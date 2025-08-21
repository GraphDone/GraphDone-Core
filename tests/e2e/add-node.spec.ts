import { test, expect } from '@playwright/test';

test.describe('Add Node Functionality', () => {
  test.beforeEach(async ({ page }) => {
    // Listen for console errors from the start
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
        console.log('Browser console error:', msg.text());
      }
    });
    
    // Listen for page errors
    page.on('pageerror', error => {
      console.log('Page error:', error.message);
      errors.push(error.message);
    });
    
    // Navigate to the app and handle authentication
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Wait longer for React to load
    await page.waitForTimeout(3000);
    
    // Handle login flow
    // Wait for login page to load
    await expect(page.locator('text=GraphDone')).toBeVisible({ timeout: 30000 });
    
    // Select a team first (click the first team button)
    const teamButtons = page.locator('button').filter({ hasText: /.*Team.*|.*Product.*|.*Engineering.*/ });
    await teamButtons.first().click();
    
    // Wait a moment for team selection to process
    await page.waitForTimeout(500);
    
    // Select a user (click the first available user)
    const userButtons = page.locator('button').filter({ hasText: /Alice|Bob|Carol/ });
    await userButtons.first().click();
    
    // Wait for user selection to process
    await page.waitForTimeout(500);
    
    // Click continue button
    await page.locator('button:has-text("Continue to GraphDone")').click();
    
    // Wait for workspace to load
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    
    // Select a graph (if needed)
    // Look for a graph selection or create one
    const selectGraphElement = await page.locator('text=Select a Graph').isVisible();
    if (selectGraphElement) {
      // If there's a graph selector, click on the first graph
      const graphButtons = page.locator('button').filter({ hasText: /Roadmap|Product|Project/ });
      if (await graphButtons.count() > 0) {
        await graphButtons.first().click();
      }
    }
    
    // Wait for graph to be selected and UI to be ready
    await page.waitForTimeout(2000);
    
    // Report any errors
    if (errors.length > 0) {
      console.log('JavaScript errors detected:', errors);
    }
  });

  test('should display workspace with add node button', async ({ page }) => {
    // Listen for console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log('Browser console error:', msg.text());
      }
    });
    
    // Take a screenshot for debugging
    await page.screenshot({ path: 'debug-workspace.png' });
    
    // Check what's actually on the page
    const pageContent = await page.textContent('body');
    console.log('Page content:', pageContent?.substring(0, 500));
    
    // Check that the workspace is loaded
    await expect(page.locator('button:has-text("Add Node")')).toBeVisible();
    
    // Check that the graph canvas is present (look for the specific graph SVG)
    const graphSVG = page.locator('div.graph-container svg, svg').last();
    await expect(graphSVG).toBeVisible();
    
    // Check for workspace elements
    await expect(page.locator('text=Filter')).toBeVisible();
    await expect(page.locator('text=Auto-layout')).toBeVisible();
  });

  test('should open create node modal when Add Node button is clicked', async ({ page }) => {
    // Click the Add Node button
    await page.locator('button:has-text("Add Node")').click();
    
    // Check that the modal opens
    await expect(page.locator('text=Create New Work Item')).toBeVisible();
    await expect(page.locator('input[placeholder*="title"]')).toBeVisible();
    await expect(page.locator('select')).toBeVisible(); // Type selector
    await expect(page.locator('textarea')).toBeVisible(); // Description
  });

  test('should create a new work item when form is submitted', async ({ page }) => {
    // Click Add Node button
    await page.locator('button:has-text("Add Node")').click();
    
    // Fill out the form
    await page.locator('input[placeholder*="title"]').fill('Test Work Item');
    await page.locator('select').selectOption('TASK');
    await page.locator('textarea').fill('This is a test work item');
    
    // Set some priority values using the sliders
    const prioritySliders = page.locator('input[type="range"]');
    await prioritySliders.nth(0).fill('0.7'); // Executive priority
    await prioritySliders.nth(1).fill('0.5'); // Individual priority
    await prioritySliders.nth(2).fill('0.3'); // Community priority
    
    // Submit the form
    await page.locator('button:has-text("Create Work Item")').click();
    
    // Wait for the modal to close
    await expect(page.locator('text=Create New Work Item')).not.toBeVisible();
    
    // Wait a bit for the graph to update
    await page.waitForTimeout(1000);
    
    // Check that a node appears in the graph
    // The node should be visible as a circle in the SVG
    const circles = page.locator('svg circle.node-circle');
    const circleCount = await circles.count();
    expect(circleCount).toBeGreaterThan(0);
    
    // Check that the node has a label with our title
    await expect(page.locator('svg text:has-text("Test Work Item")')).toBeVisible();
  });

  test('should open create node modal when clicking on graph background', async ({ page }) => {
    // Click on the SVG background (empty area)
    const svg = page.locator('svg');
    await svg.click({ position: { x: 300, y: 300 } });
    
    // Check that the modal opens
    await expect(page.locator('text=Create New Work Item')).toBeVisible();
  });

  test('should open node context menu when clicking on existing node', async ({ page }) => {
    // First create a node to click on
    await page.locator('button:has-text("Add Node")').click();
    await page.locator('input[placeholder*="title"]').fill('Click Test Node');
    await page.locator('button:has-text("Create Work Item")').click();
    await page.waitForTimeout(1000);
    
    // Click on the node
    const nodeCircle = page.locator('svg circle.node-circle').first();
    await nodeCircle.click();
    
    // Check that the context menu appears
    await expect(page.locator('text=Add Connected Item')).toBeVisible();
    await expect(page.locator('text=Edit Details')).toBeVisible();
  });

  test('should create connected node when Add Connected Item is clicked', async ({ page }) => {
    // First create a parent node
    await page.locator('button:has-text("Add Node")').click();
    await page.locator('input[placeholder*="title"]').fill('Parent Node');
    await page.locator('button:has-text("Create Work Item")').click();
    await page.waitForTimeout(1000);
    
    // Click on the parent node to open context menu
    const nodeCircle = page.locator('svg circle.node-circle').first();
    await nodeCircle.click();
    
    // Click "Add Connected Item"
    await page.locator('text=Add Connected Item').click();
    
    // Check that the modal opens with connection indicator
    await expect(page.locator('text=Add Connected Work Item')).toBeVisible();
    await expect(page.locator('text=This work item will be connected')).toBeVisible();
    
    // Fill out the form for the connected item
    await page.locator('input[placeholder*="title"]').fill('Connected Child Node');
    await page.locator('button:has-text("Create & Connect")').click();
    
    // Wait for updates
    await page.waitForTimeout(1000);
    
    // Check that both nodes are visible
    await expect(page.locator('svg text:has-text("Parent Node")')).toBeVisible();
    await expect(page.locator('svg text:has-text("Connected Child Node")')).toBeVisible();
    
    // Check that there's a connection line between them
    const edges = page.locator('svg line.edge');
    await expect(edges).toHaveCountGreaterThan(0);
  });

  test('should handle errors gracefully when server is unavailable', async ({ page }) => {
    // Intercept GraphQL requests and make them fail
    await page.route('**/graphql', route => {
      route.abort();
    });
    
    // Try to create a node
    await page.locator('button:has-text("Add Node")').click();
    await page.locator('input[placeholder*="title"]').fill('Error Test Node');
    await page.locator('button:has-text("Create Work Item")').click();
    
    // The button should show an error state or the modal should remain open
    // (We're not sure exactly how errors are handled, but we can check for common patterns)
    await page.waitForTimeout(2000);
    
    // The modal should still be visible if there was an error
    const modalStillVisible = await page.locator('text=Create New Work Item').isVisible();
    const hasErrorMessage = await page.locator('text*=error').isVisible();
    
    // At least one of these should be true - either modal stays open or error is shown
    expect(modalStillVisible || hasErrorMessage).toBeTruthy();
  });

  test('should display existing work items on page load', async ({ page }) => {
    // Since we may have created nodes in previous tests, check if they're visible
    // This tests the data fetching functionality
    
    // Wait for data to load
    await page.waitForTimeout(2000);
    
    // Check if any nodes are displayed
    const nodeCount = await page.locator('svg circle.node-circle').count();
    console.log(`Found ${nodeCount} nodes on page load`);
    
    // If there are nodes, check that they have labels
    if (nodeCount > 0) {
      const textCount = await page.locator('svg text.node-text').count();
      expect(textCount).toBeGreaterThan(0);
    }
  });
});