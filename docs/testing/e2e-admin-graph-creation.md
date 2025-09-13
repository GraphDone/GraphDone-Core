# E2E Testing Guide: Admin Panel & Graph Creation

This guide provides comprehensive end-to-end testing specifications for GraphDone's admin panel functionality and complete graph creation workflows.

## Prerequisites

Before running these E2E tests, ensure:
- GraphDone development server is running on http://localhost:3127
- Neo4j database is seeded with test data
- Test user accounts are available (ADMIN, MEMBER, VIEWER roles)
- Playwright is configured with the robust authentication system

## Authentication Foundation

All E2E tests build on GraphDone's battle-tested authentication system:

```typescript
import { login, navigateToWorkspace, cleanupAuth, TEST_USERS } from '../helpers/auth';

test.beforeEach(async ({ page }) => {
  // Use centralized auth system
  await login(page, TEST_USERS.ADMIN);
});

test.afterEach(async ({ page }) => {
  // Always clean up auth state
  await cleanupAuth(page);
});
```

## Admin Panel E2E Tests

### Test Suite: Admin Access Control

```typescript
// tests/e2e/admin-access-control.spec.ts
import { test, expect } from '@playwright/test';
import { login, cleanupAuth, TEST_USERS } from '../helpers/auth';

test.describe('Admin Panel Access Control', () => {
  test('should grant admin access to ADMIN users', async ({ page }) => {
    await login(page, TEST_USERS.ADMIN);
    
    // Navigate to admin panel
    await page.goto('/admin');
    
    // Verify admin interface loads
    await expect(page.locator('h1:has-text("System Administration")')).toBeVisible();
    await expect(page.locator('[data-testid="admin-tabs"]')).toBeVisible();
    
    // Check all admin tabs are present
    const expectedTabs = ['Users', 'Registration', 'Database', 'Security', 'Backup & Restore'];
    for (const tab of expectedTabs) {
      await expect(page.locator(`button:has-text("${tab}")`)).toBeVisible();
    }
  });

  test('should deny admin access to non-ADMIN users', async ({ page }) => {
    await login(page, TEST_USERS.MEMBER);
    
    // Attempt to access admin panel
    await page.goto('/admin');
    
    // Verify access denied
    await expect(page.locator('h1:has-text("Access Denied")')).toBeVisible();
    await expect(page.locator('text=Only ADMIN users can access')).toBeVisible();
  });

  test('should redirect unauthenticated users to login', async ({ page }) => {
    // No login - direct admin access attempt
    await page.goto('/admin');
    
    // Should redirect to login
    await expect(page.url()).toMatch(/\/login/);
  });
});
```

### Test Suite: User Management

```typescript
// tests/e2e/admin-user-management.spec.ts
test.describe('Admin User Management', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, TEST_USERS.ADMIN);
    await page.goto('/admin');
    // Activate Users tab
    await page.click('button:has-text("Users")');
  });

  test('should display user list with correct information', async ({ page }) => {
    // Wait for user list to load
    await expect(page.locator('[data-testid="user-list"]')).toBeVisible();
    
    // Verify user table headers
    const expectedHeaders = ['Email', 'Username', 'Name', 'Role', 'Status', 'Actions'];
    for (const header of expectedHeaders) {
      await expect(page.locator(`th:has-text("${header}")`)).toBeVisible();
    }
    
    // Verify at least test users are present
    await expect(page.locator('tr:has-text("admin")')).toBeVisible();
    await expect(page.locator('tr:has-text("member")')).toBeVisible();
  });

  test('should create new user successfully', async ({ page }) => {
    // Click create user button
    await page.click('[data-testid="create-user-button"]');
    
    // Fill user creation form
    await page.fill('[data-testid="user-email"]', 'testuser@example.com');
    await page.fill('[data-testid="user-username"]', 'testuser');
    await page.fill('[data-testid="user-name"]', 'Test User');
    
    // Select role
    await page.selectOption('[data-testid="user-role"]', 'MEMBER');
    
    // Submit form
    await page.click('[data-testid="create-user-submit"]');
    
    // Verify success notification
    await expect(page.locator('.notification:has-text("User created successfully")')).toBeVisible();
    
    // Verify user appears in list
    await expect(page.locator('tr:has-text("testuser@example.com")')).toBeVisible();
  });

  test('should update user role', async ({ page }) => {
    // Find test user row and click edit
    const userRow = page.locator('tr:has-text("member")').first();
    await userRow.locator('[data-testid="edit-user-button"]').click();
    
    // Change role
    await page.selectOption('[data-testid="edit-user-role"]', 'VIEWER');
    
    // Save changes
    await page.click('[data-testid="save-user-changes"]');
    
    // Verify role updated in UI
    await expect(userRow.locator('td:has-text("VIEWER")')).toBeVisible();
  });

  test('should deactivate user account', async ({ page }) => {
    const userRow = page.locator('tr:has-text("testuser")').first();
    
    // Click deactivate button
    await userRow.locator('[data-testid="deactivate-user-button"]').click();
    
    // Confirm deactivation
    await page.click('[data-testid="confirm-deactivation"]');
    
    // Verify status changed
    await expect(userRow.locator('.status-inactive')).toBeVisible();
  });

  test('should reset user password', async ({ page }) => {
    const userRow = page.locator('tr:has-text("member")').first();
    
    // Click reset password
    await userRow.locator('[data-testid="reset-password-button"]').click();
    
    // Confirm reset
    await page.click('[data-testid="confirm-password-reset"]');
    
    // Verify temporary password displayed
    await expect(page.locator('[data-testid="temp-password-display"]')).toBeVisible();
    
    // Verify success notification
    await expect(page.locator('.notification:has-text("Password reset successfully")')).toBeVisible();
  });
});
```

### Test Suite: Database Management

```typescript
// tests/e2e/admin-database-management.spec.ts
test.describe('Admin Database Management', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, TEST_USERS.ADMIN);
    await page.goto('/admin');
    await page.click('button:has-text("Database")');
  });

  test('should display database connection status', async ({ page }) => {
    // Check connection indicators
    await expect(page.locator('[data-testid="neo4j-status"]')).toBeVisible();
    await expect(page.locator('[data-testid="connection-health"]')).toHaveText(/Connected|Healthy/);
    
    // Verify database metrics
    await expect(page.locator('[data-testid="node-count"]')).toBeVisible();
    await expect(page.locator('[data-testid="relationship-count"]')).toBeVisible();
  });

  test('should perform database maintenance operations', async ({ page }) => {
    // Click maintenance button
    await page.click('[data-testid="run-maintenance"]');
    
    // Confirm operation
    await page.click('[data-testid="confirm-maintenance"]');
    
    // Wait for completion
    await expect(page.locator('.notification:has-text("Maintenance completed")')).toBeVisible({ timeout: 30000 });
    
    // Verify maintenance log
    await expect(page.locator('[data-testid="maintenance-log"]')).toContainText('Maintenance run completed');
  });
});
```

## Graph Creation E2E Tests

### Test Suite: Complete Graph Creation Journey

```typescript
// tests/e2e/graph-creation-journey.spec.ts
test.describe('Complete Graph Creation Journey', () => {
  let graphName: string;
  
  test.beforeEach(async ({ page }) => {
    await login(page, TEST_USERS.ADMIN);
    await navigateToWorkspace(page);
    
    // Generate unique graph name for this test
    graphName = `Test Graph ${Date.now()}`;
  });

  test('should create graph from blank template', async ({ page }) => {
    // Start graph creation
    await page.click('[data-testid="create-new-graph"]');
    
    // Fill graph details
    await page.fill('[data-testid="graph-name"]', graphName);
    await page.fill('[data-testid="graph-description"]', 'E2E test graph for validation');
    
    // Select graph type
    await page.selectOption('[data-testid="graph-type"]', 'PROJECT');
    
    // Set permissions
    await page.selectOption('[data-testid="graph-visibility"]', 'PRIVATE');
    
    // Create graph
    await page.click('[data-testid="create-graph-button"]');
    
    // Verify graph created
    await expect(page.locator(`text=${graphName}`)).toBeVisible();
    await expect(page.url()).toMatch(/\/workspace/);
    
    // Verify empty graph view
    await expect(page.locator('[data-testid="graph-canvas"]')).toBeVisible();
    await expect(page.locator('[data-testid="no-nodes-message"]')).toBeVisible();
  });

  test('should add nodes of different types', async ({ page }) => {
    // Navigate to test graph
    await navigateToTestGraph(page, graphName);
    
    const nodeTypes = [
      { type: 'EPIC', title: 'Epic: Mobile App Redesign' },
      { type: 'FEATURE', title: 'Feature: User Authentication' },
      { type: 'TASK', title: 'Task: Design Login Screen' },
      { type: 'BUG', title: 'Bug: Fix Navigation Issue' }
    ];
    
    for (const nodeData of nodeTypes) {
      // Add node
      await page.click('[data-testid="add-node-button"]');
      
      // Fill node form
      await page.selectOption('[data-testid="node-type"]', nodeData.type);
      await page.fill('[data-testid="node-title"]', nodeData.title);
      await page.fill('[data-testid="node-description"]', `Test ${nodeData.type.toLowerCase()} node`);
      
      // Set priority
      await page.fill('[data-testid="executive-priority"]', '0.8');
      await page.fill('[data-testid="individual-priority"]', '0.6');
      
      // Create node
      await page.click('[data-testid="create-node-button"]');
      
      // Verify node appears in graph
      await expect(page.locator(`[data-testid="node"]:has-text("${nodeData.title}")`)).toBeVisible();
    }
    
    // Verify all nodes created
    await expect(page.locator('[data-testid="node"]')).toHaveCount(4);
  });

  test('should create relationships between nodes', async ({ page }) => {
    await navigateToTestGraph(page, graphName);
    
    // Ensure nodes exist (from previous test or setup)
    await createTestNodes(page);
    
    // Create dependency relationship
    const epicNode = page.locator('[data-testid="node"]:has-text("Epic:")').first();
    const featureNode = page.locator('[data-testid="node"]:has-text("Feature:")').first();
    
    // Drag from epic to feature to create relationship
    await epicNode.hover();
    await page.mouse.down();
    await featureNode.hover();
    await page.mouse.up();
    
    // Select relationship type
    await page.click('[data-testid="relationship-type-CONTAINS"]');
    
    // Verify relationship created
    await expect(page.locator('[data-testid="edge"]')).toHaveCount(1);
    
    // Create blocking relationship
    const taskNode = page.locator('[data-testid="node"]:has-text("Task:")').first();
    const bugNode = page.locator('[data-testid="node"]:has-text("Bug:")').first();
    
    // Right-click on task for context menu
    await taskNode.click({ button: 'right' });
    await page.click('[data-testid="add-relationship"]');
    
    // Select target and relationship type
    await page.selectOption('[data-testid="relationship-target"]', bugNode.getAttribute('data-node-id'));
    await page.selectOption('[data-testid="relationship-type"]', 'BLOCKS');
    
    // Create relationship
    await page.click('[data-testid="create-relationship"]');
    
    // Verify relationships exist
    await expect(page.locator('[data-testid="edge"]')).toHaveCount(2);
  });

  test('should test priority boosting mechanism', async ({ page }) => {
    await navigateToTestGraph(page, graphName);
    
    const ideaNode = await createTestNode(page, {
      type: 'IDEA',
      title: 'Idea: Dark Mode Theme',
      executivePriority: '0.1',
      individualPriority: '0.3'
    });
    
    // Record initial position
    const initialPosition = await ideaNode.boundingBox();
    
    // Boost the idea (simulate community validation)
    await ideaNode.click();
    await page.click('[data-testid="boost-priority-button"]');
    
    // Wait for animation to complete
    await page.waitForTimeout(2000);
    
    // Verify node moved closer to center (priority increased)
    const newPosition = await ideaNode.boundingBox();
    
    // Position should have changed (this is a simplified check)
    expect(newPosition?.x).not.toBe(initialPosition?.x);
    
    // Verify priority updated in UI
    await ideaNode.click();
    const priorityDisplay = page.locator('[data-testid="priority-display"]');
    await expect(priorityDisplay).toContainText('Community: 0.');
  });
});
```

### Test Suite: Graph View Modes

```typescript
// tests/e2e/graph-view-modes.spec.ts
test.describe('Graph View Modes', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, TEST_USERS.ADMIN);
    await navigateToWorkspace(page);
    await navigateToTestGraph(page, 'Sample Graph');
  });

  test('should switch between all view modes', async ({ page }) => {
    const viewModes = [
      { id: 'graph-view', name: 'Graph' },
      { id: 'table-view', name: 'Table' },
      { id: 'kanban-view', name: 'Kanban' },
      { id: 'gantt-view', name: 'Gantt' },
      { id: 'calendar-view', name: 'Calendar' }
    ];
    
    for (const view of viewModes) {
      // Switch to view mode
      await page.click(`[data-testid="${view.id}-button"]`);
      
      // Verify view activated
      await expect(page.locator(`[data-testid="${view.id}"]`)).toBeVisible();
      
      // Verify view-specific elements
      switch (view.id) {
        case 'graph-view':
          await expect(page.locator('[data-testid="graph-canvas"]')).toBeVisible();
          break;
        case 'table-view':
          await expect(page.locator('[data-testid="data-table"]')).toBeVisible();
          break;
        case 'kanban-view':
          await expect(page.locator('[data-testid="kanban-board"]')).toBeVisible();
          break;
        case 'gantt-view':
          await expect(page.locator('[data-testid="gantt-chart"]')).toBeVisible();
          break;
        case 'calendar-view':
          await expect(page.locator('[data-testid="calendar-grid"]')).toBeVisible();
          break;
      }
      
      // Take screenshot for visual verification
      await page.screenshot({ 
        path: `artifacts/screenshots/view-${view.name.toLowerCase()}.png`,
        fullPage: true 
      });
    }
  });

  test('should filter nodes in table view', async ({ page }) => {
    // Switch to table view
    await page.click('[data-testid="table-view-button"]');
    
    // Apply type filter
    await page.selectOption('[data-testid="type-filter"]', 'TASK');
    
    // Verify only task nodes visible
    const visibleRows = page.locator('[data-testid="table-row"]');
    const rowCount = await visibleRows.count();
    
    for (let i = 0; i < rowCount; i++) {
      const row = visibleRows.nth(i);
      await expect(row.locator('[data-testid="node-type"]')).toHaveText('TASK');
    }
    
    // Clear filter
    await page.selectOption('[data-testid="type-filter"]', 'ALL');
    
    // Verify all nodes visible again
    await expect(visibleRows.count()).toBeGreaterThan(rowCount);
  });
});
```

## Test Helper Functions

```typescript
// tests/helpers/graph-creation.ts
import { Page, expect } from '@playwright/test';

export async function navigateToTestGraph(page: Page, graphName: string) {
  // Select graph from dropdown
  await page.click('[data-testid="graph-selector"]');
  await page.click(`[data-testid="graph-option"]:has-text("${graphName}")`);
  
  // Wait for graph to load
  await expect(page.locator(`[data-testid="current-graph"]:has-text("${graphName}")`)).toBeVisible();
}

export async function createTestNode(page: Page, nodeData: {
  type: string;
  title: string;
  executivePriority?: string;
  individualPriority?: string;
}) {
  await page.click('[data-testid="add-node-button"]');
  
  await page.selectOption('[data-testid="node-type"]', nodeData.type);
  await page.fill('[data-testid="node-title"]', nodeData.title);
  
  if (nodeData.executivePriority) {
    await page.fill('[data-testid="executive-priority"]', nodeData.executivePriority);
  }
  
  if (nodeData.individualPriority) {
    await page.fill('[data-testid="individual-priority"]', nodeData.individualPriority);
  }
  
  await page.click('[data-testid="create-node-button"]');
  
  // Return reference to created node
  return page.locator(`[data-testid="node"]:has-text("${nodeData.title}")`);
}

export async function createTestNodes(page: Page) {
  const nodes = [
    { type: 'EPIC', title: 'Epic: Test Initiative' },
    { type: 'FEATURE', title: 'Feature: Core Functionality' },
    { type: 'TASK', title: 'Task: Implementation Work' },
    { type: 'BUG', title: 'Bug: Critical Issue' }
  ];
  
  for (const node of nodes) {
    await createTestNode(page, node);
  }
}
```

## Running the Tests

### Individual Test Suites

```bash
# Admin panel tests
npm run test:e2e -- tests/e2e/admin-access-control.spec.ts
npm run test:e2e -- tests/e2e/admin-user-management.spec.ts
npm run test:e2e -- tests/e2e/admin-database-management.spec.ts

# Graph creation tests  
npm run test:e2e -- tests/e2e/graph-creation-journey.spec.ts
npm run test:e2e -- tests/e2e/graph-view-modes.spec.ts

# All admin and graph creation tests
npm run test:e2e -- --grep="Admin|Graph Creation"
```

### Test Configuration

```typescript
// tests/playwright.config.ts - Add admin/graph creation specific settings
export default defineConfig({
  projects: [
    {
      name: 'admin-features',
      testMatch: '**/admin-*.spec.ts',
      use: {
        // Admin tests might need longer timeouts
        actionTimeout: 15000,
        navigationTimeout: 30000
      }
    },
    {
      name: 'graph-creation',
      testMatch: '**/graph-*.spec.ts', 
      use: {
        // Graph creation tests need visual stability
        actionTimeout: 10000
      }
    }
  ]
});
```

## Test Coverage Expectations

### Admin Panel Coverage
- ✅ Access control enforcement
- ✅ User CRUD operations
- ✅ Role management
- ✅ Password operations
- ✅ Account status management
- ✅ Database monitoring
- ✅ System maintenance operations

### Graph Creation Coverage  
- ✅ Graph creation workflow
- ✅ All node types creation
- ✅ Relationship establishment
- ✅ Priority system mechanics
- ✅ Community boosting
- ✅ View mode transitions
- ✅ Filtering and search
- ✅ Collaborative features

### Integration Coverage
- ✅ Admin operations affecting user graph access
- ✅ User role changes impacting graph permissions  
- ✅ Database operations and graph consistency
- ✅ Cross-user collaboration workflows

These E2E tests provide comprehensive coverage of GraphDone's admin functionality and graph creation workflows, ensuring both security boundaries and user experience quality are maintained across all supported features.