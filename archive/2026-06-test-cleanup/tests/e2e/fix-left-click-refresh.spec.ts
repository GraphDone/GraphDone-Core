import { test, expect } from '@playwright/test';

test('Verify left-clicking does not refresh visualization', async ({ page }) => {
  console.log('🖱️ Testing left-click behavior...');
  
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
  
  // Wait for graph to be fully loaded
  const nodeCircles = page.locator('.graph-container svg circle.node-circle');
  await expect(nodeCircles.first()).toBeVisible({ timeout: 15000 });
  
  // Record initial node positions by getting the first node's position
  const firstNode = nodeCircles.first();
  const initialTransform = await firstNode.locator('..').getAttribute('transform');
  console.log(`📍 Initial node position: ${initialTransform}`);
  
  // Take screenshot before click
  await page.screenshot({ path: 'test-artifacts/screenshots/before-click.png', fullPage: true });
  
  // Wait a moment for any initial animations to settle
  await page.waitForTimeout(2000);
  
  // Click on empty space in the main graph SVG (not on a node)
  const svgElement = page.locator('.graph-container svg').first();
  await svgElement.click({ position: { x: 100, y: 100 } });
  
  console.log('🖱️ Clicked on empty space');
  
  // Wait a moment to see if anything changes
  await page.waitForTimeout(2000);
  
  // Check that the first node's position hasn't changed significantly
  const afterClickTransform = await firstNode.locator('..').getAttribute('transform');
  console.log(`📍 After click position: ${afterClickTransform}`);
  
  // Take screenshot after click
  await page.screenshot({ path: 'test-artifacts/screenshots/after-click.png', fullPage: true });
  
  // The transform should not have changed significantly (allowing for minor simulation movement)
  // If the visualization refreshed, the node would be back at initial random position
  const nodePositionStable = initialTransform === afterClickTransform;
  
  console.log(`🎯 Node position stable: ${nodePositionStable}`);
  
  // Multiple clicks should not cause refresh
  await svgElement.click({ position: { x: 200, y: 200 } });
  await page.waitForTimeout(1000);
  await svgElement.click({ position: { x: 300, y: 300 } });
  await page.waitForTimeout(1000);
  
  const afterMultipleClicksTransform = await firstNode.locator('..').getAttribute('transform');
  console.log(`📍 After multiple clicks position: ${afterMultipleClicksTransform}`);
  
  // Take final screenshot
  await page.screenshot({ path: 'test-artifacts/screenshots/after-multiple-clicks.png', fullPage: true });
  
  // The position should still be stable or only have minor changes from simulation
  const finalPositionStable = afterClickTransform === afterMultipleClicksTransform;
  
  console.log('🎉 Left-click test results:');
  console.log(`   ✅ Initial position stable after first click: ${nodePositionStable}`);
  console.log(`   ✅ Position stable after multiple clicks: ${finalPositionStable}`);
  
  // At minimum, we expect no dramatic position changes that would indicate a refresh
  expect(nodePositionStable || finalPositionStable).toBeTruthy();
});