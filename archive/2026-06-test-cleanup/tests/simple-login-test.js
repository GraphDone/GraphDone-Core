#!/usr/bin/env node

const { chromium } = require('playwright');

async function simpleLoginTest() {
  console.log('🧪 SIMPLE LOGIN TEST');
  console.log('   Target: https://localhost:3128');
  console.log('   Credentials: admin/graphdone');
  
  const browser = await chromium.launch({ 
    headless: false,
    ignoreHTTPSErrors: true,
    slowMo: 1000  // Slow down to see what's happening
  });
  
  const page = await browser.newPage();
  
  try {
    // Navigate to production
    console.log('\n1. Navigating to production...');
    await page.goto('https://localhost:3128');
    await page.waitForLoadState('domcontentloaded');
    
    // Take screenshot of initial state
    await page.screenshot({ path: 'artifacts/screenshots/login-step1-initial.png' });
    console.log('✅ Page loaded');
    
    // Check what's actually on the page
    console.log('\n2. Analyzing page content...');
    const title = await page.title();
    console.log(`   Page title: "${title}"`);
    
    // Look for login form elements
    const emailInput = page.locator('input[type="text"], input[name="username"], input[placeholder*="Email"], input[placeholder*="Username"]').first();
    const passwordInput = page.locator('input[type="password"]').first();
    const signInButton = page.locator('button:has-text("Sign In")').first();
    
    // Check visibility
    const emailVisible = await emailInput.isVisible();
    const passwordVisible = await passwordInput.isVisible();
    const buttonVisible = await signInButton.isVisible();
    
    console.log(`   Email/Username input visible: ${emailVisible}`);
    console.log(`   Password input visible: ${passwordVisible}`);
    console.log(`   Sign In button visible: ${buttonVisible}`);
    
    if (!emailVisible || !passwordVisible || !buttonVisible) {
      console.log('\n❌ Login form not complete. Current page state:');
      const bodyText = await page.locator('body').textContent();
      console.log(`   Body text (first 200 chars): ${bodyText.substring(0, 200)}...`);
      
      // Try to find what elements ARE visible
      const allButtons = await page.locator('button').count();
      const allInputs = await page.locator('input').count();
      console.log(`   Found ${allButtons} buttons, ${allInputs} inputs`);
      
      return;
    }
    
    // Fill login form
    console.log('\n3. Filling login form...');
    await emailInput.fill('admin');
    console.log('   ✅ Username filled');
    
    await passwordInput.fill('graphdone');
    console.log('   ✅ Password filled');
    
    await page.screenshot({ path: 'artifacts/screenshots/login-step2-filled.png' });
    
    // Click sign in
    console.log('\n4. Clicking Sign In...');
    await signInButton.click();
    console.log('   ✅ Sign In clicked');
    
    // Wait for navigation or response
    await page.waitForTimeout(3000);
    
    await page.screenshot({ path: 'artifacts/screenshots/login-step3-after-signin.png' });
    
    // Check if we're still on login page or moved somewhere else
    const newUrl = page.url();
    const stillOnLogin = await page.locator('button:has-text("Sign In")').isVisible();
    
    console.log(`\n5. Login result:`);
    console.log(`   New URL: ${newUrl}`);
    console.log(`   Still on login page: ${stillOnLogin}`);
    
    if (!stillOnLogin) {
      console.log('✅ Login successful - moved away from login page');
      
      // Check for workspace elements
      const hasWorkspace = await page.locator('button:has-text("Graph"), button:has-text("Table")').isVisible();
      console.log(`   Workspace elements visible: ${hasWorkspace}`);
      
    } else {
      console.log('❌ Login failed - still on login page');
      
      // Check for error messages
      const errorMessage = await page.locator('.error, [role="alert"], .text-red-500').textContent().catch(() => 'None');
      console.log(`   Error message: ${errorMessage}`);
    }
    
    console.log('\n📁 Screenshots saved to artifacts/screenshots/:');
    console.log('   - login-step1-initial.png');
    console.log('   - login-step2-filled.png');
    console.log('   - login-step3-after-signin.png');
    
    console.log('\n🔍 Browser staying open - press Ctrl+C when done');
    await new Promise(() => {}); // Keep browser open
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    await page.screenshot({ path: 'artifacts/screenshots/login-error.png' });
  }
}

simpleLoginTest().catch(console.error);