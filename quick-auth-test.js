#!/usr/bin/env node

const { chromium } = require('playwright');

async function quickAuthTest() {
  console.log('🧪 Quick Authentication Test for Production');
  console.log('   Target: https://localhost:3128');
  
  const browser = await chromium.launch({ 
    headless: false,
    ignoreHTTPSErrors: true,
    slowMo: 500
  });
  
  const page = await browser.newPage();
  
  try {
    // Navigate to production
    console.log('\n=== STEP 1: Navigate to Production ===');
    await page.goto('https://localhost:3128', { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });
    
    await page.screenshot({ path: 'auth-test-1-initial.png' });
    console.log('✅ Connected to production deployment');
    
    // Check if we need to log in
    console.log('\n=== STEP 2: Check Authentication State ===');
    const hasLoginForm = await page.locator('button:has-text("Sign In")').isVisible({ timeout: 3000 });
    
    if (hasLoginForm) {
      console.log('📝 Login form found - logging in as admin');
      
      const usernameField = page.locator('input[name="username"], input[type="text"], input[placeholder*="Email"], input[placeholder*="Username"]').first();
      const passwordField = page.locator('input[name="password"], input[type="password"]').first();
      
      await usernameField.fill('admin');
      await passwordField.fill('graphdone');
      
      const loginButton = page.locator('button:has-text("Sign In"), button[type="submit"]').first();
      await loginButton.click();
      
      await page.waitForTimeout(3000);
      await page.screenshot({ path: 'auth-test-2-after-login.png' });
      console.log('✅ Login completed');
    } else {
      console.log('ℹ️ No login form - may already be authenticated or different flow');
    }
    
    // Navigate to workspace
    console.log('\n=== STEP 3: Navigate to Workspace ===');
    const currentUrl = page.url();
    if (!currentUrl.includes('/workspace')) {
      try {
        await page.goto('https://localhost:3128/workspace', { waitUntil: 'networkidle', timeout: 10000 });
      } catch (error) {
        console.log('   Trying root path for workspace...');
        await page.goto('https://localhost:3128/', { waitUntil: 'networkidle', timeout: 10000 });
      }
    }
    
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'auth-test-3-workspace.png' });
    
    // Check workspace elements
    console.log('\n=== STEP 4: Check Workspace Elements ===');
    const workspaceElements = [
      'button:has-text("Graph")',
      'button:has-text("Table")', 
      'button:has-text("Dashboard")',
      '[data-testid="graph-selector"]',
      '.graph-selector',
      'main',
      'header',
      'nav'
    ];
    
    let foundElements = [];
    for (const selector of workspaceElements) {
      const isVisible = await page.locator(selector).isVisible({ timeout: 2000 });
      if (isVisible) {
        foundElements.push(selector);
        console.log(`✅ Found: ${selector}`);
      }
    }
    
    console.log(`\nFound ${foundElements.length} workspace elements:`);
    foundElements.forEach(el => console.log(`  - ${el}`));
    
    // Check for any errors
    console.log('\n=== STEP 5: Error Detection ===');
    const hasErrors = await page.locator('.error, [role="alert"]').isVisible({ timeout: 1000 });
    if (hasErrors) {
      const errorText = await page.locator('.error, [role="alert"]').first().textContent();
      console.log(`❌ Error detected: ${errorText}`);
    } else {
      console.log('✅ No errors detected');
    }
    
    console.log('\n✅ Quick Authentication Test Completed');
    console.log('📁 Screenshots generated:');
    console.log('   - auth-test-1-initial.png');
    console.log('   - auth-test-2-after-login.png'); 
    console.log('   - auth-test-3-workspace.png');
    
    console.log('\n🔍 Keep browser open for manual inspection...');
    console.log('   Press Ctrl+C when done');
    
    // Keep browser open for manual inspection
    await new Promise(() => {});
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    await page.screenshot({ path: 'auth-test-error.png' });
  } finally {
    // Browser will stay open due to infinite wait
  }
}

quickAuthTest().catch(console.error);