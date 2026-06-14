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

  // Sample until the simulation reaches rest (or budget elapses).
  let settleMs: number | null = null;
  let last: any = null;
  const settleStart = Date.now();
  while (Date.now() - settleStart < SETTLE_BUDGET_MS) {
    last = await page.evaluate(() => (window as any).__graphPerf ?? null);
    if (last && typeof last.alpha === 'number' && last.alpha <= REST_ALPHA) {
      settleMs = Date.now() - settleStart;
      break;
    }
    await page.waitForTimeout(500);
  }
  // One more read so spatial/drift reflects the settled state.
  last = (await page.evaluate(() => (window as any).__graphPerf ?? null)) ?? last ?? {};

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

      const seeded = await seedLargeGraph(page, { size });
      try {
        for (const quality of QUALITIES) {
          const result = await measure(page, seeded.graphId, size, quality);
          result.seededEdges = seeded.edgeCount;
          fs.mkdirSync(OUT_DIR, { recursive: true });
          fs.writeFileSync(path.join(OUT_DIR, `${size}n-${quality}.json`), JSON.stringify(result, null, 2));
          // Console line so a headless run is legible without the report.
          // eslint-disable-next-line no-console
          console.log(
            `[scale] ${size}n/${quality}: rendered ${result.renderedNodes}n/${result.renderedEdges}e ` +
              `load=${result.loadMs}ms settle=${result.settleMs ?? 'NONE'}ms ` +
              `tick=${result.avgTickMs}ms fps=${result.fps} drift=${result.rmsFromSavedPx}px qP95=${result.queryP95Ms}ms`
          );
          // Sanity: the seeded graph must actually render. (Report-only otherwise.)
          expect(result.renderedNodes, `graph of ${size} nodes must render some nodes`).toBeGreaterThan(0);
        }
      } finally {
        await deleteGraphDeep(page, seeded.graphId);
      }
    });
  }
});
