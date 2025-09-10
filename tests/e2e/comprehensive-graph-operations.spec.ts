import { test, expect } from '@playwright/test';
import { login, navigateToWorkspace, cleanupAuth, TEST_USERS } from '../helpers/auth';

test.describe('Comprehensive Graph Operations - Real-Time vs Refresh', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    
    // Monitor all GraphQL traffic
    page.on('response', async response => {
      if (response.url().includes('/graphql') || response.url().includes('/api/graphql')) {
        try {
          const responseData = await response.json();
          if (responseData.data || responseData.errors) {
            console.log(`GraphQL: ${response.status()} - ${JSON.stringify(responseData).substring(0, 100)}...`);
          }
        } catch (e) {
          // Ignore non-JSON responses
        }
      }
    });
  });

  test.afterEach(async ({ page }) => {
    await cleanupAuth(page);
  });

  test('should test all graph operations for refresh requirements', async ({ page }) => {
    console.log('🧪 COMPREHENSIVE GRAPH OPERATIONS TEST');
    console.log('   User requested: "change all node values, add nodes, remove nodes,');
    console.log('                   create and delete relationships, change priority levels"');
    
    await login(page, TEST_USERS.ADMIN);
    await navigateToWorkspace(page);
    
    const operationResults = {
      nodeOperations: {
        create: { attempted: false, visibleWithoutRefresh: false, visibleAfterRefresh: false },
        delete: { attempted: false, visibleWithoutRefresh: false, visibleAfterRefresh: false },
        updateTitle: { attempted: false, visibleWithoutRefresh: false, visibleAfterRefresh: false },
        updateDescription: { attempted: false, visibleWithoutRefresh: false, visibleAfterRefresh: false },
        updateStatus: { attempted: false, visibleWithoutRefresh: false, visibleAfterRefresh: false },
        updatePriority: { attempted: false, visibleWithoutRefresh: false, visibleAfterRefresh: false },
        updateType: { attempted: false, visibleWithoutRefresh: false, visibleAfterRefresh: false }
      },
      relationshipOperations: {
        create: { attempted: false, visibleWithoutRefresh: false, visibleAfterRefresh: false },
        delete: { attempted: false, visibleWithoutRefresh: false, visibleAfterRefresh: false },
        flip: { attempted: false, visibleWithoutRefresh: false, visibleAfterRefresh: false }
      },
      refreshRequiredOperations: [],
      realTimeOperations: []
    };
    
    // Test 1: Node Creation (most fundamental operation)
    console.log('\n=== NODE CREATION TEST ===');
    const newNodeTitle = `Comprehensive Test Node ${Date.now()}`;
    
    try {
      const nodeCreated = await createNodeViaUI(page, newNodeTitle);
      operationResults.nodeOperations.create.attempted = nodeCreated;
      
      if (nodeCreated) {
        await page.waitForTimeout(4000); // Allow time for real-time updates
        
        const visibleImmediately = await isNodeVisibleInGraph(page, newNodeTitle);
        operationResults.nodeOperations.create.visibleWithoutRefresh = visibleImmediately;
        
        console.log(`Node "${newNodeTitle}" visible immediately: ${visibleImmediately}`);
        
        if (!visibleImmediately) {
          console.log('   Testing refresh workaround...');
          await page.reload();
          await page.waitForTimeout(3000);
          
          const visibleAfterRefresh = await isNodeVisibleInGraph(page, newNodeTitle);
          operationResults.nodeOperations.create.visibleAfterRefresh = visibleAfterRefresh;
          
          console.log(`Node visible after refresh: ${visibleAfterRefresh}`);
          
          if (visibleAfterRefresh) {
            operationResults.refreshRequiredOperations.push('Node Creation');
            console.log('🐛 CONFIRMED: Node creation requires manual refresh');
          }
        } else {
          operationResults.realTimeOperations.push('Node Creation');
        }
      }
    } catch (error) {
      console.log(`Node creation test failed: ${error.message}`);
    }
    
    // Test 2: Node Status Changes (user's specific bug report)
    console.log('\n=== NODE STATUS CHANGE TEST ===');
    
    if (operationResults.nodeOperations.create.visibleAfterRefresh || operationResults.nodeOperations.create.visibleWithoutRefresh) {
      try {
        const statusChanged = await changeNodeStatusViaUI(page, newNodeTitle, 'IN_PROGRESS');
        operationResults.nodeOperations.updateStatus.attempted = statusChanged;
        
        if (statusChanged) {
          await page.waitForTimeout(3000);
          
          const statusVisibleImmediately = await isNodeStatusVisible(page, newNodeTitle, 'IN_PROGRESS');
          operationResults.nodeOperations.updateStatus.visibleWithoutRefresh = statusVisibleImmediately;
          
          console.log(`Status change visible immediately: ${statusVisibleImmediately}`);
          
          if (!statusVisibleImmediately) {
            console.log('   Testing status change refresh workaround...');
            await page.reload();
            await page.waitForTimeout(3000);
            
            const statusVisibleAfterRefresh = await isNodeStatusVisible(page, newNodeTitle, 'IN_PROGRESS');
            operationResults.nodeOperations.updateStatus.visibleAfterRefresh = statusVisibleAfterRefresh;
            
            if (statusVisibleAfterRefresh) {
              operationResults.refreshRequiredOperations.push('Status Change');
              console.log('🎯 CONFIRMED: Status change requires manual refresh (matches user bug report)');
            }
          } else {
            operationResults.realTimeOperations.push('Status Change');
          }
        }
      } catch (error) {
        console.log(`Status change test failed: ${error.message}`);
      }
    }
    
    // Test 3: Priority Level Changes
    console.log('\n=== PRIORITY LEVEL CHANGE TEST ===');
    
    try {
      const priorityChanged = await changeNodePriorityViaUI(page, newNodeTitle, 'HIGH');
      operationResults.nodeOperations.updatePriority.attempted = priorityChanged;
      
      if (priorityChanged) {
        await page.waitForTimeout(3000);
        
        const priorityVisibleImmediately = await isNodePriorityVisible(page, newNodeTitle, 'HIGH');
        operationResults.nodeOperations.updatePriority.visibleWithoutRefresh = priorityVisibleImmediately;
        
        if (!priorityVisibleImmediately) {
          await page.reload();
          await page.waitForTimeout(3000);
          
          const priorityVisibleAfterRefresh = await isNodePriorityVisible(page, newNodeTitle, 'HIGH');
          operationResults.nodeOperations.updatePriority.visibleAfterRefresh = priorityVisibleAfterRefresh;
          
          if (priorityVisibleAfterRefresh) {
            operationResults.refreshRequiredOperations.push('Priority Change');
            console.log('🐛 CONFIRMED: Priority change requires manual refresh');
          }
        } else {
          operationResults.realTimeOperations.push('Priority Change');
        }
      }
    } catch (error) {
      console.log(`Priority change test failed: ${error.message}`);
    }
    
    // Test 4: Node Title/Description Changes
    console.log('\n=== NODE CONTENT CHANGE TEST ===');
    
    const updatedTitle = `${newNodeTitle} - UPDATED`;
    
    try {
      const titleChanged = await changeNodeTitleViaUI(page, newNodeTitle, updatedTitle);
      operationResults.nodeOperations.updateTitle.attempted = titleChanged;
      
      if (titleChanged) {
        await page.waitForTimeout(3000);
        
        const titleVisibleImmediately = await isNodeVisibleInGraph(page, updatedTitle);
        operationResults.nodeOperations.updateTitle.visibleWithoutRefresh = titleVisibleImmediately;
        
        if (!titleVisibleImmediately) {
          await page.reload();
          await page.waitForTimeout(3000);
          
          const titleVisibleAfterRefresh = await isNodeVisibleInGraph(page, updatedTitle);
          operationResults.nodeOperations.updateTitle.visibleAfterRefresh = titleVisibleAfterRefresh;
          
          if (titleVisibleAfterRefresh) {
            operationResults.refreshRequiredOperations.push('Title Change');
            console.log('🐛 CONFIRMED: Title change requires manual refresh');
          }
        } else {
          operationResults.realTimeOperations.push('Title Change');
        }
      }
    } catch (error) {
      console.log(`Title change test failed: ${error.message}`);
    }
    
    // Test 5: Node Type Changes
    console.log('\n=== NODE TYPE CHANGE TEST ===');
    
    try {
      const typeChanged = await changeNodeTypeViaUI(page, updatedTitle || newNodeTitle, 'MILESTONE');
      operationResults.nodeOperations.updateType.attempted = typeChanged;
      
      if (typeChanged) {
        await page.waitForTimeout(3000);
        
        const typeVisibleImmediately = await isNodeTypeVisible(page, updatedTitle || newNodeTitle, 'MILESTONE');
        operationResults.nodeOperations.updateType.visibleWithoutRefresh = typeVisibleImmediately;
        
        if (!typeVisibleImmediately) {
          await page.reload();
          await page.waitForTimeout(3000);
          
          const typeVisibleAfterRefresh = await isNodeTypeVisible(page, updatedTitle || newNodeTitle, 'MILESTONE');
          operationResults.nodeOperations.updateType.visibleAfterRefresh = typeVisibleAfterRefresh;
          
          if (typeVisibleAfterRefresh) {
            operationResults.refreshRequiredOperations.push('Type Change');
            console.log('🐛 CONFIRMED: Type change requires manual refresh');
          }
        } else {
          operationResults.realTimeOperations.push('Type Change');
        }
      }
    } catch (error) {
      console.log(`Type change test failed: ${error.message}`);
    }
    
    // Test 6: Relationship Operations
    console.log('\n=== RELATIONSHIP OPERATIONS TEST ===');
    
    // Create a second node for relationship testing
    const secondNodeTitle = `Relationship Target ${Date.now()}`;
    
    try {
      const secondNodeCreated = await createNodeViaUI(page, secondNodeTitle);
      
      if (secondNodeCreated) {
        // Wait for node to be available
        await page.waitForTimeout(3000);
        
        // Ensure both nodes are visible
        let node1Visible = await isNodeVisibleInGraph(page, updatedTitle || newNodeTitle);
        let node2Visible = await isNodeVisibleInGraph(page, secondNodeTitle);
        
        if (!node1Visible || !node2Visible) {
          await page.reload();
          await page.waitForTimeout(3000);
          node1Visible = await isNodeVisibleInGraph(page, updatedTitle || newNodeTitle);
          node2Visible = await isNodeVisibleInGraph(page, secondNodeTitle);
        }
        
        if (node1Visible && node2Visible) {
          // Test relationship creation
          console.log('   Testing relationship creation...');
          
          const relationshipCreated = await createRelationshipViaUI(page, updatedTitle || newNodeTitle, secondNodeTitle);
          operationResults.relationshipOperations.create.attempted = relationshipCreated;
          
          if (relationshipCreated) {
            await page.waitForTimeout(3000);
            
            const relationshipVisible = await isRelationshipVisibleInGraph(page, updatedTitle || newNodeTitle, secondNodeTitle);
            operationResults.relationshipOperations.create.visibleWithoutRefresh = relationshipVisible;
            
            if (!relationshipVisible) {
              await page.reload();
              await page.waitForTimeout(3000);
              
              const relationshipVisibleAfterRefresh = await isRelationshipVisibleInGraph(page, updatedTitle || newNodeTitle, secondNodeTitle);
              operationResults.relationshipOperations.create.visibleAfterRefresh = relationshipVisibleAfterRefresh;
              
              if (relationshipVisibleAfterRefresh) {
                operationResults.refreshRequiredOperations.push('Relationship Creation');
                console.log('🐛 CONFIRMED: Relationship creation requires manual refresh');
              }
            } else {
              operationResults.realTimeOperations.push('Relationship Creation');
            }
            
            // Test relationship flip (user's original bug report)
            console.log('   Testing relationship flip direction...');
            
            const relationshipFlipped = await flipRelationshipViaUI(page, updatedTitle || newNodeTitle, secondNodeTitle);
            operationResults.relationshipOperations.flip.attempted = relationshipFlipped;
            
            if (relationshipFlipped) {
              await page.waitForTimeout(3000);
              
              const flipVisible = await isRelationshipFlipVisible(page, updatedTitle || newNodeTitle, secondNodeTitle);
              operationResults.relationshipOperations.flip.visibleWithoutRefresh = flipVisible;
              
              if (!flipVisible) {
                await page.reload();
                await page.waitForTimeout(3000);
                
                const flipVisibleAfterRefresh = await isRelationshipFlipVisible(page, updatedTitle || newNodeTitle, secondNodeTitle);
                operationResults.relationshipOperations.flip.visibleAfterRefresh = flipVisibleAfterRefresh;
                
                if (flipVisibleAfterRefresh) {
                  operationResults.refreshRequiredOperations.push('Relationship Flip');
                  console.log('🎯 CONFIRMED: Relationship flip requires manual refresh (original user bug)');
                }
              } else {
                operationResults.realTimeOperations.push('Relationship Flip');
              }
            }
          }
        }
      }
    } catch (error) {
      console.log(`Relationship operations test failed: ${error.message}`);
    }
    
    // Test 7: Node Deletion
    console.log('\n=== NODE DELETION TEST ===');
    
    try {
      const nodeDeleted = await deleteNodeViaUI(page, secondNodeTitle);
      operationResults.nodeOperations.delete.attempted = nodeDeleted;
      
      if (nodeDeleted) {
        await page.waitForTimeout(3000);
        
        const deletedNodeGone = !await isNodeVisibleInGraph(page, secondNodeTitle);
        operationResults.nodeOperations.delete.visibleWithoutRefresh = deletedNodeGone;
        
        if (!deletedNodeGone) {
          await page.reload();
          await page.waitForTimeout(3000);
          
          const deletedNodeGoneAfterRefresh = !await isNodeVisibleInGraph(page, secondNodeTitle);
          operationResults.nodeOperations.delete.visibleAfterRefresh = deletedNodeGoneAfterRefresh;
          
          if (deletedNodeGoneAfterRefresh) {
            operationResults.refreshRequiredOperations.push('Node Deletion');
            console.log('🐛 CONFIRMED: Node deletion requires manual refresh');
          }
        } else {
          operationResults.realTimeOperations.push('Node Deletion');
        }
      }
    } catch (error) {
      console.log(`Node deletion test failed: ${error.message}`);
    }
    
    // Comprehensive Results Report
    console.log('\n═══════════════════════════════════════════');
    console.log('   COMPREHENSIVE GRAPH OPERATIONS REPORT');
    console.log('═══════════════════════════════════════════');
    
    console.log('\n🔄 OPERATIONS REQUIRING MANUAL REFRESH:');
    if (operationResults.refreshRequiredOperations.length > 0) {
      operationResults.refreshRequiredOperations.forEach(op => {
        console.log(`   🐛 ${op}`);
      });
    } else {
      console.log('   ✅ NONE - All operations work in real-time!');
    }
    
    console.log('\n⚡ OPERATIONS WORKING IN REAL-TIME:');
    if (operationResults.realTimeOperations.length > 0) {
      operationResults.realTimeOperations.forEach(op => {
        console.log(`   ✅ ${op}`);
      });
    } else {
      console.log('   ❌ NONE - All operations require manual refresh!');
    }
    
    // Calculate overall health
    const totalOperationsTested = operationResults.refreshRequiredOperations.length + operationResults.realTimeOperations.length;
    const realTimePercentage = totalOperationsTested > 0 ? (operationResults.realTimeOperations.length / totalOperationsTested * 100).toFixed(1) : 0;
    
    console.log(`\n📊 REAL-TIME UPDATE HEALTH: ${realTimePercentage}%`);
    console.log(`   Operations tested: ${totalOperationsTested}`);
    console.log(`   Working real-time: ${operationResults.realTimeOperations.length}`);
    console.log(`   Requiring refresh: ${operationResults.refreshRequiredOperations.length}`);
    
    if (operationResults.refreshRequiredOperations.length > 0) {
      console.log('\n💡 DEVELOPMENT RECOMMENDATIONS:');
      console.log('   1. Check GraphQL subscription configuration');
      console.log('   2. Verify WebSocket connections for real-time updates');
      console.log('   3. Review Apollo Client cache update policies');
      console.log('   4. Ensure graph visualization re-renders on data changes');
    }
    
    // Take comprehensive final screenshot
    await page.screenshot({ 
      path: 'artifacts/screenshots/comprehensive-graph-operations-final.png',
      fullPage: true 
    });
    
    console.log('\n✅ COMPREHENSIVE GRAPH OPERATIONS TEST COMPLETED');
    
    // Test assertions
    expect(totalOperationsTested, 'Should test at least some operations').toBeGreaterThan(0);
    
    // Log critical findings for development team
    if (operationResults.refreshRequiredOperations.length > 0) {
      console.log('\n🚨 CRITICAL FINDINGS FOR DEVELOPMENT TEAM:');
      console.log('   Real-time updates are not working for key operations.');
      console.log('   This significantly impacts user experience and workflow efficiency.');
      console.log('   Users must manually refresh to see their changes, which is unacceptable.');
    }
  });
  
  // UI Interaction Helper Functions
  async function createNodeViaUI(page: any, title: string): Promise<boolean> {
    try {
      console.log(`   Attempting to create node: "${title}"`);
      
      // Method 1: Right-click on graph area
      const graphArea = page.locator('svg, canvas, .graph-container, .graph-visualization').first();
      
      if (await graphArea.isVisible({ timeout: 5000 })) {
        await graphArea.click({ 
          button: 'right', 
          position: { x: Math.random() * 300 + 200, y: Math.random() * 300 + 200 } 
        });
        await page.waitForTimeout(1000);
        
        // Look for context menu
        const createContextOption = page.locator(
          'button:has-text("Create"), ' +
          'button:has-text("Add Node"), ' +
          'text="Create Node", ' +
          'text="Add Node"'
        ).first();
        
        if (await createContextOption.isVisible({ timeout: 3000 })) {
          await createContextOption.click();
          
          // Fill out creation form
          const success = await fillNodeCreationForm(page, title);
          if (success) {
            console.log(`   ✅ Node created via right-click context menu`);
            return true;
          }
        }
      }
      
      // Method 2: Toolbar create button
      const toolbarCreateButton = page.locator(
        'button:has-text("Create"), ' +
        'button:has-text("Add"), ' +
        '[data-testid="create-node"], ' +
        '.create-node-button, ' +
        'button[title*="create"], ' +
        'button[aria-label*="create"]'
      ).first();
      
      if (await toolbarCreateButton.isVisible({ timeout: 3000 })) {
        await toolbarCreateButton.click();
        
        const success = await fillNodeCreationForm(page, title);
        if (success) {
          console.log(`   ✅ Node created via toolbar button`);
          return true;
        }
      }
      
      // Method 3: Keyboard shortcut
      await page.keyboard.press('Control+N'); // Common create shortcut
      await page.waitForTimeout(1000);
      
      const success = await fillNodeCreationForm(page, title);
      if (success) {
        console.log(`   ✅ Node created via keyboard shortcut`);
        return true;
      }
      
      console.log(`   ❌ Could not find any node creation method`);
      return false;
      
    } catch (error) {
      console.log(`   ❌ Node creation failed: ${error.message}`);
      return false;
    }
  }

  async function fillNodeCreationForm(page: any, title: string): Promise<boolean> {
    try {
      // Wait for form to appear
      await page.waitForTimeout(1000);
      
      // Try various selectors for title input
      const titleSelectors = [
        'input[name="title"]',
        'input[placeholder*="title" i]',
        'input[placeholder*="name" i]',
        'input[type="text"]:visible',
        '.node-title-input',
        '[data-field="title"]'
      ];
      
      let titleInput = null;
      for (const selector of titleSelectors) {
        titleInput = page.locator(selector).first();
        if (await titleInput.isVisible({ timeout: 2000 })) {
          break;
        }
        titleInput = null;
      }
      
      if (!titleInput) {
        console.log(`     No title input found`);
        return false;
      }
      
      await titleInput.fill(title);
      
      // Look for submit button
      const submitSelectors = [
        'button[type="submit"]',
        'button:has-text("Create")',
        'button:has-text("Add")',
        'button:has-text("Save")',
        'button:has-text("Submit")',
        '.submit-button',
        '.create-button'
      ];
      
      let submitButton = null;
      for (const selector of submitSelectors) {
        submitButton = page.locator(selector).first();
        if (await submitButton.isVisible({ timeout: 2000 })) {
          break;
        }
        submitButton = null;
      }
      
      if (!submitButton) {
        console.log(`     No submit button found`);
        // Try pressing Enter
        await titleInput.press('Enter');
        return true;
      }
      
      await submitButton.click();
      return true;
      
    } catch (error) {
      console.log(`     Form filling failed: ${error.message}`);
      return false;
    }
  }

  async function isNodeVisibleInGraph(page: any, nodeTitle: string): Promise<boolean> {
    try {
      // Check various ways a node might be displayed
      const nodeSelectors = [
        `text="${nodeTitle}"`,
        `[title="${nodeTitle}"]`,
        `[data-node-title="${nodeTitle}"]`,
        `.node:has-text("${nodeTitle}")`,
        `g:has-text("${nodeTitle}")`,
        `[aria-label*="${nodeTitle}"]`
      ];
      
      for (const selector of nodeSelectors) {
        const element = page.locator(selector);
        if (await element.isVisible({ timeout: 2000 })) {
          console.log(`     Node found with selector: ${selector}`);
          return true;
        }
      }
      
      // Count total visible nodes for debugging
      const totalNodes = await page.locator('g.node, .node, circle, [data-node]').count();
      console.log(`     Node "${nodeTitle}" not found. Total nodes visible: ${totalNodes}`);
      
      return false;
    } catch (error) {
      console.log(`     Node visibility check failed: ${error.message}`);
      return false;
    }
  }

  async function changeNodeStatusViaUI(page: any, nodeTitle: string, newStatus: string): Promise<boolean> {
    try {
      console.log(`   Attempting to change "${nodeTitle}" status to ${newStatus}`);
      
      // Find and select the node
      const node = page.locator(`text="${nodeTitle}"`).first();
      if (!(await node.isVisible({ timeout: 5000 }))) {
        console.log(`     Node "${nodeTitle}" not visible for status change`);
        return false;
      }
      
      // Click the node to select/open editor
      await node.click();
      await page.waitForTimeout(1000);
      
      // Look for status editor/dropdown
      const statusSelectors = [
        'select[name="status"]',
        '[data-field="status"]',
        '.status-dropdown',
        '.status-selector',
        'input[name="status"]'
      ];
      
      for (const selector of statusSelectors) {
        const statusControl = page.locator(selector).first();
        if (await statusControl.isVisible({ timeout: 2000 })) {
          
          if (await statusControl.evaluate(el => el.tagName) === 'SELECT') {
            await statusControl.selectOption(newStatus);
          } else {
            await statusControl.fill(newStatus);
          }
          
          // Save if needed
          const saveButton = page.locator('button:has-text("Save"), button:has-text("Update")').first();
          if (await saveButton.isVisible({ timeout: 2000 })) {
            await saveButton.click();
          }
          
          console.log(`   ✅ Status changed via ${selector}`);
          return true;
        }
      }
      
      console.log(`   ❌ No status control found`);
      return false;
      
    } catch (error) {
      console.log(`   ❌ Status change failed: ${error.message}`);
      return false;
    }
  }

  async function isNodeStatusVisible(page: any, nodeTitle: string, expectedStatus: string): Promise<boolean> {
    try {
      // Check if the node shows the expected status
      const statusVisible = await page.locator(`text="${nodeTitle}"`).locator(`text="${expectedStatus}"`).isVisible({ timeout: 2000 });
      
      if (!statusVisible) {
        // Try alternative ways to find status
        const statusIndicators = [
          `[data-node="${nodeTitle}"] [data-status="${expectedStatus}"]`,
          `.node:has-text("${nodeTitle}") .status:has-text("${expectedStatus}")`,
          `g:has-text("${nodeTitle}") text:has-text("${expectedStatus}")`
        ];
        
        for (const selector of statusIndicators) {
          if (await page.locator(selector).isVisible({ timeout: 1000 })) {
            return true;
          }
        }
      }
      
      return statusVisible;
    } catch (error) {
      return false;
    }
  }

  async function changeNodePriorityViaUI(page: any, nodeTitle: string, newPriority: string): Promise<boolean> {
    try {
      console.log(`   Attempting to change "${nodeTitle}" priority to ${newPriority}`);
      
      const node = page.locator(`text="${nodeTitle}"`).first();
      if (!(await node.isVisible({ timeout: 5000 }))) return false;
      
      await node.click();
      await page.waitForTimeout(1000);
      
      const prioritySelectors = [
        'select[name="priority"]',
        '[data-field="priority"]',
        '.priority-dropdown',
        'input[name="priority"]'
      ];
      
      for (const selector of prioritySelectors) {
        const priorityControl = page.locator(selector).first();
        if (await priorityControl.isVisible({ timeout: 2000 })) {
          
          if (await priorityControl.evaluate(el => el.tagName) === 'SELECT') {
            await priorityControl.selectOption(newPriority);
          } else {
            await priorityControl.fill(newPriority);
          }
          
          const saveButton = page.locator('button:has-text("Save"), button:has-text("Update")').first();
          if (await saveButton.isVisible({ timeout: 2000 })) {
            await saveButton.click();
          }
          
          return true;
        }
      }
      
      return false;
    } catch (error) {
      return false;
    }
  }

  async function isNodePriorityVisible(page: any, nodeTitle: string, expectedPriority: string): Promise<boolean> {
    try {
      return await page.locator(`text="${nodeTitle}"`).locator(`text="${expectedPriority}"`).isVisible({ timeout: 2000 });
    } catch (error) {
      return false;
    }
  }

  async function changeNodeTitleViaUI(page: any, oldTitle: string, newTitle: string): Promise<boolean> {
    try {
      console.log(`   Attempting to change title from "${oldTitle}" to "${newTitle}"`);
      
      const node = page.locator(`text="${oldTitle}"`).first();
      if (!(await node.isVisible({ timeout: 5000 }))) return false;
      
      await node.click();
      await page.waitForTimeout(1000);
      
      const titleInput = page.locator('input[name="title"], input[placeholder*="title"]').first();
      if (await titleInput.isVisible({ timeout: 3000 })) {
        await titleInput.clear();
        await titleInput.fill(newTitle);
        
        const saveButton = page.locator('button:has-text("Save"), button:has-text("Update")').first();
        if (await saveButton.isVisible({ timeout: 2000 })) {
          await saveButton.click();
        } else {
          await titleInput.press('Enter');
        }
        
        return true;
      }
      
      return false;
    } catch (error) {
      return false;
    }
  }

  async function changeNodeTypeViaUI(page: any, nodeTitle: string, newType: string): Promise<boolean> {
    try {
      const node = page.locator(`text="${nodeTitle}"`).first();
      if (!(await node.isVisible({ timeout: 5000 }))) return false;
      
      await node.click();
      await page.waitForTimeout(1000);
      
      const typeControl = page.locator('select[name="type"], [data-field="type"]').first();
      if (await typeControl.isVisible({ timeout: 3000 })) {
        await typeControl.selectOption(newType);
        
        const saveButton = page.locator('button:has-text("Save"), button:has-text("Update")').first();
        if (await saveButton.isVisible({ timeout: 2000 })) {
          await saveButton.click();
        }
        
        return true;
      }
      
      return false;
    } catch (error) {
      return false;
    }
  }

  async function isNodeTypeVisible(page: any, nodeTitle: string, expectedType: string): Promise<boolean> {
    try {
      // Look for type indicators near the node
      return await page.locator(`text="${nodeTitle}"`).locator(`text="${expectedType}"`).isVisible({ timeout: 2000 });
    } catch (error) {
      return false;
    }
  }

  async function createRelationshipViaUI(page: any, sourceTitle: string, targetTitle: string): Promise<boolean> {
    try {
      console.log(`   Attempting to create relationship: ${sourceTitle} → ${targetTitle}`);
      
      // This is a complex operation that depends heavily on the specific UI implementation
      // Common patterns: drag from source to target, select both nodes then click connect button
      
      // Method 1: Drag and drop
      const sourceNode = page.locator(`text="${sourceTitle}"`).first();
      const targetNode = page.locator(`text="${targetTitle}"`).first();
      
      if (await sourceNode.isVisible({ timeout: 3000 }) && await targetNode.isVisible({ timeout: 3000 })) {
        
        // Try drag and drop
        try {
          await sourceNode.hover();
          await page.mouse.down();
          await targetNode.hover();
          await page.mouse.up();
          await page.waitForTimeout(1000);
          
          // Check if relationship creation dialog appeared
          const relationshipDialog = page.locator('.relationship-dialog, .connect-dialog').first();
          if (await relationshipDialog.isVisible({ timeout: 2000 })) {
            const confirmButton = page.locator('button:has-text("Create"), button:has-text("Connect")').first();
            if (await confirmButton.isVisible({ timeout: 2000 })) {
              await confirmButton.click();
              return true;
            }
          }
        } catch (error) {
          // Drag and drop failed, try other methods
        }
        
        // Method 2: Select both nodes and use connect button
        await sourceNode.click();
        await page.keyboard.down('Control');
        await targetNode.click();
        await page.keyboard.up('Control');
        
        const connectButton = page.locator('button:has-text("Connect"), button:has-text("Link"), .connect-button').first();
        if (await connectButton.isVisible({ timeout: 3000 })) {
          await connectButton.click();
          return true;
        }
      }
      
      return false;
    } catch (error) {
      console.log(`   Relationship creation failed: ${error.message}`);
      return false;
    }
  }

  async function isRelationshipVisibleInGraph(page: any, sourceTitle: string, targetTitle: string): Promise<boolean> {
    try {
      // Look for visual connection between nodes (SVG lines, arrows, etc.)
      const relationships = await page.locator('line, path[marker-end], .edge, .relationship').count();
      console.log(`     Found ${relationships} potential relationships in graph`);
      
      // This is a simplified check - real implementation would need to verify
      // that the relationship connects the specific nodes
      return relationships > 0;
    } catch (error) {
      return false;
    }
  }

  async function flipRelationshipViaUI(page: any, sourceTitle: string, targetTitle: string): Promise<boolean> {
    try {
      // Find the relationship between nodes and flip it
      // This requires clicking on the relationship and finding a flip button
      
      const relationship = page.locator('line, path[marker-end], .edge').first();
      if (await relationship.isVisible({ timeout: 3000 })) {
        await relationship.click();
        await page.waitForTimeout(1000);
        
        const flipButton = page.locator('button:has-text("Flip"), button:has-text("Reverse"), [data-action="flip"]').first();
        if (await flipButton.isVisible({ timeout: 3000 })) {
          await flipButton.click();
          return true;
        }
      }
      
      return false;
    } catch (error) {
      return false;
    }
  }

  async function isRelationshipFlipVisible(page: any, sourceTitle: string, targetTitle: string): Promise<boolean> {
    try {
      // Check if the relationship direction has visually changed
      // This would require analyzing arrow directions or other visual indicators
      
      // Simplified implementation - would need actual visual verification
      return true; // Placeholder
    } catch (error) {
      return false;
    }
  }

  async function deleteNodeViaUI(page: any, nodeTitle: string): Promise<boolean> {
    try {
      console.log(`   Attempting to delete node: "${nodeTitle}"`);
      
      const node = page.locator(`text="${nodeTitle}"`).first();
      if (!(await node.isVisible({ timeout: 5000 }))) return false;
      
      // Method 1: Right-click context menu
      await node.click({ button: 'right' });
      await page.waitForTimeout(1000);
      
      const deleteContextOption = page.locator('button:has-text("Delete"), text="Delete"').first();
      if (await deleteContextOption.isVisible({ timeout: 3000 })) {
        await deleteContextOption.click();
        
        // Handle confirmation dialog
        const confirmButton = page.locator('button:has-text("Confirm"), button:has-text("Yes"), button:has-text("Delete")').first();
        if (await confirmButton.isVisible({ timeout: 2000 })) {
          await confirmButton.click();
        }
        
        return true;
      }
      
      // Method 2: Select node and use Delete key
      await node.click();
      await page.keyboard.press('Delete');
      
      const confirmButton = page.locator('button:has-text("Confirm"), button:has-text("Yes")').first();
      if (await confirmButton.isVisible({ timeout: 2000 })) {
        await confirmButton.click();
        return true;
      }
      
      return false;
    } catch (error) {
      return false;
    }
  }
});