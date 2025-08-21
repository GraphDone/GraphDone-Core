import { test, expect } from '@playwright/test';

test('manual interaction test - login flow', async ({ page }) => {
  console.log('🔍 Testing actual login flow...');
  
  // Monitor console errors
  const consoleMessages: string[] = [];
  const jsErrors: string[] = [];
  
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleMessages.push(`CONSOLE ERROR: ${msg.text()}`);
    }
  });

  page.on('pageerror', (error) => {
    jsErrors.push(`JS ERROR: ${error.message}`);
  });
  
  // Navigate to the page
  await page.goto('/');
  
  // Wait for page to load
  await page.waitForLoadState('networkidle');
  
  // Take initial screenshot
  await page.screenshot({ path: 'test-artifacts/manual-test-1-initial.png', fullPage: true });
  
  // Check if we can see the login page
  await expect(page.locator('text=GraphDone')).toBeVisible();
  await expect(page.locator('text=Welcome Back')).toBeVisible();
  
  console.log('✅ Login page loaded successfully');
  
  // Try to click on Product Team
  await page.click('text=Product Team');
  await page.waitForTimeout(500);
  
  await page.screenshot({ path: 'test-artifacts/manual-test-2-team-selected.png', fullPage: true });
  console.log('✅ Team selection works');
  
  // Try to click on a user (Alice Johnson)
  await page.click('text=Alice Johnson');
  await page.waitForTimeout(500);
  
  await page.screenshot({ path: 'test-artifacts/manual-test-3-user-selected.png', fullPage: true });
  console.log('✅ User selection works');
  
  // Try to click Continue
  await page.click('button:has-text("Continue to GraphDone")');
  await page.waitForTimeout(2000);
  
  await page.screenshot({ path: 'test-artifacts/manual-test-4-after-login.png', fullPage: true });
  
  // Check if we got to the main app
  const currentContent = await page.textContent('body');
  console.log('📄 Final page content preview:', currentContent?.substring(0, 200));
  
  // Check if we see the main app UI
  const hasWorkspace = await page.locator('text=Workspace').count() > 0;
  console.log('🏠 Has Workspace:', hasWorkspace);
  
  if (!hasWorkspace) {
    console.log('❌ Login did not complete successfully - page may be blank');
    
    // Log any JavaScript errors
    if (consoleMessages.length > 0) {
      console.log('🚨 Console errors found:');
      consoleMessages.forEach(msg => console.log('  ', msg));
    }
    
    if (jsErrors.length > 0) {
      console.log('🚨 JavaScript errors found:');
      jsErrors.forEach(err => console.log('  ', err));
    }
    
    if (consoleMessages.length === 0 && jsErrors.length === 0) {
      console.log('🤔 No JavaScript errors found - checking for other issues...');
    }
  } else {
    console.log('✅ Login completed successfully');
  }
});