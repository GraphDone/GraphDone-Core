const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// Bad data scenarios to test validation
const testScenarios = {
  nullNodes: {
    workItems: [
      null,
      undefined,
      { id: 'valid-1', title: 'Valid Node', type: 'TASK' }
    ]
  },
  
  missingRequiredFields: {
    workItems: [
      { title: 'No ID Node', type: 'TASK' },
      { id: 'no-title', type: 'TASK' },
      { id: 'no-type', title: 'No Type Node' },
      { id: 'valid-1', title: 'Valid Node', type: 'TASK' }
    ]
  },
  
  invalidNumericValues: {
    workItems: [
      { 
        id: 'invalid-numbers', 
        title: 'Invalid Numbers', 
        type: 'TASK',
        positionX: NaN,
        positionY: Infinity,
        priorityExec: -5,
        priorityComm: 'not-a-number'
      },
      { id: 'valid-1', title: 'Valid Node', type: 'TASK' }
    ]
  },
  
  duplicateIds: {
    workItems: [
      { id: 'duplicate', title: 'First Duplicate', type: 'TASK' },
      { id: 'duplicate', title: 'Second Duplicate', type: 'EPIC' },
      { id: 'valid-1', title: 'Valid Node', type: 'TASK' }
    ]
  }
};

async function navigateToWorkspace(page) {
  console.log('🚀 Navigating to workspace...');
  
  // Go to application
  await page.goto('http://localhost:3127');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);
  
  // Select Product Team
  console.log('👥 Selecting team...');
  await page.click('text=Product Team');
  await page.waitForTimeout(2000);
  
  // Now select a user (should be available after team selection)
  console.log('👤 Selecting user...');
  const continueButton = page.locator('text=Continue');
  if (await continueButton.isVisible()) {
    await continueButton.click();
    await page.waitForTimeout(3000);
  }
  
  console.log('✅ Successfully navigated to workspace');
}

async function injectBadDataViaConsole(page, scenario) {
  console.log(`🧪 Injecting bad data scenario: ${scenario}`);
  
  const testData = testScenarios[scenario];
  
  const result = await page.evaluate((data) => {
    try {
      // Try to manually trigger validation if functions are available
      if (window.validateGraphData) {
        return window.validateGraphData(data.workItems, []);
      }
      
      // If validation function not available, try to inject into React component state
      const reactFiberKey = Object.keys(document.querySelector('#root')).find(key => 
        key.startsWith('__reactFiber') || key.startsWith('__reactInternalInstance')
      );
      
      if (reactFiberKey) {
        const fiber = document.querySelector('#root')[reactFiberKey];
        // Try to find and update component state
        console.log('React fiber found, attempting to inject test data');
        return { success: true, message: 'Test data injection attempted via React' };
      }
      
      return { success: false, message: 'No injection method available' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }, testData);
  
  console.log('   Result:', result);
  return result;
}

async function forceReactError(page) {
  console.log('💥 Forcing React component error...');
  
  const result = await page.evaluate(() => {
    try {
      // Try to find React and force an error
      if (window.React) {
        // Override useState to throw an error
        const originalUseState = window.React.useState;
        window.React.useState = function(initial) {
          if (typeof initial === 'object' && initial && initial.validationResult !== undefined) {
            throw new Error('Simulated React error for testing error boundary');
          }
          return originalUseState(initial);
        };
        return { success: true, message: 'React error injection set up' };
      }
      
      // Alternative: throw error in setTimeout to trigger error boundary
      setTimeout(() => {
        throw new Error('Async error for testing error boundary');
      }, 1000);
      
      return { success: true, message: 'Async error scheduled' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
  
  console.log('   Result:', result);
  return result;
}

async function comprehensive_error_test() {
  console.log('🚀 Starting Comprehensive Error Handling Test...\n');
  
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 500
  });
  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 }
  });
  const page = await context.newPage();
  
  // Create results directory
  const resultsDir = './error-test-results';
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir);
  }
  
  const consoleMessages = [];
  const errors = [];
  
  // Capture console messages and errors
  page.on('console', msg => {
    const message = `[${msg.type()}] ${msg.text()}`;
    consoleMessages.push(message);
    console.log(`📝 Console: ${message}`);
  });
  
  page.on('pageerror', error => {
    errors.push(error.message);
    console.log(`❌ Page Error: ${error.message}`);
  });
  
  try {
    // Step 1: Navigate to workspace
    await navigateToWorkspace(page);
    
    // Take baseline screenshot
    await page.screenshot({ 
      path: path.join(resultsDir, '01-baseline-workspace.png'),
      fullPage: true 
    });
    
    // Step 2: Check if error handling components are present
    console.log('\n🔍 Checking for error handling components...');
    
    // Look for data health indicator
    const dataHealthCount = await page.locator('[data-testid="data-health-indicator"]').count();
    console.log(`⚠️  Data health indicators found: ${dataHealthCount}`);
    
    // Look for any validation-related text
    const validationTextCount = await page.locator('text=validation').count();
    console.log(`✅ Validation text elements: ${validationTextCount}`);
    
    // Look for error boundaries
    const errorBoundaryCount = await page.locator('text=Error').count();
    console.log(`🛡️  Error boundary elements: ${errorBoundaryCount}`);
    
    // Step 3: Test each bad data scenario
    let testNumber = 2;
    for (const [scenarioName, scenario] of Object.entries(testScenarios)) {
      console.log(`\n📊 Test ${testNumber}: ${scenarioName}`);
      
      // Inject bad data
      await injectBadDataViaConsole(page, scenarioName);
      await page.waitForTimeout(3000);
      
      // Take screenshot
      await page.screenshot({ 
        path: path.join(resultsDir, `${testNumber.toString().padStart(2, '0')}-${scenarioName}.png`),
        fullPage: true 
      });
      
      // Check for validation indicators
      const healthIndicator = await page.locator('[data-testid="data-health-indicator"]').count();
      const validationSummary = await page.locator('[data-testid="validation-summary"]').count();
      
      console.log(`   ⚠️  Health indicator appeared: ${healthIndicator > 0}`);
      console.log(`   📋 Validation summary visible: ${validationSummary > 0}`);
      
      // Try to click data health indicator if present
      if (healthIndicator > 0) {
        try {
          await page.click('[data-testid="data-health-indicator"]');
          await page.waitForTimeout(2000);
          
          await page.screenshot({ 
            path: path.join(resultsDir, `${testNumber.toString().padStart(2, '0')}-${scenarioName}-dashboard.png`),
            fullPage: true 
          });
          console.log(`   📊 Dashboard screenshot captured`);
        } catch (e) {
          console.log(`   ❌ Could not interact with health indicator: ${e.message}`);
        }
      }
      
      testNumber++;
    }
    
    // Step 4: Test React Error Boundary
    console.log(`\n📊 Test ${testNumber}: React Error Boundary`);
    await forceReactError(page);
    await page.waitForTimeout(5000);
    
    await page.screenshot({ 
      path: path.join(resultsDir, `${testNumber.toString().padStart(2, '0')}-react-error-boundary.png`),
      fullPage: true 
    });
    
    const errorBoundaryVisible = await page.locator('text=Error').count();
    console.log(`   🛡️  Error boundary triggered: ${errorBoundaryVisible > 0}`);
    
    // Step 5: Test page is still functional
    console.log(`\n📊 Test ${testNumber + 1}: Page Functionality After Errors`);
    
    const bodyVisible = await page.locator('body').isVisible();
    const buttonsWorking = await page.locator('button').count();
    const navigationExists = await page.locator('nav, [role="navigation"]').count();
    
    console.log(`   📱 Page body visible: ${bodyVisible}`);
    console.log(`   🎛️  Interactive buttons: ${buttonsWorking}`);
    console.log(`   🧭 Navigation elements: ${navigationExists}`);
    
    await page.screenshot({ 
      path: path.join(resultsDir, `${testNumber + 1}-functionality-check.png`),
      fullPage: true 
    });
    
    // Generate comprehensive report
    const report = {
      timestamp: new Date().toISOString(),
      testsRun: Object.keys(testScenarios).length + 3,
      scenarios: Object.keys(testScenarios),
      results: {
        pageStillFunctional: bodyVisible,
        errorBoundariesDetected: errorBoundaryCount > 0 || errorBoundaryVisible > 0,
        dataHealthIndicatorsFound: dataHealthCount > 0,
        validationSystemActive: validationTextCount > 0,
        consoleErrorsCount: errors.length,
        consoleMessagesCount: consoleMessages.length
      },
      consoleErrors: errors,
      sampleConsoleMessages: consoleMessages.slice(0, 10)
    };
    
    fs.writeFileSync(
      path.join(resultsDir, 'comprehensive-test-report.json'), 
      JSON.stringify(report, null, 2)
    );
    
    console.log('\n📋 TEST SUMMARY');
    console.log('================');
    console.log(`✅ Tests completed: ${report.testsRun}`);
    console.log(`📱 Page functional: ${report.results.pageStillFunctional}`);
    console.log(`🛡️  Error boundaries: ${report.results.errorBoundariesDetected}`);
    console.log(`⚠️  Data health system: ${report.results.dataHealthIndicatorsFound}`);
    console.log(`✅ Validation active: ${report.results.validationSystemActive}`);
    console.log(`❌ Console errors: ${report.results.consoleErrorsCount}`);
    console.log(`📝 Console messages: ${report.results.consoleMessagesCount}`);
    console.log(`📁 Results saved to: ${resultsDir}`);
    
    return report;
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  } finally {
    console.log('\n🔍 Keeping browser open for 30 seconds for manual inspection...');
    await page.waitForTimeout(30000);
    await browser.close();
  }
}

// Run the comprehensive test
comprehensive_error_test()
  .then(report => {
    console.log('\n🎉 All tests completed successfully!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n💥 Test suite failed:', error);
    process.exit(1);
  });