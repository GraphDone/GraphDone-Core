import { test, expect, chromium } from '@playwright/test';

/**
 * Quick test with fresh browser context to avoid caching issues
 */

const DEMO_URL = 'http://graphdone-ai-01.chocolate-perch.ts.net';

test('quick cache-free guest login test', async () => {
  // Create a completely fresh browser instance
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    ignoreHTTPSErrors: true
  });
  const page = await context.newPage();

  // Log network requests
  page.on('request', request => {
    if (request.url().includes('graphql')) {
      console.log('[REQUEST]:', request.url());
    }
  });

  // Navigate with no-cache headers
  await page.goto(DEMO_URL, {
    waitUntil: 'networkidle',
  });

  // Force a hard reload
  await page.reload({ waitUntil: 'networkidle' });

  console.log('Page loaded. Checking for guest button...');

  const guestButton = page.locator('button:has-text("Continue as Guest")');
  await expect(guestButton).toBeVisible();

  console.log('Clicking guest button...');
  await guestButton.click();

  // Wait a bit
  await page.waitForTimeout(3000);

  console.log('Current URL:', page.url());

  await browser.close();
});
