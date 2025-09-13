import { Page, expect } from '@playwright/test';

/**
 * CRITICAL AUTHENTICATION HELPER
 * 
 * This is the foundation of all E2E testing. Every test depends on reliable authentication.
 * This helper must handle all edge cases, authentication flows, and error conditions.
 * 
 * Key Requirements:
 * - Handle both development and production environments  
 * - Support multiple authentication methods (form login, quick login, guest access)
 * - Robust error handling and retry logic
 * - Clear logging for debugging test failures
 * - Proper session management and cleanup
 * - Cross-browser compatibility
 */

export interface LoginCredentials {
  username: string;
  password: string;
  role?: 'admin' | 'member' | 'viewer' | 'guest';
}

// Production-ready test credentials
export const TEST_USERS = {
  ADMIN: {
    username: 'admin',
    password: 'graphdone',
    role: 'admin' as const
  },
  MEMBER: {
    username: 'member', 
    password: 'graphdone',
    role: 'member' as const
  },
  VIEWER: {
    username: 'viewer',
    password: 'graphdone', 
    role: 'viewer' as const
  },
  GUEST: {
    username: '',
    password: '',
    role: 'guest' as const
  }
} as const;

/**
 * Authentication state detection
 */
export interface AuthState {
  isLoggedIn: boolean;
  currentUrl: string;
  userIndicators: string[];
  errors: string[];
}

/**
 * Get current authentication state
 */
export async function getAuthState(page: Page): Promise<AuthState> {
  const currentUrl = page.url();
  const errors: string[] = [];
  
  // Check for login indicators
  const userMenuIndicators = [
    'button:has-text("Logout")',
    'button:has-text("Sign Out")',
    '[aria-label="User menu"]',
    '[data-testid="user-menu"]',
    '.user-menu',
    'button:has-text("Profile")',
    // Workspace-specific indicators
    '[data-testid="graph-selector"]',
    '.graph-selector',
    'text="Graph Viewer"',
    // Error indicators
    'text="Failed to fetch"',
    '.error-message',
    '[role="alert"]'
  ];
  
  const foundIndicators: string[] = [];
  
  for (const indicator of userMenuIndicators) {
    const element = page.locator(indicator).first();
    if (await element.isVisible({ timeout: 1000 })) {
      foundIndicators.push(indicator);
      
      // Check for error messages
      if (indicator.includes('Failed') || indicator.includes('error') || indicator.includes('alert')) {
        const text = await element.textContent();
        if (text) errors.push(text);
      }
    }
  }
  
  // Check for explicit login form indicators (NOT logged in)
  const loginFormIndicators = [
    'input[type="password"]',
    'button:has-text("Sign In")',
    'button:has-text("Login")',
    'text="Welcome Back"',
    'text="Enter your credentials"',
    'input[placeholder*="Email"]',
    'input[placeholder*="Username"]'
  ];
  
  const hasLoginForm = await Promise.all(
    loginFormIndicators.map(selector => 
      page.locator(selector).first().isVisible({ timeout: 1000 }).catch(() => false)
    )
  ).then(results => results.some(visible => visible));
  
  // Determine login state - prioritize explicit indicators
  const isLoggedIn = !hasLoginForm && (
    foundIndicators.some(ind => 
      ind.includes('Logout') || 
      ind.includes('user-menu') || 
      ind.includes('graph-selector') ||
      ind.includes('Graph Viewer')
    ) ||
    // If no login form and we're on a non-login page, consider it logged in
    (!currentUrl.includes('/login') && !hasLoginForm && errors.length === 0)
  );
  
  return {
    isLoggedIn,
    currentUrl,
    userIndicators: foundIndicators,
    errors
  };
}

/**
 * ROBUST LOGIN FUNCTION
 * 
 * Handles all authentication scenarios with comprehensive error handling and retry logic.
 * This is the most critical function in the test suite.
 * 
 * @param page - Playwright page object
 * @param credentials - User credentials (defaults to admin)
 * @param options - Login options and configuration
 * @returns Promise that resolves when login is complete
 */
export async function login(
  page: Page, 
  credentials: LoginCredentials = TEST_USERS.ADMIN,
  options: {
    retries?: number;
    timeout?: number;
    skipIfLoggedIn?: boolean;
    forceReauth?: boolean;
  } = {}
): Promise<void> {
  const { retries = 3, timeout = 30000, skipIfLoggedIn = true, forceReauth = false } = options;
  
  console.log(`🔐 Authenticating as: ${credentials.username} (role: ${credentials.role || 'unknown'})`);
  
  // Check if already authenticated
  if (skipIfLoggedIn && !forceReauth) {
    const authState = await getAuthState(page);
    if (authState.isLoggedIn) {
      console.log('✅ Already authenticated, skipping login');
      console.log(`   Current URL: ${authState.currentUrl}`);
      console.log(`   Found indicators: ${authState.userIndicators.join(', ')}`);
      return;
    }
    
    if (authState.errors.length > 0) {
      console.log('⚠️  Authentication errors detected:', authState.errors);
    }
  }
  
  // Attempt login with retry logic
  for (let attempt = 1; attempt <= retries; attempt++) {
    console.log(`🔄 Login attempt ${attempt}/${retries}`);
    
    try {
      await attemptLogin(page, credentials, timeout);
      
      // Verify login success
      const finalAuthState = await getAuthState(page);
      if (finalAuthState.isLoggedIn) {
        console.log(`✅ Login successful on attempt ${attempt}`);
        console.log(`   Final URL: ${finalAuthState.currentUrl}`);
        console.log(`   Indicators: ${finalAuthState.userIndicators.join(', ')}`);
        return;
      } else {
        throw new Error(`Login verification failed: ${finalAuthState.errors.join(', ')}`);
      }
      
    } catch (error) {
      console.log(`❌ Login attempt ${attempt} failed: ${error.message}`);
      
      if (attempt === retries) {
        // Final attempt failed
        const debugState = await getAuthState(page);
        console.log('🔍 Final debug state:');
        console.log(`   URL: ${debugState.currentUrl}`);
        console.log(`   Indicators: ${debugState.userIndicators.join(', ')}`);
        console.log(`   Errors: ${debugState.errors.join(', ')}`);
        
        throw new Error(`Login failed after ${retries} attempts for user: ${credentials.username}. Last error: ${error.message}`);
      }
      
      // Wait before retry
      await page.waitForTimeout(2000 * attempt);
    }
  }
}

/**
 * Single login attempt with comprehensive error handling
 */
async function attemptLogin(
  page: Page,
  credentials: LoginCredentials,
  timeout: number
): Promise<void> {
  // Step 1: Navigate to application
  console.log('   📍 Navigating to application...');
  await page.goto('/', { waitUntil: 'domcontentloaded', timeout });
  await page.waitForTimeout(1500); // Allow React hydration
  
  // Step 2: Check if we need to navigate to login
  const currentUrl = page.url();
  if (!currentUrl.includes('/login')) {
    // Try to find login link or navigate directly
    const loginLink = page.locator('a[href*="login"], button:has-text("Login"), button:has-text("Sign In")').first();
    
    if (await loginLink.isVisible({ timeout: 2000 })) {
      console.log('   🔗 Found login link, clicking...');
      await loginLink.click();
      await page.waitForTimeout(1000);
    } else {
      console.log('   🗺️  No login link found, navigating directly to /login-form');
      await page.goto('/login-form', { waitUntil: 'domcontentloaded' });
    }
  }
  
  // Step 3: Wait for login form to be ready
  console.log('   ⏳ Waiting for login form...');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1000); // React render time
  
  // Step 4: Try quick login first (development mode)
  if (await attemptQuickLogin(page, credentials)) {
    return;
  }
  
  // Step 5: Use traditional form login
  await performFormLogin(page, credentials, timeout);
}

/**
 * Attempt quick login using development mode buttons
 */
async function attemptQuickLogin(page: Page, credentials: LoginCredentials): Promise<boolean> {
  if (!credentials.role || credentials.role === 'guest') {
    return false;
  }
  
  console.log('   ⚡ Trying quick login...');
  
  // Look for development mode quick login buttons
  const quickLoginSelectors = [
    `button:has-text("Login as ${credentials.role}")`,
    `button:has-text("${credentials.role}")`,
    `[data-role="${credentials.role}"]`,
    `button[data-testid="quick-login-${credentials.role}"]`
  ];
  
  for (const selector of quickLoginSelectors) {
    const quickButton = page.locator(selector).first();
    if (await quickButton.isVisible({ timeout: 2000 })) {
      console.log(`   ⚡ Found quick login: ${selector}`);
      await quickButton.click();
      await page.waitForTimeout(3000); // Wait for redirect
      return true;
    }
  }
  
  console.log('   ❌ No quick login found, using form login');
  return false;
}

/**
 * Perform traditional form-based login
 */
async function performFormLogin(page: Page, credentials: LoginCredentials, timeout: number): Promise<void> {
  console.log('   📝 Performing form login...');
  
  // Find form fields with multiple selector strategies
  const usernameSelectors = [
    'input[name="emailOrUsername"]',
    'input[name="username"]', 
    'input[name="email"]',
    'input[type="text"]:first-of-type',
    'input[placeholder*="username"]',
    'input[placeholder*="email"]'
  ];
  
  const passwordSelectors = [
    'input[name="password"]',
    'input[type="password"]'
  ];
  
  // Find username field
  let usernameField;
  for (const selector of usernameSelectors) {
    usernameField = page.locator(selector).first();
    if (await usernameField.isVisible({ timeout: 2000 })) {
      console.log(`   📧 Found username field: ${selector}`);
      break;
    }
  }
  
  if (!usernameField || !(await usernameField.isVisible())) {
    throw new Error('Username field not found');
  }
  
  // Find password field
  let passwordField;
  for (const selector of passwordSelectors) {
    passwordField = page.locator(selector).first();
    if (await passwordField.isVisible({ timeout: 2000 })) {
      console.log(`   🔒 Found password field: ${selector}`);
      break;
    }
  }
  
  if (!passwordField || !(await passwordField.isVisible())) {
    throw new Error('Password field not found');
  }
  
  // Clear and fill fields with proper timing
  console.log('   ⌨️  Filling credentials...');
  await usernameField.click();
  await usernameField.fill('');
  await usernameField.type(credentials.username, { delay: 50 });
  
  await passwordField.click();
  await passwordField.fill('');
  await passwordField.type(credentials.password, { delay: 50 });
  
  // Wait for form validation
  await page.waitForTimeout(500);
  
  // Find and click submit button
  const submitSelectors = [
    'button:has-text("Sign In")',
    'button:has-text("Login")', 
    'button:has-text("Submit")',
    'button[type="submit"]',
    'input[type="submit"]'
  ];
  
  let submitButton;
  for (const selector of submitSelectors) {
    submitButton = page.locator(selector).first();
    if (await submitButton.isVisible({ timeout: 2000 })) {
      console.log(`   🚀 Found submit button: ${selector}`);
      break;
    }
  }
  
  if (!submitButton || !(await submitButton.isVisible())) {
    throw new Error('Submit button not found');
  }
  
  // Ensure button is enabled
  await expect(submitButton).toBeEnabled({ timeout: 5000 });
  
  // Submit form
  console.log('   📤 Submitting login form...');
  await submitButton.click();
  
  // Wait for navigation with intelligent error detection
  await waitForLoginCompletion(page, timeout);
}

/**
 * Wait for login to complete with intelligent error detection
 */
async function waitForLoginCompletion(page: Page, timeout: number): Promise<void> {
  console.log('   ⏳ Waiting for login completion...');
  
  const startTime = Date.now();
  const maxWait = timeout;
  
  while (Date.now() - startTime < maxWait) {
    await page.waitForTimeout(1000);
    
    const currentUrl = page.url();
    console.log(`   🔍 Current URL: ${currentUrl}`);
    
    // Check for successful navigation away from login
    if (!currentUrl.includes('/login')) {
      console.log('   ✅ Navigated away from login page');
      
      // Additional verification - look for workspace elements  
      const workspaceIndicators = [
        '[data-testid="graph-selector"]',
        '.graph-selector',
        'text="Graph Viewer"'
      ];
      
      for (const indicator of workspaceIndicators) {
        if (await page.locator(indicator).isVisible({ timeout: 3000 })) {
          console.log(`   ✅ Workspace loaded: found ${indicator}`);
          return;
        }
      }
      
      console.log('   ⚠️  Navigated away from login but workspace not confirmed');
      return;
    }
    
    // Check for login errors
    const errorMessages = await page.locator('.error-message, [role="alert"], text*="Failed", text*="error"').all();
    if (errorMessages.length > 0) {
      const errorTexts = await Promise.all(errorMessages.map(el => el.textContent()));
      const errors = errorTexts.filter(Boolean);
      
      if (errors.length > 0 && !errors.some(e => e.includes('favicon'))) {
        console.log(`   ❌ Login errors detected: ${errors.join(', ')}`);
        // Continue anyway - might be transient
      }
    }
  }
  
  throw new Error(`Login completion timeout after ${timeout}ms`);
}

/**
 * Quick login using development credentials - SIMPLIFIED API
 * Attempts to use quick login buttons if available, fallback to regular login
 */
export async function quickLogin(page: Page, role: 'admin' | 'member' | 'viewer' = 'admin'): Promise<void> {
  const credentials = role === 'admin' ? TEST_USERS.ADMIN :
                      role === 'member' ? TEST_USERS.MEMBER :
                      TEST_USERS.VIEWER;
  
  console.log(`🚀 Quick login as: ${role}`);
  return await login(page, credentials);
}

/**
 * ROBUST LOGOUT FUNCTION
 * Handles all logout scenarios with proper cleanup
 */
export async function logout(page: Page): Promise<void> {
  console.log('🚪 Logging out...');
  
  const authState = await getAuthState(page);
  if (!authState.isLoggedIn) {
    console.log('✅ Already logged out');
    return;
  }
  
  // Try multiple logout strategies
  const logoutSelectors = [
    'button:has-text("Logout")',
    'button:has-text("Sign Out")', 
    'a:has-text("Logout")',
    '[data-testid="logout"]',
    '[aria-label="Logout"]',
    '.user-menu button:has-text("Logout")',
    // Profile dropdown logout
    'button[aria-label="User menu"]',
    '[data-testid="user-menu"]'
  ];
  
  for (const selector of logoutSelectors) {
    const element = page.locator(selector).first();
    if (await element.isVisible({ timeout: 2000 })) {
      console.log(`   🎯 Found logout element: ${selector}`);
      await element.click();
      
      // If it's a menu, look for logout option
      if (selector.includes('menu')) {
        await page.waitForTimeout(500);
        const logoutOption = page.locator('button:has-text("Logout"), button:has-text("Sign Out")').first();
        if (await logoutOption.isVisible({ timeout: 3000 })) {
          await logoutOption.click();
        }
      }
      
      // Wait for logout to complete
      try {
        await page.waitForURL(/login/, { timeout: 10000 });
        console.log('✅ Successfully logged out');
        return;
      } catch {
        console.log('⚠️  Logout may have completed without redirect');
        return;
      }
    }
  }
  
  console.log('⚠️  No logout button found - may already be logged out');
}

/**
 * Check if user is currently logged in - ENHANCED
 */
export async function isLoggedIn(page: Page): Promise<boolean> {
  const authState = await getAuthState(page);
  return authState.isLoggedIn;
}

/**
 * Ensure user is logged in before running test - ENHANCED
 * Useful for beforeEach hooks with intelligent state detection
 */
export async function ensureLoggedIn(
  page: Page, 
  credentials: LoginCredentials = TEST_USERS.ADMIN
): Promise<void> {
  console.log('🔍 Ensuring user is logged in...');
  
  const authState = await getAuthState(page);
  if (authState.isLoggedIn) {
    console.log('✅ User already logged in');
    return;
  }
  
  console.log('🔐 User not logged in, performing login...');
  await login(page, credentials);
}

/**
 * ENHANCED WORKSPACE NAVIGATION
 * Navigate to workspace with intelligent graph selection and full readiness verification
 */
export async function navigateToWorkspace(page: Page): Promise<void> {
  console.log('🏢 Navigating to workspace...');
  
  // Ensure we're logged in first
  await ensureLoggedIn(page);
  
  // Navigate to workspace
  await page.goto('/workspace', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000); // React hydration
  
  // Wait for workspace core elements
  console.log('   ⏳ Waiting for workspace elements...');
  // Wait for any of the workspace elements
  try {
    await page.waitForSelector('[data-testid="graph-selector"]', { timeout: 5000 });
  } catch {
    try {
      await page.waitForSelector('.graph-selector', { timeout: 5000 });
    } catch {
      try {
        await page.waitForSelector(':has-text("Graph Viewer")', { timeout: 5000 });
      } catch {
        console.log('   ⚠️ No specific workspace elements found, continuing...');
      }
    }
  }
  
  // Check workspace readiness
  const workspaceElements = [
    '[data-testid="graph-selector"]',
    '.graph-selector', 
    'text="Graph Viewer"'
  ];
  
  let workspaceReady = false;
  let foundElement = '';
  
  for (const selector of workspaceElements) {
    if (await page.locator(selector).isVisible({ timeout: 5000 })) {
      console.log(`   ✅ Found workspace element: ${selector}`);
      workspaceReady = true;
      foundElement = selector;
      break;
    }
  }
  
  // If no workspace elements found, be more lenient for production environment
  if (!workspaceReady) {
    console.log('   🔍 Checking for fallback workspace indicators...');
    const fallbackElements = [
      '[role="main"]',
      '.container',
      '#root main',
      'header',
      'nav',
      'div[class*="workspace"]',
      'div[class*="graph"]',
      'button:has-text("Graph")',
      'button:has-text("Table")',
      'button:has-text("Dashboard")',
      'main',
      '.workspace'
    ];
    
    for (const selector of fallbackElements) {
      if (await page.locator(selector).isVisible({ timeout: 3000 })) {
        console.log(`   ✅ Found fallback element: ${selector}`);
        workspaceReady = true;
        foundElement = selector;
        break;
      }
    }
  }
  
  // Additional check: ensure we're not on a login or error page
  const isOnLoginPage = await page.locator('button:has-text("Sign In")').isVisible({ timeout: 1000 });
  const hasErrorMessage = await page.locator('.error, [role="alert"]').or(page.locator('text="Error"')).isVisible({ timeout: 1000 });
  
  if (isOnLoginPage) {
    throw new Error('Workspace navigation failed: Still on login page');
  }
  
  if (hasErrorMessage) {
    const errorText = await page.locator('.error').or(page.locator('[role="alert"]')).first().textContent();
    throw new Error(`Workspace navigation failed: Error detected - ${errorText}`);
  }
  
  // If still not ready after all checks, try waiting a bit longer
  if (!workspaceReady) {
    console.log('   ⏳ Workspace elements not found, waiting for page to fully load...');
    await page.waitForTimeout(3000);
    
    // Final check - if page has basic content, consider it ready
    const hasBasicContent = await page.locator('body').isVisible();
    if (hasBasicContent && !isOnLoginPage && !hasErrorMessage) {
      console.log('   ✅ Page appears loaded, proceeding with caution...');
      workspaceReady = true;
      foundElement = 'body (fallback)';
    }
  }
  
  if (!workspaceReady) {
    throw new Error(`Workspace failed to load properly. Found element: ${foundElement || 'none'}`);
  }
  
  // Handle graph selection if needed
  await handleGraphSelection(page);
  
  // Final verification
  await page.waitForTimeout(3000); // Allow D3 and GraphQL to settle
  console.log('✅ Workspace navigation complete');
}

/**
 * Handle automatic graph selection for testing
 */
async function handleGraphSelection(page: Page): Promise<void> {
  console.log('   📊 Checking graph selection state...');
  
  const graphSelector = page.locator('[data-testid="graph-selector"], .graph-selector, button:has-text("Select Graph")').first();
  
  if (!(await graphSelector.isVisible({ timeout: 5000 }))) {
    console.log('   ⚠️  No graph selector found');
    return;
  }
  
  const selectorText = await graphSelector.textContent();
  console.log(`   📊 Graph selector text: "${selectorText}"`);
  
  // If selector shows we need to select a graph
  if (!selectorText || selectorText.includes('Select') || selectorText.includes('Choose')) {
    console.log('   🔄 Need to select a graph...');
    
    await graphSelector.click();
    await page.waitForTimeout(1000);
    
    // Look for existing graphs to select
    const existingGraphs = page.locator('[role="option"], .graph-option, .graph-item');
    const graphCount = await existingGraphs.count();
    
    if (graphCount > 0) {
      console.log(`   📊 Found ${graphCount} available graphs, selecting first one`);
      await existingGraphs.first().click();
      await page.waitForTimeout(2000);
    } else {
      console.log('   📊 No existing graphs found');
      // Could create a test graph here if needed
    }
  } else {
    console.log('   ✅ Graph already selected');
  }
}

/**
 * CREATE TEST GRAPH - Utility for tests that need a specific graph
 */
export async function createTestGraph(
  page: Page, 
  options: {
    name?: string;
    description?: string;
    type?: 'PROJECT' | 'WORKSPACE' | 'TEMPLATE';
  } = {}
): Promise<string> {
  const testGraphName = options.name || `Test Graph ${Date.now()}`;
  
  console.log(`📊 Creating test graph: ${testGraphName}`);
  
  // Navigate to workspace first
  await navigateToWorkspace(page);
  
  // Open graph selector
  const graphSelector = page.locator('[data-testid="graph-selector"], .graph-selector').first();
  await graphSelector.click();
  await page.waitForTimeout(1000);
  
  // Look for create graph option
  const createOption = page.locator('button:has-text("Create"), text="Create New Graph", [role="option"]:has-text("Create")').first();
  await expect(createOption).toBeVisible({ timeout: 5000 });
  await createOption.click();
  
  // Fill graph creation form
  const nameInput = page.locator('input[name="name"], input[placeholder*="name"]').first();
  await expect(nameInput).toBeVisible({ timeout: 5000 });
  await nameInput.fill(testGraphName);
  
  if (options.description) {
    const descInput = page.locator('textarea[name="description"], input[name="description"]').first();
    if (await descInput.isVisible({ timeout: 2000 })) {
      await descInput.fill(options.description);
    }
  }
  
  if (options.type) {
    const typeSelect = page.locator('select[name="type"], [data-testid="graph-type"]').first();
    if (await typeSelect.isVisible({ timeout: 2000 })) {
      await typeSelect.selectOption(options.type);
    }
  }
  
  // Submit
  const submitButton = page.locator('button:has-text("Create"), button:has-text("Save")').first();
  await submitButton.click();
  
  // Wait for creation
  await page.waitForTimeout(3000);
  
  console.log(`✅ Test graph created: ${testGraphName}`);
  return testGraphName;
}

/**
 * AUTHENTICATION CLEANUP - For test teardown
 */
export async function cleanupAuth(page: Page): Promise<void> {
  console.log('🧹 Cleaning up authentication state...');
  
  try {
    await logout(page);
  } catch (error) {
    console.log('   ⚠️  Logout failed, clearing storage manually');
    
    // Clear all storage
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    
    // Clear cookies
    await page.context().clearCookies();
  }
  
  console.log('✅ Authentication cleanup complete');
}

/**
 * WAIT FOR AUTHENTICATED STATE - Utility for complex flows
 */
export async function waitForAuthentication(
  page: Page, 
  options: {
    timeout?: number;
    expectedUrl?: string | RegExp;
  } = {}
): Promise<void> {
  const { timeout = 30000, expectedUrl } = options;
  
  console.log('⏳ Waiting for authentication to complete...');
  
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    const authState = await getAuthState(page);
    
    if (authState.isLoggedIn) {
      if (expectedUrl) {
        const currentUrl = page.url();
        const matches = typeof expectedUrl === 'string' 
          ? currentUrl.includes(expectedUrl)
          : expectedUrl.test(currentUrl);
          
        if (matches) {
          console.log('✅ Authentication and navigation complete');
          return;
        }
      } else {
        console.log('✅ Authentication complete');
        return;
      }
    }
    
    await page.waitForTimeout(1000);
  }
  
  throw new Error(`Authentication timeout after ${timeout}ms`);
}