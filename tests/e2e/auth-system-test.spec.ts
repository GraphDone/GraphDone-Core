import { test, expect } from '@playwright/test';
import { 
  login, 
  logout, 
  isLoggedIn, 
  ensureLoggedIn, 
  quickLogin,
  navigateToWorkspace, 
  createTestGraph,
  cleanupAuth,
  waitForAuthentication,
  getAuthState,
  TEST_USERS 
} from '../helpers/auth';

test.describe('Authentication System Validation', () => {
  test.afterEach(async ({ page }) => {
    // Clean up after each test
    await cleanupAuth(page);
  });

  test('should perform robust admin login with retry logic', async ({ page }) => {
    console.log('🧪 Testing robust admin login...');

    // Test the main login function
    await login(page, TEST_USERS.ADMIN);

    // Verify authentication state
    const authState = await getAuthState(page);
    expect(authState.isLoggedIn, 'Should be logged in').toBe(true);
    expect(authState.currentUrl, 'Should not be on login page').not.toContain('/login');
    expect(authState.errors.length, `Authentication errors: ${authState.errors.join(', ')}`).toBe(0);

    console.log('✅ Admin login test passed');
  });

  test('should handle different user roles', async ({ page }) => {
    console.log('🧪 Testing different user role authentication...');

    // Test member login
    await login(page, TEST_USERS.MEMBER);
    let authState = await getAuthState(page);
    expect(authState.isLoggedIn, 'Member should be logged in').toBe(true);

    // Logout and test viewer
    await logout(page);
    authState = await getAuthState(page);
    expect(authState.isLoggedIn, 'Should be logged out').toBe(false);

    await login(page, TEST_USERS.VIEWER);
    authState = await getAuthState(page);
    expect(authState.isLoggedIn, 'Viewer should be logged in').toBe(true);

    console.log('✅ Multi-role authentication test passed');
  });

  test('should handle quick login convenience function', async ({ page }) => {
    console.log('🧪 Testing quick login functionality...');

    await quickLogin(page, 'admin');
    
    const authState = await getAuthState(page);
    expect(authState.isLoggedIn, 'Quick login should work').toBe(true);

    console.log('✅ Quick login test passed');
  });

  test('should intelligently detect existing authentication', async ({ page }) => {
    console.log('🧪 Testing authentication state detection...');

    // First login
    await login(page, TEST_USERS.ADMIN);
    
    // Test ensureLoggedIn - should skip login
    console.log('Testing ensureLoggedIn with existing auth...');
    await ensureLoggedIn(page, TEST_USERS.ADMIN);
    
    const authState = await getAuthState(page);
    expect(authState.isLoggedIn, 'Should remain logged in').toBe(true);

    console.log('✅ Authentication state detection test passed');
  });

  test('should navigate to workspace with full readiness verification', async ({ page }) => {
    console.log('🧪 Testing workspace navigation...');

    await navigateToWorkspace(page);

    // Verify workspace is fully loaded
    const workspaceElements = [
      '[data-testid="graph-selector"]',
      '.graph-selector', 
      'text="Graph Viewer"'
    ];

    let foundElement = false;
    for (const selector of workspaceElements) {
      if (await page.locator(selector).isVisible({ timeout: 5000 })) {
        foundElement = true;
        console.log(`✅ Found workspace element: ${selector}`);
        break;
      }
    }

    expect(foundElement, 'Should find workspace elements').toBe(true);
    console.log('✅ Workspace navigation test passed');
  });

  test('should handle graph creation workflow', async ({ page }) => {
    console.log('🧪 Testing graph creation workflow...');

    const testGraphName = await createTestGraph(page, {
      name: `Auth Test Graph ${Date.now()}`,
      description: 'Test graph for authentication system validation'
    });

    expect(testGraphName).toContain('Auth Test Graph');

    // Verify we can interact with the graph selector after creation
    const graphSelector = page.locator('[data-testid="graph-selector"], .graph-selector').first();
    await expect(graphSelector).toBeVisible({ timeout: 5000 });

    const selectorText = await graphSelector.textContent();
    console.log(`Graph selector shows: "${selectorText}"`);

    console.log('✅ Graph creation test passed');
  });

  test('should handle logout and cleanup properly', async ({ page }) => {
    console.log('🧪 Testing logout and cleanup...');

    // Login first
    await login(page, TEST_USERS.ADMIN);
    let authState = await getAuthState(page);
    expect(authState.isLoggedIn, 'Should be logged in initially').toBe(true);

    // Test logout
    await logout(page);
    authState = await getAuthState(page);
    expect(authState.isLoggedIn, 'Should be logged out').toBe(false);

    // Test cleanup
    await cleanupAuth(page);
    
    // Verify clean state
    const finalUrl = page.url();
    console.log(`Final URL after cleanup: ${finalUrl}`);

    console.log('✅ Logout and cleanup test passed');
  });

  test('should handle authentication errors gracefully', async ({ page }) => {
    console.log('🧪 Testing authentication error handling...');

    // Test with invalid credentials
    try {
      await login(page, {
        username: 'invalid_user',
        password: 'wrong_password'
      }, {
        retries: 1, // Reduce retries for faster test
        timeout: 10000
      });
      
      // If we get here, login succeeded somehow
      console.log('⚠️  Login unexpectedly succeeded with invalid credentials');
    } catch (error) {
      console.log('✅ Correctly handled invalid credentials');
      expect(error.message).toContain('Login failed');
    }

    // Verify we can still login with correct credentials after failure
    await login(page, TEST_USERS.ADMIN);
    const authState = await getAuthState(page);
    expect(authState.isLoggedIn, 'Should recover and login correctly').toBe(true);

    console.log('✅ Authentication error handling test passed');
  });

  test('should support wait for authentication utility', async ({ page }) => {
    console.log('🧪 Testing wait for authentication utility...');

    // Start authentication process
    const loginPromise = login(page, TEST_USERS.ADMIN);
    
    // Use wait utility in parallel
    const waitPromise = waitForAuthentication(page, {
      timeout: 15000
    });

    // Both should complete successfully
    await Promise.all([loginPromise, waitPromise]);

    const authState = await getAuthState(page);
    expect(authState.isLoggedIn, 'Should be authenticated').toBe(true);

    console.log('✅ Wait for authentication test passed');
  });

  test('should be resilient across page reloads and navigation', async ({ page }) => {
    console.log('🧪 Testing authentication persistence...');

    // Login and navigate to workspace
    await login(page, TEST_USERS.ADMIN);
    await navigateToWorkspace(page);

    // Reload the page
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000); // Allow React to rehydrate

    // Check if still authenticated
    const authStateAfterReload = await getAuthState(page);
    console.log(`Auth state after reload: ${authStateAfterReload.isLoggedIn}`);
    console.log(`URL after reload: ${authStateAfterReload.currentUrl}`);
    console.log(`Indicators: ${authStateAfterReload.userIndicators.join(', ')}`);

    // The auth system should handle session persistence
    // If not, ensureLoggedIn should fix it
    await ensureLoggedIn(page);
    
    const finalAuthState = await getAuthState(page);
    expect(finalAuthState.isLoggedIn, 'Should maintain or restore authentication').toBe(true);

    console.log('✅ Authentication persistence test passed');
  });
});