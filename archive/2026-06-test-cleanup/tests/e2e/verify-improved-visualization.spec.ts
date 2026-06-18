import { test, expect } from '@playwright/test';

test('Verify improved graph visualization with edges and better labels', async ({ page }) => {
  console.log('🎨 Testing improved graph visualization...');
  
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
  
  // Check for graph visualization components
  const svgExists = await page.locator('.graph-container svg').first().isVisible();
  const nodeCircles = await page.locator('.graph-container svg circle.node-circle').count();
  const nodeLabels = await page.locator('.graph-container svg text.node-label').count();
  const edges = await page.locator('.graph-container svg line.edge').count();
  
  console.log(`🎨 SVG container exists: ${svgExists}`);
  console.log(`⭕ Node circles found: ${nodeCircles}`);
  console.log(`🏷️ SVG text labels found: ${nodeLabels}`);
  console.log(`🔗 Edges found: ${edges}`);
  
  // Take screenshot
  await page.screenshot({ path: 'test-artifacts/screenshots/improved-visualization.png', fullPage: true });
  
  // Verify the improved visualization
  expect(svgExists).toBeTruthy();
  expect(nodeCircles).toBeGreaterThan(25); // Should have 32 nodes
  expect(nodeLabels).toBeGreaterThan(25); // Should have labels for each node
  expect(edges).toBeGreaterThan(0); // Should have edges now
  
  console.log('🎉 Improved visualization is working!');
  console.log(`   ✅ Nodes: ${nodeCircles}`);
  console.log(`   ✅ Labels: ${nodeLabels} (SVG text elements)`);
  console.log(`   ✅ Edges: ${edges} (connected relationships)`);
});