import { test, expect } from '@playwright/test';
import { getBaseURL } from '../lib/auth';

/**
 * Passwordless sign-in focus order (@loginfocus). When the user switches to the
 * Passwordless (magic-link) method, the cursor must land in the EMAIL field if
 * no email has been entered yet — NOT in the captcha (the captcha used to steal
 * focus on mount). If an email is already present, focus jumps ahead to the
 * captcha. Reported by a user dogfooding the live login page.
 */

test.describe('passwordless login focus order @loginfocus', () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test.describe.configure({ timeout: 60_000 });

  test('empty email → email field is focused first', async ({ page }) => {
    await page.goto(`${getBaseURL()}/login`, { waitUntil: 'domcontentloaded' });
    await page.locator('button:has-text("Passwordless")').click();
    await expect(page.locator('#magicLinkEmail')).toBeFocused();
    await expect(page.locator('#captcha-input')).not.toBeFocused();
  });

  test('email already present → captcha is focused on re-entry', async ({ page }) => {
    await page.goto(`${getBaseURL()}/login`, { waitUntil: 'domcontentloaded' });
    await page.locator('button:has-text("Passwordless")').click();
    await page.locator('#magicLinkEmail').fill('dogfood@example.com');
    // Leave and re-enter passwordless mode; the email value persists.
    await page.locator('button:has-text("Password")').first().click();
    await page.locator('button:has-text("Passwordless")').click();
    await expect(page.locator('#captcha-input')).toBeFocused();
  });
});
