import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { login, TEST_USERS } from '../helpers/auth';

/**
 * Physics-lifecycle diagnostic — proves the one-shot model: a graph settles,
 * then the simulation goes IDLE and stays idle (no continuous drift), and the
 * manual Organize reflow re-settles a piled graph. Captures the full metric
 * time series (window.__layoutMetrics) so the behaviour can be studied deeply
 * and skeptically. Report-only; needs the hierarchy demo seeded.
 */
const OUT = path.resolve(process.cwd(), 'test-artifacts/physics');
// A mid-size sub-graph (varies the load); change via env if desired.
const GRAPH_ID = process.env.PHYS_GRAPH_ID || 'subgraph-power-shared';

async function openGraph(page: Page, id: string) {
  await page.evaluate((gid) => {
    localStorage.setItem('currentGraphId', gid);
    localStorage.setItem('graphdone.quality.override', 'HIGH');
  }, id);
  await page.reload();
  await page.waitForTimeout(6000);
}

async function metrics(page: Page) {
  return page.evaluate(() => (window as any).__layoutMetrics?.() ?? null);
}

async function sampleSeries(page: Page, label: string, seconds: number) {
  const series: any[] = [];
  for (let i = 0; i < seconds; i++) {
    series.push({ t: i, ...(await metrics(page)) });
    await page.waitForTimeout(1000);
  }
  // eslint-disable-next-line no-console
  console.log(`[physics ${label}] ` + JSON.stringify(series[series.length - 1]));
  return series;
}

test.describe('physics settle diagnostic @geometry', () => {
  test.describe.configure({ timeout: 180_000 });

  test('graph settles then stays idle (no drift); Organize reflows', async ({ page }) => {
    fs.mkdirSync(OUT, { recursive: true });
    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page, TEST_USERS.ADMIN);
    await page.waitForTimeout(1500);
    await openGraph(page, GRAPH_ID);

    // After the initial settle, sample for 8s: the sim must be IDLE and nodes
    // must NOT keep moving (the perpetual-reheat bug would show movingNodes>0).
    const settleSeries = await sampleSeries(page, 'settled', 8);
    const last4 = settleSeries.slice(-4);
    const maxMoving = Math.max(...last4.map((s) => s.drift?.movingNodes ?? 0));
    const anyRunning = last4.some((s) => s.simRunning);

    // Organize: reflow a (possibly piled) graph with physics, then it settles
    // and STOPS. Poll the live signals (alpha-based atRest + true overlap) — the
    // drift field goes stale once the sim stops ticking, so don't rely on it.
    await page.evaluate(() => (window as any).__organizeGraph?.());
    const organizeSeries: any[] = [];
    let lastAfter: any = null;
    for (let i = 0; i < 30; i++) {
      await page.waitForTimeout(1000);
      lastAfter = await metrics(page);
      organizeSeries.push({ t: i, ...lastAfter });
      if (lastAfter?.atRest && i >= 2) break; // settled + stopped
    }
    // eslint-disable-next-line no-console
    console.log('[physics after-organize] ' + JSON.stringify(lastAfter));

    const report = {
      graphId: GRAPH_ID,
      settleSeries,
      organizeSeries,
      summary: {
        idleAfterSettle: !anyRunning,
        maxMovingNodesLast4s: maxMoving,
        overlapBefore: settleSeries[settleSeries.length - 1]?.overlappingNodePairs,
        overlapAfterOrganize: lastAfter?.overlappingNodePairs,
        labelOverlapAfter: lastAfter?.overlappingLabelPairs,
        settledAndStopped: lastAfter?.atRest,
        settleSeconds: organizeSeries.length,
        lastSettleMs: lastAfter?.lastSettleMs,
      },
    };
    fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
    // eslint-disable-next-line no-console
    console.log('[physics] summary ' + JSON.stringify(report.summary));

    // No continuous drift after the initial settle (the poll-reheat fix).
    expect(maxMoving, 'no continuous drift: nodes stop moving after settle').toBeLessThanOrEqual(1);
    expect(anyRunning, 'simulation is idle after settle (not reheating)').toBe(false);
    // Organize lays the graph out CLEAN (zero true card overlaps) and the sim
    // comes to a full STOP (one-shot physics, then disabled).
    expect(lastAfter.overlappingNodePairs, 'Organize settles to zero card overlaps').toBe(0);
    expect(lastAfter.atRest, 'simulation reaches rest (stops) after Organize').toBe(true);
  });
});
