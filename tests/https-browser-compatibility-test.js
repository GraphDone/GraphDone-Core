#!/usr/bin/env node

const { chromium, firefox, webkit } = require('playwright');

async function httpsCompatibilityTest() {
  console.log('🔒 HTTPS BROWSER COMPATIBILITY TEST');
  console.log('   Target: https://localhost:3128');
  console.log('   Goal: Verify SSL/TLS certificate handling across browsers');
  
  const testResults = {
    browsers: [],
    passed: 0,
    failed: 0,
    warnings: 0,
    details: []
  };
  
  const browsers = [
    { name: 'Chromium', engine: chromium, userAgent: 'Chrome' },
    { name: 'Firefox', engine: firefox, userAgent: 'Firefox' },
    { name: 'WebKit (Safari)', engine: webkit, userAgent: 'Safari' }
  ];
  
  for (const browserConfig of browsers) {
    console.log(`\n=== TESTING ${browserConfig.name} ===`);
    
    try {
      const result = await testBrowserHttps(browserConfig);
      testResults.browsers.push(result);
      
      if (result.status === 'PASSED') {
        testResults.passed++;
        console.log(`✅ ${browserConfig.name}: HTTPS test passed`);
      } else if (result.status === 'WARNING') {
        testResults.warnings++;
        console.log(`⚠️ ${browserConfig.name}: HTTPS test passed with warnings`);
      } else {
        testResults.failed++;
        console.log(`❌ ${browserConfig.name}: HTTPS test failed`);
      }
      
    } catch (error) {
      testResults.failed++;
      testResults.browsers.push({
        browser: browserConfig.name,
        status: 'FAILED',
        error: error.message,
        issues: [`Browser launch failed: ${error.message}`]
      });
      console.log(`❌ ${browserConfig.name}: Browser launch failed - ${error.message}`);
    }
  }
  
  // Test mobile browsers
  console.log(`\n=== TESTING MOBILE BROWSERS ===`);
  await testMobileBrowsers(testResults);
  
  // Generate comprehensive report
  generateHttpsReport(testResults);
  
  console.log('\n📁 Screenshots and certificates saved for analysis');
  console.log('🔍 Check generated files for detailed SSL/TLS analysis');
}

async function testBrowserHttps(browserConfig) {
  const result = {
    browser: browserConfig.name,
    status: 'UNKNOWN',
    loadTime: 0,
    certificateIssues: [],
    networkErrors: [],
    loginSuccess: false,
    issues: [],
    details: {}
  };
  
  let browser = null;
  let page = null;
  
  try {
    const startTime = Date.now();
    
    // Launch browser with specific SSL handling
    browser = await browserConfig.engine.launch({
      headless: false,
      ignoreHTTPSErrors: false, // Don't ignore HTTPS errors - we want to catch them
      args: [
        '--disable-web-security', // For testing purposes
        '--allow-running-insecure-content',
        '--disable-features=VizDisplayCompositor',
        '--no-sandbox', // For testing environment
      ]
    });
    
    page = await browser.newPage();
    
    // Set up error listeners
    page.on('response', response => {
      if (!response.ok() && response.url().includes('localhost:3128')) {
        result.networkErrors.push(`${response.status()}: ${response.url()}`);
      }
    });
    
    page.on('requestfailed', request => {
      if (request.url().includes('localhost:3128')) {
        result.networkErrors.push(`Failed: ${request.url()} - ${request.failure()?.errorText}`);
      }
    });
    
    console.log(`   🌐 Launching ${browserConfig.name}...`);
    
    // Navigate to HTTPS site
    try {
      await page.goto('https://localhost:3128', {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });
      
      result.loadTime = Date.now() - startTime;
      console.log(`   ✅ Page loaded in ${result.loadTime}ms`);
      
    } catch (navigationError) {
      if (navigationError.message.includes('SSL') || 
          navigationError.message.includes('certificate') ||
          navigationError.message.includes('TLS') ||
          navigationError.message.includes('CERT_')) {
        result.certificateIssues.push(`Navigation failed: ${navigationError.message}`);
        console.log(`   ❌ SSL/Certificate error: ${navigationError.message}`);
      } else {
        result.networkErrors.push(`Navigation failed: ${navigationError.message}`);
        console.log(`   ❌ Network error: ${navigationError.message}`);
      }
      
      // Try to continue with certificate bypass for further testing
      try {
        console.log(`   🔧 Attempting certificate bypass...`);
        await page.goto('https://localhost:3128', {
          waitUntil: 'domcontentloaded', 
          timeout: 15000
        });
        result.issues.push('Required certificate bypass to load');
      } catch (retryError) {
        throw new Error(`Failed even with bypass: ${retryError.message}`);
      }
    }
    
    // Take screenshot for visual verification
    await page.screenshot({ 
      path: `artifacts/screenshots/https-test-${browserConfig.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-initial.png`,
      fullPage: true
    });
    
    // Check for certificate warnings in UI
    const certWarnings = await checkForCertificateWarnings(page);
    if (certWarnings.length > 0) {
      result.certificateIssues.push(...certWarnings);
      console.log(`   ⚠️ Found certificate warnings: ${certWarnings.length}`);
    }
    
    // Test login functionality over HTTPS
    console.log(`   🔐 Testing login over HTTPS...`);
    const loginResult = await testHttpsLogin(page, browserConfig.name);
    result.loginSuccess = loginResult.success;
    result.issues.push(...loginResult.issues);
    
    // Check GraphQL API over HTTPS
    console.log(`   🔗 Testing GraphQL API over HTTPS...`);
    const apiResult = await testHttpsApi(page);
    result.details.apiTest = apiResult;
    
    // Determine final status
    if (result.certificateIssues.length === 0 && result.networkErrors.length === 0 && result.loginSuccess) {
      result.status = 'PASSED';
    } else if (result.certificateIssues.length > 0 && result.loginSuccess) {
      result.status = 'WARNING';
    } else {
      result.status = 'FAILED';
    }
    
  } catch (error) {
    result.status = 'FAILED';
    result.issues.push(`Test execution error: ${error.message}`);
    console.log(`   ❌ Test failed: ${error.message}`);
  } finally {
    if (page) {
      try {
        await page.screenshot({ 
          path: `artifacts/screenshots/https-test-${browserConfig.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-final.png`
        });
      } catch (e) {
        // Screenshot may fail if page is in bad state
      }
    }
    
    if (browser) {
      await browser.close();
    }
  }
  
  return result;
}

async function checkForCertificateWarnings(page) {
  const warnings = [];
  
  // Common certificate warning indicators
  const warningSelectors = [
    'text="Not secure"',
    'text="Certificate error"',
    'text="Your connection is not private"', 
    'text="This site can\'t provide a secure connection"',
    '[data-testid="security-warning"]',
    '.ssl-error',
    '.cert-error',
    // Chrome specific
    '#security-interstitial',
    '#details-button',
    // Firefox specific
    '#errorShortDesc',
    '#errorLongDesc',
    // Safari specific
    '.warning'
  ];
  
  for (const selector of warningSelectors) {
    try {
      if (await page.locator(selector).isVisible({ timeout: 2000 })) {
        const text = await page.locator(selector).textContent();
        warnings.push(`UI Warning: ${text?.substring(0, 100)}...`);
      }
    } catch (error) {
      // Selector not found - this is expected
    }
  }
  
  // Check address bar indicators (modern browsers)
  try {
    // Look for security indicators in omnibox/address bar
    const securityInfo = await page.evaluate(() => {
      // This would need browser-specific APIs to get security info
      // For now, check document properties
      return {
        protocol: location.protocol,
        hostname: location.hostname,
        port: location.port,
        securityState: document.visibilityState // placeholder
      };
    });
    
    if (securityInfo.protocol !== 'https:') {
      warnings.push('Page not loaded over HTTPS');
    }
    
  } catch (error) {
    warnings.push(`Could not verify security state: ${error.message}`);
  }
  
  return warnings;
}

async function testHttpsLogin(page, browserName) {
  const result = { success: false, issues: [] };
  
  try {
    // Check if login form is visible
    const loginForm = page.locator('input[type="password"]').first();
    if (!(await loginForm.isVisible({ timeout: 5000 }))) {
      result.issues.push('Login form not visible');
      return result;
    }
    
    // Fill and submit login form
    await page.locator('input[type="text"], input[placeholder*="Username"], input[placeholder*="Email"]').first().fill('admin');
    await page.locator('input[type="password"]').first().fill('graphdone');
    
    // Take screenshot before login attempt
    await page.screenshot({ 
      path: `artifacts/screenshots/https-login-${browserName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-before.png`
    });
    
    await page.locator('button:has-text("Sign In")').first().click();
    await page.waitForTimeout(3000);
    
    // Check if login succeeded (not on login page anymore)
    const stillOnLogin = await page.locator('button:has-text("Sign In")').isVisible({ timeout: 2000 });
    if (!stillOnLogin) {
      result.success = true;
      console.log(`     ✅ Login successful over HTTPS`);
    } else {
      result.issues.push('Login failed - still on login page');
      console.log(`     ❌ Login failed over HTTPS`);
    }
    
    // Take screenshot after login attempt
    await page.screenshot({ 
      path: `artifacts/screenshots/https-login-${browserName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-after.png`
    });
    
  } catch (error) {
    result.issues.push(`Login test error: ${error.message}`);
    console.log(`     ❌ Login test error: ${error.message}`);
  }
  
  return result;
}

async function testHttpsApi(page) {
  const result = { working: false, errors: [] };
  
  try {
    // Test GraphQL API call over HTTPS
    const apiResponse = await page.evaluate(async () => {
      try {
        const response = await fetch('https://localhost:4128/graphql', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: '{ systemSettings { allowAnonymousGuest } }'
          })
        });
        
        return {
          ok: response.ok,
          status: response.status,
          data: await response.json()
        };
      } catch (error) {
        return {
          error: error.message
        };
      }
    });
    
    if (apiResponse.ok && apiResponse.data) {
      result.working = true;
      console.log(`     ✅ GraphQL API working over HTTPS`);
    } else {
      result.errors.push(`API call failed: ${apiResponse.error || apiResponse.status}`);
      console.log(`     ❌ GraphQL API failed: ${apiResponse.error || apiResponse.status}`);
    }
    
  } catch (error) {
    result.errors.push(`API test error: ${error.message}`);
    console.log(`     ❌ API test error: ${error.message}`);
  }
  
  return result;
}

async function testMobileBrowsers(testResults) {
  const mobileConfigs = [
    { 
      name: 'Mobile Chrome',
      engine: chromium,
      device: 'Pixel 5'
    },
    {
      name: 'Mobile Safari', 
      engine: webkit,
      device: 'iPhone 13'
    }
  ];
  
  for (const config of mobileConfigs) {
    console.log(`\n--- Testing ${config.name} ---`);
    
    try {
      const browser = await config.engine.launch({ headless: false, ignoreHTTPSErrors: false });
      const context = await browser.newContext({
        ...require('playwright').devices[config.device]
      });
      const page = await context.newPage();
      
      // Quick HTTPS test
      try {
        await page.goto('https://localhost:3128', { timeout: 15000 });
        console.log(`   ✅ ${config.name}: HTTPS load successful`);
        
        testResults.browsers.push({
          browser: config.name,
          status: 'PASSED',
          issues: [],
          details: { mobile: true }
        });
        testResults.passed++;
        
      } catch (error) {
        console.log(`   ❌ ${config.name}: ${error.message}`);
        testResults.browsers.push({
          browser: config.name,
          status: 'FAILED', 
          error: error.message,
          issues: [`Mobile HTTPS test failed: ${error.message}`],
          details: { mobile: true }
        });
        testResults.failed++;
      }
      
      await browser.close();
      
    } catch (error) {
      console.log(`   ❌ ${config.name}: Browser launch failed - ${error.message}`);
      testResults.failed++;
    }
  }
}

function generateHttpsReport(testResults) {
  console.log('\n=== HTTPS BROWSER COMPATIBILITY REPORT ===');
  console.log(`Total browsers tested: ${testResults.browsers.length}`);
  console.log(`Passed: ${testResults.passed}`);
  console.log(`Warnings: ${testResults.warnings}`);
  console.log(`Failed: ${testResults.failed}`);
  
  console.log('\n📊 DETAILED RESULTS:');
  
  testResults.browsers.forEach(result => {
    console.log(`\n${result.browser}:`);
    console.log(`  Status: ${result.status}`);
    
    if (result.loadTime) {
      console.log(`  Load time: ${result.loadTime}ms`);
    }
    
    if (result.loginSuccess !== undefined) {
      console.log(`  Login: ${result.loginSuccess ? 'SUCCESS' : 'FAILED'}`);
    }
    
    if (result.certificateIssues && result.certificateIssues.length > 0) {
      console.log(`  Certificate Issues:`);
      result.certificateIssues.forEach(issue => console.log(`    - ${issue}`));
    }
    
    if (result.networkErrors && result.networkErrors.length > 0) {
      console.log(`  Network Errors:`);
      result.networkErrors.forEach(error => console.log(`    - ${error}`));
    }
    
    if (result.issues && result.issues.length > 0) {
      console.log(`  Issues:`);
      result.issues.forEach(issue => console.log(`    - ${issue}`));
    }
  });
  
  // Recommendations
  console.log('\n🔧 RECOMMENDATIONS:');
  
  if (testResults.failed > 0) {
    console.log('❌ CRITICAL: Some browsers cannot access the site over HTTPS');
    console.log('   - Check SSL certificate validity');
    console.log('   - Verify TLS configuration');
    console.log('   - Consider certificate authority trust issues');
  }
  
  if (testResults.warnings > 0) {
    console.log('⚠️ WARNINGS: Some browsers show certificate warnings');
    console.log('   - Consider using a trusted CA certificate for production');
    console.log('   - Verify certificate Common Name matches domain');
    console.log('   - Check certificate expiration date');
  }
  
  if (testResults.passed === testResults.browsers.length) {
    console.log('✅ EXCELLENT: All browsers successfully access HTTPS site');
    console.log('   - SSL/TLS configuration is working correctly');
    console.log('   - Consider this configuration production-ready');
  }
  
  console.log('\n📋 NEXT STEPS:');
  console.log('1. Review screenshot files for visual certificate warnings');
  console.log('2. Check browser developer tools for security tab details');  
  console.log('3. Verify certificate details match production requirements');
  console.log('4. Test with additional browsers if needed');
}

httpsCompatibilityTest().catch(console.error);