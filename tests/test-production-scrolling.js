#!/usr/bin/env node

// Direct production test for scrolling issues
const { chromium } = require('playwright');

async function testProductionScrolling() {
  console.log('🧪 PRODUCTION SCROLLING TEST');
  console.log('   Target: https://localhost:3128');
  console.log('   Mission: Detect workspace scrolling issues');
  
  const browser = await chromium.launch({ 
    headless: false,
    ignoreHTTPSErrors: true,
    slowMo: 500
  });
  
  const page = await browser.newPage();
  
  try {
    // Step 1: Navigate to production GraphDone
    console.log('\n=== STEP 1: CONNECT TO PRODUCTION ===');
    await page.goto('https://localhost:3128', { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });
    
    await page.screenshot({ path: 'prod-step1-initial.png' });
    console.log('✅ Connected to production deployment');
    
    // Step 2: Handle authentication
    console.log('\n=== STEP 2: AUTHENTICATION ===');
    
    // Look for login form or check if already logged in
    await page.waitForTimeout(3000);
    
    // Try to find login elements
    const usernameField = page.locator('input[name="username"], input[type="text"], input[placeholder*="username" i]');
    const passwordField = page.locator('input[name="password"], input[type="password"]');
    
    if (await usernameField.isVisible({ timeout: 3000 })) {
      console.log('📝 Login form found - logging in as admin');
      
      await usernameField.fill('admin');
      await passwordField.fill('graphdone');
      
      const loginButton = page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign")');
      await loginButton.click();
      
      await page.waitForTimeout(3000);
      await page.screenshot({ path: 'prod-step2-after-login.png' });
      console.log('✅ Login completed');
    } else {
      console.log('ℹ️ No login form - may already be authenticated');
    }
    
    // Step 3: Navigate to workspace and find view switchers
    console.log('\n=== STEP 3: WORKSPACE NAVIGATION ===');
    
    // Look for workspace or navigate to it
    const currentUrl = page.url();
    if (!currentUrl.includes('/workspace')) {
      try {
        await page.goto('https://localhost:3128/workspace', { waitUntil: 'networkidle' });
        await page.waitForTimeout(3000);
      } catch (error) {
        console.log('   Trying root path for workspace...');
        await page.goto('https://localhost:3128/', { waitUntil: 'networkidle' });
        await page.waitForTimeout(3000);
      }
    }
    
    await page.screenshot({ path: 'prod-step3-workspace.png' });
    console.log('✅ Navigated to workspace area');
    
    // Step 4: Test view switching and scrolling
    console.log('\n=== STEP 4: VIEW SWITCHING & SCROLLING TEST ===');
    
    const viewTests = [
      { name: 'Table', selectors: ['button:has-text("Table")', '[data-view="table"]', 'text="Table"'] },
      { name: 'Kanban', selectors: ['button:has-text("Kanban")', '[data-view="kanban"]', 'text="Kanban"'] },
      { name: 'Graph', selectors: ['button:has-text("Graph")', '[data-view="graph"]', 'text="Graph"'] },
      { name: 'Dashboard', selectors: ['button:has-text("Dashboard")', '[data-view="dashboard"]', 'text="Dashboard"'] }
    ];
    
    const scrollingResults = {
      viewsTested: 0,
      viewsWithScrolling: [],
      viewsWithoutScrolling: [],
      scrollingIssues: []
    };
    
    for (const view of viewTests) {
      console.log(`\n--- Testing ${view.name} View ---`);
      
      let viewSwitched = false;
      
      // Try to find and click the view button
      for (const selector of view.selectors) {
        const button = page.locator(selector);
        if (await button.isVisible({ timeout: 2000 })) {
          console.log(`   Found ${view.name} button: ${selector}`);
          try {
            await button.click();
            await page.waitForTimeout(2000);
            viewSwitched = true;
            break;
          } catch (error) {
            console.log(`   Click failed for ${selector}: ${error.message}`);
          }
        }
      }
      
      if (!viewSwitched) {
        console.log(`   ⚠️ Could not switch to ${view.name} view - buttons not found`);
        continue;
      }
      
      scrollingResults.viewsTested++;
      
      // Set short viewport to force scrolling needs
      await page.setViewportSize({ width: 1280, height: 400 });
      await page.waitForTimeout(1000);
      
      // Test scrolling capability
      const scrollTest = await page.evaluate(() => {
        const initialScroll = window.scrollY;
        const documentHeight = document.documentElement.scrollHeight;
        const viewportHeight = window.innerHeight;
        const shouldScroll = documentHeight > viewportHeight;
        
        // Try to scroll
        window.scrollBy(0, 200);
        const afterScroll = window.scrollY;
        const didScroll = afterScroll !== initialScroll;
        
        // Reset scroll
        window.scrollTo(0, 0);
        
        return {
          shouldScroll,
          didScroll,
          documentHeight,
          viewportHeight,
          scrollAttempt: { initial: initialScroll, after: afterScroll }
        };
      });
      
      console.log(`   Content: ${scrollTest.documentHeight}px, Viewport: ${scrollTest.viewportHeight}px`);
      console.log(`   Should scroll: ${scrollTest.shouldScroll}, Did scroll: ${scrollTest.didScroll}`);
      
      if (scrollTest.shouldScroll && !scrollTest.didScroll) {
        console.log(`   ❌ ${view.name}: SCROLLING BROKEN - content overflows but scroll not working`);
        scrollingResults.viewsWithoutScrolling.push(view.name);
        scrollingResults.scrollingIssues.push(`${view.name} view has ${scrollTest.documentHeight}px content in ${scrollTest.viewportHeight}px viewport but cannot scroll`);
      } else if (scrollTest.shouldScroll && scrollTest.didScroll) {
        console.log(`   ✅ ${view.name}: Scrolling works correctly`);
        scrollingResults.viewsWithScrolling.push(view.name);
      } else {
        console.log(`   ℹ️ ${view.name}: No scrolling needed (content fits)`);
      }
      
      // Take screenshot
      await page.screenshot({ 
        path: `prod-${view.name.toLowerCase()}-view-scrolltest.png`,
        fullPage: true 
      });
      
      // Reset viewport for next test
      await page.setViewportSize({ width: 1280, height: 720 });
    }
    
    // Step 5: Comprehensive report
    console.log('\n=== COMPREHENSIVE SCROLLING REPORT ===');
    console.log(`Views tested: ${scrollingResults.viewsTested}`);
    console.log(`Views with working scrolling: ${scrollingResults.viewsWithScrolling.join(', ') || 'NONE'}`);
    console.log(`Views with broken scrolling: ${scrollingResults.viewsWithoutScrolling.join(', ') || 'NONE'}`);
    
    if (scrollingResults.scrollingIssues.length > 0) {
      console.log('\n🐛 SCROLLING ISSUES DETECTED:');
      scrollingResults.scrollingIssues.forEach((issue, i) => {
        console.log(`${i + 1}. ${issue}`);
      });
    }
    
    // User's specific bug report verification
    console.log('\n=== USER BUG VERIFICATION ===');
    console.log('User reported: "all pages besides the graph need the ability to scroll"');
    
    const nonGraphBrokenViews = scrollingResults.viewsWithoutScrolling.filter(view => view !== 'Graph');
    
    if (nonGraphBrokenViews.length > 0) {
      console.log('🎯 BUG CONFIRMED: Non-graph views have scrolling issues');
      console.log(`   Affected views: ${nonGraphBrokenViews.join(', ')}`);
      console.log('   This matches the user report exactly');
    } else if (scrollingResults.viewsWithoutScrolling.includes('Graph')) {
      console.log('🤔 Interesting: Graph view has scrolling issues (opposite of user report)');
    } else {
      console.log('✅ Bug not reproduced: All tested views have working scrolling');
    }
    
    // Step 6: Additional UI interaction testing
    console.log('\n=== STEP 6: BASIC UI INTERACTION TEST ===');
    
    // Find and test interactive elements
    const interactiveElements = await page.locator('button:visible, a:visible, input:visible').count();
    console.log(`Found ${interactiveElements} interactive elements`);
    
    let clickableCount = 0;
    const buttons = page.locator('button:visible');
    const buttonCount = await buttons.count();
    
    console.log(`Testing ${Math.min(buttonCount, 5)} buttons for clickability...`);
    
    for (let i = 0; i < Math.min(buttonCount, 5); i++) {
      const button = buttons.nth(i);
      const buttonText = await button.textContent() || `Button ${i}`;
      
      try {
        const boundingBox = await button.boundingBox();
        if (boundingBox && boundingBox.width > 0 && boundingBox.height > 0) {
          await button.click({ timeout: 3000 });
          clickableCount++;
          console.log(`   ✅ "${buttonText}" clickable`);
          await page.waitForTimeout(500);
        } else {
          console.log(`   ⚠️ "${buttonText}" has no dimensions`);
        }
      } catch (error) {
        console.log(`   ❌ "${buttonText}" not clickable: ${error.message}`);
      }
    }
    
    const clickabilityRatio = buttonCount > 0 ? (clickableCount / Math.min(buttonCount, 5) * 100).toFixed(1) : 0;
    console.log(`Clickability: ${clickableCount}/${Math.min(buttonCount, 5)} = ${clickabilityRatio}%`);
    
    // Final screenshot
    await page.screenshot({ path: 'prod-final-state.png', fullPage: true });
    
    console.log('\n✅ PRODUCTION SCROLLING TEST COMPLETED');
    console.log('\n📁 Screenshots generated:');
    console.log('   - prod-step1-initial.png');
    console.log('   - prod-step2-after-login.png'); 
    console.log('   - prod-step3-workspace.png');
    console.log('   - prod-*-view-scrolltest.png (for each view)');
    console.log('   - prod-final-state.png');
    
    console.log('\n🔍 Keep browser open for manual inspection...');
    console.log('   Press Ctrl+C when done');
    
    // Keep browser open for manual inspection
    await new Promise(() => {});
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    await page.screenshot({ path: 'prod-error.png' });
  } finally {
    // Browser will stay open due to infinite wait
  }
}

testProductionScrolling().catch(console.error);