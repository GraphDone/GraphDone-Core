import { test, expect } from '@playwright/test';
import { login, TEST_USERS, getBaseURL } from '../../lib/auth';
import { auditDialog } from '../../lib/mobileAudit';

/**
 * Automated dialog sweep — opens the modals a phone user actually hits and
 * verifies each fits the viewport AND is painted on top (not clipped by / under
 * the bottom nav). Catches the stacking-context bug class (a modal trapped in a
 * z-20 ancestor losing to the z-30 nav). Tagged @audit.
 */
test.use({ viewport: { width: 390, height: 844 } });

async function openListView(page: import('@playwright/test').Page) {
  await login(page, TEST_USERS.ADMIN);
  await page.evaluate(() => localStorage.setItem('graphdone:viewMode', 'cards'));
  await page.goto(`${getBaseURL()}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
}

test.describe('mobile dialogs fit the screen and sit above the nav @audit', () => {
  test('work-item edit modal (tap a list card)', async ({ page }) => {
    await openListView(page);
    await page.locator('[data-testid="view-content"] .grid > div').first().click();
    await page.waitForTimeout(1200);
    const d = await auditDialog(page, 'Work Item Details');
    expect(d.found, 'edit modal opened').toBe(true);
    expect(d.fitsWidth, 'edit modal fits viewport width').toBe(true);
    expect(d.fitsHeight, 'edit modal fits viewport height').toBe(true);
    expect(d.coveredBy, 'edit modal is on top (nothing painted over it)').toBeNull();
  });

  test('create-work-item modal (the + FAB)', async ({ page }) => {
    await openListView(page);
    await page.locator('[aria-label="New work item"]').click();
    await page.waitForTimeout(1200);
    const d = await auditDialog(page, 'Create New Work Item');
    expect(d.found, 'create modal opened').toBe(true);
    expect(d.fitsWidth, 'create modal fits viewport width').toBe(true);
    expect(d.fitsHeight, 'create modal fits viewport height').toBe(true);
    expect(d.coveredBy, 'create modal is on top (nothing painted over it)').toBeNull();
  });
});
