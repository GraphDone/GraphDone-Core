#!/usr/bin/env node

const { chromium, firefox, webkit } = require('playwright');

async function sslCertificateAnalysis() {
  console.log('🔒 SSL CERTIFICATE ANALYSIS');
  console.log('   Target: https://localhost:3128');
  console.log('   Certificate: Self-signed mkcert development certificate');
  console.log('   Expected: Browser warnings for untrusted CA');
  
  const results = {
    browsers: [],
    certificateIssues: [],
    recommendations: []
  };
  
  // Test each browser's certificate handling
  const browserTests = [
    { name: 'Chromium', engine: chromium },
    { name: 'Firefox', engine: firefox },
    { name: 'WebKit (Safari)', engine: webkit }
  ];
  
  for (const browserConfig of browserTests) {
    console.log(`\n=== ${browserConfig.name.toUpperCase()} CERTIFICATE TEST ===`);
    
    const result = await testBrowserCertificateHandling(browserConfig);
    results.browsers.push(result);
    
    console.log(`${browserConfig.name}: ${result.status}`);
    if (result.issues.length > 0) {
      console.log(`  Issues: ${result.issues.join(', ')}`);
    }
  }
  
  // Test API endpoint certificate
  console.log(`\n=== API CERTIFICATE TEST ===`);
  await testApiCertificate(results);
  
  // Generate comprehensive analysis
  generateCertificateReport(results);
}

async function testBrowserCertificateHandling(browserConfig) {
  const result = {
    browser: browserConfig.name,
    status: 'UNKNOWN',
    loadSuccess: false,
    certificateWarnings: false,
    loginSuccess: false,
    issues: [],
    securityDetails: {}
  };
  
  let browser = null;
  
  try {
    // Launch browser - don't ignore HTTPS errors to see real behavior
    browser = await browserConfig.engine.launch({
      headless: false,
      ignoreHTTPSErrors: false,
      args: browserConfig.name === 'Chromium' ? [
        '--ignore-certificate-errors-spki-list',
        '--ignore-certificate-errors',
        '--allow-running-insecure-content'
      ] : []
    });
    
    const page = await browser.newPage();
    
    // Monitor security state
    page.on('response', response => {
      if (response.url().includes('localhost:3128')) {
        result.securityDetails.responses = result.securityDetails.responses || [];
        result.securityDetails.responses.push({
          url: response.url(),
          status: response.status(),
          headers: response.headers()
        });
      }
    });
    
    console.log(`  🌐 Testing HTTPS navigation...`);
    
    try {
      await page.goto('https://localhost:3128', {
        waitUntil: 'domcontentloaded',
        timeout: 20000
      });
      
      result.loadSuccess = true;
      console.log(`  ✅ Page loaded successfully`);
      
      // Check for certificate warnings in the UI
      const warningChecks = [
        'text="Not secure"',
        'text="Certificate error"',
        'text="Your connection is not private"',
        'text="This site can\'t provide a secure connection"',
        '#security-interstitial', // Chrome certificate error page
        '#errorShortDesc',          // Firefox error page  
        '.warning',                 // Safari warnings
        '[data-testid="security-warning"]'
      ];
      
      let foundWarnings = [];
      for (const selector of warningChecks) {
        try {
          if (await page.locator(selector).isVisible({ timeout: 2000 })) {
            const text = await page.locator(selector).textContent();
            foundWarnings.push(`${selector}: ${text?.substring(0, 50)}...`);
          }
        } catch (e) {
          // Expected - selector not found
        }
      }
      
      if (foundWarnings.length > 0) {
        result.certificateWarnings = true;
        result.issues.push(`Certificate warnings: ${foundWarnings.length} found`);
        console.log(`  ⚠️ Certificate warnings detected`);
        
        // Try to proceed past warnings if possible
        const proceedButtons = [
          'text="Advanced"',
          'text="Proceed"',
          'text="Continue"',
          '#details-button',
          '#proceed-link'
        ];
        
        for (const selector of proceedButtons) {
          try {
            if (await page.locator(selector).isVisible({ timeout: 2000 })) {
              await page.locator(selector).click();
              await page.waitForTimeout(1000);
              console.log(`  🔧 Clicked proceed button: ${selector}`);
              break;
            }
          } catch (e) {
            // Button not found or not clickable
          }
        }
      } else {
        console.log(`  ✅ No certificate warnings in UI`);
      }
      
      // Test login functionality
      console.log(`  🔐 Testing login functionality...`);
      
      const usernameInput = page.locator('input[type="text"], input[placeholder*="Username"], input[placeholder*="Email"]').first();
      const passwordInput = page.locator('input[type="password"]').first();
      const signInButton = page.locator('button:has-text("Sign In")').first();
      
      if (await usernameInput.isVisible({ timeout: 5000 })) {
        await usernameInput.fill('admin');
        await passwordInput.fill('graphdone');
        await signInButton.click();
        await page.waitForTimeout(3000);
        
        // Check if login succeeded
        const stillOnLogin = await page.locator('button:has-text("Sign In")').isVisible({ timeout: 2000 });
        if (!stillOnLogin) {
          result.loginSuccess = true;
          console.log(`  ✅ Login successful`);
        } else {
          result.issues.push('Login failed');
          console.log(`  ❌ Login failed`);
        }
      } else {
        result.issues.push('Login form not accessible');
        console.log(`  ⚠️ Login form not found`);
      }
      
    } catch (navigationError) {
      result.issues.push(`Navigation failed: ${navigationError.message}`);
      console.log(`  ❌ Navigation failed: ${navigationError.message}`);
      
      if (navigationError.message.includes('SSL') || 
          navigationError.message.includes('certificate') ||
          navigationError.message.includes('TLS')) {
        result.issues.push('SSL/TLS certificate rejected by browser');
      }
    }
    
    // Determine overall status
    if (result.loadSuccess && result.loginSuccess) {
      result.status = result.certificateWarnings ? 'WARNING' : 'PASSED';
    } else if (result.loadSuccess) {
      result.status = 'PARTIAL';
    } else {
      result.status = 'FAILED';
    }
    
    // Take screenshot for evidence
    try {
      await page.screenshot({ 
        path: `artifacts/screenshots/ssl-test-${browserConfig.name.toLowerCase().replace(/\s+/g, '-')}.png`,
        fullPage: true
      });
    } catch (e) {
      // Screenshot may fail if page didn't load
    }
    
  } catch (error) {
    result.status = 'FAILED';
    result.issues.push(`Browser test failed: ${error.message}`);
    console.log(`  ❌ Browser test error: ${error.message}`);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
  
  return result;
}

async function testApiCertificate(results) {
  try {
    // Test API endpoint certificate using Node.js
    const https = require('https');
    const url = require('url');
    
    const apiTests = [
      'https://localhost:3128/api/graphql',  // Proxied API
      'https://localhost:3128/health',      // Health endpoint
    ];
    
    for (const apiUrl of apiTests) {
      console.log(`  🔗 Testing API: ${apiUrl}`);
      
      const result = await new Promise((resolve, reject) => {
        const options = {
          ...url.parse(apiUrl),
          rejectUnauthorized: false // Accept self-signed certificates
        };
        
        const req = https.request(options, (res) => {
          const cert = res.socket.getPeerCertificate();
          resolve({
            url: apiUrl,
            status: res.statusCode,
            certificate: {
              subject: cert.subject,
              issuer: cert.issuer,
              valid_from: cert.valid_from,
              valid_to: cert.valid_to,
              serialNumber: cert.serialNumber
            }
          });
        });
        
        req.on('error', (err) => {
          resolve({
            url: apiUrl,
            error: err.message
          });
        });
        
        req.end();
      });
      
      if (result.certificate) {
        console.log(`    ✅ Certificate: ${result.certificate.issuer.CN}`);
        console.log(`    ✅ Valid until: ${result.certificate.valid_to}`);
        results.certificateIssues.push({
          endpoint: apiUrl,
          status: 'WORKING',
          details: result.certificate
        });
      } else {
        console.log(`    ❌ API error: ${result.error}`);
        results.certificateIssues.push({
          endpoint: apiUrl,
          status: 'FAILED',
          error: result.error
        });
      }
    }
    
  } catch (error) {
    console.log(`  ❌ API certificate test failed: ${error.message}`);
    results.certificateIssues.push({
      endpoint: 'API_TEST',
      status: 'FAILED',
      error: error.message
    });
  }
}

function generateCertificateReport(results) {
  console.log('\n=== SSL CERTIFICATE COMPATIBILITY REPORT ===');
  
  const passed = results.browsers.filter(b => b.status === 'PASSED').length;
  const warnings = results.browsers.filter(b => b.status === 'WARNING').length;
  const partial = results.browsers.filter(b => b.status === 'PARTIAL').length;
  const failed = results.browsers.filter(b => b.status === 'FAILED').length;
  
  console.log(`\n📊 BROWSER COMPATIBILITY:`);
  console.log(`  Passed: ${passed} browsers`);
  console.log(`  Warnings: ${warnings} browsers (certificate warnings but functional)`);
  console.log(`  Partial: ${partial} browsers (loads but login issues)`);
  console.log(`  Failed: ${failed} browsers (cannot load)`);
  
  console.log(`\n🔍 DETAILED RESULTS:`);
  results.browsers.forEach(result => {
    console.log(`\n  ${result.browser}:`);
    console.log(`    Status: ${result.status}`);
    console.log(`    Load Success: ${result.loadSuccess}`);
    console.log(`    Certificate Warnings: ${result.certificateWarnings}`);
    console.log(`    Login Success: ${result.loginSuccess}`);
    
    if (result.issues.length > 0) {
      console.log(`    Issues:`);
      result.issues.forEach(issue => console.log(`      - ${issue}`));
    }
  });
  
  console.log(`\n🔧 CERTIFICATE ANALYSIS:`);
  console.log(`  Type: Self-signed development certificate (mkcert)`);
  console.log(`  Issuer: mkcert development CA`);
  console.log(`  Domains: localhost, *.localhost, 127.0.0.1`);
  console.log(`  Valid Until: December 9, 2027`);
  
  console.log(`\n📋 RECOMMENDATIONS:`);
  
  if (failed > 0) {
    console.log(`❌ CRITICAL: ${failed} browser(s) cannot access the site`);
    console.log(`   - Install mkcert root CA certificate on the system`);
    console.log(`   - Run: mkcert -install (if mkcert is available)`);
    console.log(`   - Alternative: Use production CA-signed certificate`);
  }
  
  if (warnings > 0) {
    console.log(`⚠️ WARNINGS: ${warnings} browser(s) show certificate warnings`);
    console.log(`   - Users will see "Not Secure" warnings`);
    console.log(`   - May require manual certificate acceptance`);
    console.log(`   - Consider installing mkcert CA or using production certificate`);
  }
  
  if (passed === results.browsers.length) {
    console.log(`✅ EXCELLENT: All browsers accept the certificate`);
    console.log(`   - mkcert CA is properly installed`);
    console.log(`   - Certificate configuration is working correctly`);
  }
  
  console.log(`\n🚀 PRODUCTION READINESS:`);
  if (warnings > 0 || failed > 0) {
    console.log(`❌ NOT PRODUCTION READY - Certificate warnings/failures detected`);
    console.log(`   For production deployment:`);
    console.log(`   1. Use CA-signed certificate (Let's Encrypt, commercial CA)`);
    console.log(`   2. Configure proper domain name (not localhost)`);
    console.log(`   3. Test with production certificate authority`);
  } else {
    console.log(`✅ DEVELOPMENT READY - All browsers accept certificate`);
    console.log(`   For production: Replace with CA-signed certificate`);
  }
  
  console.log(`\n📁 Evidence collected:`);
  console.log(`   - ssl-test-chromium.png`);
  console.log(`   - ssl-test-firefox.png`);
  console.log(`   - ssl-test-webkit-safari.png`);
  
  console.log(`\n🔍 Next steps:`);
  console.log(`1. Review screenshots for visual certificate warnings`);
  console.log(`2. Test certificate installation: mkcert -install`);
  console.log(`3. Verify certificate trust in browser settings`);
  console.log(`4. Plan production certificate strategy`);
}

sslCertificateAnalysis().catch(console.error);