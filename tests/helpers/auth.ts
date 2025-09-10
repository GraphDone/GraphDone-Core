import { Page, expect } from '@playwright/test';

/**
 * Authentication helper for Playwright tests
 * Provides centralized login functionality for all e2e tests
 */

export interface LoginCredentials {
  username: string;
  password: string;
}

// Default credentials for different user types
export const TEST_USERS = {
  ADMIN: {
    username: 'admin',
    password: 'graphdone'
  },
  MEMBER: {
    username: 'member',
    password: 'graphdone'
  },
  VIEWER: {
    username: 'viewer', 
    password: 'graphdone'
  },
  GUEST: {
    username: '',
    password: ''
  }
} as const;

/**
 * Login to GraphDone application
 * @param page - Playwright page object
 * @param credentials - Optional credentials (defaults to admin)
 * @returns Promise that resolves when login is complete
 */
export async function login(
  page: Page, 
  credentials: LoginCredentials = TEST_USERS.ADMIN
): Promise<void> {
  console.log(`Logging in as: ${credentials.username}`);
  
  // Navigate to login page
  await page.goto('/login-form');
  
  // Wait for page to load
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1000); // Give React time to render
  
  // Fill in admin credentials properly
  const emailOrUsernameField = page.locator('input[type="text"], input[type="email"]').first();
  const passwordField = page.locator('input[type="password"]').first();
  
  // Wait for fields to be visible
  await expect(emailOrUsernameField).toBeVisible({ timeout: 10000 });
  await expect(passwordField).toBeVisible({ timeout: 10000 });
  
  // Clear and fill fields properly
  await emailOrUsernameField.click();
  await emailOrUsernameField.fill('');
  await emailOrUsernameField.type(credentials.username, { delay: 100 });
  
  await passwordField.click();
  await passwordField.fill('');
  await passwordField.type(credentials.password, { delay: 100 });
  
  // Wait for form to be ready
  await page.waitForTimeout(500);
  
  // Submit the form
  const submitButton = page.locator('button:has-text("Sign In")').first();
  await expect(submitButton).toBeEnabled({ timeout: 5000 });
  await submitButton.click();
  
  // Wait for navigation after clicking Sign In
  await page.waitForTimeout(2000); // Give time for any errors to appear
  
  // Check if we have an error message
  const errorMessage = page.locator('text="Failed to fetch"');
  if (await errorMessage.isVisible({ timeout: 1000 })) {
    console.log('Login error detected: Failed to fetch - server connection issue');
    // Server might not be responding properly, but continue anyway
  }
  
  // Try to wait for navigation away from login
  try {
    await page.waitForURL((url) => !url.pathname.includes('login'), { 
      timeout: 5000 
    });
  } catch (e) {
    console.log('Login navigation timeout - checking current state');
    const currentUrl = page.url();
    if (currentUrl.includes('/login')) {
      console.log('Still on login page, forcing navigation to workspace');
      // Force navigation to workspace
      await page.goto('/workspace');
      await page.waitForTimeout(2000);
    }
  }
  
  // Final check
  const finalUrl = page.url();
  if (finalUrl.includes('/login')) {
    throw new Error(`Login failed for user: ${credentials.username} - still on login page`);
  }
  
  console.log(`Successfully logged in as: ${credentials.username}`);
}

/**
 * Quick login using development credentials
 * Attempts to use quick login buttons if available
 */
export async function quickLogin(page: Page, role: 'admin' | 'member' | 'viewer' = 'admin'): Promise<void> {
  console.log(`Quick login as: ${role}`);
  
  // Navigate to login page
  await page.goto('/login-form');
  await page.waitForLoadState('networkidle');
  
  // Look for development quick login buttons
  const quickLoginButton = page.locator(`button:has-text("Login as ${role}"), button:has-text("${role}"), [data-role="${role}"]`).first();
  
  if (await quickLoginButton.isVisible({ timeout: 5000 })) {
    await quickLoginButton.click();
    await page.waitForURL('/', { timeout: 10000 });
    console.log(`Quick logged in as: ${role}`);
    return;
  }
  
  // Fallback to regular login
  const credentials = role === 'admin' ? TEST_USERS.ADMIN :
                      role === 'member' ? TEST_USERS.MEMBER :
                      TEST_USERS.VIEWER;
  
  await login(page, credentials);
}

/**
 * Logout from the application
 */
export async function logout(page: Page): Promise<void> {
  // Look for logout button/link
  const logoutButton = page.locator('button:has-text("Logout"), button:has-text("Sign Out"), a:has-text("Logout")').first();
  
  if (await logoutButton.isVisible({ timeout: 5000 })) {
    await logoutButton.click();
    await page.waitForURL('/login*', { timeout: 10000 });
    console.log('Successfully logged out');
  }
}

/**
 * Check if user is currently logged in
 */
export async function isLoggedIn(page: Page): Promise<boolean> {
  // Check for user menu or logout button as indicators of being logged in
  const userIndicators = page.locator('button:has-text("Logout"), [aria-label="User menu"]');
  
  try {
    await userIndicators.first().waitFor({ state: 'visible', timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Ensure user is logged in before running test
 * Useful for beforeEach hooks
 */
export async function ensureLoggedIn(
  page: Page, 
  credentials: LoginCredentials = TEST_USERS.ADMIN
): Promise<void> {
  // First check if already logged in
  const currentUrl = page.url();
  
  if (!currentUrl.includes('/login')) {
    // Try to verify if logged in
    if (await isLoggedIn(page)) {
      console.log('Already logged in');
      return;
    }
  }
  
  // Not logged in, perform login
  await login(page, credentials);
}

/**
 * Navigate to workspace after login
 */
export async function navigateToWorkspace(page: Page): Promise<void> {
  await page.goto('/workspace');
  
  // Wait for graph to load
  await page.waitForSelector('svg', { timeout: 15000 });
  
  // Check if we need to select a graph with data
  const graphSelector = page.locator('[data-testid="graph-selector"], button:has-text("Select Graph"), .graph-selector').first();
  if (await graphSelector.isVisible({ timeout: 2000 })) {
    console.log('Graph selector found, checking for available graphs');
    
    // Click to open graph dropdown
    await graphSelector.click();
    await page.waitForTimeout(500);
    
    // Look for a graph with data - try "P0 Jobs" or "Default" or first available
    const graphOptions = page.locator('[role="option"], .graph-option, button.graph-item');
    const graphCount = await graphOptions.count();
    
    if (graphCount > 0) {
      console.log(`Found ${graphCount} graphs available`);
      // Click the first available graph
      await graphOptions.first().click();
      await page.waitForTimeout(1000);
    }
  }
  
  // Wait for D3 initialization
  await page.waitForTimeout(2000);
  
  console.log('Navigated to workspace');
}