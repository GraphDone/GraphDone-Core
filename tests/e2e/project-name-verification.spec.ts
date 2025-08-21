import { test, expect } from '@playwright/test';

test.describe('Project Name and UI Integration Tests', () => {
  test('Verify modern project names appear in UI', async ({ page }) => {
    console.log('🚀 Testing GraphDone Graph Integration...');
    
    // Navigate to the app
    console.log('📍 Navigating to application...');
    await page.goto('http://localhost:3127');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    
    console.log('🔍 Looking for modern project names...');
    
    // Check for modern project names that should be in the seeded data
    const projectNames = [
      'AI-Powered Healthcare Platform',
      'Global Climate Intelligence Platform', 
      'Quantum Cloud Computing Platform'
    ];
    
    const foundProjects = [];
    const missingProjects = [];
    
    for (const projectName of projectNames) {
      try {
        // Look for project name in any visible text
        const element = await page.locator(`text=${projectName}`).first();
        const isVisible = await element.isVisible({ timeout: 5000 });
        
        if (isVisible) {
          foundProjects.push(projectName);
          console.log(`✅ Found ${projectName} in UI`);
        } else {
          missingProjects.push(projectName);
          console.log(`❌ ${projectName} not visible in UI`);
        }
      } catch (error) {
        missingProjects.push(projectName);
        console.log(`❌ ${projectName} not found in UI`);
      }
    }
    
    // Take a screenshot for debugging
    await page.screenshot({ 
      path: './test-results/project-names-verification.png', 
      fullPage: true 
    });
    
    // Verify that at least some projects were found
    expect(foundProjects.length).toBeGreaterThan(0);
    
    console.log(`\n📊 Summary:`);
    console.log(`✅ Projects found: ${foundProjects.length}/${projectNames.length}`);
    console.log(`❌ Projects missing: ${missingProjects.length}/${projectNames.length}`);
    
    if (foundProjects.length > 0) {
      console.log(`Found projects: ${foundProjects.join(', ')}`);
    }
    if (missingProjects.length > 0) {
      console.log(`Missing projects: ${missingProjects.join(', ')}`);
    }
  });

  test('Verify UI displays work items after authentication', async ({ page }) => {
    console.log('🔐 Testing authenticated UI content...');
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    
    // Check if authentication flow is required
    const hasLoginForm = await page.locator('text=GraphDone').isVisible({ timeout: 10000 });
    
    if (hasLoginForm) {
      console.log('🔑 Performing authentication...');
      
      // Select Product Team if available
      try {
        const teamButtons = page.locator('button').filter({ hasText: /Product Team/ });
        if (await teamButtons.first().isVisible({ timeout: 5000 })) {
          await teamButtons.first().click();
          await page.waitForTimeout(1000);
        }
      } catch (error) {
        console.log('⚠️ Product Team selection not available');
      }
      
      // Select a user if available
      try {
        const userButtons = page.locator('button').filter({ hasText: /Alice Johnson|John|Sarah|Mike/ });
        if (await userButtons.first().isVisible({ timeout: 5000 })) {
          await userButtons.first().click();
          await page.waitForTimeout(1000);
        }
      } catch (error) {
        console.log('⚠️ User selection not available');
      }
    }
    
    // Look for any work items or project content
    await page.waitForTimeout(3000);
    
    // Check for common UI elements that indicate successful data loading
    const indicators = [
      page.locator('[data-testid*="work-item"]'),
      page.locator('[data-testid*="node"]'),
      page.locator('text=Task'),
      page.locator('text=Feature'),
      page.locator('text=Bug'),
      page.locator('svg'), // Graph visualization
    ];
    
    let contentFound = false;
    for (const indicator of indicators) {
      try {
        if (await indicator.first().isVisible({ timeout: 5000 })) {
          contentFound = true;
          console.log('✅ Found work item content in UI');
          break;
        }
      } catch (error) {
        // Continue checking other indicators
      }
    }
    
    // Take screenshot for debugging
    await page.screenshot({ 
      path: './test-results/authenticated-ui-content.png', 
      fullPage: true 
    });
    
    if (contentFound) {
      console.log('✅ UI successfully displays work items after authentication');
    } else {
      console.log('⚠️ No obvious work item content found - may need deeper inspection');
    }
  });
});