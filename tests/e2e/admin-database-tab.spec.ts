import { test, expect } from '@playwright/test';
import { login, TEST_USERS, getBaseURL } from '../helpers/auth';

test.describe('Admin Database Tab', () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin
    await login(page, TEST_USERS.ADMIN);
  });

  test('should display Database tab in admin panel', async ({ page }) => {
    const baseURL = getBaseURL();
    await page.goto(`${baseURL}/admin`);

    // Wait for admin panel to load
    await page.waitForLoadState('networkidle');

    // Check for Database tab
    const databaseTab = page.locator('text="Database"');
    await expect(databaseTab).toBeVisible({ timeout: 10000 });

    console.log('✅ Database tab is visible in admin panel');
  });

  test('should show database statistics without errors', async ({ page }) => {
    const baseURL = getBaseURL();
    await page.goto(`${baseURL}/admin`);

    // Click Database tab
    await page.click('text="Database"');
    await page.waitForTimeout(2000); // Wait for stats to load

    // Check that statistics are displayed (not "Error")
    const graphCount = await page.locator('#graph-count').textContent();
    const nodeCount = await page.locator('#node-count').textContent();
    const edgeCount = await page.locator('#edge-count').textContent();

    // Verify none of them show "Error"
    expect(graphCount).not.toBe('Error');
    expect(nodeCount).not.toBe('Error');
    expect(edgeCount).not.toBe('Error');

    // Verify they contain numbers
    expect(graphCount).toMatch(/^\d+$/);
    expect(nodeCount).toMatch(/^\d+$/);
    expect(edgeCount).toMatch(/^\d+$/);

    console.log(`✅ Database stats loaded: ${graphCount} graphs, ${nodeCount} nodes, ${edgeCount} edges`);
  });

  test('should have Refresh Stats button that works', async ({ page }) => {
    const baseURL = getBaseURL();
    await page.goto(`${baseURL}/admin`);

    // Navigate to Database tab
    await page.click('text="Database"');
    await page.waitForTimeout(1000);

    // Find and click Refresh button
    const refreshButton = page.locator('button:has-text("Refresh")');
    await expect(refreshButton).toBeVisible({ timeout: 5000 });

    await refreshButton.click();
    await page.waitForTimeout(1500);

    // Verify stats are still valid (not Error)
    const graphCount = await page.locator('#graph-count').textContent();
    expect(graphCount).not.toBe('Error');
    expect(graphCount).toMatch(/^\d+$/);

    console.log('✅ Refresh Stats button works correctly');
  });

  test('should have Check Data Integrity button', async ({ page }) => {
    const baseURL = getBaseURL();
    await page.goto(`${baseURL}/admin`);

    // Navigate to Database tab
    await page.click('text="Database"');
    await page.waitForTimeout(1000);

    // Look for integrity check button
    const integrityButton = page.locator('button:has-text("Check Data Integrity")');
    await expect(integrityButton).toBeVisible({ timeout: 5000 });

    console.log('✅ Check Data Integrity button is visible');
  });

  test('should have Cleanup Database button', async ({ page }) => {
    const baseURL = getBaseURL();
    await page.goto(`${baseURL}/admin`);

    // Navigate to Database tab
    await page.click('text="Database"');
    await page.waitForTimeout(1000);

    // Look for cleanup button
    const cleanupButton = page.locator('button:has-text("Cleanup")');
    await expect(cleanupButton).toBeVisible({ timeout: 5000 });

    console.log('✅ Cleanup Database button is visible');
  });

  test('should use correct API endpoint (/api/graphql)', async ({ page }) => {
    const baseURL = getBaseURL();

    // Intercept network requests to verify correct endpoint usage
    const requests: string[] = [];
    page.on('request', request => {
      if (request.url().includes('graphql')) {
        requests.push(request.url());
      }
    });

    await page.goto(`${baseURL}/admin`);
    await page.click('text="Database"');
    await page.waitForTimeout(2000);

    // Verify all GraphQL requests use /api/graphql proxy path
    const invalidRequests = requests.filter(url => {
      // Should NOT directly access ports 4127 or 4128
      return url.includes(':4127/graphql') || url.includes(':4128/graphql');
    });

    expect(invalidRequests.length).toBe(0);

    // Verify we DO use the proxy path
    const proxyRequests = requests.filter(url => url.includes('/api/graphql'));
    expect(proxyRequests.length).toBeGreaterThan(0);

    console.log(`✅ All ${proxyRequests.length} requests use /api/graphql proxy path`);
  });

  test('should handle API errors gracefully', async ({ page }) => {
    const baseURL = getBaseURL();

    // Intercept and fail GraphQL requests to test error handling
    await page.route('**/api/graphql', route => route.abort('failed'));

    await page.goto(`${baseURL}/admin`);
    await page.click('text="Database"');
    await page.waitForTimeout(2000);

    // Stats should show "Error" when API fails
    const graphCount = await page.locator('#graph-count').textContent();
    expect(graphCount).toBe('Error');

    console.log('✅ Error handling works correctly');
  });

  test('should display page structure correctly', async ({ page }) => {
    const baseURL = getBaseURL();
    await page.goto(`${baseURL}/admin`);
    await page.click('text="Database"');
    await page.waitForTimeout(1000);

    const pageContent = await page.content();

    // Should contain database-related text
    expect(pageContent).toContain('Database');
    expect(pageContent).toContain('graph');

    console.log('✅ Database page has proper structure');
  });
});
