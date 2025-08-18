const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// Test scenarios with bad data
const testScenarios = {
  nullNodes: {
    workItems: [
      null,
      undefined,
      { id: 'valid-1', title: 'Valid Node', type: 'TASK' }
    ],
    edges: []
  },
  
  missingRequiredFields: {
    workItems: [
      { title: 'No ID Node', type: 'TASK' },
      { id: 'no-title', type: 'TASK' },
      { id: 'no-type', title: 'No Type Node' },
      { id: 'valid-1', title: 'Valid Node', type: 'TASK' }
    ],
    edges: []
  },
  
  invalidNumericValues: {
    workItems: [
      { 
        id: 'invalid-numbers', 
        title: 'Invalid Numbers', 
        type: 'TASK',
        positionX: NaN,
        positionY: Infinity,
        priorityExec: -1,
        priorityComm: 2.5
      },
      { id: 'valid-1', title: 'Valid Node', type: 'TASK' }
    ],
    edges: []
  },
  
  duplicateIds: {
    workItems: [
      { id: 'duplicate', title: 'First Duplicate', type: 'TASK' },
      { id: 'duplicate', title: 'Second Duplicate', type: 'EPIC' },
      { id: 'valid-1', title: 'Valid Node', type: 'TASK' }
    ],
    edges: []
  }
};

async function injectBadData(page, scenario) {
  const testData = testScenarios[scenario];
  
  console.log(`\n🧪 Testing scenario: ${scenario}`);
  console.log(`   Nodes: ${testData.workItems.length}, Edges: ${testData.edges.length}`);
  
  // Override GraphQL responses to return bad data
  await page.route('**/graphql', async route => {
    const request = route.request();
    const postData = request.postData();
    
    if (postData && postData.includes('GetWorkItems')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: { workItems: testData.workItems }
        })
      });
    } else if (postData && postData.includes('GetEdges')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: { edges: testData.edges }
        })
      });
    } else {
      await route.continue();
    }
  });
}

async function testErrorHandling() {
  console.log('🚀 Starting Error Handling Tests...\n');
  
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 }
  });
  const page = await context.newPage();
  
  // Create screenshots directory
  const screenshotsDir = './error-handling-screenshots';
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir);
  }
  
  // Collect console errors
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });
  
  try {
    // First, handle login
    console.log('🔐 Logging in...');
    await page.goto('http://localhost:3127');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // Check if we need to login
    const needsLogin = await page.locator('text=Login', 'text=Sign in').count() > 0;
    if (needsLogin) {
      console.log('   Login required, attempting to login...');
      
      // Try to find and fill login form
      const emailInput = page.locator('input[type="email"], input[name="email"]');
      const passwordInput = page.locator('input[type="password"], input[name="password"]');
      const loginButton = page.locator('button:has-text("Login"), button:has-text("Sign in")');
      
      if (await emailInput.count() > 0) {
        await emailInput.fill('demo@example.com');
        await passwordInput.fill('demo123');
        await loginButton.click();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(3000);
      } else {
        // Try to find any demo/skip buttons
        const demoButton = page.locator('button:has-text("Demo"), button:has-text("Skip"), button:has-text("Continue")');
        if (await demoButton.count() > 0) {
          await demoButton.first().click();
          await page.waitForLoadState('networkidle');
          await page.waitForTimeout(3000);
        }
      }
    }
    
    // Navigate to workspace/graph view
    const graphViewButton = page.locator('[data-testid="graph-view-button"], button:has-text("Graph")');
    if (await graphViewButton.count() > 0) {
      await graphViewButton.click();
      await page.waitForTimeout(2000);
    }
    
    // Test 1: Normal operation (baseline)
    console.log('📊 Test 1: Normal operation (baseline)');
    await page.waitForTimeout(3000);
    
    // Take baseline screenshot
    await page.screenshot({ 
      path: path.join(screenshotsDir, '01-baseline-normal.png'),
      fullPage: true 
    });
    
    // Check for any graph elements
    const hasGraph = await page.locator('svg, .graph-container').count();
    console.log(`   ✅ Baseline: Found ${hasGraph} graph elements`);
    
    // Test each error scenario
    let testNumber = 2;
    for (const [scenarioName, scenario] of Object.entries(testScenarios)) {
      console.log(`\n📊 Test ${testNumber}: ${scenarioName}`);
      
      // Go to fresh page and login again
      await page.goto('http://localhost:3127');
      await page.waitForLoadState('networkidle');
      
      // Setup bad data injection before any requests
      await injectBadData(page, scenarioName);
      
      // Navigate through login process if needed
      await page.waitForTimeout(3000);
      const graphViewButton = page.locator('[data-testid="graph-view-button"], button:has-text("Graph")');
      if (await graphViewButton.count() > 0) {
        await graphViewButton.click();
        await page.waitForTimeout(2000);
      }
      
      await page.waitForTimeout(5000); // Give time for validation to run
      
      // Take screenshot
      await page.screenshot({ 
        path: path.join(screenshotsDir, `${testNumber.toString().padStart(2, '0')}-${scenarioName}.png`),
        fullPage: true 
      });
      
      // Check if page is still functional
      const bodyVisible = await page.locator('body').isVisible();
      const hasErrorBoundary = await page.locator('text=Error').count();
      const hasDataHealthIndicator = await page.locator('[data-testid="data-health-indicator"]').count();
      const hasValidationSummary = await page.locator('[data-testid="validation-summary"]').count();
      
      console.log(`   📱 Page visible: ${bodyVisible}`);
      console.log(`   🛡️  Error boundary active: ${hasErrorBoundary > 0}`);
      console.log(`   ⚠️  Data health indicator: ${hasDataHealthIndicator > 0}`);
      console.log(`   📋 Validation summary: ${hasValidationSummary > 0}`);
      
      // Try to interact with data health indicator if present
      if (hasDataHealthIndicator > 0) {
        try {
          await page.click('[data-testid="data-health-indicator"]');
          await page.waitForTimeout(1000);
          
          // Take screenshot of data health dashboard
          await page.screenshot({ 
            path: path.join(screenshotsDir, `${testNumber.toString().padStart(2, '0')}-${scenarioName}-dashboard.png`),
            fullPage: true 
          });
          console.log(`   📊 Dashboard screenshot captured`);
          
          // Check validation summary content
          const summaryText = await page.locator('[data-testid="validation-summary"]').textContent();
          console.log(`   📄 Validation summary: ${summaryText?.substring(0, 100)}...`);
          
        } catch (e) {
          console.log(`   ❌ Could not interact with data health indicator: ${e.message}`);
        }
      }
      
      testNumber++;
    }
    
    // Test React Error Boundary
    console.log(`\n📊 Test ${testNumber}: React Error Boundary`);
    await page.goto('http://localhost:3127');
    await page.waitForLoadState('networkidle');
    
    // Inject code to force a React error
    await page.addInitScript(() => {
      // Override React to throw an error
      setTimeout(() => {
        if (window.React && window.React.useEffect) {
          const originalUseEffect = window.React.useEffect;
          window.React.useEffect = function(callback, deps) {
            if (callback && callback.toString().includes('validation')) {
              throw new Error('Simulated React error for testing error boundary');
            }
            return originalUseEffect(callback, deps);
          };
        }
      }, 2000);
    });
    
    await page.reload();
    await page.waitForTimeout(5000);
    
    await page.screenshot({ 
      path: path.join(screenshotsDir, `${testNumber.toString().padStart(2, '0')}-react-error-boundary.png`),
      fullPage: true 
    });
    
    const hasErrorBoundaryText = await page.locator('text=Error').count();
    console.log(`   🛡️  Error boundary triggered: ${hasErrorBoundaryText > 0}`);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    console.log(`\n📄 Console errors collected: ${consoleErrors.length}`);
    if (consoleErrors.length > 0) {
      console.log('   First few errors:');
      consoleErrors.slice(0, 3).forEach((error, i) => {
        console.log(`   ${i + 1}. ${error.substring(0, 100)}...`);
      });
    }
    
    // Generate test report
    const report = {
      timestamp: new Date().toISOString(),
      totalTests: Object.keys(testScenarios).length + 2,
      scenarios: Object.keys(testScenarios),
      consoleErrors: consoleErrors.length,
      screenshotsGenerated: fs.readdirSync(screenshotsDir).length
    };
    
    fs.writeFileSync(
      path.join(screenshotsDir, 'test-report.json'), 
      JSON.stringify(report, null, 2)
    );
    
    console.log(`\n✅ Test completed! Screenshots saved to: ${screenshotsDir}`);
    console.log(`📊 Total screenshots: ${report.screenshotsGenerated}`);
    
    await browser.close();
  }
}

// Run the tests
testErrorHandling().catch(console.error);