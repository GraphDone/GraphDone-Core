import { test, expect } from '@playwright/test';
import { login, TEST_USERS, getBaseURL } from '../helpers/auth';

/**
 * Click-to-copy node id (@copyid, #23): the node inspector shows a short id chip;
 * clicking it copies the full id and flashes a transient "Copied!" confirmation.
 */
test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

test('node inspector id chip copies and confirms @copyid', async ({ page }) => {
  test.setTimeout(90_000);
  await page.addInitScript(() => localStorage.setItem('graphdone:viewMode', 'graph'));
  await login(page, TEST_USERS.ADMIN);
  await page.goto(`${getBaseURL()}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.graph-container svg .node', { timeout: 15_000 });
  await page.waitForTimeout(3500);

  // Select a node → docked inspector opens.
  await page.locator('.graph-container svg .node').first().click();
  const chip = page.locator('[data-testid="copyable-id"]').first();
  await expect(chip).toBeVisible({ timeout: 8000 });

  await chip.click();
  // Flashes "Copied!" on success.
  await expect(chip.getByText('Copied!')).toBeVisible({ timeout: 4000 });

  // And the clipboard actually holds a non-trivial id.
  const clip = await page.evaluate(() => navigator.clipboard.readText().catch(() => ''));
  expect(clip.length).toBeGreaterThan(8);
});
