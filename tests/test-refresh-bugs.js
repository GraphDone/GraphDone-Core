#!/usr/bin/env node

// Quick manual test script to validate the refresh bugs
// This connects to the production deployment at localhost:3128

const { chromium } = require('playwright');

async function testRefreshBugs() {
  console.log('🧪 Testing GraphDone refresh bugs manually...');
  console.log('🌐 Connecting to production deployment at https://localhost:3128');
  
  const browser = await chromium.launch({ 
    headless: false,
    ignoreHTTPSErrors: true, // Accept self-signed certs for dev testing
    slowMo: 1000 // Slow down for visibility
  });
  
  const page = await browser.newPage();
  
  try {
    // Step 1: Navigate to production GraphDone
    console.log('Step 1: Navigating to GraphDone...');
    await page.goto('https://localhost:3128', { waitUntil: 'networkidle' });
    
    // Wait for the page to load
    await page.waitForTimeout(3000);
    
    // Step 2: Login as admin
    console.log('Step 2: Logging in as admin...');
    
    // Look for login elements
    const loginButton = page.locator('button:has-text("Login"), a:has-text("Login"), [href*="login"]').first();
    if (await loginButton.isVisible({ timeout: 5000 })) {
      await loginButton.click();
      await page.waitForTimeout(2000);
    }
    
    // Try to login with admin/graphdone
    const usernameField = page.locator('input[name="username"], input[type="text"], input[placeholder*="username"]').first();
    const passwordField = page.locator('input[name="password"], input[type="password"], input[placeholder*="password"]').first();
    
    if (await usernameField.isVisible({ timeout: 5000 })) {
      await usernameField.fill('admin');
      await passwordField.fill('graphdone');
      
      const submitButton = page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign")').first();
      await submitButton.click();
      
      await page.waitForTimeout(3000);
      console.log('✅ Login attempt completed');
    } else {
      console.log('ℹ️ No login form found - may already be logged in or different auth system');
    }
    
    // Step 3: Look for graph visualization or workspace
    console.log('Step 3: Looking for graph workspace...');
    
    await page.waitForTimeout(5000);
    
    // Take a screenshot to see current state
    await page.screenshot({ path: 'current-state.png' });
    console.log('📸 Screenshot saved as current-state.png');
    
    // Step 4: Test node creation (if possible)
    console.log('Step 4: Testing node creation workflow...');
    
    // Look for create/add buttons
    const createButtons = await page.locator('button:has-text("Create"), button:has-text("Add"), button:has-text("+")').count();
    console.log(`Found ${createButtons} potential create buttons`);
    
    if (createButtons > 0) {
      const createBtn = page.locator('button:has-text("Create"), button:has-text("Add"), button:has-text("+")').first();
      await createBtn.click();
      await page.waitForTimeout(2000);
      
      // Look for form fields
      const titleField = page.locator('input[name="title"], input[placeholder*="title"], input[placeholder*="name"]').first();
      if (await titleField.isVisible({ timeout: 3000 })) {
        console.log('✅ Node creation form opened');
        
        await titleField.fill('Test Refresh Bug Node');
        
        const saveBtn = page.locator('button:has-text("Save"), button:has-text("Create"), button:has-text("Submit")').first();
        if (await saveBtn.isVisible({ timeout: 3000 })) {
          console.log('⏳ Creating node...');
          await saveBtn.click();
          await page.waitForTimeout(5000);
          
          // Check if node is immediately visible
          const nodeVisible = await page.locator('text="Test Refresh Bug Node"').count() > 0;
          console.log(`Node visible without refresh: ${nodeVisible}`);
          
          if (!nodeVisible) {
            console.log('🐛 REFRESH BUG DETECTED: Node not visible, trying refresh...');
            await page.reload();
            await page.waitForTimeout(3000);
            
            const nodeVisibleAfterRefresh = await page.locator('text="Test Refresh Bug Node"').count() > 0;
            console.log(`Node visible after refresh: ${nodeVisibleAfterRefresh}`);
            
            if (nodeVisibleAfterRefresh) {
              console.log('🎯 CONFIRMED: Node creation requires refresh bug!');
            }
          }
        }
      }
    }
    
    // Step 5: Test relationship flip (if relationships exist)
    console.log('Step 5: Looking for relationships to test flip direction...');
    
    const relationships = await page.locator('line, path[marker-end], .edge').count();
    console.log(`Found ${relationships} potential relationships`);
    
    if (relationships > 0) {
      const relationship = page.locator('line, path[marker-end], .edge').first();
      await relationship.click();
      await page.waitForTimeout(2000);
      
      // Look for flip button
      const flipBtn = page.locator('button:has-text("Flip"), button:has-text("Reverse"), button[title*="flip"]').first();
      if (await flipBtn.isVisible({ timeout: 3000 })) {
        console.log('⏳ Flipping relationship direction...');
        
        // Capture before state
        await page.screenshot({ path: 'before-flip.png' });
        
        await flipBtn.click();
        await page.waitForTimeout(3000);
        
        // Capture after state  
        await page.screenshot({ path: 'after-flip.png' });
        
        console.log('🔄 Flip attempted - compare before-flip.png and after-flip.png');
        console.log('💡 If they look the same, try refreshing the page manually to see if flip took effect');
        
        // Test refresh
        console.log('Testing refresh after flip...');
        await page.reload();
        await page.waitForTimeout(3000);
        
        await page.screenshot({ path: 'after-flip-refresh.png' });
        console.log('📸 After refresh screenshot: after-flip-refresh.png');
      }
    }
    
    console.log('✅ Manual testing completed!');
    console.log('📁 Check these screenshots:');
    console.log('   - current-state.png (initial state)');
    console.log('   - before-flip.png (before relationship flip)'); 
    console.log('   - after-flip.png (after flip, before refresh)');
    console.log('   - after-flip-refresh.png (after refresh)');
    
    // Keep browser open for manual inspection
    console.log('🔍 Browser staying open for manual inspection...');
    console.log('   Press Ctrl+C to close when done');
    
    // Wait indefinitely
    await new Promise(() => {});
    
  } catch (error) {
    console.error('❌ Test error:', error.message);
  } finally {
    // Browser will stay open due to the infinite wait above
  }
}

// Run the test
testRefreshBugs().catch(console.error);