#!/usr/bin/env node

const { chromium, webkit } = require('playwright');

async function mobileHttpsCompatibilityTest() {
  console.log('📱 MOBILE HTTPS COMPATIBILITY TEST');
  console.log('   Target: https://localhost:3128');
  console.log('   Testing: Mobile browsers with HTTPS certificate handling');
  
  const results = {
    mobileDevices: [],
    passed: 0,
    failed: 0,
    issues: []
  };
  
  // Test mobile devices with different browsers
  const mobileTests = [
    {
      name: 'iPhone 13',
      device: 'iPhone 13',
      engine: webkit,
      expectedBehavior: 'Should work with mkcert certificate'
    },
    {
      name: 'iPhone 13 Pro',
      device: 'iPhone 13 Pro',
      engine: webkit,
      expectedBehavior: 'Should work with mkcert certificate'
    },
    {
      name: 'Pixel 5',
      device: 'Pixel 5', 
      engine: chromium,
      expectedBehavior: 'Should work with mkcert certificate'
    },
    {
      name: 'Galaxy S21',
      device: 'Galaxy S21',
      engine: chromium,
      expectedBehavior: 'Should work with mkcert certificate'
    },
    {
      name: 'iPad Pro',
      device: 'iPad Pro',
      engine: webkit,
      expectedBehavior: 'Should work with mkcert certificate'
    }
  ];
  
  for (const testConfig of mobileTests) {
    console.log(`\n=== Testing ${testConfig.name} ===`);
    
    const result = await testMobileDevice(testConfig);
    results.mobileDevices.push(result);
    
    if (result.status === 'PASSED') {
      results.passed++;
      console.log(`✅ ${testConfig.name}: HTTPS working perfectly`);
    } else {
      results.failed++;
      console.log(`❌ ${testConfig.name}: ${result.status} - ${result.issues.join(', ')}`);
    }
  }
  
  generateMobileReport(results);
}

async function testMobileDevice(testConfig) {
  const result = {
    device: testConfig.name,
    status: 'UNKNOWN',
    loadTime: 0,
    httpsWorking: false,
    loginWorking: false,
    touchInteractions: false,
    responsiveDesign: false,
    issues: []
  };
  
  let browser = null;
  
  try {
    const startTime = Date.now();
    
    // Launch browser with mobile context
    browser = await testConfig.engine.launch({
      headless: false,
      ignoreHTTPSErrors: false // Don't ignore - we want to test real certificate behavior
    });
    
    const context = await browser.newContext({
      ...require('playwright').devices[testConfig.device],
      ignoreHTTPSErrors: false
    });
    
    const page = await context.newPage();
    
    console.log(`  📱 Emulating ${testConfig.device}...`);
    console.log(`  🔒 Testing HTTPS navigation...`);
    
    try {
      await page.goto('https://localhost:3128', {
        waitUntil: 'domcontentloaded',
        timeout: 25000
      });
      
      result.loadTime = Date.now() - startTime;
      result.httpsWorking = true;
      console.log(`  ✅ HTTPS load successful (${result.loadTime}ms)`);
      
      // Check for mobile-specific certificate warnings
      const mobileWarnings = [
        'text="Certificate Error"',
        'text="Security Warning"',
        'text="Not Secure"',
        '.security-warning',
        '#ssl-error',
        '[role="alert"]'
      ];
      
      let hasWarnings = false;
      for (const selector of mobileWarnings) {
        if (await page.locator(selector).isVisible({ timeout: 2000 })) {
          hasWarnings = true;
          result.issues.push(`Mobile certificate warning: ${selector}`);
          break;
        }
      }
      
      if (!hasWarnings) {
        console.log(`  ✅ No certificate warnings on mobile`);
      } else {
        console.log(`  ⚠️ Certificate warnings detected on mobile`);
      }
      
      // Test responsive design
      console.log(`  📐 Testing responsive design...`);
      const viewport = page.viewportSize();
      console.log(`    Viewport: ${viewport.width}x${viewport.height}`);
      
      // Check if mobile-optimized elements are visible
      const mobileElements = [
        'button', // Should be touch-friendly
        'input',  // Should be appropriately sized
        'nav',    // Should be collapsed/hamburger menu
      ];
      
      let responsiveScore = 0;
      for (const selector of mobileElements) {
        if (await page.locator(selector).first().isVisible({ timeout: 3000 })) {
          responsiveScore++;
        }
      }
      
      if (responsiveScore >= 2) {
        result.responsiveDesign = true;
        console.log(`  ✅ Responsive design working`);
      } else {
        result.issues.push('Responsive design issues detected');
        console.log(`  ⚠️ Responsive design needs work`);
      }
      
      // Test login on mobile
      console.log(`  🔐 Testing mobile login...`);
      
      const usernameInput = page.locator('input[type="text"], input[placeholder*="Username"], input[placeholder*="Email"]').first();
      const passwordInput = page.locator('input[type="password"]').first();
      const signInButton = page.locator('button:has-text("Sign In")').first();
      
      if (await usernameInput.isVisible({ timeout: 5000 })) {
        // Test touch interactions
        await usernameInput.tap();
        await usernameInput.fill('admin');
        
        await passwordInput.tap();
        await passwordInput.fill('graphdone');
        
        await signInButton.tap(); // Use tap() for mobile
        await page.waitForTimeout(3000);
        
        const stillOnLogin = await page.locator('button:has-text("Sign In")').isVisible({ timeout: 2000 });
        if (!stillOnLogin) {
          result.loginWorking = true;
          result.touchInteractions = true;
          console.log(`  ✅ Mobile login successful with touch interactions`);
        } else {
          result.issues.push('Mobile login failed');
          console.log(`  ❌ Mobile login failed`);
        }
      } else {
        result.issues.push('Login form not accessible on mobile');
        console.log(`  ⚠️ Login form not found on mobile`);
      }
      
      // Test basic mobile interactions
      if (result.loginWorking) {
        console.log(`  👆 Testing mobile touch interactions...`);
        
        // Try to find and tap on workspace elements
        const workspaceButtons = page.locator('button:has-text("Graph"), button:has-text("Table")');
        const buttonCount = await workspaceButtons.count();
        
        if (buttonCount > 0) {
          const firstButton = workspaceButtons.first();
          await firstButton.tap();
          await page.waitForTimeout(1000);
          console.log(`  ✅ Touch interactions working`);
          result.touchInteractions = true;
        }
      }
      
    } catch (navigationError) {
      result.issues.push(`HTTPS navigation failed: ${navigationError.message}`);
      console.log(`  ❌ HTTPS navigation failed: ${navigationError.message}`);
      
      if (navigationError.message.includes('SSL') || 
          navigationError.message.includes('certificate') ||
          navigationError.message.includes('TLS') ||
          navigationError.message.includes('NET::ERR_CERT')) {
        result.issues.push('Mobile browser rejects SSL certificate');
      }
    }
    
    // Take mobile screenshot
    await page.screenshot({ 
      path: `artifacts/screenshots/mobile-https-${testConfig.name.toLowerCase().replace(/\s+/g, '-')}.png`,
      fullPage: true
    });
    
    // Determine overall mobile status
    if (result.httpsWorking && result.loginWorking && result.touchInteractions) {
      result.status = 'PASSED';
    } else if (result.httpsWorking && result.loginWorking) {
      result.status = 'PARTIAL';
    } else if (result.httpsWorking) {
      result.status = 'LIMITED';
    } else {
      result.status = 'FAILED';
    }
    
  } catch (error) {
    result.status = 'FAILED';
    result.issues.push(`Mobile test failed: ${error.message}`);
    console.log(`  ❌ Mobile test error: ${error.message}`);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
  
  return result;
}

function generateMobileReport(results) {
  console.log('\n=== MOBILE HTTPS COMPATIBILITY REPORT ===');
  
  console.log(`\n📊 MOBILE DEVICE RESULTS:`);
  console.log(`  Passed: ${results.passed} devices`);
  console.log(`  Failed: ${results.failed} devices`);
  console.log(`  Total: ${results.mobileDevices.length} devices tested`);
  
  console.log(`\n📱 DETAILED MOBILE RESULTS:`);
  results.mobileDevices.forEach(result => {
    console.log(`\n  ${result.device}:`);
    console.log(`    Status: ${result.status}`);
    console.log(`    HTTPS Working: ${result.httpsWorking}`);
    console.log(`    Login Working: ${result.loginWorking}`);
    console.log(`    Touch Interactions: ${result.touchInteractions}`);
    console.log(`    Responsive Design: ${result.responsiveDesign}`);
    if (result.loadTime > 0) {
      console.log(`    Load Time: ${result.loadTime}ms`);
    }
    
    if (result.issues.length > 0) {
      console.log(`    Issues:`);
      result.issues.forEach(issue => console.log(`      - ${issue}`));
    }
  });
  
  console.log(`\n🔒 MOBILE HTTPS ANALYSIS:`);
  const httpsWorking = results.mobileDevices.filter(d => d.httpsWorking).length;
  console.log(`  Devices with HTTPS working: ${httpsWorking}/${results.mobileDevices.length}`);
  
  if (httpsWorking === results.mobileDevices.length) {
    console.log(`  ✅ EXCELLENT: All mobile devices accept HTTPS certificate`);
  } else {
    console.log(`  ⚠️ WARNING: Some mobile devices have HTTPS issues`);
  }
  
  console.log(`\n📋 MOBILE-SPECIFIC RECOMMENDATIONS:`);
  
  if (results.failed > 0) {
    console.log(`❌ MOBILE CERTIFICATE ISSUES:`);
    console.log(`   - ${results.failed} device(s) have certificate problems`);
    console.log(`   - Mobile browsers may be more strict with self-signed certificates`);
    console.log(`   - Consider installing mkcert CA on mobile test devices`);
    console.log(`   - For production: Use CA-signed certificate for mobile compatibility`);
  }
  
  const touchIssues = results.mobileDevices.filter(d => d.httpsWorking && !d.touchInteractions).length;
  if (touchIssues > 0) {
    console.log(`📱 MOBILE UX ISSUES:`);
    console.log(`   - ${touchIssues} device(s) have touch interaction problems`);
    console.log(`   - Ensure buttons are touch-friendly (44px minimum)`);
    console.log(`   - Test tap events vs click events`);
    console.log(`   - Verify mobile viewport meta tag`);
  }
  
  if (results.passed === results.mobileDevices.length) {
    console.log(`✅ MOBILE READY: All mobile devices work perfectly with HTTPS`);
    console.log(`   - Certificate is trusted by mobile browsers`);
    console.log(`   - Touch interactions working`);
    console.log(`   - Responsive design functional`);
  }
  
  console.log(`\n📁 Mobile screenshots saved:`);
  results.mobileDevices.forEach(result => {
    const filename = `mobile-https-${result.device.toLowerCase().replace(/\s+/g, '-')}.png`;
    console.log(`   - ${filename}`);
  });
  
  console.log(`\n🚀 PRODUCTION MOBILE READINESS:`);
  if (results.passed === results.mobileDevices.length) {
    console.log(`✅ MOBILE HTTPS READY for development`);
    console.log(`   For production: Replace with CA-signed certificate`);
  } else {
    console.log(`❌ MOBILE ISSUES DETECTED`);
    console.log(`   - Fix certificate issues before production deployment`);
    console.log(`   - Test with real mobile devices and CA-signed certificates`);
  }
}

mobileHttpsCompatibilityTest().catch(console.error);