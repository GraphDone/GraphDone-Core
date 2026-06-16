import { test, expect } from '@playwright/test';
import { login, TEST_USERS } from '../helpers/auth';

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

  test('all eight view tabs stay reachable and the graph view is mobile-clean', async ({ page }) => {
    await login(page, TEST_USERS.ADMIN);
    await page.waitForTimeout(1500);

    // Every view tab must exist and be clickable (the strip scrolls, never clips).
    const tabTitles = [
      'Graph View', 'Dashboard View', 'Table View', 'Card View',
      'Kanban View', 'Gantt Chart', 'Calendar View', 'Activity Feed',
    ];
    for (const title of tabTitles) {
      const tab = page.locator(`button[title="${title}"]`);
      await expect(tab, `${title} tab present`).toHaveCount(1);
    }

    // Switch to the graph view and verify the mobile-clean treatment.
    const graphTab = page.locator('button[title="Graph View"]');
    await graphTab.scrollIntoViewIfNeeded();
    await graphTab.click();
    await page.waitForTimeout(3000);

    // Minimap is hidden on mobile (it covered ~18% of the screen).
    await expect(page.getByText('Mini-Map', { exact: true })).toHaveCount(0);
    // No connection banner while the GraphQL data layer is healthy.
    await expect(page.getByText('Connection Lost', { exact: true })).toHaveCount(0);
  });
});
