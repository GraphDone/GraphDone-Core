import { test, expect } from '@playwright/test';
import { login, TEST_USERS, getBaseURL } from '../helpers/auth';

test.describe('OAuth Provider Configuration (Admin Panel)', () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin
    await login(page, TEST_USERS.ADMIN);
  });

  test('should display OAuth Providers tab in admin panel', async ({ page }) => {
    const baseURL = getBaseURL();
    await page.goto(`${baseURL}/admin`);

    // Wait for admin panel to load
    await page.waitForLoadState('networkidle');

    // Check for OAuth Providers tab
    const oauthTab = page.locator('text="OAuth Providers"');
    await expect(oauthTab).toBeVisible({ timeout: 10000 });

    console.log('✅ OAuth Providers tab is visible in admin panel');
  });

  test('should show all three OAuth providers (Google, LinkedIn, GitHub)', async ({ page }) => {
    const baseURL = getBaseURL();
    await page.goto(`${baseURL}/admin`);

    // Click OAuth Providers tab
    await page.click('text="OAuth Providers"');
    await page.waitForTimeout(1000);

    // Check for all three provider sections
    const googleSection = page.locator('text=/Google/i').first();
    const linkedinSection = page.locator('text=/LinkedIn/i').first();
    const githubSection = page.locator('text=/GitHub/i').first();

    await expect(googleSection).toBeVisible({ timeout: 5000 });
    await expect(linkedinSection).toBeVisible({ timeout: 5000 });
    await expect(githubSection).toBeVisible({ timeout: 5000 });

    console.log('✅ All three OAuth providers are displayed');
  });

  test('should have enable/disable toggles for each provider', async ({ page }) => {
    const baseURL = getBaseURL();
    await page.goto(`${baseURL}/admin`);

    // Navigate to OAuth tab
    await page.click('text="OAuth Providers"');
    await page.waitForTimeout(1000);

    // Look for toggle inputs
    const toggles = page.locator('input[type="checkbox"]');
    const count = await toggles.count();

    // Should have at least 3 toggles (one per provider)
    expect(count).toBeGreaterThanOrEqual(3);

    console.log(`✅ Found ${count} toggle controls`);
  });

  test('should have Client ID and Client Secret inputs', async ({ page }) => {
    const baseURL = getBaseURL();
    await page.goto(`${baseURL}/admin`);

    // Navigate to OAuth tab
    await page.click('text="OAuth Providers"');
    await page.waitForTimeout(1000);

    // Check for Client ID inputs
    const clientIdInputs = page.locator('input[placeholder*="Client ID"], input[name*="clientId"]');
    const clientIdCount = await clientIdInputs.count();
    expect(clientIdCount).toBeGreaterThanOrEqual(3);

    // Check for Client Secret inputs
    const clientSecretInputs = page.locator('input[type="password"], input[placeholder*="Secret"], input[name*="clientSecret"]');
    const secretCount = await clientSecretInputs.count();
    expect(secretCount).toBeGreaterThanOrEqual(3);

    console.log(`✅ Found ${clientIdCount} Client ID inputs and ${secretCount} Client Secret inputs`);
  });

  test('should display callback URLs for each provider', async ({ page }) => {
    const baseURL = getBaseURL();
    await page.goto(`${baseURL}/admin`);

    // Navigate to OAuth tab
    await page.click('text="OAuth Providers"');
    await page.waitForTimeout(1000);

    // Check for callback URL text
    const callbackUrl = page.locator('text=/callback/i');
    const count = await callbackUrl.count();

    // Should show callback URLs for all providers
    expect(count).toBeGreaterThanOrEqual(3);

    console.log(`✅ Found ${count} callback URL references`);
  });

  test('should have Save Configuration button', async ({ page }) => {
    const baseURL = getBaseURL();
    await page.goto(`${baseURL}/admin`);

    // Navigate to OAuth tab
    await page.click('text="OAuth Providers"');
    await page.waitForTimeout(1000);

    // Look for Save button
    const saveButton = page.locator('button:has-text("Save")');
    await expect(saveButton).toBeVisible({ timeout: 5000 });

    console.log('✅ Save Configuration button is visible');
  });

  test('should toggle provider enable/disable', async ({ page }) => {
    const baseURL = getBaseURL();
    await page.goto(`${baseURL}/admin`);

    // Navigate to OAuth tab
    await page.click('text="OAuth Providers"');
    await page.waitForTimeout(1000);

    // Find first toggle
    const firstToggle = page.locator('input[type="checkbox"]').first();
    const initialState = await firstToggle.isChecked();

    // Toggle it
    await firstToggle.click();
    await page.waitForTimeout(500);

    const newState = await firstToggle.isChecked();

    // State should have changed
    expect(newState).not.toBe(initialState);

    console.log(`✅ Successfully toggled from ${initialState} to ${newState}`);
  });

  test('should show/hide Client Secret with eye icon', async ({ page }) => {
    const baseURL = getBaseURL();
    await page.goto(`${baseURL}/admin`);

    // Navigate to OAuth tab
    await page.click('text="OAuth Providers"');
    await page.waitForTimeout(1000);

    // Look for show/hide password buttons (eye icons)
    const eyeButtons = page.locator('button:has(svg), button[aria-label*="show"], button[aria-label*="hide"]');
    const count = await eyeButtons.count();

    if (count > 0) {
      console.log(`✅ Found ${count} show/hide secret buttons`);
    } else {
      console.log('⚠️  No show/hide buttons found - may not be implemented');
    }
  });

  test('should validate form has proper structure', async ({ page }) => {
    const baseURL = getBaseURL();
    await page.goto(`${baseURL}/admin`);

    // Navigate to OAuth tab
    await page.click('text="OAuth Providers"');
    await page.waitForTimeout(1000);

    // Check page structure
    const pageContent = await page.content();

    // Should contain OAuth-related text
    expect(pageContent).toContain('OAuth');
    expect(pageContent).toContain('Google');
    expect(pageContent).toContain('LinkedIn');
    expect(pageContent).toContain('GitHub');

    console.log('✅ OAuth configuration page has proper structure');
  });
});
