import { test, expect, Page } from '@playwright/test';
import { login, TEST_USERS } from '../helpers/auth';

/**
 * Minimap wheel/pinch zoom: a wheel over the minimap zooms the MAIN view
 * (centered on the gesture point). Asserts the main view's zoom scale changes.
 */
const GRAPH_ID = 'subgraph-power-shared';

async function mainScale(page: Page): Promise<number> {
  return page.evaluate(() => {
    const g = document.querySelector('.graph-container svg .main-graph-group') as SVGGElement | null;
    const t = g?.getAttribute('transform') || '';
    const m = /scale\(([-0-9.]+)/.exec(t);
    return m ? parseFloat(m[1]) : 1;
  });
}

test.describe('minimap zoom diagnostic @geometry', () => {
  test.describe.configure({ timeout: 120_000 });

  test('wheel on the minimap changes the main view zoom', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page, TEST_USERS.ADMIN);
    await page.waitForTimeout(1500);
    await page.evaluate((gid) => {
      localStorage.setItem('currentGraphId', gid);
      localStorage.setItem('graphdone.quality.override', 'HIGH');
    }, GRAPH_ID);
    await page.reload();
    await page.waitForTimeout(6000);

    const mini = page.locator('[data-testid="mini-map"]');
    await mini.waitFor({ timeout: 15000 });
    const box = await mini.boundingBox();
    expect(box, 'minimap is visible').not.toBeNull();

    const cx = box!.x + box!.width / 2;
    const cy = box!.y + box!.height / 2;
    await page.mouse.move(cx, cy);
    const before = await mainScale(page);

    // Zoom IN: real (trusted) wheel events at the minimap centre.
    for (let i = 0; i < 3; i++) { await page.mouse.wheel(0, -120); await page.waitForTimeout(250); }
    await page.waitForTimeout(400);
    const afterIn = await mainScale(page);

    // Zoom OUT.
    for (let i = 0; i < 4; i++) { await page.mouse.wheel(0, 120); await page.waitForTimeout(250); }
    await page.waitForTimeout(400);
    const afterOut = await mainScale(page);

    // eslint-disable-next-line no-console
    console.log(`[minimap-zoom] before=${before} afterIn=${afterIn} afterOut=${afterOut}`);
    expect(afterIn, 'wheel-in increases main zoom').toBeGreaterThan(before);
    expect(afterOut, 'wheel-out decreases zoom below the zoomed-in level').toBeLessThan(afterIn);
  });
});
