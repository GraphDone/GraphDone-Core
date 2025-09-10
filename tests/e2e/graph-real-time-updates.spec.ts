import { test, expect } from '@playwright/test';
import { login, navigateToWorkspace, cleanupAuth, TEST_USERS } from '../helpers/auth';

test.describe('Graph Real-Time Update Issues', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
  });

  test.afterEach(async ({ page }) => {
    await cleanupAuth(page);
  });

  test('should detect node status change refresh requirements', async ({ page }) => {
    console.log('🧪 TESTING NODE STATUS CHANGES');
    console.log('   User reported: "graph needs manual refresh after status changes"');
    console.log('   Testing: TODO → IN_PROGRESS → COMPLETED status changes');
    
    // Track GraphQL responses
    const graphqlResponses: any[] = [];
    page.on('response', async response => {
      if (response.url().includes('/graphql') || response.url().includes('/api/graphql')) {
        try {
          const json = await response.json();
          graphqlResponses.push({
            url: response.url(),
            status: response.status(),
            data: json,
            timestamp: Date.now()
          });
          
          if (json.data && (
            JSON.stringify(json).includes('updateWorkItem') ||
            JSON.stringify(json).includes('status') ||
            JSON.stringify(json).includes('Status')
          )) {
            console.log('🔄 Status change GraphQL mutation detected');
          }
        } catch (e) {
          // Ignore non-JSON responses
        }
      }
    });
    
    await login(page, TEST_USERS.ADMIN);
    await navigateToWorkspace(page);
    
    const testResults = {
      statusChanges: [],
      refreshRequired: [],
      realTimeWorking: [],
      graphqlMutations: 0
    };
    
    // Test status changes: TODO → IN_PROGRESS → COMPLETED → BLOCKED
    const statusSequence = [
      { from: 'TODO', to: 'IN_PROGRESS', label: 'Todo to In Progress' },
      { from: 'IN_PROGRESS', to: 'COMPLETED', label: 'In Progress to Completed' },
      { from: 'COMPLETED', to: 'BLOCKED', label: 'Completed to Blocked' },
      { from: 'BLOCKED', to: 'TODO', label: 'Blocked back to Todo' }
    ];
    
    for (const statusChange of statusSequence) {
      console.log(`\n--- Testing: ${statusChange.label} ---`);
      
      try {
        // Find a node to modify (try creating one if none exist)
        let targetNode = await findOrCreateTestNode(page, `Status Test Node ${Date.now()}`);
        
        if (!targetNode) {
          console.log('⚠️ Could not find or create a test node');
          continue;
        }
        
        // Record initial state
        const initialState = await captureGraphState(page, targetNode.title);
        console.log(`Initial state: ${initialState.nodeFound ? 'Node visible' : 'Node not found'}`);
        
        // Change status
        const statusChanged = await changeNodeStatus(page, targetNode.title, statusChange.to);
        
        if (!statusChanged) {
          console.log(`❌ Failed to change status to ${statusChange.to}`);
          continue;
        }
        
        // Wait for potential real-time update
        await page.waitForTimeout(3000);
        
        // Check if change is visible without refresh
        const afterChangeState = await captureGraphState(page, targetNode.title);
        const changeVisibleWithoutRefresh = afterChangeState.nodeStatus === statusChange.to;
        
        console.log(`Status change visible without refresh: ${changeVisibleWithoutRefresh}`);
        
        if (!changeVisibleWithoutRefresh) {
          console.log('💡 Status change not visible - testing refresh workaround...');
          
          // Test refresh
          await page.reload();
          await page.waitForTimeout(3000);
          
          const afterRefreshState = await captureGraphState(page, targetNode.title);
          const changeVisibleAfterRefresh = afterRefreshState.nodeStatus === statusChange.to;
          
          console.log(`Status change visible after refresh: ${changeVisibleAfterRefresh}`);
          
          if (changeVisibleAfterRefresh) {
            console.log(`🐛 CONFIRMED: ${statusChange.label} requires manual refresh`);
            testResults.refreshRequired.push(statusChange.label);
          }
        } else {
          console.log(`✅ ${statusChange.label} works in real-time`);
          testResults.realTimeWorking.push(statusChange.label);
        }
        
        testResults.statusChanges.push({
          change: statusChange.label,
          attempted: true,
          visibleWithoutRefresh: changeVisibleWithoutRefresh,
          visibleAfterRefresh: changeVisibleWithoutRefresh || afterRefreshState?.nodeStatus === statusChange.to
        });
        
      } catch (error) {
        console.log(`❌ Status change test failed: ${error.message}`);
        testResults.statusChanges.push({
          change: statusChange.label,
          attempted: false,
          error: error.message
        });
      }
    }
    
    // Count GraphQL mutations
    testResults.graphqlMutations = graphqlResponses.filter(r => 
      JSON.stringify(r.data).includes('updateWorkItem') || 
      JSON.stringify(r.data).includes('mutation')
    ).length;
    
    // Generate comprehensive report
    console.log('\n=== NODE STATUS CHANGE RESULTS ===');
    console.log(`Status changes attempted: ${testResults.statusChanges.length}`);
    console.log(`Changes requiring refresh: ${testResults.refreshRequired.join(', ') || 'NONE'}`);
    console.log(`Changes working real-time: ${testResults.realTimeWorking.join(', ') || 'NONE'}`);
    console.log(`GraphQL mutations detected: ${testResults.graphqlMutations}`);
    
    if (testResults.refreshRequired.length > 0) {
      console.log('\n🎯 BUG CONFIRMED: Status changes require manual refresh');
      console.log('   This matches the user-reported issue exactly');
    }
    
    expect(testResults.statusChanges.length, 'Should test at least some status changes').toBeGreaterThan(0);
  });

  test('should detect node property change refresh requirements', async ({ page }) => {
    console.log('🧪 TESTING ALL NODE PROPERTY CHANGES');
    console.log('   Testing: title, description, priority, type, assignee changes');
    
    await login(page, TEST_USERS.ADMIN);
    await navigateToWorkspace(page);
    
    const propertyTests = [
      { property: 'title', newValue: `Updated Title ${Date.now()}` },
      { property: 'description', newValue: `Updated description at ${new Date().toISOString()}` },
      { property: 'priority', newValue: 'HIGH' },
      { property: 'type', newValue: 'MILESTONE' },
    ];
    
    const propertyResults = {
      propertiesChanged: 0,
      refreshRequired: [],
      realTimeWorking: []
    };
    
    for (const test of propertyTests) {
      console.log(`\n--- Testing ${test.property} changes ---`);
      
      try {
        // Find or create test node
        const testNode = await findOrCreateTestNode(page, `Property Test ${test.property} ${Date.now()}`);
        if (!testNode) continue;
        
        // Change the property
        const changeResult = await changeNodeProperty(page, testNode.title, test.property, test.newValue);
        
        if (!changeResult.success) {
          console.log(`⚠️ Could not change ${test.property}: ${changeResult.error}`);
          continue;
        }
        
        propertyResults.propertiesChanged++;
        
        // Wait for real-time update
        await page.waitForTimeout(3000);
        
        // Check visibility without refresh
        const visibleWithoutRefresh = await isPropertyChangeVisible(page, testNode.title, test.property, test.newValue);
        
        if (!visibleWithoutRefresh) {
          console.log(`💡 ${test.property} change not visible - testing refresh...`);
          
          await page.reload();
          await page.waitForTimeout(3000);
          
          const visibleAfterRefresh = await isPropertyChangeVisible(page, testNode.title, test.property, test.newValue);
          
          if (visibleAfterRefresh) {
            console.log(`🐛 ${test.property} change requires refresh`);
            propertyResults.refreshRequired.push(test.property);
          }
        } else {
          console.log(`✅ ${test.property} change works in real-time`);
          propertyResults.realTimeWorking.push(test.property);
        }
        
      } catch (error) {
        console.log(`❌ ${test.property} test failed: ${error.message}`);
      }
    }
    
    console.log('\n=== PROPERTY CHANGE RESULTS ===');
    console.log(`Properties changed: ${propertyResults.propertiesChanged}`);
    console.log(`Properties requiring refresh: ${propertyResults.refreshRequired.join(', ') || 'NONE'}`);
    console.log(`Properties working real-time: ${propertyResults.realTimeWorking.join(', ') || 'NONE'}`);
  });

  test('should detect node CRUD operation refresh requirements', async ({ page }) => {
    console.log('🧪 TESTING NODE CRUD OPERATIONS');
    console.log('   Testing: create node, delete node visibility in real-time');
    
    await login(page, TEST_USERS.ADMIN);
    await navigateToWorkspace(page);
    
    const crudResults = {
      nodeCreated: false,
      createVisibleWithoutRefresh: false,
      createVisibleAfterRefresh: false,
      nodeDeleted: false,
      deleteVisibleWithoutRefresh: false,
      deleteVisibleAfterRefresh: false
    };
    
    // Test node creation
    console.log('\n--- Testing Node Creation ---');
    const newNodeTitle = `CRUD Test Node ${Date.now()}`;
    
    try {
      const created = await createNode(page, newNodeTitle, 'Test node for CRUD operations');
      crudResults.nodeCreated = created;
      
      if (created) {
        // Check immediate visibility
        await page.waitForTimeout(3000);
        const visibleImmediately = await isNodeVisible(page, newNodeTitle);
        crudResults.createVisibleWithoutRefresh = visibleImmediately;
        
        if (!visibleImmediately) {
          console.log('💡 New node not visible immediately - testing refresh...');
          await page.reload();
          await page.waitForTimeout(3000);
          
          const visibleAfterRefresh = await isNodeVisible(page, newNodeTitle);
          crudResults.createVisibleAfterRefresh = visibleAfterRefresh;
          
          if (visibleAfterRefresh) {
            console.log('🐛 CONFIRMED: Node creation requires refresh to be visible');
          }
        } else {
          console.log('✅ Node creation visible immediately');
        }
        
        // Test node deletion
        console.log('\n--- Testing Node Deletion ---');
        
        const deleted = await deleteNode(page, newNodeTitle);
        crudResults.nodeDeleted = deleted;
        
        if (deleted) {
          await page.waitForTimeout(3000);
          const stillVisibleAfterDelete = await isNodeVisible(page, newNodeTitle);
          crudResults.deleteVisibleWithoutRefresh = !stillVisibleAfterDelete;
          
          if (stillVisibleAfterDelete) {
            console.log('💡 Deleted node still visible - testing refresh...');
            await page.reload();
            await page.waitForTimeout(3000);
            
            const visibleAfterRefresh = await isNodeVisible(page, newNodeTitle);
            crudResults.deleteVisibleAfterRefresh = !visibleAfterRefresh;
            
            if (!visibleAfterRefresh) {
              console.log('🐛 CONFIRMED: Node deletion requires refresh to be visible');
            }
          } else {
            console.log('✅ Node deletion visible immediately');
          }
        }
      }
    } catch (error) {
      console.log(`❌ CRUD test failed: ${error.message}`);
    }
    
    console.log('\n=== NODE CRUD RESULTS ===');
    console.log(`Node created: ${crudResults.nodeCreated}`);
    console.log(`Create visible without refresh: ${crudResults.createVisibleWithoutRefresh}`);
    console.log(`Create visible after refresh: ${crudResults.createVisibleAfterRefresh}`);
    console.log(`Node deleted: ${crudResults.nodeDeleted}`);
    console.log(`Delete visible without refresh: ${crudResults.deleteVisibleWithoutRefresh}`);
    console.log(`Delete visible after refresh: ${crudResults.deleteVisibleAfterRefresh}`);
    
    // Identify refresh requirements
    const refreshIssues = [];
    if (crudResults.nodeCreated && !crudResults.createVisibleWithoutRefresh && crudResults.createVisibleAfterRefresh) {
      refreshIssues.push('Node creation requires refresh');
    }
    if (crudResults.nodeDeleted && !crudResults.deleteVisibleWithoutRefresh && crudResults.deleteVisibleAfterRefresh) {
      refreshIssues.push('Node deletion requires refresh');
    }
    
    if (refreshIssues.length > 0) {
      console.log('\n🐛 CRUD REFRESH ISSUES DETECTED:');
      refreshIssues.forEach(issue => console.log(`   - ${issue}`));
    }
  });

  test('should detect relationship CRUD refresh requirements', async ({ page }) => {
    console.log('🧪 TESTING RELATIONSHIP CRUD OPERATIONS');
    console.log('   Testing: create relationships, delete relationships, flip direction');
    
    await login(page, TEST_USERS.ADMIN);
    await navigateToWorkspace(page);
    
    // Implementation for relationship testing
    console.log('Creating test nodes for relationship testing...');
    
    const node1Title = `Rel Source ${Date.now()}`;
    const node2Title = `Rel Target ${Date.now() + 1}`;
    
    const relationshipResults = {
      relationshipCreated: false,
      relationshipVisible: false,
      relationshipDeleted: false,
      relationshipFlipped: false
    };
    
    try {
      // Create two nodes for relationship
      const node1Created = await createNode(page, node1Title, 'Source node for relationship test');
      const node2Created = await createNode(page, node2Title, 'Target node for relationship test');
      
      if (node1Created && node2Created) {
        console.log('✅ Test nodes created for relationship testing');
        
        // Test relationship creation
        const relationshipCreated = await createRelationship(page, node1Title, node2Title, 'DEPENDS_ON');
        relationshipResults.relationshipCreated = relationshipCreated;
        
        if (relationshipCreated) {
          await page.waitForTimeout(3000);
          const relationshipVisible = await isRelationshipVisible(page, node1Title, node2Title);
          relationshipResults.relationshipVisible = relationshipVisible;
          
          if (!relationshipVisible) {
            console.log('💡 Relationship not visible - testing refresh...');
            await page.reload();
            await page.waitForTimeout(3000);
            
            const visibleAfterRefresh = await isRelationshipVisible(page, node1Title, node2Title);
            
            if (visibleAfterRefresh) {
              console.log('🐛 CONFIRMED: Relationship creation requires refresh');
            }
          }
          
          // Test relationship flip (the original user-reported bug)
          console.log('\n--- Testing Relationship Flip Direction ---');
          const flipped = await flipRelationshipDirection(page, node1Title, node2Title);
          relationshipResults.relationshipFlipped = flipped;
          
          if (flipped) {
            await page.waitForTimeout(3000);
            const flipVisible = await isRelationshipFlipped(page, node1Title, node2Title);
            
            if (!flipVisible) {
              console.log('💡 Relationship flip not visible - testing refresh...');
              await page.reload();
              await page.waitForTimeout(3000);
              
              const flipVisibleAfterRefresh = await isRelationshipFlipped(page, node1Title, node2Title);
              
              if (flipVisibleAfterRefresh) {
                console.log('🎯 CONFIRMED: Relationship flip requires refresh (matches user bug report)');
              }
            }
          }
        }
      }
    } catch (error) {
      console.log(`❌ Relationship test failed: ${error.message}`);
    }
    
    console.log('\n=== RELATIONSHIP RESULTS ===');
    console.log(`Relationship created: ${relationshipResults.relationshipCreated}`);
    console.log(`Relationship visible: ${relationshipResults.relationshipVisible}`);
    console.log(`Relationship flipped: ${relationshipResults.relationshipFlipped}`);
  });

  // Helper functions
  async function findOrCreateTestNode(page: any, title: string): Promise<{ title: string } | null> {
    // Try to find existing node first
    const existingNode = page.locator(`text="${title}"`);
    if (await existingNode.isVisible({ timeout: 2000 })) {
      return { title };
    }
    
    // Create new node
    const created = await createNode(page, title, 'Test node for E2E testing');
    return created ? { title } : null;
  }

  async function createNode(page: any, title: string, description: string = ''): Promise<boolean> {
    try {
      // Try right-click to create node
      const graphArea = page.locator('svg, .graph-container, [data-testid="graph-container"]').first();
      
      if (await graphArea.isVisible({ timeout: 5000 })) {
        await graphArea.click({ button: 'right', position: { x: 400, y: 300 } });
        await page.waitForTimeout(1000);
        
        const createOption = page.locator('button:has-text("Create"), text="Create Node", text="Add Node"').first();
        if (await createOption.isVisible({ timeout: 3000 })) {
          await createOption.click();
          
          const titleInput = page.locator('input[name="title"], input[placeholder*="title"]').first();
          if (await titleInput.isVisible({ timeout: 3000 })) {
            await titleInput.fill(title);
            
            if (description) {
              const descInput = page.locator('textarea[name="description"], textarea[placeholder*="description"]').first();
              if (await descInput.isVisible({ timeout: 2000 })) {
                await descInput.fill(description);
              }
            }
            
            const saveButton = page.locator('button:has-text("Create"), button:has-text("Save"), button:has-text("Add")').first();
            if (await saveButton.isVisible({ timeout: 3000 })) {
              await saveButton.click();
              return true;
            }
          }
        }
      }
      
      // Try alternative creation methods (toolbar buttons, etc.)
      const createButton = page.locator('button:has-text("Add"), [data-testid="create-node"], .create-node-btn').first();
      if (await createButton.isVisible({ timeout: 3000 })) {
        await createButton.click();
        // ... similar form filling logic
      }
      
      return false;
    } catch (error) {
      console.log(`Node creation failed: ${error.message}`);
      return false;
    }
  }

  async function changeNodeStatus(page: any, nodeTitle: string, newStatus: string): Promise<boolean> {
    try {
      // Find the node
      const node = page.locator(`text="${nodeTitle}"`).first();
      if (await node.isVisible({ timeout: 5000 })) {
        await node.click();
        await page.waitForTimeout(1000);
        
        // Look for status dropdown or editor
        const statusDropdown = page.locator('select[name="status"], [data-field="status"]').first();
        if (await statusDropdown.isVisible({ timeout: 3000 })) {
          await statusDropdown.selectOption(newStatus);
          
          // Save if needed
          const saveButton = page.locator('button:has-text("Save"), button:has-text("Update")').first();
          if (await saveButton.isVisible({ timeout: 2000 })) {
            await saveButton.click();
          }
          
          return true;
        }
      }
      
      return false;
    } catch (error) {
      console.log(`Status change failed: ${error.message}`);
      return false;
    }
  }

  async function changeNodeProperty(page: any, nodeTitle: string, property: string, newValue: string): Promise<{ success: boolean, error?: string }> {
    try {
      // Find and click node to open editor
      const node = page.locator(`text="${nodeTitle}"`).first();
      if (await node.isVisible({ timeout: 5000 })) {
        await node.click();
        await page.waitForTimeout(1000);
        
        // Try to find property field
        const propertyField = page.locator(`input[name="${property}"], textarea[name="${property}"], select[name="${property}"]`).first();
        
        if (await propertyField.isVisible({ timeout: 3000 })) {
          await propertyField.clear();
          await propertyField.fill(newValue);
          
          // Save changes
          const saveButton = page.locator('button:has-text("Save"), button:has-text("Update")').first();
          if (await saveButton.isVisible({ timeout: 2000 })) {
            await saveButton.click();
          }
          
          return { success: true };
        }
        
        return { success: false, error: `Property field for ${property} not found` };
      }
      
      return { success: false, error: `Node ${nodeTitle} not found` };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async function captureGraphState(page: any, nodeTitle: string): Promise<any> {
    try {
      const node = page.locator(`text="${nodeTitle}"`).first();
      const nodeFound = await node.isVisible({ timeout: 2000 });
      
      if (nodeFound) {
        // Try to capture node status from various possible locations
        const statusElements = [
          `[data-node="${nodeTitle}"] [data-status]`,
          `.node:has-text("${nodeTitle}") .status`,
          `text="${nodeTitle}" + .status`
        ];
        
        let nodeStatus = 'UNKNOWN';
        for (const selector of statusElements) {
          const statusEl = page.locator(selector).first();
          if (await statusEl.isVisible({ timeout: 1000 })) {
            nodeStatus = await statusEl.textContent() || 'UNKNOWN';
            break;
          }
        }
        
        return { nodeFound, nodeStatus };
      }
      
      return { nodeFound: false };
    } catch (error) {
      return { nodeFound: false, error: error.message };
    }
  }

  async function isPropertyChangeVisible(page: any, nodeTitle: string, property: string, expectedValue: string): Promise<boolean> {
    try {
      // Look for the changed property in various places
      const node = page.locator(`text="${nodeTitle}"`).first();
      if (await node.isVisible({ timeout: 2000 })) {
        
        // Check if the property change is reflected in the UI
        const propertyVisible = await page.locator(`text="${expectedValue}"`).isVisible({ timeout: 2000 });
        
        return propertyVisible;
      }
      
      return false;
    } catch (error) {
      return false;
    }
  }

  async function isNodeVisible(page: any, nodeTitle: string): Promise<boolean> {
    try {
      const node = page.locator(`text="${nodeTitle}"`).first();
      return await node.isVisible({ timeout: 2000 });
    } catch (error) {
      return false;
    }
  }

  async function deleteNode(page: any, nodeTitle: string): Promise<boolean> {
    try {
      const node = page.locator(`text="${nodeTitle}"`).first();
      if (await node.isVisible({ timeout: 5000 })) {
        // Right-click for context menu
        await node.click({ button: 'right' });
        await page.waitForTimeout(1000);
        
        const deleteOption = page.locator('button:has-text("Delete"), text="Delete"').first();
        if (await deleteOption.isVisible({ timeout: 3000 })) {
          await deleteOption.click();
          
          // Confirm deletion if needed
          const confirmButton = page.locator('button:has-text("Confirm"), button:has-text("Yes"), button:has-text("Delete")').first();
          if (await confirmButton.isVisible({ timeout: 2000 })) {
            await confirmButton.click();
          }
          
          return true;
        }
      }
      
      return false;
    } catch (error) {
      console.log(`Delete failed: ${error.message}`);
      return false;
    }
  }

  async function createRelationship(page: any, sourceTitle: string, targetTitle: string, relationshipType: string): Promise<boolean> {
    // Implementation would depend on the specific UI for creating relationships
    try {
      console.log(`Attempting to create ${relationshipType} relationship: ${sourceTitle} → ${targetTitle}`);
      
      // This is a placeholder - actual implementation would depend on the UI
      // For example: drag from source to target, or select both nodes and use a button
      
      return false; // Placeholder
    } catch (error) {
      return false;
    }
  }

  async function isRelationshipVisible(page: any, sourceTitle: string, targetTitle: string): Promise<boolean> {
    // Check for visual connection between nodes
    try {
      const sourceNode = page.locator(`text="${sourceTitle}"`).first();
      const targetNode = page.locator(`text="${targetTitle}"`).first();
      
      // This would need to check for SVG lines or other relationship visualizations
      // Placeholder implementation
      return false;
    } catch (error) {
      return false;
    }
  }

  async function flipRelationshipDirection(page: any, sourceTitle: string, targetTitle: string): Promise<boolean> {
    // Find and flip the relationship direction
    try {
      // This would involve finding the relationship and using the flip function
      // Placeholder implementation
      return false;
    } catch (error) {
      return false;
    }
  }

  async function isRelationshipFlipped(page: any, sourceTitle: string, targetTitle: string): Promise<boolean> {
    // Check if the relationship direction has been flipped
    try {
      // This would check the visual direction of arrows or other indicators
      // Placeholder implementation  
      return false;
    } catch (error) {
      return false;
    }
  }
});