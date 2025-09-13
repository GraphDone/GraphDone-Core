import { test, expect } from '@playwright/test';
import { login, navigateToWorkspace, cleanupAuth, TEST_USERS } from '../helpers/auth';

test.describe('Comprehensive UI Interaction Testing', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
  });

  test.afterEach(async ({ page }) => {
    await cleanupAuth(page);
  });

  test('should login and systematically test all UI interactions', async ({ page }) => {
    console.log('🧪 COMPREHENSIVE UI INTERACTION TEST');
    console.log('   Login → Click Everything → Verify It Works');
    
    // Step 1: Login
    console.log('\n=== STEP 1: AUTHENTICATION ===');
    await login(page, TEST_USERS.ADMIN);
    await navigateToWorkspace(page);
    console.log('✅ Successfully logged in and navigated to workspace');
    
    // Step 2: Inventory all interactive elements
    console.log('\n=== STEP 2: UI ELEMENT INVENTORY ===');
    
    const interactionReport = {
      buttons: 0,
      links: 0,
      inputs: 0,
      dropdowns: 0,
      modals: 0,
      viewSwitchers: 0,
      navigation: 0,
      graphElements: 0,
      successful: 0,
      failed: 0,
      issues: []
    };
    
    // Test main navigation elements
    console.log('\n--- Testing Main Navigation ---');
    const navElements = page.locator('nav a, .nav-item, [role="navigation"] a, .sidebar a');
    const navCount = await navElements.count();
    interactionReport.navigation = navCount;
    
    console.log(`Found ${navCount} navigation elements`);
    
    for (let i = 0; i < navCount; i++) {
      const navElement = navElements.nth(i);
      const navText = await navElement.textContent();
      const navHref = await navElement.getAttribute('href');
      
      try {
        if (await navElement.isVisible({ timeout: 2000 })) {
          await navElement.click({ timeout: 3000 });
          await page.waitForTimeout(1500); // Allow page to load
          
          console.log(`✅ Navigation: "${navText}" (${navHref})`);
          interactionReport.successful++;
          
          // Navigate back to workspace for next test
          if (navHref && navHref !== '/' && navHref !== '/workspace') {
            await navigateToWorkspace(page);
          }
        }
      } catch (error) {
        console.log(`❌ Navigation failed: "${navText}" - ${error.message}`);
        interactionReport.failed++;
        interactionReport.issues.push(`Navigation "${navText}": ${error.message}`);
      }
    }
    
    // Test view switching buttons
    console.log('\n--- Testing View Switchers ---');
    const viewSwitchers = page.locator('button[data-view], button:has-text("Graph"), button:has-text("Table"), button:has-text("Kanban"), button:has-text("Dashboard"), button:has-text("Calendar")');
    const viewCount = await viewSwitchers.count();
    interactionReport.viewSwitchers = viewCount;
    
    console.log(`Found ${viewCount} view switching buttons`);
    
    for (let i = 0; i < viewCount; i++) {
      const viewButton = viewSwitchers.nth(i);
      const viewText = await viewButton.textContent() || await viewButton.getAttribute('data-view');
      
      try {
        if (await viewButton.isVisible({ timeout: 2000 })) {
          await viewButton.click({ timeout: 3000 });
          await page.waitForTimeout(2000); // Allow view to load
          
          console.log(`✅ View Switch: "${viewText}"`);
          interactionReport.successful++;
          
          // Take screenshot of this view
          await page.screenshot({ 
            path: `artifacts/screenshots/view-${viewText?.toLowerCase().replace(/\s+/g, '-') || i}.png` 
          });
          
          // Test scrollbars in this view
          await testViewScrollbars(page, viewText || `View ${i}`);
          
        }
      } catch (error) {
        console.log(`❌ View Switch failed: "${viewText}" - ${error.message}`);
        interactionReport.failed++;
        interactionReport.issues.push(`View "${viewText}": ${error.message}`);
      }
    }
    
    // Test all buttons
    console.log('\n--- Testing All Buttons ---');
    const buttons = page.locator('button:not([data-view]):visible');
    const buttonCount = await buttons.count();
    interactionReport.buttons = buttonCount;
    
    console.log(`Found ${buttonCount} buttons to test`);
    
    // Test first 20 buttons (to avoid infinite loops)
    for (let i = 0; i < Math.min(buttonCount, 20); i++) {
      const button = buttons.nth(i);
      const buttonText = await button.textContent();
      const buttonId = await button.getAttribute('id');
      const buttonClass = await button.getAttribute('class');
      const identifier = buttonText || buttonId || `Button ${i} (${buttonClass})`;
      
      try {
        if (await button.isVisible({ timeout: 1000 }) && await button.isEnabled({ timeout: 1000 })) {
          await button.click({ timeout: 2000 });
          await page.waitForTimeout(500);
          
          console.log(`✅ Button: "${identifier}"`);
          interactionReport.successful++;
          
          // Handle any modals that might have opened
          await handleModal(page);
          
        }
      } catch (error) {
        console.log(`❌ Button failed: "${identifier}" - ${error.message}`);
        interactionReport.failed++;
        interactionReport.issues.push(`Button "${identifier}": ${error.message}`);
      }
    }
    
    // Test input fields
    console.log('\n--- Testing Input Fields ---');
    const inputs = page.locator('input:visible, textarea:visible, select:visible');
    const inputCount = await inputs.count();
    interactionReport.inputs = inputCount;
    
    console.log(`Found ${inputCount} input elements`);
    
    for (let i = 0; i < Math.min(inputCount, 10); i++) {
      const input = inputs.nth(i);
      const inputType = await input.getAttribute('type') || 'text';
      const placeholder = await input.getAttribute('placeholder');
      const identifier = placeholder || `${inputType} input ${i}`;
      
      try {
        if (await input.isVisible({ timeout: 1000 }) && await input.isEnabled({ timeout: 1000 })) {
          
          if (inputType === 'text' || inputType === 'email' || !inputType) {
            await input.fill('Test Input');
            console.log(`✅ Text Input: "${identifier}"`);
          } else if (inputType === 'checkbox' || inputType === 'radio') {
            await input.check();
            console.log(`✅ Checkbox/Radio: "${identifier}"`);
          } else if (input.tagName === 'SELECT') {
            const options = await input.locator('option').count();
            if (options > 1) {
              await input.selectOption({ index: 1 });
              console.log(`✅ Select: "${identifier}" (${options} options)`);
            }
          }
          
          interactionReport.successful++;
        }
      } catch (error) {
        console.log(`❌ Input failed: "${identifier}" - ${error.message}`);
        interactionReport.failed++;
        interactionReport.issues.push(`Input "${identifier}": ${error.message}`);
      }
    }
    
    // Test dropdowns and context menus
    console.log('\n--- Testing Dropdowns and Menus ---');
    const dropdowns = page.locator('[role="button"][aria-haspopup], .dropdown-toggle, button:has-text("▼"), button:has-text("⋯")');
    const dropdownCount = await dropdowns.count();
    interactionReport.dropdowns = dropdownCount;
    
    console.log(`Found ${dropdownCount} dropdown triggers`);
    
    for (let i = 0; i < dropdownCount; i++) {
      const dropdown = dropdowns.nth(i);
      const dropdownText = await dropdown.textContent();
      
      try {
        if (await dropdown.isVisible({ timeout: 1000 })) {
          await dropdown.click({ timeout: 2000 });
          await page.waitForTimeout(500);
          
          // Look for opened dropdown menu
          const menu = page.locator('.dropdown-menu:visible, .menu:visible, [role="menu"]:visible').first();
          if (await menu.isVisible({ timeout: 1000 })) {
            console.log(`✅ Dropdown opened: "${dropdownText}"`);
            
            // Try to click a menu item
            const menuItems = menu.locator('a, button, [role="menuitem"]');
            const itemCount = await menuItems.count();
            
            if (itemCount > 0) {
              const firstItem = menuItems.first();
              const itemText = await firstItem.textContent();
              
              try {
                await firstItem.click({ timeout: 1000 });
                console.log(`✅ Menu item clicked: "${itemText}"`);
              } catch (error) {
                console.log(`⚠️ Menu item click failed: "${itemText}"`);
              }
            }
            
            // Close dropdown by clicking elsewhere
            await page.click('body', { position: { x: 50, y: 50 } });
          }
          
          interactionReport.successful++;
        }
      } catch (error) {
        console.log(`❌ Dropdown failed: "${dropdownText}" - ${error.message}`);
        interactionReport.failed++;
        interactionReport.issues.push(`Dropdown "${dropdownText}": ${error.message}`);
      }
    }
    
    // Test graph/canvas interactions (if in graph view)
    console.log('\n--- Testing Graph/Canvas Interactions ---');
    const graphContainer = page.locator('svg, canvas, .graph-container, .visualization').first();
    
    if (await graphContainer.isVisible({ timeout: 3000 })) {
      console.log('Graph container found - testing interactions...');
      
      try {
        // Test click on graph area
        await graphContainer.click({ position: { x: 200, y: 200 } });
        await page.waitForTimeout(500);
        console.log('✅ Graph area click');
        
        // Test right-click for context menu
        await graphContainer.click({ 
          button: 'right', 
          position: { x: 300, y: 200 } 
        });
        await page.waitForTimeout(1000);
        
        const contextMenu = page.locator('.context-menu:visible, .right-click-menu:visible').first();
        if (await contextMenu.isVisible({ timeout: 1000 })) {
          console.log('✅ Graph context menu opened');
          
          // Try clicking a context menu item
          const menuItem = contextMenu.locator('button, a, [role="menuitem"]').first();
          if (await menuItem.isVisible({ timeout: 1000 })) {
            const itemText = await menuItem.textContent();
            try {
              await menuItem.click({ timeout: 1000 });
              console.log(`✅ Context menu item: "${itemText}"`);
            } catch (error) {
              console.log(`⚠️ Context menu item failed: "${itemText}"`);
            }
          }
          
          // Close context menu
          await page.keyboard.press('Escape');
        }
        
        interactionReport.graphElements++;
        interactionReport.successful++;
        
      } catch (error) {
        console.log(`❌ Graph interaction failed: ${error.message}`);
        interactionReport.failed++;
        interactionReport.issues.push(`Graph interaction: ${error.message}`);
      }
    } else {
      console.log('No graph container found in current view');
    }
    
    // Step 3: Generate comprehensive report
    console.log('\n=== COMPREHENSIVE INTERACTION REPORT ===');
    console.log(`Navigation elements: ${interactionReport.navigation}`);
    console.log(`View switchers: ${interactionReport.viewSwitchers}`);
    console.log(`Buttons tested: ${interactionReport.buttons}`);
    console.log(`Input fields: ${interactionReport.inputs}`);
    console.log(`Dropdowns: ${interactionReport.dropdowns}`);
    console.log(`Graph elements: ${interactionReport.graphElements}`);
    console.log(`\nSUCCESSFUL INTERACTIONS: ${interactionReport.successful}`);
    console.log(`FAILED INTERACTIONS: ${interactionReport.failed}`);
    
    const totalAttempted = interactionReport.successful + interactionReport.failed;
    const successRate = totalAttempted > 0 ? (interactionReport.successful / totalAttempted * 100).toFixed(1) : 0;
    console.log(`SUCCESS RATE: ${successRate}%`);
    
    if (interactionReport.issues.length > 0) {
      console.log('\n=== ISSUES DETECTED ===');
      interactionReport.issues.forEach((issue, index) => {
        console.log(`${index + 1}. ${issue}`);
      });
    }
    
    // Assertions for test pass/fail
    expect(interactionReport.successful, 'Should have some successful interactions').toBeGreaterThan(0);
    
    const minimumSuccessRate = 75;
    expect(parseFloat(successRate), `Success rate should be at least ${minimumSuccessRate}%`).toBeGreaterThan(minimumSuccessRate);
    
    if (interactionReport.issues.length > 10) {
      console.log(`⚠️ HIGH ISSUE COUNT: ${interactionReport.issues.length} issues detected`);
      console.log('This indicates significant UI interaction problems');
    }
    
    console.log('\n✅ COMPREHENSIVE UI INTERACTION TEST COMPLETED');
    
    // Final screenshot
    await page.screenshot({ path: 'artifacts/screenshots/final-ui-state.png', fullPage: true });
  });
  
  // Helper function to test scrollbars in different views
  async function testViewScrollbars(page: any, viewName: string) {
    console.log(`   Testing scrollbars in ${viewName} view...`);
    
    // Common scrollable containers in different views
    const scrollableSelectors = [
      '.table-container',
      '.data-table-wrapper', 
      '.kanban-board',
      '.card-container',
      '.calendar-container',
      '.dashboard-grid',
      '.content-area',
      '.main-content',
      'main'
    ];
    
    for (const selector of scrollableSelectors) {
      const container = page.locator(selector).first();
      
      if (await container.isVisible({ timeout: 1000 })) {
        const scrollInfo = await container.evaluate((el: Element) => {
          const style = getComputedStyle(el);
          return {
            hasHorizontalScroll: el.scrollWidth > el.clientWidth,
            hasVerticalScroll: el.scrollHeight > el.clientHeight,
            overflowX: style.overflowX,
            overflowY: style.overflowY,
            scrollWidth: el.scrollWidth,
            scrollHeight: el.scrollHeight,
            clientWidth: el.clientWidth,
            clientHeight: el.clientHeight
          };
        });
        
        if (scrollInfo.hasHorizontalScroll || scrollInfo.hasVerticalScroll) {
          console.log(`   📊 ${viewName} ${selector}:`);
          console.log(`      Horizontal scroll: ${scrollInfo.hasHorizontalScroll} (overflow-x: ${scrollInfo.overflowX})`);
          console.log(`      Vertical scroll: ${scrollInfo.hasVerticalScroll} (overflow-y: ${scrollInfo.overflowY})`);
          console.log(`      Dimensions: ${scrollInfo.clientWidth}x${scrollInfo.clientHeight} (content: ${scrollInfo.scrollWidth}x${scrollInfo.scrollHeight})`);
          
          // Check if scrollbars are missing when needed
          if (scrollInfo.hasHorizontalScroll && (scrollInfo.overflowX === 'hidden' || scrollInfo.overflowX === 'visible')) {
            console.log(`   🐛 SCROLLBAR ISSUE: Horizontal scroll needed but overflow-x is ${scrollInfo.overflowX}`);
          }
          
          if (scrollInfo.hasVerticalScroll && (scrollInfo.overflowY === 'hidden' || scrollInfo.overflowY === 'visible')) {
            console.log(`   🐛 SCROLLBAR ISSUE: Vertical scroll needed but overflow-y is ${scrollInfo.overflowY}`);
          }
        }
        
        break; // Found the main container for this view
      }
    }
  }
  
  // Helper function to handle modals that might open during testing
  async function handleModal(page: any) {
    try {
      // Look for modal/dialog elements
      const modal = page.locator('.modal:visible, .dialog:visible, [role="dialog"]:visible').first();
      
      if (await modal.isVisible({ timeout: 1000 })) {
        // Try to close modal
        const closeButton = modal.locator('button:has-text("Close"), button:has-text("Cancel"), button:has-text("×"), .close-button, [aria-label="close"]').first();
        
        if (await closeButton.isVisible({ timeout: 1000 })) {
          await closeButton.click({ timeout: 1000 });
        } else {
          // Press Escape as fallback
          await page.keyboard.press('Escape');
        }
      }
    } catch (error) {
      // Ignore modal handling errors - not critical
    }
  }
});