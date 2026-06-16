import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { login, TEST_USERS } from '../helpers/auth';

/**
 * Altium-style "graphs of graphs" navigation: from the System Overview, a
 * sheet-symbol node drills into its sub-graph; a breadcrumb ascends back. Needs
 * the hierarchy demo seeded (`npm run create-hierarchy-demo`). Report-only
 * screenshots + hard assertions on descend/ascend.
 */
const OUT = path.resolve(process.cwd(), 'test-artifacts/hierarchy');
const OVERVIEW_ID = 'overview-graph-shared';

async function openOverview(page: Page) {
  await page.evaluate((gid) => {
    localStorage.setItem('currentGraphId', gid);
    localStorage.setItem('graphdone.quality.override', 'HIGH');
  }, OVERVIEW_ID);
  await page.reload();
  await page.waitForTimeout(6000);
}

async function readState(page: Page) {
  return page.evaluate(() => {
    const nodes = [...document.querySelectorAll('.graph-container svg .node')];
    const sheets = nodes.filter((n) => (n as any).__data__?.subgraphId);
    return {
      currentGraphId: localStorage.getItem('currentGraphId'),
      nodeCount: nodes.length,
      sheetCount: sheets.length,
      firstSheetSubgraphId: (sheets[0] as any)?.__data__?.subgraphId ?? null,
    };
  });
}

test.describe('hierarchy navigation @geometry', () => {
  test.describe.configure({ timeout: 150_000 });

  test('descend into a sheet symbol, ascend via breadcrumb', async ({ page }) => {
    fs.mkdirSync(OUT, { recursive: true });
    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page, TEST_USERS.ADMIN);
    await page.waitForTimeout(1500);
    await openOverview(page);

    // Overview should render sheet-symbol nodes (each with a subgraphId).
    const overview = await readState(page);
    await page.screenshot({ path: path.join(OUT, '1-overview.png') });
    // eslint-disable-next-line no-console
    console.log('[hierarchy] overview ' + JSON.stringify(overview));
    expect(overview.currentGraphId, 'on the overview graph').toBe(OVERVIEW_ID);
    expect(overview.sheetCount, 'overview has sheet-symbol nodes').toBeGreaterThan(0);

    // Descend: click a sheet node's DESCEND glyph (plain card-click now selects
    // for the inspector; descending is the explicit ⤢ glyph or inspector Open).
    const targetSubgraphId = overview.firstSheetSubgraphId as string;
    await page.evaluate(() => {
      const sheet = [...document.querySelectorAll('.graph-container svg .node')].find(
        (n) => (n as any).__data__?.subgraphId
      ) as SVGGElement | undefined;
      const glyph = sheet?.querySelector('.node-descend-icon') as Element | undefined;
      (glyph as any)?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await page.waitForTimeout(5000);

    const descended = await readState(page);
    await page.screenshot({ path: path.join(OUT, '2-descended.png') });
    // eslint-disable-next-line no-console
    console.log('[hierarchy] descended ' + JSON.stringify(descended));
    expect(descended.currentGraphId, 'descended into the sheet sub-graph').toBe(targetSubgraphId);
    expect(descended.nodeCount, 'sub-graph rendered its own nodes').toBeGreaterThan(0);

    // Breadcrumb shows two crumbs (overview / sub-graph).
    const crumbs = await page.locator('[data-testid="graph-breadcrumb"]').count();
    expect(crumbs, 'breadcrumb is shown after descending').toBe(1);

    // Ascend via the "Up" button.
    await page.locator('[data-testid="graph-breadcrumb"] button', { hasText: 'Up' }).click();
    await page.waitForTimeout(4000);
    const ascended = await readState(page);
    await page.screenshot({ path: path.join(OUT, '3-ascended.png') });
    // eslint-disable-next-line no-console
    console.log('[hierarchy] ascended ' + JSON.stringify(ascended));
    expect(ascended.currentGraphId, 'back on the overview after Up').toBe(OVERVIEW_ID);

    fs.writeFileSync(
      path.join(OUT, 'report.json'),
      JSON.stringify({ overview, descended, ascended }, null, 2)
    );
  });
});
