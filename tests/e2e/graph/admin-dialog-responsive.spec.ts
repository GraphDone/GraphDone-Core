import { test, expect } from '@playwright/test';
import { login, TEST_USERS } from '../../lib/auth';

for (const viewport of [{ width: 360, height: 640 }, { width: 844, height: 390 }, { width: 1440, height: 900 }]) {
  test(`admin form stays reachable ${viewport.width} @responsive`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await login(page, TEST_USERS.ADMIN);
    await page.goto('/admin');
    await page.getByRole('button', { name: 'Users', exact: true }).click();
    await page.getByRole('button', { name: 'Create User', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Create new user' });
    await expect(dialog).toBeVisible();
    const bounds = (await dialog.boundingBox())!;
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.y).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height);
    await expect(dialog.getByLabel('Email', { exact: true })).toBeFocused();
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: `test-artifacts/admin-form-${viewport.width}.png` });
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Create User', exact: true })).toBeFocused();
  });
}
