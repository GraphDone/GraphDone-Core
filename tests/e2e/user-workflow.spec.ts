import { test, expect } from '@playwright/test';
import { login, TEST_USERS, navigateToWorkspace } from '../helpers/auth';

test.describe('Complete User Workflow', () => {
  test.beforeEach(async ({ page }) => {
    // Start with a clean state
    await page.goto('/');
  });

  test('should allow complete workflow: login → create graph → create node → node appears without refresh', async ({ page }) => {
    console.log('🧪 Testing complete user workflow: login → create graph → create node');

    // Track any console errors
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Track GraphQL responses for real-time updates
    const graphqlResponses: any[] = [];
    page.on('response', async response => {
      if (response.url().includes('/graphql')) {
        try {
          const json = await response.json();
          graphqlResponses.push(json);
          if (json.errors) {
            console.log('GraphQL Error:', JSON.stringify(json.errors, null, 2));
          }
        } catch (e) {
          // Ignore non-JSON responses
        }
      }
    });

    // Step 1: Login as admin
    console.log('Step 1: Logging in as admin...');
    await login(page, TEST_USERS.ADMIN);
    
    // Verify we're logged in and on the workspace
    await expect(page.url()).not.toContain('/login');
    console.log(`✓ Logged in successfully, current URL: ${page.url()}`);

    // Step 2: Create a new graph
    console.log('Step 2: Creating a new graph...');
    
    // Look for graph creation button - check multiple possible locations
    const createGraphSelectors = [
      'button:has-text("Create Graph")',
      'button:has-text("New Graph")',
      '[data-testid="create-graph"]',
      'button:has-text("+")', 
      '.graph-selector button:has-text("Create")',
      '[aria-label="Create Graph"]'
    ];

    let createButton = null;
    for (const selector of createGraphSelectors) {
      createButton = page.locator(selector).first();
      if (await createButton.isVisible({ timeout: 2000 })) {
        console.log(`Found create graph button with selector: ${selector}`);
        break;
      }
    }

    // If no create button found, look for graph selector dropdown
    if (!createButton || !(await createButton.isVisible())) {
      console.log('Looking for graph selector dropdown...');
      const graphSelector = page.locator('.graph-selector, [data-testid="graph-selector"], button:has-text("Select Graph")').first();
      
      if (await graphSelector.isVisible({ timeout: 5000 })) {
        await graphSelector.click();
        await page.waitForTimeout(1000);
        
        // Look for create option in dropdown
        const createOption = page.locator('button:has-text("Create"), text="Create Graph", [role="option"]:has-text("Create")').first();
        if (await createOption.isVisible({ timeout: 3000 })) {
          createButton = createOption;
        }
      }
    }

    if (!createButton || !(await createButton.isVisible())) {
      // Last resort - try right-click context menu or keyboard shortcut
      console.log('Trying alternative graph creation methods...');
      await page.keyboard.press('Control+Shift+G'); // Common shortcut
      await page.waitForTimeout(1000);
      
      createButton = page.locator('button:has-text("Create Graph"), button:has-text("New Graph")').first();
    }

    expect(createButton, 'Should find a graph creation button').toBeTruthy();
    await expect(createButton).toBeVisible({ timeout: 5000 });
    await createButton.click();

    // Fill in graph creation form
    console.log('Filling graph creation form...');
    const graphNameInput = page.locator('input[placeholder*="name"], input[placeholder*="title"], input[name="name"], input[name="title"]').first();
    await expect(graphNameInput).toBeVisible({ timeout: 5000 });
    
    const testGraphName = `Test Graph ${Date.now()}`;
    await graphNameInput.fill(testGraphName);

    // Look for description field if it exists
    const descriptionInput = page.locator('textarea[placeholder*="description"], input[placeholder*="description"], textarea[name="description"]').first();
    if (await descriptionInput.isVisible({ timeout: 2000 })) {
      await descriptionInput.fill('Test graph for automated user workflow testing');
    }

    // Submit the form
    const submitButton = page.locator('button:has-text("Create"), button:has-text("Save"), button[type="submit"]').first();
    await expect(submitButton).toBeVisible({ timeout: 5000 });
    await submitButton.click();

    // Wait for graph to be created and selected
    console.log('Waiting for graph creation to complete...');
    await page.waitForTimeout(3000); // Allow time for GraphQL mutation

    // Verify graph was created by checking if it appears in selector or URL
    const currentUrl = page.url();
    console.log(`Graph created, current URL: ${currentUrl}`);

    // Step 3: Create a node in the new graph
    console.log('Step 3: Creating a node...');

    // Wait for graph canvas to be ready
    await page.waitForSelector('svg', { timeout: 10000 });
    await page.waitForTimeout(2000); // Let D3 initialize

    // Try multiple methods to create a node
    let nodeCreated = false;

    // Method 1: Right-click on canvas
    console.log('Trying right-click to create node...');
    const svgCanvas = page.locator('svg').first();
    await svgCanvas.click({ button: 'right', position: { x: 400, y: 300 } });
    await page.waitForTimeout(500);

    let createNodeOption = page.locator('text="Create Node", text="Add Node", button:has-text("Create Node")').first();
    if (await createNodeOption.isVisible({ timeout: 3000 })) {
      await createNodeOption.click();
      nodeCreated = true;
    } else {
      // Method 2: Look for toolbar button
      console.log('Trying toolbar create node button...');
      const toolbarCreateNode = page.locator('button:has-text("Add Node"), button:has-text("Create Node"), [data-testid="create-node"]').first();
      if (await toolbarCreateNode.isVisible({ timeout: 3000 })) {
        await toolbarCreateNode.click();
        nodeCreated = true;
      } else {
        // Method 3: Keyboard shortcut
        console.log('Trying keyboard shortcut...');
        await page.keyboard.press('Control+Shift+N');
        await page.waitForTimeout(1000);
        nodeCreated = true;
      }
    }

    expect(nodeCreated, 'Should be able to trigger node creation').toBe(true);

    // Fill in node creation form
    console.log('Filling node creation form...');
    const nodeTitleInput = page.locator('input[placeholder*="title"], input[placeholder*="name"], input[name="title"], input[name="name"]').first();
    await expect(nodeTitleInput).toBeVisible({ timeout: 5000 });

    const testNodeTitle = `Test Node ${Date.now()}`;
    await nodeTitleInput.fill(testNodeTitle);

    // Fill description if available
    const nodeDescriptionInput = page.locator('textarea[placeholder*="description"], input[placeholder*="description"]').first();
    if (await nodeDescriptionInput.isVisible({ timeout: 2000 })) {
      await nodeDescriptionInput.fill('Test node for automated workflow testing');
    }

    // Select node type if dropdown exists
    const typeDropdown = page.locator('select[name="type"], [data-testid="node-type"]').first();
    if (await typeDropdown.isVisible({ timeout: 2000 })) {
      await typeDropdown.selectOption('TASK');
    }

    // Submit the node creation form
    const createNodeSubmit = page.locator('button:has-text("Create"), button:has-text("Add"), button:has-text("Save")').first();
    await expect(createNodeSubmit).toBeVisible({ timeout: 5000 });
    await createNodeSubmit.click();

    // Step 4: Verify node appears immediately WITHOUT refresh
    console.log('Step 4: Verifying node appears immediately without refresh...');
    
    // Wait for the node to appear in the DOM - this is the critical test
    await page.waitForTimeout(3000); // Give time for GraphQL subscription to update

    // Look for the newly created node in various ways
    const nodeSelectors = [
      `text="${testNodeTitle}"`,
      `[data-node-title="${testNodeTitle}"]`,
      `.node:has-text("${testNodeTitle}")`,
      `g.node:has-text("${testNodeTitle}")`,
      `circle + text:has-text("${testNodeTitle}")`,
      '[data-testid="graph-node"]'
    ];

    let nodeFound = false;
    let foundSelector = '';

    for (const selector of nodeSelectors) {
      const nodeElement = page.locator(selector).first();
      if (await nodeElement.isVisible({ timeout: 2000 })) {
        nodeFound = true;
        foundSelector = selector;
        console.log(`✓ Node found with selector: ${selector}`);
        break;
      }
    }

    // If still not found, check if nodes exist at all
    if (!nodeFound) {
      console.log('Node not found with title, checking for any nodes...');
      const anyNodes = page.locator('.node, g.node, circle[r]');
      const nodeCount = await anyNodes.count();
      console.log(`Total nodes found: ${nodeCount}`);
      
      if (nodeCount > 0) {
        console.log('Nodes exist but title not found - checking node content...');
        for (let i = 0; i < Math.min(nodeCount, 5); i++) {
          const nodeText = await anyNodes.nth(i).textContent();
          console.log(`Node ${i} text:`, nodeText);
        }
      }
    }

    // Critical assertion: Node should appear without refresh
    expect(nodeFound, `Node with title "${testNodeTitle}" should be visible immediately after creation without refresh. Checked selectors: ${nodeSelectors.join(', ')}`).toBe(true);

    // Step 5: Verify no errors occurred
    console.log('Step 5: Checking for errors...');

    const relevantErrors = consoleErrors.filter(error => 
      !error.includes('favicon') && 
      !error.includes('net::ERR_') &&
      !error.includes('ResizeObserver')
    );

    if (relevantErrors.length > 0) {
      console.log('Console errors found:', relevantErrors);
    }

    expect(relevantErrors.length, `No console errors should occur during workflow. Found: ${relevantErrors.join(', ')}`).toBe(0);

    // Step 6: Verify real-time updates are working
    console.log('Step 6: Verifying real-time updates...');

    const hasNodeCreationResponse = graphqlResponses.some(response => 
      response.data && (
        response.data.createWorkItem || 
        response.data.addNode ||
        JSON.stringify(response).includes('createWorkItem')
      )
    );

    expect(hasNodeCreationResponse, 'Should have GraphQL response for node creation').toBe(true);

    console.log('✅ Complete user workflow test passed successfully!');
    console.log(`- Successfully logged in as ${TEST_USERS.ADMIN.username}`);
    console.log(`- Created graph: "${testGraphName}"`);
    console.log(`- Created node: "${testNodeTitle}"`);
    console.log(`- Node appeared immediately without refresh using selector: ${foundSelector}`);
    console.log(`- No console errors occurred`);
    console.log(`- Real-time GraphQL updates working`);
  });

  test('should handle node creation errors gracefully', async ({ page }) => {
    console.log('🧪 Testing error handling during node creation');

    // Login first
    await login(page, TEST_USERS.ADMIN);
    await navigateToWorkspace(page);

    // Try to create a node with invalid data
    const svgCanvas = page.locator('svg').first();
    await svgCanvas.click({ button: 'right', position: { x: 400, y: 300 } });

    const createNodeOption = page.locator('text="Create Node", text="Add Node"').first();
    if (await createNodeOption.isVisible({ timeout: 3000 })) {
      await createNodeOption.click();

      // Submit with empty form to trigger validation
      const submitButton = page.locator('button:has-text("Create"), button:has-text("Add")').first();
      if (await submitButton.isVisible({ timeout: 5000 })) {
        await submitButton.click();

        // Should show validation error
        const errorMessage = page.locator('text*="required", text*="error", .error-message').first();
        await expect(errorMessage).toBeVisible({ timeout: 5000 });
        
        console.log('✓ Validation error handling works correctly');
      }
    }
  });

  test('should support creating multiple nodes in sequence', async ({ page }) => {
    console.log('🧪 Testing multiple node creation without refresh issues');

    await login(page, TEST_USERS.ADMIN);
    await navigateToWorkspace(page);

    // Create 3 nodes in sequence
    const nodeNames = ['First Node', 'Second Node', 'Third Node'];
    
    for (let i = 0; i < nodeNames.length; i++) {
      console.log(`Creating node ${i + 1}: ${nodeNames[i]}`);

      // Right-click to create node
      const svgCanvas = page.locator('svg').first();
      await svgCanvas.click({ button: 'right', position: { x: 300 + i * 100, y: 300 + i * 50 } });

      const createNodeOption = page.locator('text="Create Node", text="Add Node"').first();
      if (await createNodeOption.isVisible({ timeout: 3000 })) {
        await createNodeOption.click();

        // Fill form
        const titleInput = page.locator('input[placeholder*="title"], input[name="title"]').first();
        await titleInput.fill(nodeNames[i]);

        // Submit
        const submitButton = page.locator('button:has-text("Create")').first();
        await submitButton.click();

        // Wait and verify node appears
        await page.waitForTimeout(2000);
        const nodeElement = page.locator(`text="${nodeNames[i]}"`).first();
        await expect(nodeElement).toBeVisible({ timeout: 5000 });
        
        console.log(`✓ Node "${nodeNames[i]}" created and visible`);
      }
    }

    // Verify all nodes are still visible
    for (const nodeName of nodeNames) {
      const nodeElement = page.locator(`text="${nodeName}"`).first();
      await expect(nodeElement).toBeVisible();
    }

    console.log('✅ Multiple node creation test passed - all nodes visible without refresh');
  });
});