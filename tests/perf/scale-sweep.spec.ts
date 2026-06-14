import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { login, TEST_USERS } from '../helpers/auth';
import { seedLargeGraph, deleteGraphDeep } from '../helpers/seedGraph';
import '../helpers/testEnv';
import { envIntList, envList } from '../helpers/testEnv';

/**
 * Large-scale graph creation + performance metric sweep. Seeds real graphs of
 * increasing size through the GraphQL API, loads each in the browser at one or
 * more quality tiers, and records the in-app PerfMeter/DriftMeter readings
 * (window.__graphPerf) plus settle time, load time, and query latency.
 *
 * Report-only: writes one JSON per (size, quality) under
 * test-artifacts/scale-sweep/, which `npm run report:perf` renders into a table
 * + charts. It does NOT fail on thresholds — the goal is a metric sweep, not a
 * gate (the @perf budgets spec is the gate). The only hard assertion is that a
 * seeded graph actually renders, so a silent breakage still surfaces.
 *
 * Sizes/qualities come from env (.env.test.local) so you can push it hard
 * locally; CI uses a small set just to keep the harness honest.
 */

const SIZES = (() => {
  const fromEnv = envIntList('SCALE_SWEEP_SIZES');
  if (fromEnv.length) return fromEnv;
  return process.env.CI ? [40, 120] : [50, 200, 500, 1000, 2000];
})();

const QUALITIES = (() => {
  const fromEnv = envList('SCALE_SWEEP_QUALITIES').map((q) => q.toUpperCase());
  const valid = fromEnv.filter((q) => ['LOW', 'MEDIUM', 'HIGH', 'ULTRA'].includes(q));
  if (valid.length) return valid;
  return process.env.CI ? ['HIGH'] : ['HIGH', 'ULTRA'];
})();

const OUT_DIR = path.resolve(process.cwd(), 'test-artifacts/scale-sweep');
const SETTLE_BUDGET_MS = 30_000;
const REST_ALPHA = 0.02;

interface SweepResult {
  size: number;
  quality: string;
  seededNodes: number;
  seededEdges: number;
  renderedNodes: number;
  renderedEdges: number;
  loadMs: number; // time from reload to first node painted
  interactionFps: number; // RELIABLE: rendered frames/sec while dragging the graph
  settleMs: number | null; // time to reach REST_ALPHA (null = never settled within budget)
  finalAlpha: number;
  avgTickMs: number;
  p95TickMs: number;
  fps: number;
  droppedFrames: number;
  rmsFromSavedPx: number;
  maxStepPx: number;
  queryP95Ms: number;
  timestampISO: string;
}

async function measure(page: Page, graphId: string, size: number, quality: string): Promise<SweepResult> {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.evaluate(
    ({ gid, q }) => {
      localStorage.setItem('currentGraphId', gid);
      localStorage.setItem('graphdone.quality.override', q);
    },
    { gid: graphId, q: quality }
  );

  const t0 = Date.now();
  await page.reload();
  // Load time = first node painted.
  await page.locator('.graph-container svg .node').first().waitFor({ timeout: 60_000 }).catch(() => {});
  const loadMs = Date.now() - t0;

  // Seeded nodes carry saved grid positions, so the app pins them and the force
  // sim sits idle — PerfMeter (window.__graphPerf, published only every ~2s
  // WHILE ticking) then never reports. We hold a node and drag it continuously
  // for a few seconds: d3 keeps alphaTarget>0 while dragging, so the sim ticks
  // the whole time and the meter publishes real UNDER-INTERACTION samples (tick
  // cost / fps at this scale — a realistic "dragging a big graph" metric). We
  // keep the best (lowest-tick) live sample, then release and time the settle.
  const box = await page.evaluate(() => {
    const n = document.querySelector('.graph-container svg .node .node-bg') as Element | null;
    if (!n) return null;
    const r = n.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });

  // Reliable interaction FPS: count real rendered frames (requestAnimationFrame)
  // over a fixed wall-clock window while dragging. This needs no app
  // instrumentation, so it works at every size — when the main thread is busy
  // ticking a huge sim, rAF visibly drops, which is exactly the scaling signal.
  let lastNonNull: any = null;
  const samples: any[] = [];
  let interactionFps = -1;
  if (box) {
    await page.evaluate(() => {
      (window as any).__fc = 0;
      const loop = () => { (window as any).__fc++; (window as any).__rafId = requestAnimationFrame(loop); };
      (window as any).__rafId = requestAnimationFrame(loop);
    });
    await page.mouse.move(box.x, box.y).catch(() => {});
    await page.mouse.down().catch(() => {});
    const dragStart = Date.now();
    let a = 0;
    while (Date.now() - dragStart < 6000) {
      a += 0.6;
      await page.mouse.move(box.x + Math.cos(a) * 70, box.y + Math.sin(a) * 55).catch(() => {});
      await page.waitForTimeout(120);
      const cur = await page.evaluate(() => (window as any).__graphPerf ?? null);
      if (cur) { lastNonNull = cur; samples.push(cur); }
    }
    await page.mouse.up().catch(() => {});
    const frames = await page.evaluate(() => { cancelAnimationFrame((window as any).__rafId); return (window as any).__fc || 0; });
    const secs = (Date.now() - dragStart) / 1000;
    interactionFps = Math.round((frames / secs) * 10) / 10;
  }

  // Now measure how long it takes to come to rest after the perturbation.
  let settleMs: number | null = null;
  const settleStart = Date.now();
  while (Date.now() - settleStart < SETTLE_BUDGET_MS) {
    const cur = await page.evaluate(() => (window as any).__graphPerf ?? null);
    if (cur) {
      lastNonNull = cur;
      if (typeof cur.alpha === 'number' && cur.alpha <= REST_ALPHA) {
        settleMs = Date.now() - settleStart;
        break;
      }
    }
    await page.waitForTimeout(300);
  }
  // Prefer the worst (max) tick seen under interaction — that's the real cost at
  // scale; a single settled sample understates it.
  const underLoad = samples.length
    ? samples.reduce((w, s) => ((s.avgTickMs ?? 0) > (w.avgTickMs ?? 0) ? s : w))
    : null;
  const last = underLoad ?? (await page.evaluate(() => (window as any).__graphPerf ?? null)) ?? lastNonNull ?? {};

  const renderedNodes = await page.locator('.graph-container svg .node').count();
  const renderedEdges = await page.locator('.graph-container svg .edge').count();

  // Query latency a human/AI would feel: a graph-scoped workItems fetch.
  const queryP95Ms = await page.evaluate(async (gid) => {
    const token = localStorage.getItem('authToken') ?? '';
    const times: number[] = [];
    for (let i = 0; i < 10; i++) {
      const s = performance.now();
      await fetch('/api/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          query: `query($w: WorkItemWhere) { workItems(where: $w, options: { limit: 5000 }) { id status type priority } }`,
          variables: { w: { graph: { id: gid } } },
        }),
      }).then((r) => r.json());
      times.push(performance.now() - s);
    }
    times.sort((a, b) => a - b);
    return Math.round(times[Math.floor(times.length * 0.95)] ?? times[times.length - 1]);
  }, graphId);

  const spatial = last?.spatial ?? {};
  fs.mkdirSync(OUT_DIR, { recursive: true });
  await page.screenshot({ path: path.join(OUT_DIR, `${size}n-${quality}.png`), fullPage: false }).catch(() => {});

  return {
    size,
    quality,
    seededNodes: size,
    seededEdges: 0, // filled by caller
    renderedNodes,
    renderedEdges,
    loadMs,
    interactionFps,
    settleMs,
    finalAlpha: typeof last?.alpha === 'number' ? last.alpha : -1,
    avgTickMs: last?.avgTickMs ?? -1,
    p95TickMs: last?.p95TickMs ?? -1,
    fps: last?.fps ?? -1,
    droppedFrames: last?.droppedFrames ?? -1,
    rmsFromSavedPx: spatial.rmsFromSavedPx ?? -1,
    maxStepPx: spatial.maxStepPx ?? -1,
    queryP95Ms,
    timestampISO: new Date(t0).toISOString(),
  };
}

test.describe('large-scale graph perf sweep @scale', () => {
  test.describe.configure({ mode: 'serial', timeout: 600_000 });

  for (const size of SIZES) {
    test(`sweep ${size} nodes`, async ({ page }) => {
      await login(page, TEST_USERS.ADMIN);
      await page.waitForTimeout(1500);

      // A FRESH graph per (size, quality): otherwise the second quality loads
      // the first run's already-settled positions, the sim never ticks, and
      // PerfMeter never publishes (the -1 / settle=NONE gaps in v1).
      for (const quality of QUALITIES) {
        const seeded = await seedLargeGraph(page, { size });
        try {
          const result = await measure(page, seeded.graphId, size, quality);
          result.seededEdges = seeded.edgeCount;
          fs.mkdirSync(OUT_DIR, { recursive: true });
          fs.writeFileSync(path.join(OUT_DIR, `${size}n-${quality}.json`), JSON.stringify(result, null, 2));
          // eslint-disable-next-line no-console
          console.log(
            `[scale] ${size}n/${quality}: rendered ${result.renderedNodes}n/${result.renderedEdges}e ` +
              `load=${result.loadMs}ms dragFps=${result.interactionFps} settle=${result.settleMs ?? 'NONE'}ms ` +
              `tick=${result.avgTickMs}ms qP95=${result.queryP95Ms}ms`
          );
          expect(result.renderedNodes, `graph of ${size} nodes must render some nodes`).toBeGreaterThan(0);
        } finally {
          await deleteGraphDeep(page, seeded.graphId);
        }
      }
    });
  }
});
