import { test, expect } from '@playwright/test';
import { login, TEST_USERS } from '../../lib/auth';

/**
 * Mobile touch overhaul (#29). On a phone the graph defaults to LOCKED (touch
 * pans the canvas), but a single TAP on a node must still open it — the primary
 * way to inspect/edit on touch. Verifies tap-to-open works under a real touch
 * context (not a synthetic mouse click).
 */
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

test.describe('mobile graph touch @mobile @touch', () => {
  test('single tap on a node opens the inspector (even while locked)', async ({ page }) => {
    test.setTimeout(90000);
    await login(page, TEST_USERS.ADMIN);
    // Land deterministically on the graph view.
    await page.evaluate(() => localStorage.setItem('graphdone:viewMode', 'graph'));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.node-bg', { timeout: 30000 });
    await page.waitForTimeout(4000); // let physics settle

    // The graph starts locked on a phone (pan-by-touch is the default nav).
    const lock = page.getByTestId('graph-lock-toggle');
    await expect(lock).toBeVisible();

    // Inspector is not open yet.
    await expect(page.getByTestId('node-inspector')).toHaveCount(0);

    // A real touch TAP on a node card opens the inspector.
    await page.locator('.node-bg').first().tap();
    await expect(page.getByTestId('node-inspector')).toBeVisible({ timeout: 8000 });
  });
});
