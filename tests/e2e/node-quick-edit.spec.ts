import { test, expect, Page } from '@playwright/test';
import { login, TEST_USERS, getBaseURL } from '../helpers/auth';

/**
 * In-context node quick-edit (@quickedit, #87): double-clicking a node opens a
 * compact popover anchored to it that edits every field — title, description,
 * type, priority, status — without the heavy details modal. Each field saves
 * immediately (optimistic) with undo.
 */
async function gotoGraph(page: Page) {
  await page.addInitScript(() => localStorage.setItem('graphdone:viewMode', 'graph'));
  await login(page, TEST_USERS.ADMIN);
  await page.goto(`${getBaseURL()}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.graph-container svg .node', { timeout: 15_000 });
  await page.waitForTimeout(3500);
}

test.describe('node quick-edit @quickedit', () => {
  test.describe.configure({ timeout: 90_000 });

  test('double-click opens a quick editor with every field', async ({ page }) => {
    await gotoGraph(page);
    await page.locator('.graph-container svg .node').first().dblclick();
    const pop = page.locator('[data-testid="node-quick-edit"]');
    await expect(pop).toBeVisible();
    for (const f of ['quick-title', 'quick-description', 'quick-type', 'quick-priority', 'quick-status']) {
      await expect(page.locator(`[data-testid="${f}"]`)).toBeVisible();
    }
    // Esc closes it.
    await page.keyboard.press('Escape');
    await expect(pop).toHaveCount(0);
  });

  test('editing the title in place persists to the graph (and reverts)', async ({ page }) => {
    await gotoGraph(page);
    const firstNode = page.locator('.graph-container svg .node').first();
    const original = (await firstNode.locator('.node-title-text').first().innerText().catch(() => '')).trim();

    await firstNode.dblclick();
    const input = page.locator('[data-testid="quick-title"]');
    await expect(input).toBeVisible();
    const marker = `QE-${Date.now() % 100000}`;
    await input.fill(marker);
    await input.blur();
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1200); // mutation + graph refresh

    // The graph should now show the new title somewhere.
    await expect(page.locator('.graph-container svg').getByText(marker, { exact: false }).first()).toBeVisible({ timeout: 8000 });

    // Revert so the seed data is unchanged.
    if (original) {
      await page.locator('.graph-container svg .node', { hasText: marker }).first().dblclick().catch(async () => {
        await page.locator('.graph-container svg .node').first().dblclick();
      });
      const input2 = page.locator('[data-testid="quick-title"]');
      await input2.fill(original);
      await input2.blur();
      await page.keyboard.press('Escape');
      await page.waitForTimeout(800);
    }
  });
});
