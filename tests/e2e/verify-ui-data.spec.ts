import { test, expect } from '@playwright/test';

test('Verify UI shows work items data', async ({ page }) => {
  console.log('🔍 Testing if UI displays work items...');
  
  // Navigate and authenticate
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);
  
  // Login flow
  await expect(page.locator('text=GraphDone')).toBeVisible({ timeout: 30000 });
  
  // Select Product Team
  const teamButtons = page.locator('button').filter({ hasText: /Product Team/ });
  await teamButtons.first().click();
  await page.waitForTimeout(1000);
  
  // Select Alice Johnson
  const userButtons = page.locator('button').filter({ hasText: /Alice Johnson/ });
  await userButtons.first().click();
  await page.waitForTimeout(1000);
  
  // Continue to main interface
  await page.locator('button:has-text("Continue to GraphDone")').click();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(5000);
  
  console.log('✅ Authentication completed');
  
  // Check for graph visualization
  const svgExists = await page.locator('.graph-container svg').first().isVisible();
  const nodeCircles = await page.locator('.graph-container svg circle.node-circle').count();
  const nodeLabels = await page.locator('.node-label').count();
  
  console.log(`🎨 SVG container exists: ${svgExists}`);
  console.log(`⭕ Node circles found: ${nodeCircles}`);
  console.log(`🏷️ Node labels found: ${nodeLabels}`);
  
  // Take screenshot for debugging
  await page.screenshot({ path: 'test-artifacts/screenshots/ui-data-verification.png', fullPage: true });
  
  // Verify we have data
  expect(svgExists).toBeTruthy();
  expect(nodeCircles).toBeGreaterThan(20); // We should have 32 items
  expect(nodeLabels).toBeGreaterThan(20);
  
  console.log('🎉 UI is displaying work items correctly!');
});