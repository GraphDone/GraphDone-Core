import { test, expect } from '@playwright/test';
import { 
  login, 
  logout, 
  getAuthState,
  TEST_USERS 
} from '../helpers/auth';

test.describe('Basic Authentication Validation', () => {
  test('should login as admin successfully', async ({ page }) => {
    console.log('🧪 Testing basic admin login...');

    // Test the main login function
    await login(page, TEST_USERS.ADMIN, { retries: 1 });

    // Verify authentication state
    const authState = await getAuthState(page);
    console.log(`Auth state: isLoggedIn=${authState.isLoggedIn}, URL=${authState.currentUrl}`);
    console.log(`Indicators found: ${authState.userIndicators.join(', ')}`);
    console.log(`Errors: ${authState.errors.join(', ')}`);

    expect(authState.isLoggedIn, 'Should be logged in').toBe(true);
    expect(authState.currentUrl, 'Should not be on login page').not.toContain('/login');

    // Cleanup
    try {
      await logout(page);
    } catch (e) {
      console.log('Logout cleanup failed, continuing...');
    }

    console.log('✅ Basic admin login test passed');
  });

  test('should detect authentication state correctly', async ({ page }) => {
    console.log('🧪 Testing authentication state detection...');
    
    // Start with clean state
    await page.goto('/');
    await page.waitForTimeout(1000);
    
    // Check initial state (should be logged out)
    let authState = await getAuthState(page);
    console.log(`Initial state: isLoggedIn=${authState.isLoggedIn}`);
    
    // Login
    await login(page, TEST_USERS.ADMIN, { retries: 1 });
    
    // Check logged in state
    authState = await getAuthState(page);
    console.log(`After login: isLoggedIn=${authState.isLoggedIn}, URL=${authState.currentUrl}`);
    expect(authState.isLoggedIn, 'Should be logged in after login').toBe(true);
    
    console.log('✅ Authentication state detection test passed');
  });
});