import { test, expect, Page } from '@playwright/test';
import { login, TEST_USERS } from '../helpers/auth';

/**
 * Docked inspector: selecting a node opens it; Contents renders its description
 * as readable markdown; Diagram renders the sub-graph; modes switch explicitly
 * (not via zoom). Needs the hierarchy demo seeded (System Overview).
 */
const OVERVIEW_ID = 'overview-graph-shared';

async function openOverview(page: Page) {
  await page.evaluate((gid) => {
    localStorage.setItem('currentGraphId', gid);
    localStorage.setItem('graphdone.quality.override', 'HIGH');
  }, OVERVIEW_ID);
  await page.reload();
  await page.waitForTimeout(6000);
}

test.describe('node inspector diagnostic @geometry', () => {
  test.describe.configure({ timeout: 120_000 });

  test('select node → inspector Contents + Diagram + Card modes', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page, TEST_USERS.ADMIN);
    await page.waitForTimeout(1500);
    await openOverview(page);

    // Plain-click a sheet node's card → it SELECTS (no longer descends).
    const box = await page.evaluate(() => {
      const sheet = [...document.querySelectorAll('.graph-container svg .node')].find(
        (n) => (n as any).__data__?.subgraphId
      ) as SVGGElement | undefined;
      const bg = sheet?.querySelector('.node-bg') as Element | undefined;
      if (!bg) return null;
      const r = bg.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    expect(box, 'found a sheet node on screen').not.toBeNull();
    await page.mouse.click(box!.x, box!.y);
    await page.waitForTimeout(1800);

    const inspector = page.locator('[data-testid="node-inspector"]');
    await expect(inspector, 'inspector opens on node select').toBeVisible({ timeout: 8000 });

    // Contents (default for a node with a description) renders markdown.
    const contents = page.locator('[data-testid="node-content-rendered"]');
    await expect(contents, 'Contents renders the description').toBeVisible({ timeout: 8000 });
    const contentsText = await contents.innerText();
    expect(contentsText.length, 'contents has readable text').toBeGreaterThan(5);

    // Switch to Diagram → static sub-graph preview renders.
    await inspector.getByRole('button', { name: 'Diagram' }).click();
    await page.waitForTimeout(2000);
    // eslint-disable-next-line no-console
    console.log('[node-inspector] diagram pane: ' + (await inspector.innerText()).slice(0, 160).replace(/\n/g, ' '));
    await expect(page.locator('[data-testid="subgraph-preview"]'), 'Diagram renders the sub-graph').toBeVisible({ timeout: 15000 });

    // Switch to Card → summary rows.
    await inspector.getByRole('button', { name: 'Card' }).click();
    await expect(inspector.getByText('Type', { exact: true }), 'Card shows the summary').toBeVisible({ timeout: 5000 });

    // Legibility independent of zoom: zoom the canvas way out, inspector text stays.
    await page.mouse.move(400, 400);
    for (let i = 0; i < 5; i++) { await page.mouse.wheel(0, 240); await page.waitForTimeout(100); }
    await inspector.getByRole('button', { name: 'Contents', exact: true }).click();
    await expect(page.locator('[data-testid="node-content-rendered"]'), 'contents readable regardless of zoom').toBeVisible();

    // eslint-disable-next-line no-console
    console.log('[node-inspector] ok — inspector + Contents/Diagram/Card verified');
  });
});
