const { chromium } = require('playwright');

async function manualErrorDemo() {
  console.log('🚀 Manual Error Handling Demo - Interactive Session');
  console.log('This will open a browser for you to manually test the error handling');
  
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 1000,
    devtools: true
  });
  
  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 }
  });
  
  const page = await context.newPage();
  
  console.log('\n📝 Instructions:');
  console.log('1. Navigate through the login process manually');
  console.log('2. Open DevTools console (F12)');
  console.log('3. Try the following tests:');
  console.log('');
  console.log('🧪 Test 1 - Check for validation functions:');
  console.log('   window.validateGraphData');
  console.log('');
  console.log('🧪 Test 2 - Inject bad data:');
  console.log('   const badData = [null, {id: "test", title: "valid"}];');
  console.log('   const result = window.validateGraphData(badData, []);');
  console.log('   console.log(result);');
  console.log('');
  console.log('🧪 Test 3 - Look for error handling UI elements:');
  console.log('   document.querySelector("[data-testid=\\"data-health-indicator\\"]")');
  console.log('');
  console.log('🧪 Test 4 - Check React error boundaries:');
  console.log('   throw new Error("Test error for error boundary");');
  console.log('');
  console.log('⚠️ Note: The browser will stay open until you close it manually');
  
  await page.goto('http://localhost:3127');
  
  // Add helpful debugging info to the page
  await page.addInitScript(() => {
    // Add helper functions to window for easy testing
    window.testErrorHandling = {
      injectBadData: () => {
        const badData = [
          null,
          undefined,
          { id: 'missing-title', type: 'TASK' },
          { title: 'missing-id', type: 'TASK' },
          { id: 'invalid-numbers', title: 'test', type: 'TASK', positionX: NaN, priorityExec: -5 },
          { id: 'valid', title: 'Valid Node', type: 'TASK' }
        ];
        
        if (window.validateGraphData) {
          const result = window.validateGraphData(badData, []);
          console.log('🧪 Validation result:', result);
          return result;
        } else {
          console.log('❌ validateGraphData function not available');
          return null;
        }
      },
      
      checkErrorHandling: () => {
        const elements = {
          errorBoundaries: document.querySelectorAll('[data-error-boundary]').length,
          dataHealthIndicators: document.querySelectorAll('[data-testid="data-health-indicator"]').length,
          validationSummaries: document.querySelectorAll('[data-testid="validation-summary"]').length,
          graphContainers: document.querySelectorAll('.graph-container, svg').length
        };
        console.log('🔍 Error handling elements found:', elements);
        return elements;
      },
      
      forceReactError: () => {
        console.log('💥 Forcing React error...');
        throw new Error('Test React error for error boundary demonstration');
      }
    };
    
    console.log('🛠️ Helper functions added to window.testErrorHandling:');
    console.log('   - injectBadData()');
    console.log('   - checkErrorHandling()');
    console.log('   - forceReactError()');
  });
  
  // Wait indefinitely until browser is closed
  console.log('\n🌐 Browser opened. Test the error handling manually!');
  console.log('   Close the browser window when done.');
  
  try {
    // This will keep the script running until the browser is closed
    await page.waitForEvent('close', { timeout: 0 });
  } catch (error) {
    // Browser was closed
    console.log('\n✅ Browser closed. Demo complete!');
  }
  
  await browser.close();
  console.log('🎉 Manual error handling demo finished!');
}

manualErrorDemo().catch(console.error);