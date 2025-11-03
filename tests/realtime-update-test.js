#!/usr/bin/env node

const { chromium } = require('playwright');

async function realtimeUpdateTest() {
  console.log('🧪 REAL-TIME UPDATE TEST');
  console.log('   Focus: Test user-reported issue - "graph needs manual refresh after status changes"');
  console.log('   Target: https://localhost:3128');
  
  const browser = await chromium.launch({ 
    headless: false,
    ignoreHTTPSErrors: true,
    slowMo: 800
  });
  
  const page = await browser.newPage();
  
  const findings = {
    operationsTested: [],
    realTimeWorking: [],
    requiresRefresh: [],
    issues: []
  };
  
  try {
    // Step 1: Login (we know this works)
    console.log('\n=== STEP 1: LOGIN ===');
    await page.goto('https://localhost:3128');
    await page.waitForLoadState('domcontentloaded');
    
    await page.locator('input[type="text"], input[placeholder*="Username"]').first().fill('admin');
    await page.locator('input[type="password"]').first().fill('graphdone');
    await page.locator('button:has-text("Sign In")').first().click();
    await page.waitForTimeout(3000);
    console.log('✅ Logged in successfully');
    
    // Step 2: Ensure in graph view  
    console.log('\n=== STEP 2: NAVIGATE TO GRAPH VIEW ===');
    const graphButton = page.locator('button:has-text("Graph")').first();
    await graphButton.click();
    await page.waitForTimeout(3000);
    console.log('✅ Graph view active');
    
    await page.screenshot({ path: 'artifacts/screenshots/realtime-test-initial.png' });
    
    // Step 3: Count initial nodes
    console.log('\n=== STEP 3: ANALYZE CURRENT GRAPH ===');
    const initialNodes = await countNodes(page);
    console.log(`Found ${initialNodes} nodes initially`);
    
    // Step 4: Test node status change (main user complaint)
    await testNodeStatusChange(page, findings);
    
    // Step 5: Test node creation
    await testNodeCreation(page, findings);
    
    // Step 6: Test relationship operations  
    await testRelationshipOperations(page, findings);
    
    // Step 7: Generate report
    console.log('\n=== REAL-TIME UPDATE TEST RESULTS ===');
    generateReport(findings);
    
    console.log('\n🔍 Browser kept open for manual verification');
    console.log('   Check screenshots and manual refresh to verify findings');
    console.log('   Press Ctrl+C when done');
    
    await new Promise(() => {}); // Keep open
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    await page.screenshot({ path: 'artifacts/screenshots/realtime-test-error.png' });
  }
}

async function countNodes(page) {
  // Count nodes in the graph visualization
  try {
    const nodes = await page.locator('circle, .node, [data-node-id]').count();
    return nodes;
  } catch (error) {
    console.log(`   ⚠️ Could not count nodes: ${error.message}`);
    return 0;
  }
}

async function testNodeStatusChange(page, findings) {
  console.log('\n--- Testing Node Status Change (User\'s Main Complaint) ---');
  
  try {
    // Look for a node to click on
    const firstNode = page.locator('circle').first();
    const nodeExists = await firstNode.isVisible({ timeout: 5000 });
    
    if (!nodeExists) {
      findings.issues.push('No nodes found to test status change');
      console.log('⚠️ No nodes found to test');
      return;
    }
    
    console.log('🎯 Clicking on first node...');
    await firstNode.click();
    await page.waitForTimeout(2000);
    
    // Look for status change UI (modal, dropdown, etc.)
    const statusChangeOptions = [
      'button:has-text("TODO")',
      'button:has-text("IN_PROGRESS")', 
      'button:has-text("COMPLETED")',
      'button:has-text("In Progress")',
      'button:has-text("Done")',
      'select[name="status"]',
      '.status-dropdown button',
      '[data-testid="status-selector"]'
    ];
    
    let statusUI = null;
    for (const selector of statusChangeOptions) {
      if (await page.locator(selector).first().isVisible({ timeout: 2000 })) {
        statusUI = selector;
        console.log(`✅ Found status UI: ${selector}`);
        break;
      }
    }
    
    if (!statusUI) {
      findings.issues.push('Node status change UI not found');
      console.log('❌ Could not find status change UI');
      return;
    }
    
    // Capture before state
    await page.screenshot({ path: 'artifacts/screenshots/before-status-change.png' });
    const nodesBefore = await countNodes(page);
    
    // Change status
    console.log('🔧 Changing node status...');
    await page.locator(statusUI).first().click();
    await page.waitForTimeout(1000);
    
    // If modal appeared, try to save/confirm
    const confirmButton = page.locator('button:has-text("Save"), button:has-text("Update"), button:has-text("Confirm")').first();
    if (await confirmButton.isVisible({ timeout: 2000 })) {
      await confirmButton.click();
      await page.waitForTimeout(1000);
    }
    
    // Check immediate state (without refresh)
    await page.screenshot({ path: 'artifacts/screenshots/after-status-change-no-refresh.png' });
    const nodesAfter = await countNodes(page);
    
    console.log(`   Nodes before: ${nodesBefore}, after: ${nodesAfter}`);
    
    // Wait for potential real-time updates
    await page.waitForTimeout(3000);
    
    // Take screenshot after waiting
    await page.screenshot({ path: 'artifacts/screenshots/after-status-change-waited.png' });
    
    // Now test manual refresh
    console.log('🔄 Testing manual refresh...');
    await page.reload();
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'artifacts/screenshots/after-status-change-refreshed.png' });
    
    const nodesAfterRefresh = await countNodes(page);
    console.log(`   Nodes after refresh: ${nodesAfterRefresh}`);
    
    // Analyze results
    findings.operationsTested.push('Node status change');
    
    if (nodesAfter === nodesBefore && nodesAfterRefresh !== nodesBefore) {
      findings.requiresRefresh.push('Node status change - Not visible until refresh');
      console.log('❌ Status change requires manual refresh (matches user report)');
    } else if (nodesAfter !== nodesBefore) {
      findings.realTimeWorking.push('Node status change - Immediate update');
      console.log('✅ Status change updates in real-time');
    } else {
      findings.issues.push('Node status change - Could not detect changes');
      console.log('⚠️ Could not determine if status change worked');
    }
    
  } catch (error) {
    findings.issues.push(`Node status change test failed: ${error.message}`);
    console.log(`❌ Status change test failed: ${error.message}`);
  }
}

async function testNodeCreation(page, findings) {
  console.log('\n--- Testing Node Creation ---');
  
  try {
    // Look for create node button
    const createOptions = [
      'button:has-text("Add Node")',
      'button:has-text("Create Node")', 
      'button:has-text("New Node")',
      'button:has-text("+")',
      '.add-node-button',
      '[data-testid="create-node"]'
    ];
    
    let createButton = null;
    for (const selector of createOptions) {
      if (await page.locator(selector).first().isVisible({ timeout: 2000 })) {
        createButton = selector;
        console.log(`✅ Found create button: ${selector}`);
        break;
      }
    }
    
    if (!createButton) {
      findings.issues.push('Node creation UI not found');
      console.log('❌ Could not find node creation UI');
      return;
    }
    
    const nodesBefore = await countNodes(page);
    console.log(`   Starting with ${nodesBefore} nodes`);
    
    // Click create
    console.log('🔧 Creating new node...');
    await page.locator(createButton).first().click();
    await page.waitForTimeout(2000);
    
    // Fill form if it appears
    const titleInput = page.locator('input[name="title"], input[placeholder*="title"], input[placeholder*="Title"]').first();
    if (await titleInput.isVisible({ timeout: 3000 })) {
      await titleInput.fill('Real-Time Update Test Node');
      
      const submitButton = page.locator('button:has-text("Create"), button:has-text("Add"), button:has-text("Save")').first();
      if (await submitButton.isVisible({ timeout: 2000 })) {
        await submitButton.click();
        await page.waitForTimeout(2000);
      }
    }
    
    // Check immediate result
    const nodesAfterCreate = await countNodes(page);
    console.log(`   Immediately after create: ${nodesAfterCreate} nodes`);
    
    // Wait for potential updates
    await page.waitForTimeout(3000);
    const nodesAfterWait = await countNodes(page);
    console.log(`   After waiting: ${nodesAfterWait} nodes`);
    
    // Test refresh
    await page.reload();
    await page.waitForTimeout(3000);
    const nodesAfterRefresh = await countNodes(page);
    console.log(`   After refresh: ${nodesAfterRefresh} nodes`);
    
    // Analyze results
    findings.operationsTested.push('Node creation');
    
    if (nodesAfterWait === nodesBefore && nodesAfterRefresh > nodesBefore) {
      findings.requiresRefresh.push('Node creation - Not visible until refresh');
      console.log('❌ Node creation requires manual refresh');
    } else if (nodesAfterWait > nodesBefore) {
      findings.realTimeWorking.push('Node creation - Immediate update');
      console.log('✅ Node creation updates in real-time');
    } else {
      findings.issues.push('Node creation - Could not detect new node');
      console.log('⚠️ Could not determine if node creation worked');
    }
    
  } catch (error) {
    findings.issues.push(`Node creation test failed: ${error.message}`);
    console.log(`❌ Node creation test failed: ${error.message}`);
  }
}

async function testRelationshipOperations(page, findings) {
  console.log('\n--- Testing Relationship Operations ---');
  
  try {
    // Look for existing edges/relationships
    const edges = page.locator('line, path, .edge');
    const edgeCount = await edges.count();
    console.log(`   Found ${edgeCount} relationships`);
    
    if (edgeCount === 0) {
      findings.issues.push('No relationships found to test');
      console.log('⚠️ No relationships found to test');
      return;
    }
    
    // Click on first edge
    const firstEdge = edges.first();
    await firstEdge.click();
    await page.waitForTimeout(2000);
    
    // Look for flip/edit options
    const flipOptions = [
      'button:has-text("Flip")',
      'button:has-text("Reverse")', 
      'button:has-text("Edit")',
      '.flip-button',
      '[data-testid="flip-relationship"]'
    ];
    
    let flipButton = null;
    for (const selector of flipOptions) {
      if (await page.locator(selector).first().isVisible({ timeout: 2000 })) {
        flipButton = selector;
        console.log(`✅ Found flip option: ${selector}`);
        break;
      }
    }
    
    if (!flipButton) {
      findings.issues.push('Relationship flip UI not found');
      console.log('❌ Could not find relationship flip UI');
      return;
    }
    
    // Capture before flip
    await page.screenshot({ path: 'artifacts/screenshots/before-relationship-flip.png' });
    
    // Flip relationship
    console.log('🔧 Flipping relationship...');
    await page.locator(flipButton).first().click();
    await page.waitForTimeout(2000);
    
    // Check immediate result
    await page.screenshot({ path: 'artifacts/screenshots/after-relationship-flip-immediate.png' });
    
    // Wait for updates
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'artifacts/screenshots/after-relationship-flip-waited.png' });
    
    // Test refresh
    await page.reload();
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'artifacts/screenshots/after-relationship-flip-refreshed.png' });
    
    findings.operationsTested.push('Relationship flip');
    findings.requiresRefresh.push('Relationship flip - Visual comparison needed');
    console.log('✅ Relationship flip tested (visual comparison needed)');
    
  } catch (error) {
    findings.issues.push(`Relationship test failed: ${error.message}`);
    console.log(`❌ Relationship test failed: ${error.message}`);
  }
}

function generateReport(findings) {
  console.log(`\n📊 REAL-TIME UPDATE TEST REPORT`);
  console.log(`Operations tested: ${findings.operationsTested.join(', ')}`);
  console.log(`Real-time working: ${findings.realTimeWorking.length}`);
  console.log(`Require refresh: ${findings.requiresRefresh.length}`);
  console.log(`Issues/failures: ${findings.issues.length}`);
  
  if (findings.realTimeWorking.length > 0) {
    console.log(`\n✅ REAL-TIME UPDATES WORKING:`);
    findings.realTimeWorking.forEach(item => console.log(`  - ${item}`));
  }
  
  if (findings.requiresRefresh.length > 0) {
    console.log(`\n❌ REQUIRE MANUAL REFRESH:`);
    findings.requiresRefresh.forEach(item => console.log(`  - ${item}`));
  }
  
  if (findings.issues.length > 0) {
    console.log(`\n⚠️ ISSUES/FAILURES:`);
    findings.issues.forEach(item => console.log(`  - ${item}`));
  }
  
  // User bug verification
  console.log(`\n🎯 USER BUG VERIFICATION:`);
  console.log(`User reported: "graph needs a manual refresh after status changes"`);
  
  const hasStatusRefreshIssue = findings.requiresRefresh.some(item => item.includes('status'));
  const hasNodeCreationIssue = findings.requiresRefresh.some(item => item.includes('creation'));
  
  if (hasStatusRefreshIssue || hasNodeCreationIssue) {
    console.log(`✅ BUG CONFIRMED: Real-time update issues detected`);
  } else if (findings.operationsTested.length === 0) {
    console.log(`⚠️ INCONCLUSIVE: No operations could be tested`);
  } else {
    console.log(`❓ BUG NOT REPRODUCED: Operations appear to work in real-time`);
  }
  
  console.log(`\n📁 Screenshots saved to artifacts/screenshots/:`);
  console.log(`   - realtime-test-initial.png`);
  console.log(`   - before-status-change.png`);
  console.log(`   - after-status-change-no-refresh.png`);
  console.log(`   - after-status-change-waited.png`);
  console.log(`   - after-status-change-refreshed.png`);
  console.log(`   - before-relationship-flip.png`);
  console.log(`   - after-relationship-flip-*.png`);
}

realtimeUpdateTest().catch(console.error);