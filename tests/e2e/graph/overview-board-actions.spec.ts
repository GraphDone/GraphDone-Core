import { test, expect } from '@playwright/test';
import { login, TEST_USERS } from '../../lib/auth';

for (const viewport of [{ width: 360, height: 640 }, { width: 844, height: 390 }]) {
  test(`overview and board open work directly ${viewport.width} @responsive`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await login(page, TEST_USERS.ADMIN);
    await page.evaluate(() => localStorage.setItem('graphdone:viewMode', 'dashboard'));
    await page.goto('/');
    const openWork = page.getByRole('button', { name: /^Open / }).first();
    await expect(openWork).toBeVisible();
    await page.screenshot({ path: `test-artifacts/overview-simple-${viewport.width}.png` });
    await openWork.click();
    await expect(page.getByRole('dialog', { name: 'Work item details', exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await page.evaluate(() => localStorage.setItem('graphdone:viewMode', 'kanban'));
    await page.goto('/');
    await expect(page.getByLabel('Show empty lanes')).not.toBeChecked();
    const card = page.getByRole('button', { name: /^Edit / }).first();
    await expect(card).toBeVisible();
    await card.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog', { name: 'Work item details', exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await page.getByLabel('Show empty lanes').check();
    await expect(page.getByText('0 tasks', { exact: true }).first()).toBeVisible();
  });
}
