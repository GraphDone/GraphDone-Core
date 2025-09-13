import { test, expect } from '@playwright/test';
import { login, navigateToWorkspace, cleanupAuth, TEST_USERS } from '../helpers/auth';

test.describe('Workspace Scrolling Issues', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 600 }); // Shorter height to force scrolling
  });

  test.afterEach(async ({ page }) => {
    await cleanupAuth(page);
  });

  test('should detect scrolling issues in workspace views', async ({ page }) => {
    console.log('🧪 WORKSPACE SCROLLING DIAGNOSIS');
    console.log('   Testing: login → workspace → test all views → detect scroll issues');
    
    // Step 1: Login and navigate to workspace
    await login(page, TEST_USERS.ADMIN);
    await navigateToWorkspace(page);
    
    // Step 2: Test scrolling in each workspace view
    const workspaceViews = [
      { name: 'Graph', button: 'button:has-text("Graph"), [data-view="graph"]' },
      { name: 'Table', button: 'button:has-text("Table"), [data-view="table"]' },
      { name: 'Kanban', button: 'button:has-text("Kanban"), [data-view="kanban"]' },
      { name: 'Dashboard', button: 'button:has-text("Dashboard"), [data-view="dashboard"]' },
      { name: 'Calendar', button: 'button:has-text("Calendar"), [data-view="calendar"]' },
      { name: 'Card', button: 'button:has-text("Card"), [data-view="card"]' }
    ];
    
    const scrollTestResults = {
      workingViews: [],
      brokenViews: [],
      issues: []
    };
    
    for (const view of workspaceViews) {
      console.log(`\n--- Testing ${view.name} View Scrolling ---`);
      
      try {
        // Switch to this view
        const viewButton = page.locator(view.button).first();
        
        if (await viewButton.isVisible({ timeout: 5000 })) {
          await viewButton.click();
          await page.waitForTimeout(2000); // Allow view to load
          
          console.log(`✅ Switched to ${view.name} view`);
          
          // Test scrolling functionality
          const scrollResults = await testViewScrolling(page, view.name);
          
          if (scrollResults.hasScrollingIssues) {
            scrollTestResults.brokenViews.push({
              view: view.name,
              issues: scrollResults.issues
            });
            console.log(`❌ ${view.name}: Scrolling issues detected`);
            scrollResults.issues.forEach(issue => console.log(`   - ${issue}`));
          } else {
            scrollTestResults.workingViews.push(view.name);
            console.log(`✅ ${view.name}: Scrolling works correctly`);
          }
          
          // Take screenshot for visual evidence
          await page.screenshot({ 
            path: `workspace-${view.name.toLowerCase()}-scrolling.png`,
            fullPage: true 
          });
          
        } else {
          console.log(`⚠️ ${view.name} view button not found`);
          scrollTestResults.issues.push(`${view.name} view button not accessible`);
        }
        
      } catch (error) {
        console.log(`❌ ${view.name} view test failed: ${error.message}`);
        scrollTestResults.brokenViews.push({
          view: view.name,
          issues: [`View switch failed: ${error.message}`]
        });
      }
    }
    
    // Step 3: Generate comprehensive scrolling report
    console.log('\n=== WORKSPACE SCROLLING REPORT ===');
    console.log(`Views with working scrolling: ${scrollTestResults.workingViews.join(', ') || 'NONE'}`);
    console.log(`Views with scrolling issues: ${scrollTestResults.brokenViews.length}`);
    
    if (scrollTestResults.brokenViews.length > 0) {
      console.log('\n🐛 SCROLLING ISSUES DETECTED:');
      scrollTestResults.brokenViews.forEach(brokenView => {
        console.log(`\n${brokenView.view} View Issues:`);
        brokenView.issues.forEach(issue => console.log(`  - ${issue}`));
      });
    }
    
    if (scrollTestResults.issues.length > 0) {
      console.log('\n⚠️ Additional Issues:');
      scrollTestResults.issues.forEach(issue => console.log(`  - ${issue}`));
    }
    
    // Step 4: Specific test for the reported bug
    console.log('\n--- SPECIFIC BUG VERIFICATION ---');
    console.log('Testing user-reported issue: "all pages besides the graph need the ability to scroll"');
    
    const nonGraphViews = scrollTestResults.brokenViews.filter(v => v.view !== 'Graph');
    
    if (nonGraphViews.length > 0) {
      console.log('🎯 BUG CONFIRMED: Non-graph views have scrolling issues');
      console.log(`   Affected views: ${nonGraphViews.map(v => v.view).join(', ')}`);
      console.log('   This matches the user-reported bug exactly');
    } else {
      console.log('ℹ️ Bug not reproduced - all views appear to have working scrolling');
    }
    
    // Assertions for test results
    expect(scrollTestResults.workingViews.length, 'At least some views should have working scrolling').toBeGreaterThan(0);
    
    // Document critical findings
    if (scrollTestResults.brokenViews.length > 0) {
      console.log('\n📊 CRITICAL FINDINGS FOR FIX:');
      console.log('1. Views without scrolling need overflow CSS properties');
      console.log('2. Container heights may be incorrectly set to viewport height');
      console.log('3. Content areas need proper scroll containers');
      console.log('4. Mobile/responsive scrolling may need touch-action properties');
    }
    
    console.log('\n✅ WORKSPACE SCROLLING DIAGNOSIS COMPLETED');
  });
  
  // Helper function to test scrolling in a specific view
  async function testViewScrolling(page: any, viewName: string) {
    const results = {
      hasScrollingIssues: false,
      issues: [],
      scrollableContainers: 0,
      contentOverflow: false
    };
    
    try {
      // Get page dimensions
      const viewportHeight = page.viewportSize().height;
      
      // Check document scroll capability
      const documentScrollInfo = await page.evaluate(() => ({
        documentHeight: document.documentElement.scrollHeight,
        documentClientHeight: document.documentElement.clientHeight,
        bodyHeight: document.body.scrollHeight,
        bodyClientHeight: document.body.clientHeight,
        canScroll: document.documentElement.scrollHeight > window.innerHeight
      }));
      
      console.log(`   Document scroll info: ${documentScrollInfo.documentHeight}h vs ${viewportHeight}vh`);
      
      if (documentScrollInfo.canScroll) {
        // Test actual scrolling
        const initialScrollY = await page.evaluate(() => window.scrollY);
        
        // Try to scroll down
        await page.keyboard.press('PageDown');
        await page.waitForTimeout(500);
        
        const afterScrollY = await page.evaluate(() => window.scrollY);
        
        if (afterScrollY === initialScrollY) {
          results.hasScrollingIssues = true;
          results.issues.push('Page scroll (PageDown) not working despite content overflow');
        }
        
        // Test mouse wheel scrolling
        const mainContent = page.locator('main, .main-content, .workspace, body').first();
        await mainContent.hover();
        await page.mouse.wheel(0, 300); // Scroll down 300px
        await page.waitForTimeout(500);
        
        const afterWheelY = await page.evaluate(() => window.scrollY);
        
        if (afterWheelY === initialScrollY) {
          results.hasScrollingIssues = true;
          results.issues.push('Mouse wheel scrolling not working');
        }
        
        // Reset scroll position
        await page.evaluate(() => window.scrollTo(0, 0));
        
      } else {
        // Check if content should overflow
        const contentContainers = await page.locator('main, .main-content, .workspace, .view-container').count();
        
        if (contentContainers > 0) {
          const containerInfo = await page.locator('main, .main-content, .workspace').first().evaluate((el) => ({
            scrollHeight: el.scrollHeight,
            clientHeight: el.clientHeight,
            overflowY: getComputedStyle(el).overflowY,
            height: getComputedStyle(el).height,
            maxHeight: getComputedStyle(el).maxHeight
          }));
          
          console.log(`   Container info:`, containerInfo);
          
          if (containerInfo.height === '100vh' || containerInfo.maxHeight === '100vh') {
            results.hasScrollingIssues = true;
            results.issues.push('Container artificially limited to viewport height (100vh)');
          }
          
          if (containerInfo.overflowY === 'hidden') {
            results.hasScrollingIssues = true;
            results.issues.push('Container has overflow-y: hidden preventing scroll');
          }
        }
      }
      
      // Check for specific scrollable areas within the view
      const scrollableSelectors = [
        '.table-container',
        '.table-wrapper', 
        '.data-table',
        '.kanban-board',
        '.card-grid',
        '.dashboard-grid',
        '.calendar-container',
        '.content-area'
      ];
      
      for (const selector of scrollableSelectors) {
        const element = page.locator(selector).first();
        
        if (await element.isVisible({ timeout: 1000 })) {
          const scrollInfo = await element.evaluate((el) => ({
            hasOverflow: el.scrollHeight > el.clientHeight,
            overflowY: getComputedStyle(el).overflowY,
            scrollHeight: el.scrollHeight,
            clientHeight: el.clientHeight
          }));
          
          results.scrollableContainers++;
          
          if (scrollInfo.hasOverflow) {
            results.contentOverflow = true;
            
            if (scrollInfo.overflowY === 'hidden' || scrollInfo.overflowY === 'visible') {
              results.hasScrollingIssues = true;
              results.issues.push(`${selector} has content overflow but no scrollbar (overflow-y: ${scrollInfo.overflowY})`);
            } else {
              console.log(`   ✅ ${selector} has proper scrolling (${scrollInfo.scrollHeight} > ${scrollInfo.clientHeight})`);
            }
          }
        }
      }
      
      if (results.scrollableContainers === 0 && !documentScrollInfo.canScroll) {
        results.hasScrollingIssues = true;
        results.issues.push('No scrollable containers found and document cannot scroll');
      }
      
    } catch (error) {
      results.hasScrollingIssues = true;
      results.issues.push(`Scroll test error: ${error.message}`);
    }
    
    return results;
  }
});

test.describe('Workspace Responsive Behavior', () => {
  test.afterEach(async ({ page }) => {
    await cleanupAuth(page);
  });

  test('should handle browser window resize properly', async ({ page }) => {
    console.log('🧪 Testing workspace responsive behavior during resize...');
    
    await login(page, TEST_USERS.ADMIN);
    await navigateToWorkspace(page);
    
    // Test resizing sequence that commonly breaks layouts
    const resizeSequence = [
      { width: 1280, height: 720, name: 'Standard Desktop' },
      { width: 800, height: 600, name: 'Small Desktop' },
      { width: 1920, height: 1080, name: 'Large Desktop' },
      { width: 768, height: 1024, name: 'Tablet Portrait' },
      { width: 375, height: 812, name: 'Mobile' },
      { width: 1280, height: 400, name: 'Very Short' }, // This often breaks scrolling
    ];
    
    for (const size of resizeSequence) {
      console.log(`Resizing to ${size.name} (${size.width}x${size.height})`);
      
      await page.setViewportSize({ width: size.width, height: size.height });
      await page.waitForTimeout(1000);
      
      // Test if content is accessible via scrolling
      const canScrollTest = await page.evaluate(() => {
        const originalScrollY = window.scrollY;
        window.scrollBy(0, 100);
        const newScrollY = window.scrollY;
        window.scrollTo(0, originalScrollY); // Reset
        
        return {
          couldScroll: newScrollY !== originalScrollY,
          documentHeight: document.documentElement.scrollHeight,
          viewportHeight: window.innerHeight,
          hasOverflow: document.documentElement.scrollHeight > window.innerHeight
        };
      });
      
      if (canScrollTest.hasOverflow && !canScrollTest.couldScroll) {
        console.log(`❌ ${size.name}: Content overflow but scrolling broken`);
        console.log(`   Document: ${canScrollTest.documentHeight}px, Viewport: ${canScrollTest.viewportHeight}px`);
      } else {
        console.log(`✅ ${size.name}: Scrolling works as expected`);
      }
      
      // Take screenshot for visual verification
      await page.screenshot({ 
        path: `resize-${size.width}x${size.height}-${size.name.replace(/\s+/g, '-').toLowerCase()}.png`,
        fullPage: true 
      });
    }
    
    console.log('✅ Responsive resize test completed');
  });
});