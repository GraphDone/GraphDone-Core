import { test, expect } from '@playwright/test';

test('Screenshot current graph visualization', async ({ page }) => {
  // Navigate to the application
  await page.goto('http://localhost:3127');
  
  // Wait for the page to load
  await page.waitForLoadState('networkidle');
  
  // Wait a bit more for any dynamic content
  await page.waitForTimeout(3000);
  
  // Take a screenshot of the current state
  await page.screenshot({ 
    path: 'test-artifacts/current-graph-visualization.png',
    fullPage: true 
  });
  
  // Try to find and click on the graph view if it exists
  const graphButton = page.locator('text=Graph');
  if (await graphButton.isVisible()) {
    await graphButton.click();
    await page.waitForTimeout(2000);
    await page.screenshot({ 
      path: 'test-artifacts/current-graph-view.png',
      fullPage: true 
    });
  }
  
  // Try to find workspace or visualization elements
  const workspaceButton = page.locator('text=Workspace');
  if (await workspaceButton.isVisible()) {
    await workspaceButton.click();
    await page.waitForTimeout(2000);
    await page.screenshot({ 
      path: 'test-artifacts/current-workspace-view.png',
      fullPage: true 
    });
  }
});