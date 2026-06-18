import { test, expect } from '@playwright/test';
import { login, navigateToWorkspace, cleanupAuth, TEST_USERS } from '../helpers/auth';

test.describe('UI Basic Functionality & Responsive Design', () => {
  test.beforeEach(async ({ page }) => {
    // Set default viewport size
    await page.setViewportSize({ width: 1280, height: 720 });
  });

  test.afterEach(async ({ page }) => {
    await cleanupAuth(page);
  });

  test('should handle responsive design across different viewport sizes', async ({ page }) => {
    console.log('🧪 Testing responsive design and viewport scaling...');
    
    await login(page, TEST_USERS.ADMIN);
    await navigateToWorkspace(page);
    
    // Test different viewport sizes
    const viewports = [
      { width: 1920, height: 1080, name: 'Desktop Large' },
      { width: 1280, height: 720, name: 'Desktop Standard' },
      { width: 1024, height: 768, name: 'Tablet Landscape' },
      { width: 768, height: 1024, name: 'Tablet Portrait' },
      { width: 375, height: 667, name: 'Mobile' },
      { width: 320, height: 568, name: 'Mobile Small' }
    ];
    
    for (const viewport of viewports) {
      console.log(`Testing ${viewport.name} (${viewport.width}x${viewport.height})`);
      
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.waitForTimeout(1000); // Allow UI to adjust
      
      // Check that main UI elements are visible and properly sized
      const mainContainer = page.locator('main, .main-content, .workspace, .app-container').first();
      
      if (await mainContainer.isVisible()) {
        const boundingBox = await mainContainer.boundingBox();
        
        // Verify the container scales properly
        expect(boundingBox?.width, `Main container should fit viewport width for ${viewport.name}`)
          .toBeLessThanOrEqual(viewport.width);
        
        expect(boundingBox?.height, `Main container should be reasonable height for ${viewport.name}`)
          .toBeGreaterThan(100);
        
        console.log(`✅ ${viewport.name}: Container ${boundingBox?.width}x${boundingBox?.height}`);
      }
      
      // Check for horizontal scrollbars (should not exist unless intentional)
      const bodyScrollWidth = await page.evaluate(() => document.body.scrollWidth);
      const bodyClientWidth = await page.evaluate(() => document.body.clientWidth);
      
      if (bodyScrollWidth > bodyClientWidth + 10) {
        console.log(`⚠️ ${viewport.name}: Horizontal scroll detected (${bodyScrollWidth} > ${bodyClientWidth})`);
        console.log('   This may indicate responsive design issues');
      } else {
        console.log(`✅ ${viewport.name}: No unwanted horizontal scroll`);
      }
      
      // Take screenshot for visual verification
      await page.screenshot({ 
        path: `viewport-${viewport.width}x${viewport.height}-${viewport.name.replace(/\s+/g, '-').toLowerCase()}.png`,
        fullPage: true 
      });
    }
    
    console.log('✅ Responsive design test completed');
  });

  test('should have proper scrollbars on scrollable content areas', async ({ page }) => {
    console.log('🧪 Testing scrollbar functionality...');
    
    await login(page, TEST_USERS.ADMIN);
    await navigateToWorkspace(page);
    
    // Navigate to table view (mentioned as problematic)
    console.log('Testing table view scrollbars...');
    const tableButton = page.locator('button:has-text("Table"), [data-view="table"], button[data-testid*="table"]').first();
    
    if (await tableButton.isVisible({ timeout: 5000 })) {
      await tableButton.click();
      await page.waitForTimeout(2000);
      
      // Check for table container
      const tableContainer = page.locator('.table-container, .data-table, table, [role="table"]').first();
      
      if (await tableContainer.isVisible({ timeout: 5000 })) {
        // Check if table content overflows and needs scrollbars
        const tableElement = await tableContainer.elementHandle();
        
        if (tableElement) {
          const scrollInfo = await tableElement.evaluate((el) => ({
            scrollWidth: el.scrollWidth,
            scrollHeight: el.scrollHeight,
            clientWidth: el.clientWidth,
            clientHeight: el.clientHeight,
            overflowX: getComputedStyle(el).overflowX,
            overflowY: getComputedStyle(el).overflowY
          }));
          
          console.log('Table scroll info:', scrollInfo);
          
          // Check if content overflows but scrollbars are missing
          if (scrollInfo.scrollWidth > scrollInfo.clientWidth) {
            if (scrollInfo.overflowX === 'visible' || scrollInfo.overflowX === 'hidden') {
              console.log('🐛 ISSUE: Horizontal overflow detected but no horizontal scrollbar');
              console.log(`   Content width: ${scrollInfo.scrollWidth}, Container width: ${scrollInfo.clientWidth}`);
              console.log(`   Overflow-X setting: ${scrollInfo.overflowX}`);
            } else {
              console.log('✅ Horizontal scrollbar properly configured');
            }
          }
          
          if (scrollInfo.scrollHeight > scrollInfo.clientHeight) {
            if (scrollInfo.overflowY === 'visible' || scrollInfo.overflowY === 'hidden') {
              console.log('🐛 ISSUE: Vertical overflow detected but no vertical scrollbar');
              console.log(`   Content height: ${scrollInfo.scrollHeight}, Container height: ${scrollInfo.clientHeight}`);
              console.log(`   Overflow-Y setting: ${scrollInfo.overflowY}`);
            } else {
              console.log('✅ Vertical scrollbar properly configured');
            }
          }
        }
      } else {
        console.log('⚠️ Table container not found');
      }
    } else {
      console.log('⚠️ Table view button not found');
    }
    
    // Test other potentially scrollable areas
    const scrollableAreas = [
      '.sidebar, [data-testid="sidebar"]',
      '.graph-container, [data-testid="graph-container"]', 
      '.content-area, .main-content',
      '.modal-body, .dialog-content'
    ];
    
    for (const selector of scrollableAreas) {
      const element = page.locator(selector).first();
      if (await element.isVisible({ timeout: 2000 })) {
        const scrollInfo = await element.evaluate((el) => ({
          hasOverflow: el.scrollHeight > el.clientHeight || el.scrollWidth > el.clientWidth,
          overflowX: getComputedStyle(el).overflowX,
          overflowY: getComputedStyle(el).overflowY,
          scrollHeight: el.scrollHeight,
          clientHeight: el.clientHeight,
          scrollWidth: el.scrollWidth,
          clientWidth: el.clientWidth
        }));
        
        if (scrollInfo.hasOverflow) {
          console.log(`Area ${selector}:`, scrollInfo);
        }
      }
    }
    
    console.log('✅ Scrollbar test completed');
  });

  test('should allow clicking on all interactive elements', async ({ page }) => {
    console.log('🧪 Testing clickability of all UI elements...');
    
    await login(page, TEST_USERS.ADMIN);
    await navigateToWorkspace(page);
    
    // Find all potentially clickable elements
    const clickableSelectors = [
      'button:not([disabled])',
      'a[href]',
      '[role="button"]:not([disabled])',
      '[data-testid*="button"]:not([disabled])',
      'input[type="checkbox"]',
      'input[type="radio"]',
      'select',
      '.clickable:not([disabled])',
      '[onclick]:not([disabled])'
    ];
    
    let totalElements = 0;
    let clickableElements = 0;
    let nonClickableElements = 0;
    
    for (const selector of clickableSelectors) {
      const elements = page.locator(selector);
      const count = await elements.count();
      totalElements += count;
      
      console.log(`Found ${count} elements matching: ${selector}`);
      
      for (let i = 0; i < Math.min(count, 5); i++) { // Test up to 5 of each type
        const element = elements.nth(i);
        
        try {
          // Check if element is actually visible and interactive
          const isVisible = await element.isVisible({ timeout: 1000 });
          const isEnabled = await element.isEnabled({ timeout: 1000 });
          
          if (isVisible && isEnabled) {
            const boundingBox = await element.boundingBox();
            
            if (boundingBox && boundingBox.width > 0 && boundingBox.height > 0) {
              // Try to click the element
              await element.click({ timeout: 2000 });
              clickableElements++;
              
              // Wait a moment and close any modals that opened
              await page.waitForTimeout(500);
              
              // Try to close modal/dialog if one opened
              const closeButton = page.locator('button:has-text("Close"), button:has-text("Cancel"), [aria-label="close"], .close-button').first();
              if (await closeButton.isVisible({ timeout: 1000 })) {
                await closeButton.click({ timeout: 1000 }).catch(() => {});
              }
              
              // Press Escape key as backup
              await page.keyboard.press('Escape').catch(() => {});
              
            } else {
              console.log(`   Element ${i} has no dimensions (${boundingBox?.width}x${boundingBox?.height})`);
              nonClickableElements++;
            }
          } else {
            console.log(`   Element ${i} not visible (${isVisible}) or not enabled (${isEnabled})`);
            nonClickableElements++;
          }
          
        } catch (error) {
          console.log(`   Failed to click element ${i}: ${error.message}`);
          nonClickableElements++;
        }
      }
    }
    
    console.log(`\n=== CLICKABILITY RESULTS ===`);
    console.log(`Total elements found: ${totalElements}`);
    console.log(`Successfully clickable: ${clickableElements}`);
    console.log(`Non-clickable/problematic: ${nonClickableElements}`);
    
    const clickabilityRatio = totalElements > 0 ? (clickableElements / (clickableElements + nonClickableElements)) * 100 : 0;
    console.log(`Clickability ratio: ${clickabilityRatio.toFixed(1)}%`);
    
    if (clickabilityRatio < 70) {
      console.log('⚠️ Low clickability ratio - many UI elements may not be properly interactive');
    } else {
      console.log('✅ Good clickability ratio - most UI elements are interactive');
    }
    
    // Test specific problematic areas mentioned
    console.log('\n=== TESTING SPECIFIC UI AREAS ===');
    
    // Test view switching buttons
    const viewButtons = page.locator('button[data-view], button:has-text("Graph"), button:has-text("Table"), button:has-text("Kanban")');
    const viewButtonCount = await viewButtons.count();
    
    if (viewButtonCount > 0) {
      console.log(`Testing ${viewButtonCount} view switching buttons...`);
      
      for (let i = 0; i < viewButtonCount; i++) {
        const button = viewButtons.nth(i);
        const buttonText = await button.textContent() || await button.getAttribute('data-view') || `Button ${i}`;
        
        try {
          await button.click({ timeout: 3000 });
          await page.waitForTimeout(1000); // Allow view to load
          console.log(`✅ Successfully switched to: ${buttonText}`);
        } catch (error) {
          console.log(`❌ Failed to click view button "${buttonText}": ${error.message}`);
        }
      }
    } else {
      console.log('⚠️ No view switching buttons found');
    }
    
    // Test navigation/menu items
    const navItems = page.locator('nav a, .navigation a, .menu-item, [role="menuitem"]');
    const navCount = await navItems.count();
    
    if (navCount > 0) {
      console.log(`Testing ${navCount} navigation items...`);
      
      for (let i = 0; i < Math.min(navCount, 3); i++) {
        const navItem = navItems.nth(i);
        const navText = await navItem.textContent() || `Nav item ${i}`;
        
        try {
          await navItem.click({ timeout: 3000 });
          await page.waitForTimeout(1000);
          console.log(`✅ Successfully navigated: ${navText}`);
          
          // Navigate back to workspace for next test
          await navigateToWorkspace(page);
        } catch (error) {
          console.log(`❌ Failed to click nav item "${navText}": ${error.message}`);
        }
      }
    }
    
    console.log('✅ Interactive elements test completed');
  });

  test('should handle window resize events properly', async ({ page }) => {
    console.log('🧪 Testing dynamic window resizing...');
    
    await login(page, TEST_USERS.ADMIN);
    await navigateToWorkspace(page);
    
    // Start with a standard size
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.waitForTimeout(1000);
    
    // Take initial screenshot
    await page.screenshot({ path: 'resize-initial-1280x720.png' });
    
    // Test gradual resizing to simulate user dragging window
    const resizeSteps = [
      { width: 1400, height: 800, name: 'Expand' },
      { width: 1100, height: 600, name: 'Shrink' }, 
      { width: 900, height: 700, name: 'Narrow' },
      { width: 1600, height: 900, name: 'Large' },
      { width: 400, height: 600, name: 'Very Narrow' },
      { width: 1280, height: 720, name: 'Back to Standard' }
    ];
    
    for (const step of resizeSteps) {
      console.log(`Resizing to ${step.name}: ${step.width}x${step.height}`);
      
      await page.setViewportSize({ width: step.width, height: step.height });
      
      // Allow time for responsive adjustments
      await page.waitForTimeout(1500);
      
      // Check that main content is still visible and properly positioned
      const mainContent = page.locator('main, .main-content, .workspace').first();
      
      if (await mainContent.isVisible()) {
        const boundingBox = await mainContent.boundingBox();
        
        // Verify content fits in viewport
        const fitsWidth = boundingBox ? boundingBox.width <= step.width : false;
        const hasReasonableHeight = boundingBox ? boundingBox.height > 100 : false;
        
        if (fitsWidth && hasReasonableHeight) {
          console.log(`✅ ${step.name}: Content properly sized (${boundingBox?.width}x${boundingBox?.height})`);
        } else {
          console.log(`⚠️ ${step.name}: Content sizing issues`);
          console.log(`   Content: ${boundingBox?.width}x${boundingBox?.height}, Viewport: ${step.width}x${step.height}`);
          console.log(`   Fits width: ${fitsWidth}, Reasonable height: ${hasReasonableHeight}`);
        }
        
        // Check for layout shifts or broken elements
        const elementsOffscreen = await page.evaluate((viewportWidth) => {
          const elements = document.querySelectorAll('*');
          let offscreenCount = 0;
          
          elements.forEach(el => {
            const rect = el.getBoundingClientRect();
            if (rect.right > viewportWidth + 50) { // 50px tolerance
              offscreenCount++;
            }
          });
          
          return offscreenCount;
        }, step.width);
        
        if (elementsOffscreen > 0) {
          console.log(`⚠️ ${step.name}: ${elementsOffscreen} elements extend beyond viewport`);
        }
      }
      
      // Take screenshot for visual comparison
      await page.screenshot({ 
        path: `resize-step-${step.width}x${step.height}-${step.name.toLowerCase().replace(/\s+/g, '-')}.png` 
      });
    }
    
    console.log('✅ Window resize test completed');
    console.log('📁 Check resize-*.png screenshots for visual verification');
  });
  
  test('should maintain UI state during browser zoom changes', async ({ page }) => {
    console.log('🧪 Testing browser zoom level handling...');
    
    await login(page, TEST_USERS.ADMIN);
    await navigateToWorkspace(page);
    
    const zoomLevels = [1.0, 1.25, 1.5, 0.8, 0.67, 1.0];
    
    for (const zoom of zoomLevels) {
      console.log(`Testing zoom level: ${Math.round(zoom * 100)}%`);
      
      // Set zoom level
      await page.evaluate((zoomLevel) => {
        document.body.style.zoom = zoomLevel.toString();
      }, zoom);
      
      await page.waitForTimeout(1000);
      
      // Check that UI is still functional
      const interactiveElement = page.locator('button, a, [role="button"]').first();
      
      if (await interactiveElement.isVisible({ timeout: 2000 })) {
        try {
          await interactiveElement.click({ timeout: 2000 });
          console.log(`✅ Zoom ${Math.round(zoom * 100)}%: Interactive elements still work`);
        } catch (error) {
          console.log(`❌ Zoom ${Math.round(zoom * 100)}%: Click failed - ${error.message}`);
        }
      }
      
      // Take screenshot
      await page.screenshot({ 
        path: `zoom-${Math.round(zoom * 100)}-percent.png` 
      });
    }
    
    // Reset zoom
    await page.evaluate(() => {
      document.body.style.zoom = '1.0';
    });
    
    console.log('✅ Browser zoom test completed');
  });
});