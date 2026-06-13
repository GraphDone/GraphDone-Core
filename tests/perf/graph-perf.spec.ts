import { test, expect, Page } from '@playwright/test';
import { login, TEST_USERS } from '../helpers/auth';

/**
 * Runtime performance budgets (ADAPT-8). Numbers come from the in-app
 * PerfMeter/DriftMeter (window.__graphPerf), so they reflect what the app
 * actually measures, not a synthetic proxy. Budgets are generous v1 values —
 * tighten as the perf harness grows (large reference graphs, throttling).
 */

const SETTLE_MS = 12_000;       // graph must reach rest within this after load
const REST_ALPHA = 0.02;        // d3 alpha considered "at rest"
const SNAPSHOT_DRIFT_PX = 25;   // a placed graph must sit on its saved snapshot
const TICK_BUDGET_MS = 8;       // avg simulation tick budget
const CONTEXT_P95_MS = 800;     // get_graph_context p95 over the API

async function openGraph(page: Page) {
  await page.addInitScript(() => { try { localStorage.setItem('graphdone.quality.override', 'ULTRA'); } catch { /* */ } });
  await login(page, TEST_USERS.ADMIN);
  await page.waitForTimeout(4000);
  const sel = page.locator('[data-testid="graph-selector"]');
  if (await sel.isVisible().catch(() => false)) {
    await sel.click();
    await page.waitForTimeout(800);
    const c2 = page.locator('text=Cycle 2: The Living Graph').first();
    if (await c2.isVisible().catch(() => false)) { await c2.click(); await page.waitForTimeout(2000); }
    await page.keyboard.press('Escape').catch(() => {});
  }
}

test.describe('performance budgets @perf', () => {
  test('graph settles to rest within budget and tick stays cheap', async ({ page }) => {
    await openGraph(page);
    test.skip((await page.locator('.graph-container svg .node').count()) === 0, 'no graph');

    const start = Date.now();
    let perf: any = null;
    while (Date.now() - start < SETTLE_MS) {
      perf = await page.evaluate(() => (window as any).__graphPerf);
      if (perf && perf.alpha <= REST_ALPHA) break;
      await page.waitForTimeout(500);
    }
    expect(perf, 'PerfMeter is publishing').toBeTruthy();
    expect(perf.alpha, `graph should reach rest (alpha<=${REST_ALPHA}) within ${SETTLE_MS}ms`).toBeLessThanOrEqual(REST_ALPHA);
    expect(perf.avgTickMs, `avg tick should be under ${TICK_BUDGET_MS}ms`).toBeLessThanOrEqual(TICK_BUDGET_MS);
  });

  test('a settled placed graph sits on its saved snapshot (no drift)', async ({ page }) => {
    await openGraph(page);
    test.skip((await page.locator('.graph-container svg .node').count()) === 0, 'no graph');
    await page.waitForTimeout(6000); // let it settle

    const spatial = await page.evaluate(() => (window as any).__graphPerf?.spatial);
    test.skip(!spatial, 'drift metrics not available yet');
    expect(spatial.rmsFromSavedPx, `layout drift from saved snapshot under ${SNAPSHOT_DRIFT_PX}px`).toBeLessThanOrEqual(SNAPSHOT_DRIFT_PX);
  });

  test('get_graph_context p95 latency is within budget', async ({ page }) => {
    await login(page, TEST_USERS.ADMIN);
    await page.waitForTimeout(2000);
    const result = await page.evaluate(async (samples) => {
      const token = localStorage.getItem('authToken') ?? '';
      const g = await fetch('/api/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ query: '{ graphs(options: { limit: 1 }) { id } }' }),
      }).then((r) => r.json());
      const graphId = g.data?.graphs?.[0]?.id;
      if (!graphId) return { skipped: true };
      const times: number[] = [];
      for (let i = 0; i < samples; i++) {
        const t0 = performance.now();
        await fetch('/api/graphql', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            query: `query($where: WorkItemWhere) { workItems(where: $where, options: { limit: 50 }) { id title status type } }`,
            variables: { where: { graph: { id: graphId } } },
          }),
        }).then((r) => r.json());
        times.push(performance.now() - t0);
      }
      times.sort((a, b) => a - b);
      return { p95: times[Math.floor(times.length * 0.95)] ?? times[times.length - 1], n: times.length };
    }, 20);

    test.skip(!!(result as any).skipped, 'no graph to query');
    expect((result as any).p95, `graph-context-style query p95 under ${CONTEXT_P95_MS}ms`).toBeLessThanOrEqual(CONTEXT_P95_MS);
  });
});
