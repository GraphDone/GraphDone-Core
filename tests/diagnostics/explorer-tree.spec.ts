import { test, expect } from '@playwright/test';
import { login, TEST_USERS } from '../helpers/auth';

/**
 * Project-explorer hierarchy: the graph selector expands a parent graph
 * ("System Overview") to reveal its sub-graphs, and selecting a sub-graph
 * switches the current graph. Needs the hierarchy demo seeded.
 */
test.describe('explorer tree diagnostic @geometry', () => {
  test.describe.configure({ timeout: 120_000 });

  test('expand System Overview → sub-graphs appear → select one switches graph', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page, TEST_USERS.ADMIN);
    await page.waitForTimeout(2500);

    // Open the graph selector.
    await page.locator('[data-testid="graph-selector"]').click();
    await page.waitForTimeout(500);

    // Expand the "System Overview" parent (its chevron has a "sub-graphs" title).
    const expander = page.locator('button[title$="sub-graphs"]').first();
    await expander.waitFor({ timeout: 10000 });
    await expander.click();
    await page.waitForTimeout(500);

    // A sub-graph row should now be visible.
    const child = page.getByRole('button', { name: /Compute Core/ });
    await expect(child.first(), 'sub-graph row appears under the overview').toBeVisible();

    // Selecting it switches the current graph.
    await child.first().click();
    await page.waitForTimeout(3000);
    const current = await page.evaluate(() => localStorage.getItem('currentGraphId'));
    // eslint-disable-next-line no-console
    console.log('[explorer-tree] currentGraphId after select = ' + current);
    expect(current, 'selecting a sub-graph switches to it').toBe('subgraph-compute-shared');
  });
});
