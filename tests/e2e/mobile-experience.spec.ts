import { test, expect } from '@playwright/test';
import { login, TEST_USERS } from '../lib/auth';

/**
 * Mobile experience contract. A phone-sized screen should land on a readable
 * list view (not the graph), keep chrome slim, surface no Neo4j/DB-down strings
 * (the app is D1-first / Neo4j-optional), and never overflow the viewport width.
 */
test.use({ viewport: { width: 390, height: 844 } });

test.describe('mobile experience @mobile', () => {
  test('phone lands on a readable list view, not the graph, with no Neo4j chrome', async ({ page }) => {
    await login(page, TEST_USERS.ADMIN);

    // Deterministic default: forget any persisted choice, then re-mount at phone width.
    await page.evaluate(() => localStorage.removeItem('graphdone:viewMode'));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    // 1) Default view is a list (its search/filter toolbar renders only for
    //    table/cards/kanban) and the graph canvas is NOT the mobile default.
    await expect(page.getByPlaceholder('Search tasks by type, status, priority')).toBeVisible();
    expect(
      await page.locator('.graph-container').count(),
      'graph canvas should not be the default view on a phone'
    ).toBe(0);

    // 2) No Neo4j / DB-down chrome leaks to the user.
    const bodyText = await page.locator('body').innerText();
    expect(bodyText, 'no raw "Neo4j" string on screen').not.toMatch(/Neo4j/i);
    expect(bodyText, 'no provider-specific DB-down banner').not.toMatch(/Database Connection Lost/i);

    // 3) Nothing overflows the viewport width (view tabs, captcha, cards all fit).
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth
    );
    expect(overflow, 'no horizontal page overflow on a phone').toBeLessThanOrEqual(1);
  });

  test('bottom nav (List/Graph/More) drives the views and the graph is mobile-clean', async ({ page }) => {
    await login(page, TEST_USERS.ADMIN);
    await page.waitForTimeout(1500);

    // The phone uses a bottom tab bar, not the desktop tab strip.
    const nav = page.getByTestId('mobile-bottom-nav');
    await expect(nav, 'mobile bottom nav present').toBeVisible();
    await expect(nav.getByText('List', { exact: true })).toBeVisible();
    await expect(nav.getByText('Graph', { exact: true })).toBeVisible();
    await expect(nav.getByText('More', { exact: true })).toBeVisible();

    // More opens a sheet with the secondary views (kanban shows as "Board").
    await nav.getByText('More', { exact: true }).click();
    const sheet = page.getByTestId('mobile-more-sheet');
    for (const label of ['Dashboard', 'Table', 'Board', 'Gantt', 'Calendar', 'Activity']) {
      await expect(sheet.getByText(label, { exact: true }), `${label} in More sheet`).toBeVisible();
    }
    await page.keyboard.press('Escape').catch(() => {});
    await page.mouse.click(10, 200); // dismiss the sheet

    // Switch to the graph via the bottom nav and verify the mobile-clean treatment.
    await nav.getByText('Graph', { exact: true }).click();
    await page.waitForTimeout(3000);

    // The lock toggle defaults to "Locked" so panning never drags a node/edge.
    const lock = page.getByTestId('graph-lock-toggle');
    await expect(lock, 'graph lock toggle present on mobile').toBeVisible();
    await expect(lock).toContainText('Locked');

    // Minimap is hidden on mobile; no connection banner while GraphQL is healthy.
    await expect(page.getByText('Mini-Map', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Connection Lost', { exact: true })).toHaveCount(0);
  });
});
