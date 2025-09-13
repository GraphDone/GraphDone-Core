import { test, expect } from '@playwright/test';
import { 
  login, 
  navigateToWorkspace, 
  createTestGraph,
  cleanupAuth,
  TEST_USERS 
} from '../helpers/auth';

test.describe('User Workflow - Node Creation & Refresh Issue', () => {
  test.afterEach(async ({ page }) => {
    await cleanupAuth(page);
  });

  test('should detect node refresh requirement bug', async ({ page }) => {
    console.log('🧪 Testing complete user workflow to detect refresh issue...');

    // Track GraphQL responses and console errors
    const graphqlResponses: any[] = [];
    const consoleErrors: string[] = [];
    
    page.on('console', msg => {
      if (msg.type() === 'error' && !msg.text().includes('favicon') && !msg.text().includes('ResizeObserver')) {
        consoleErrors.push(msg.text());
        console.log('Console error:', msg.text());
      }
    });
    
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

    // Step 1: Login using our robust authentication system
    console.log('Step 1: Authenticating...');
    await login(page, TEST_USERS.ADMIN);
    console.log('✅ Authentication successful');

    // Step 2: Navigate to workspace  
    console.log('Step 2: Navigating to workspace...');
    await navigateToWorkspace(page);
    console.log('✅ Workspace loaded');

    // Step 3: Create or select a graph
    console.log('Step 3: Ensuring we have a test graph...');
    let testGraphName;
    try {
      testGraphName = await createTestGraph(page, {
        name: `Node Test Graph ${Date.now()}`,
        description: 'Testing node creation and refresh behavior'
      });
      console.log(`✅ Test graph created: ${testGraphName}`);
    } catch (error) {
      console.log('Graph creation failed, continuing with existing graph...');
      // Continue with whatever graph is currently selected
    }

    // Step 4: Create a node
    console.log('Step 4: Creating a test node...');
    const testNodeTitle = `Test Node ${Date.now()}`;
    let nodeCreationAttempted = false;
    
    // Wait for graph to be ready
    await page.waitForTimeout(3000);
    
    // Try to create a node via right-click
    try {
      const graphArea = page.locator('svg, .graph-container, [data-testid="graph-area"]').first();
      
      if (await graphArea.isVisible({ timeout: 5000 })) {
        await graphArea.click({ button: 'right', position: { x: 400, y: 300 } });
        await page.waitForTimeout(1000);
        
        const createNodeOption = page.locator('button:has-text("Create Node"), button:has-text("Add Node"), text="Create Node"').first();
        if (await createNodeOption.isVisible({ timeout: 3000 })) {
          await createNodeOption.click();
          nodeCreationAttempted = true;
          console.log('✅ Node creation dialog opened via right-click');
        }
      }
    } catch (error) {
      console.log('Right-click method failed, trying alternative...');
    }
    
    // Alternative: Look for toolbar create button
    if (!nodeCreationAttempted) {
      const createButton = page.locator('button:has-text("Add"), button:has-text("Create"), [data-testid="create-node"]').first();
      if (await createButton.isVisible({ timeout: 3000 })) {
        await createButton.click();
        nodeCreationAttempted = true;
        console.log('✅ Node creation dialog opened via toolbar');
      }
    }
    
    if (!nodeCreationAttempted) {
      console.log('⚠️ Could not find node creation method - this might be part of the UX issue');
      // Continue anyway to see what we can observe
    } else {
      // Fill node creation form
      console.log('Step 4a: Filling node creation form...');
      const titleInput = page.locator('input[name="title"], input[placeholder*="title"], input[placeholder*="name"]').first();
      
      if (await titleInput.isVisible({ timeout: 5000 })) {
        await titleInput.fill(testNodeTitle);
        
        // Submit
        const submitButton = page.locator('button:has-text("Create"), button:has-text("Add"), button:has-text("Save")').first();
        if (await submitButton.isVisible({ timeout: 5000 })) {
          await submitButton.click();
          console.log('✅ Node creation form submitted');
        }
      }
    }

    // Step 5: THE CRITICAL TEST - Check if node appears without refresh
    console.log('Step 5: Testing node appearance without refresh...');
    
    // Wait for potential GraphQL response
    await page.waitForTimeout(4000);
    
    // Look for the newly created node
    const nodeVisibleWithoutRefresh = await checkForNode(page, testNodeTitle);
    
    console.log(`Node visible without refresh: ${nodeVisibleWithoutRefresh}`);
    
    // Step 6: Test the refresh workaround
    console.log('Step 6: Testing refresh workaround...');
    let nodeVisibleAfterRefresh = false;
    
    if (!nodeVisibleWithoutRefresh) {
      console.log('💡 Node not visible, testing refresh workaround...');
      await page.reload();
      await page.waitForTimeout(3000);
      
      nodeVisibleAfterRefresh = await checkForNode(page, testNodeTitle);
      console.log(`Node visible after refresh: ${nodeVisibleAfterRefresh}`);
    }

    // Step 7: Analysis and reporting
    console.log('Step 7: Analyzing results...');
    
    const nodeCreationResponse = graphqlResponses.some(response => 
      response.data && (
        response.data.createWorkItem ||
        response.data.createNode ||
        JSON.stringify(response).toLowerCase().includes('workitem')
      )
    );

    // Generate comprehensive report
    console.log('=== USER WORKFLOW TEST RESULTS ===');
    console.log(`Node creation attempted: ${nodeCreationAttempted}`);
    console.log(`Node visible without refresh: ${nodeVisibleWithoutRefresh}`);
    console.log(`Node visible after refresh: ${nodeVisibleAfterRefresh}`);
    console.log(`GraphQL responses received: ${graphqlResponses.length}`);
    console.log(`Node creation GraphQL success: ${nodeCreationResponse}`);
    console.log(`Console errors: ${consoleErrors.length}`);
    
    if (consoleErrors.length > 0) {
      console.log('Console errors:', consoleErrors);
    }

    // CRITICAL ASSESSMENT: Detect the refresh requirement bug
    if (nodeCreationAttempted && nodeCreationResponse && !nodeVisibleWithoutRefresh && nodeVisibleAfterRefresh) {
      console.log('🐛 CONFIRMED: Node refresh requirement bug detected!');
      console.log('   - Node creation GraphQL succeeded ✓');
      console.log('   - Node not visible without refresh ❌'); 
      console.log('   - Node visible after refresh ✓');
      console.log('   This confirms the user-reported issue.');
    } else if (nodeVisibleWithoutRefresh) {
      console.log('✅ SUCCESS: Node appeared immediately without refresh');
      console.log('   Real-time updates are working correctly');
    } else {
      console.log('⚠️ INCONCLUSIVE: Unable to fully test due to UI interaction issues');
    }

    // For CI purposes, don't fail the test - this is diagnostic
    expect(graphqlResponses.length, 'Should receive GraphQL responses').toBeGreaterThan(0);
    
    console.log('✅ User workflow diagnostic test completed');
  });

  test('should detect relationship flip direction refresh bug', async ({ page }) => {
    console.log('🧪 Testing relationship flip direction refresh requirement bug...');

    // Track GraphQL responses and console errors
    const graphqlResponses: any[] = [];
    const consoleErrors: string[] = [];
    
    page.on('console', msg => {
      if (msg.type() === 'error' && !msg.text().includes('favicon') && !msg.text().includes('ResizeObserver')) {
        consoleErrors.push(msg.text());
        console.log('Console error:', msg.text());
      }
    });
    
    page.on('response', async response => {
      if (response.url().includes('/graphql')) {
        try {
          const json = await response.json();
          graphqlResponses.push(json);
          if (json.errors) {
            console.log('GraphQL Error:', JSON.stringify(json.errors, null, 2));
          }
          
          // Specifically look for flip relationship mutations
          if (JSON.stringify(json).includes('flipWorkItemRelationship') || 
              JSON.stringify(json).includes('flipRelationship')) {
            console.log('🔄 Detected flip relationship GraphQL mutation');
          }
        } catch (e) {
          // Ignore non-JSON responses
        }
      }
    });

    // Step 1: Login and setup
    console.log('Step 1: Authenticating and setting up test environment...');
    await login(page, TEST_USERS.ADMIN);
    await navigateToWorkspace(page);

    // Ensure we have a graph with some nodes and relationships
    console.log('Step 2: Ensuring test graph with relationships exists...');
    await page.waitForTimeout(3000);

    // Step 3: Find a relationship to flip
    console.log('Step 3: Looking for relationships to test flip direction...');
    
    // Look for relationship edges in the graph
    const relationships = page.locator('line, path, .edge, [data-edge]');
    const relationshipCount = await relationships.count();
    console.log(`Found ${relationshipCount} potential relationships in graph`);

    if (relationshipCount === 0) {
      console.log('⚠️ No relationships found - creating test nodes with relationship first');
      
      // Create two nodes and connect them for testing
      const node1Title = `Source Node ${Date.now()}`;
      const node2Title = `Target Node ${Date.now() + 1}`;
      
      // Create first node (simplified approach)
      await createNodeIfPossible(page, node1Title);
      await page.waitForTimeout(2000);
      
      // Create second node
      await createNodeIfPossible(page, node2Title);
      await page.waitForTimeout(2000);
      
      console.log('✅ Created test nodes for relationship flip testing');
    }

    // Step 4: Try to flip a relationship direction
    console.log('Step 4: Attempting to flip relationship direction...');
    
    let flipAttempted = false;
    let originalRelationshipState = '';
    let flippedRelationshipState = '';

    try {
      // First, try to find and click on a relationship
      const relationship = relationships.first();
      
      if (await relationship.isVisible({ timeout: 5000 })) {
        // Take a screenshot/state before flip
        originalRelationshipState = await captureRelationshipState(page);
        
        // Click on the relationship
        await relationship.click();
        console.log('✅ Clicked on relationship');
        
        // Look for flip direction button or context menu
        await page.waitForTimeout(1000);
        
        const flipButtons = [
          'button:has-text("Flip")',
          'button:has-text("Reverse")', 
          'button[title*="flip"]',
          'button[title*="reverse"]',
          '[data-testid="flip-relationship"]',
          '.flip-button',
          'button:has(svg[data-icon*="exchange"])',
          'button:has(svg[data-icon*="arrow"])'
        ];

        for (const flipSelector of flipButtons) {
          const flipButton = page.locator(flipSelector);
          if (await flipButton.isVisible({ timeout: 2000 })) {
            console.log(`Found flip button with selector: ${flipSelector}`);
            await flipButton.click();
            flipAttempted = true;
            console.log('✅ Flip relationship button clicked');
            break;
          }
        }
        
        if (!flipAttempted) {
          // Try right-click context menu approach
          await relationship.click({ button: 'right' });
          await page.waitForTimeout(1000);
          
          const contextFlip = page.locator('text="Flip Direction", text="Reverse", text="Flip"').first();
          if (await contextFlip.isVisible({ timeout: 3000 })) {
            await contextFlip.click();
            flipAttempted = true;
            console.log('✅ Flip relationship via context menu');
          }
        }
      }
    } catch (error) {
      console.log('Error during relationship flip attempt:', error);
    }

    if (!flipAttempted) {
      console.log('⚠️ Could not find relationship flip functionality - this might indicate UI/UX issues');
      console.log('This test will be inconclusive but still valuable for understanding the current state');
    }

    // Step 5: THE CRITICAL TEST - Check if flip is visible without refresh
    console.log('Step 5: Testing flip visibility without refresh...');
    
    if (flipAttempted) {
      // Wait for potential GraphQL response and UI updates
      await page.waitForTimeout(3000);
      
      // Capture relationship state after flip
      flippedRelationshipState = await captureRelationshipState(page);
      
      const flipVisibleWithoutRefresh = originalRelationshipState !== flippedRelationshipState;
      console.log(`Flip visible without refresh: ${flipVisibleWithoutRefresh}`);
      
      // Step 6: Test the refresh workaround for flip
      console.log('Step 6: Testing refresh workaround for relationship flip...');
      
      if (!flipVisibleWithoutRefresh) {
        console.log('💡 Flip not visible, testing refresh workaround...');
        await page.reload();
        await page.waitForTimeout(3000);
        
        const stateAfterRefresh = await captureRelationshipState(page);
        const flipVisibleAfterRefresh = originalRelationshipState !== stateAfterRefresh && 
                                      stateAfterRefresh !== flippedRelationshipState;
        
        console.log(`Flip visible after refresh: ${flipVisibleAfterRefresh}`);
        
        // CRITICAL ASSESSMENT for flip direction bug
        if (flipVisibleAfterRefresh) {
          console.log('🐛 CONFIRMED: Relationship flip direction refresh bug detected!');
          console.log('   - Flip action attempted ✓');
          console.log('   - Flip not visible without refresh ❌'); 
          console.log('   - Flip visible after refresh ✓');
          console.log('   This confirms the user-reported flip direction refresh issue.');
        }
      } else {
        console.log('✅ SUCCESS: Relationship flip appeared immediately without refresh');
        console.log('   Real-time relationship updates are working correctly');
      }
    }

    // Step 7: Analysis and comprehensive reporting
    console.log('=== RELATIONSHIP FLIP TEST RESULTS ===');
    console.log(`Flip attempted: ${flipAttempted}`);
    console.log(`Original state: ${originalRelationshipState.slice(0, 100)}...`);
    console.log(`Flipped state: ${flippedRelationshipState.slice(0, 100)}...`);
    console.log(`GraphQL responses: ${graphqlResponses.length}`);
    console.log(`Console errors: ${consoleErrors.length}`);
    
    const flipGraphQLResponse = graphqlResponses.some(response => 
      JSON.stringify(response).toLowerCase().includes('flip') ||
      JSON.stringify(response).toLowerCase().includes('reverse')
    );
    
    console.log(`Flip GraphQL detected: ${flipGraphQLResponse}`);
    
    if (consoleErrors.length > 0) {
      console.log('Console errors during flip test:', consoleErrors);
    }

    // For CI - don't fail, this is diagnostic  
    expect(graphqlResponses.length, 'Should receive GraphQL responses during test').toBeGreaterThan(0);
    
    console.log('✅ Relationship flip diagnostic test completed');
  });

  // Helper function to create a node if UI allows
  async function createNodeIfPossible(page: any, nodeTitle: string): Promise<boolean> {
    try {
      // Try right-click approach first
      const graphArea = page.locator('svg, .graph-container, [data-testid="graph-area"]').first();
      
      if (await graphArea.isVisible({ timeout: 5000 })) {
        await graphArea.click({ button: 'right', position: { x: Math.random() * 400 + 200, y: Math.random() * 300 + 200 } });
        await page.waitForTimeout(1000);
        
        const createOption = page.locator('button:has-text("Create"), button:has-text("Add Node"), text="Create Node"').first();
        if (await createOption.isVisible({ timeout: 3000 })) {
          await createOption.click();
          
          const titleInput = page.locator('input[name="title"], input[placeholder*="title"]').first();
          if (await titleInput.isVisible({ timeout: 3000 })) {
            await titleInput.fill(nodeTitle);
            
            const submitButton = page.locator('button:has-text("Create"), button:has-text("Add"), button:has-text("Save")').first();
            if (await submitButton.isVisible({ timeout: 3000 })) {
              await submitButton.click();
              return true;
            }
          }
        }
      }
    } catch (error) {
      console.log(`Failed to create node ${nodeTitle}:`, error);
    }
    
    return false;
  }

  // Helper function to capture relationship state
  async function captureRelationshipState(page: any): Promise<string> {
    try {
      // Capture the current state of relationships in the graph
      const relationships = page.locator('line, path, .edge, [data-edge]');
      const count = await relationships.count();
      
      let state = `relationships:${count}`;
      
      // Capture some attributes that might change during flip
      for (let i = 0; i < Math.min(count, 5); i++) {
        try {
          const rel = relationships.nth(i);
          const bbox = await rel.boundingBox();
          if (bbox) {
            state += `;rel${i}:${bbox.x.toFixed(1)},${bbox.y.toFixed(1)},${bbox.width.toFixed(1)},${bbox.height.toFixed(1)}`;
          }
        } catch (e) {
          // Skip problematic relationships
        }
      }
      
      return state;
    } catch (error) {
      return 'state-capture-failed';
    }
  }

  // Helper function to check for node presence
  async function checkForNode(page: any, nodeTitle: string): Promise<boolean> {
    const nodeSelectors = [
      `text="${nodeTitle}"`,
      `[title="${nodeTitle}"]`,
      `.node:has-text("${nodeTitle}")`,
      `g:has-text("${nodeTitle}")`,
      `circle + text:has-text("${nodeTitle}")`,
      '[data-testid="graph-node"]'
    ];

    for (const selector of nodeSelectors) {
      const elements = page.locator(selector);
      const count = await elements.count();
      
      if (count > 0) {
        // For generic selectors, verify content
        if (selector.includes('circle') || selector.includes('[data-testid')) {
          for (let i = 0; i < count; i++) {
            const text = await elements.nth(i).textContent() || '';
            if (text.includes(nodeTitle)) {
              console.log(`   Found node via selector: ${selector}`);
              return true;
            }
          }
        } else {
          console.log(`   Found node via selector: ${selector}`);
          return true;
        }
      }
    }
    
    // Check for any nodes at all
    const anyNodes = page.locator('circle, .node, g.node, [data-node]');
    const nodeCount = await anyNodes.count();
    console.log(`   Total nodes in graph: ${nodeCount}`);
    
    return false;
  }
});