const { chromium } = require('playwright');

async function testErrorHandling() {
  console.log('🚀 Testing Error Handling with Manual Data Injection...\n');
  
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 1000 // Slow down for visibility
  });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 }
  });
  const page = await context.newPage();
  
  try {
    console.log('📱 Navigating to application...');
    await page.goto('http://localhost:3127');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(5000);
    
    console.log('📊 Taking baseline screenshot...');
    await page.screenshot({ path: './baseline-screenshot.png', fullPage: true });
    
    // Check the current page content
    const title = await page.title();
    const url = page.url();
    console.log(`📄 Page title: ${title}`);
    console.log(`🔗 Current URL: ${url}`);
    
    // Look for any buttons or interactive elements
    const buttons = await page.locator('button').count();
    const links = await page.locator('a').count();
    const inputs = await page.locator('input').count();
    
    console.log(`🎛️  Found ${buttons} buttons, ${links} links, ${inputs} inputs`);
    
    // Try to find any error handling related elements
    const errorBoundary = await page.locator('text=Error').count();
    const dataHealth = await page.locator('[data-testid="data-health-indicator"]').count();
    const validation = await page.locator('text=validation').count();
    
    console.log(`🛡️  Error boundaries: ${errorBoundary}`);
    console.log(`⚠️  Data health indicators: ${dataHealth}`);
    console.log(`✅ Validation elements: ${validation}`);
    
    // Check console for any errors or validation messages
    const consoleMessages = [];
    page.on('console', msg => {
      consoleMessages.push(`[${msg.type()}] ${msg.text()}`);
    });
    
    // Try to inject some test data via browser console
    console.log('\n🧪 Injecting test data to trigger validation...');
    
    const testResult = await page.evaluate(() => {
      try {
        // Try to access validation functions if they're available
        if (window.validateGraphData) {
          const badData = [
            null,
            { id: 'missing-title', type: 'TASK' },
            { title: 'missing-id', type: 'TASK' },
            { id: 'valid', title: 'Valid Node', type: 'TASK' }
          ];
          const edges = [];
          
          const result = window.validateGraphData(badData, edges);
          return {
            success: true,
            errors: result.errors.length,
            warnings: result.warnings.length,
            validNodes: result.validNodes.length,
            invalidNodes: result.invalidNodes.length
          };
        } else {
          return { success: false, message: 'validateGraphData not available' };
        }
      } catch (error) {
        return { success: false, error: error.message };
      }
    });
    
    console.log('🧪 Test injection result:', testResult);
    
    // Wait a bit more and check for any changes
    await page.waitForTimeout(3000);
    
    // Take final screenshot
    console.log('📊 Taking final screenshot...');
    await page.screenshot({ path: './final-screenshot.png', fullPage: true });
    
    console.log('\n📄 Console messages captured:');
    consoleMessages.forEach((msg, i) => {
      if (i < 5) { // Show first 5 messages
        console.log(`   ${i + 1}. ${msg}`);
      }
    });
    if (consoleMessages.length > 5) {
      console.log(`   ... and ${consoleMessages.length - 5} more messages`);
    }
    
    console.log('\n✅ Test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    console.log('\n🔍 Keeping browser open for manual inspection...');
    console.log('   Press Ctrl+C to close when done.');
    
    // Keep browser open for manual inspection
    await new Promise(() => {}); // This will keep the script running
  }
}

testErrorHandling().catch(console.error);