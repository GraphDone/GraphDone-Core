import { test, expect } from '@playwright/test';

/**
 * Test guest login on the demo server
 * This test runs against the actual deployed instance at graphdone-ai-01.chocolate-perch.ts.net:3127
 */

const DEMO_URL = 'http://graphdone-ai-01.chocolate-perch.ts.net';

test.describe('Demo Server Guest Login', () => {
  test.beforeEach(async ({ page }) => {
    // Set up console and network logging to capture errors
    page.on('console', msg => {
      const type = msg.type();
      if (type === 'error' || type === 'warning') {
        console.log(`[BROWSER ${type.toUpperCase()}]:`, msg.text());
      }
    });

    page.on('pageerror', error => {
      console.log('[PAGE ERROR]:', error.message);
    });

    // Capture network errors
    page.on('requestfailed', request => {
      console.log('[NETWORK FAILED]:', request.url(), request.failure()?.errorText);
    });
  });

  test('should load the login page', async ({ page }) => {
    console.log('Navigating to:', DEMO_URL);

    const response = await page.goto(DEMO_URL, {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    expect(response?.status()).toBe(200);

    // Wait for the page to be fully loaded
    await page.waitForLoadState('domcontentloaded');

    // Take a screenshot of the login page
    await page.screenshot({
      path: 'test-artifacts/screenshots/demo-login-page.png',
      fullPage: true
    });

    // Check that we're on the login page
    await expect(page.locator('h1')).toContainText('Welcome Back');

    console.log('Login page loaded successfully');
  });

  test('should show guest login button with gold glow', async ({ page }) => {
    await page.goto(DEMO_URL, { waitUntil: 'networkidle' });

    // Find the guest login button
    const guestButton = page.locator('button:has-text("Continue as Guest")');
    await expect(guestButton).toBeVisible();

    // Check that the button has the gold glow styling
    const buttonStyles = await guestButton.evaluate(el => {
      const computed = window.getComputedStyle(el);
      return {
        boxShadow: computed.boxShadow,
        borderColor: computed.borderColor,
        animation: computed.animation
      };
    });

    console.log('Guest button styles:', buttonStyles);

    // Verify the button has shadow (glow effect)
    expect(buttonStyles.boxShadow).not.toBe('none');

    await page.screenshot({
      path: 'test-artifacts/screenshots/guest-button-with-glow.png',
      fullPage: true
    });
  });

  test('should attempt guest login and capture any errors', async ({ page }) => {
    console.log('Testing guest login flow...');

    // Track all GraphQL requests
    const graphqlRequests: any[] = [];
    page.on('request', request => {
      if (request.url().includes('/graphql')) {
        console.log('[GRAPHQL REQUEST]:', {
          url: request.url(),
          method: request.method(),
          headers: request.headers(),
          postData: request.postData()
        });
        graphqlRequests.push({
          url: request.url(),
          method: request.method(),
          postData: request.postData()
        });
      }
    });

    // Track all GraphQL responses
    page.on('response', async response => {
      if (response.url().includes('/graphql')) {
        const status = response.status();
        let body;
        try {
          body = await response.json();
        } catch (e) {
          body = await response.text();
        }
        console.log('[GRAPHQL RESPONSE]:', {
          url: response.url(),
          status,
          body
        });
      }
    });

    await page.goto(DEMO_URL, { waitUntil: 'networkidle' });

    // Find and click the guest login button
    const guestButton = page.locator('button:has-text("Continue as Guest")');
    await expect(guestButton).toBeVisible();

    console.log('Clicking guest login button...');

    // Take a screenshot before clicking
    await page.screenshot({
      path: 'test-artifacts/screenshots/before-guest-click.png',
      fullPage: true
    });

    // Click the button and wait for navigation or error
    await guestButton.click();

    // Wait a bit to see what happens
    await page.waitForTimeout(3000);

    // Take a screenshot after clicking
    await page.screenshot({
      path: 'test-artifacts/screenshots/after-guest-click.png',
      fullPage: true
    });

    // Check if we got any GraphQL requests
    console.log('Total GraphQL requests made:', graphqlRequests.length);

    // Check if we navigated successfully or if there's an error
    const currentUrl = page.url();
    console.log('Current URL after click:', currentUrl);

    // Look for any error messages in the DOM
    const errorMessages = await page.locator('[class*="error"], [class*="red"]').allTextContents();
    if (errorMessages.length > 0) {
      console.log('Error messages found:', errorMessages);
    }

    // Check if we're still on the login page or navigated
    if (currentUrl === DEMO_URL || currentUrl === `${DEMO_URL}/`) {
      console.log('Still on login page - login may have failed');

      // Get the Apollo Client cache/state if possible
      const apolloState = await page.evaluate(() => {
        // Try to access Apollo Client state
        const apolloCache = (window as any).__APOLLO_CLIENT__?.cache;
        if (apolloCache) {
          return apolloCache.extract();
        }
        return null;
      });

      if (apolloState) {
        console.log('Apollo Client state:', JSON.stringify(apolloState, null, 2));
      }
    } else {
      console.log('Navigated to:', currentUrl, '- login may have succeeded');
    }
  });

  test('should verify GraphQL endpoint is accessible', async ({ page }) => {
    console.log('Testing GraphQL endpoint accessibility...');

    // Try to access the GraphQL endpoint directly
    const graphqlUrl = 'http://graphdone-ai-01.chocolate-perch.ts.net/graphql';

    const response = await page.request.post(graphqlUrl, {
      headers: {
        'Content-Type': 'application/json',
      },
      data: {
        query: '{ __typename }'
      }
    });

    console.log('GraphQL endpoint status:', response.status());
    const body = await response.json();
    console.log('GraphQL endpoint response:', body);

    expect(response.status()).toBe(200);
  });
});
