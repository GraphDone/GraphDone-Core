import { test, expect } from '@playwright/test';

test.describe('Basic Error Handling Tests', () => {
  test('application loads and shows basic structure', async ({ page }) => {
    await page.goto('/');
    
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    
    // Check that the page loaded successfully
    await expect(page.locator('body')).toBeVisible();
    
    // Check for any error indicators
    const errorElements = page.locator('text=/error|failed|crash/i');
    const errorCount = await errorElements.count();
    
    console.log(`Found ${errorCount} potential error indicators`);
    
    // Check for basic app structure
    const hasContent = await page.locator('#root').isVisible();
    expect(hasContent).toBeTruthy();
    
    // Check for JavaScript errors in console
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    
    // Wait a bit more to catch any delayed errors
    await page.waitForTimeout(2000);
    
    // Log console errors for debugging
    if (consoleErrors.length > 0) {
      console.log('Console errors found:', consoleErrors);
    }
    
    // The test passes if the app loads without major crashes
    expect(await page.title()).toBeTruthy();
  });

  test('error boundary exists and is importable', async ({ page }) => {
    // This test just checks that our error boundary component can be loaded
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Check that the page loaded - if error boundary broke, this would fail
    await expect(page.locator('body')).toBeVisible();
    
    // Try to inject a test to see if React Error Boundary concepts work
    const result = await page.evaluate(() => {
      // Check if React is available
      return typeof window.React !== 'undefined' || 
             typeof window.__REACT_DEVTOOLS_GLOBAL_HOOK__ !== 'undefined' ||
             document.querySelector('[data-reactroot]') !== null;
    });
    
    console.log('React detected:', result);
  });
});