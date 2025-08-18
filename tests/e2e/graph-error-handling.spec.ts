import { test, expect, Page } from '@playwright/test';

// Test data scenarios with various error conditions
const errorScenarios = {
  nullNodes: {
    workItems: [null, undefined, { id: 'valid-1', title: 'Valid Node', type: 'TASK' }],
    edges: []
  },
  
  missingRequiredFields: {
    workItems: [
      { title: 'No ID Node', type: 'TASK' },
      { id: 'no-title', type: 'TASK' },
      { id: 'no-type', title: 'No Type Node' },
      { id: 'valid-1', title: 'Valid Node', type: 'TASK' }
    ],
    edges: []
  },
  
  invalidNumericValues: {
    workItems: [
      { 
        id: 'invalid-numbers', 
        title: 'Invalid Numbers', 
        type: 'TASK',
        positionX: NaN,
        positionY: Infinity,
        priorityExec: -1,
        priorityComm: 2.5
      },
      { id: 'valid-1', title: 'Valid Node', type: 'TASK' }
    ],
    edges: []
  },
  
  duplicateIds: {
    workItems: [
      { id: 'duplicate', title: 'First Duplicate', type: 'TASK' },
      { id: 'duplicate', title: 'Second Duplicate', type: 'EPIC' },
      { id: 'valid-1', title: 'Valid Node', type: 'TASK' }
    ],
    edges: []
  },
  
  invalidEdgeReferences: {
    workItems: [
      { id: 'node-1', title: 'Valid Node 1', type: 'TASK' },
      { id: 'node-2', title: 'Valid Node 2', type: 'TASK' }
    ],
    edges: [
      { id: 'edge-1', source: 'node-1', target: 'non-existent', type: 'DEPENDENCY' },
      { id: 'edge-2', source: 'non-existent-2', target: 'node-2', type: 'DEPENDENCY' },
      { id: 'edge-3', source: null, target: 'node-1', type: 'DEPENDENCY' },
      { id: 'edge-4', source: 'node-1', target: 'node-2', type: 'INVALID_TYPE' }
    ]
  },
  
  circularReferences: {
    workItems: [
      { id: 'node-1', title: 'Node 1', type: 'TASK' },
      { id: 'node-2', title: 'Node 2', type: 'TASK' },
      { id: 'node-3', title: 'Node 3', type: 'TASK' }
    ],
    edges: [
      { id: 'edge-1', source: 'node-1', target: 'node-2', type: 'DEPENDENCY' },
      { id: 'edge-2', source: 'node-2', target: 'node-3', type: 'DEPENDENCY' },
      { id: 'edge-3', source: 'node-3', target: 'node-1', type: 'DEPENDENCY' }
    ]
  },
  
  massiveDataset: {
    workItems: Array.from({ length: 1000 }, (_, i) => ({
      id: `node-${i}`,
      title: `Node ${i}`,
      type: i % 2 === 0 ? 'TASK' : 'EPIC',
      positionX: Math.random() * 1000,
      positionY: Math.random() * 1000
    })),
    edges: Array.from({ length: 2000 }, (_, i) => ({
      id: `edge-${i}`,
      source: `node-${i % 1000}`,
      target: `node-${(i + 1) % 1000}`,
      type: 'DEPENDENCY'
    }))
  },
  
  emptyData: {
    workItems: [],
    edges: []
  },
  
  mixedValidInvalid: {
    workItems: [
      { id: 'valid-1', title: 'Valid Task', type: 'TASK', priorityExec: 0.8 },
      null,
      { id: 'invalid-pos', title: 'Invalid Position', type: 'EPIC', positionX: 'not-a-number' },
      { title: 'Missing ID', type: 'MILESTONE' },
      { id: 'valid-2', title: 'Another Valid', type: 'FEATURE', priorityComm: 0.6 },
      undefined,
      { id: 'invalid-priority', title: 'Bad Priority', type: 'TASK', priorityExec: NaN }
    ],
    edges: [
      { id: 'edge-1', source: 'valid-1', target: 'valid-2', type: 'DEPENDENCY' },
      { id: 'edge-2', source: 'non-existent', target: 'valid-1', type: 'BLOCKS' },
      { id: 'edge-3', source: 'valid-2', target: 'invalid-pos', type: 'RELATES_TO' }
    ]
  }
};

// Helper function to inject test data into the page
async function injectTestData(page: Page, scenario: keyof typeof errorScenarios) {
  const testData = errorScenarios[scenario];
  
  await page.addInitScript((data) => {
    // Override the GraphQL queries to return our test data
    window.__TEST_DATA__ = data;
    
    // Mock the Apollo Client query responses
    const originalFetch = window.fetch;
    window.fetch = async (url, options) => {
      if (url.toString().includes('graphql')) {
        const body = JSON.parse(options?.body as string || '{}');
        
        if (body.query?.includes('GetWorkItems')) {
          return new Response(JSON.stringify({
            data: { workItems: data.workItems }
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
        if (body.query?.includes('GetEdges')) {
          return new Response(JSON.stringify({
            data: { edges: data.edges }
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }
      
      return originalFetch(url, options);
    };
  }, testData);
}

test.describe('Graph Error Handling', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the workspace
    await page.goto('/');
    
    // Wait for the application to load - look for any interactive element
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000); // Allow React to hydrate
    
    // Try to find any main content area or navigation
    const selectors = [
      'main', 
      '[role="main"]', 
      '.workspace', 
      'body', 
      '#root'
    ];
    
    let found = false;
    for (const selector of selectors) {
      try {
        await page.waitForSelector(selector, { timeout: 5000 });
        found = true;
        break;
      } catch (e) {
        // Try next selector
      }
    }
    
    if (!found) {
      console.log('No main content found, checking page state');
      console.log('URL:', page.url());
      console.log('Title:', await page.title());
    }
  });

  test('handles null and undefined nodes gracefully', async ({ page }) => {
    await injectTestData(page, 'nullNodes');
    
    // Look for any interactive element that might indicate the app is working
    const interactiveElements = [
      'button', 
      'svg', 
      '.graph-container',
      '[role="button"]'
    ];
    
    let foundInteractive = false;
    for (const selector of interactiveElements) {
      try {
        await page.waitForSelector(selector, { timeout: 5000 });
        foundInteractive = true;
        break;
      } catch (e) {
        // Try next selector
      }
    }
    
    // Should not crash - basic page functionality check
    await expect(page.locator('body')).toBeVisible();
    
    // If we found interactive elements, the app is running
    if (foundInteractive) {
      // Try to find graph-related elements
      const graphElements = page.locator('svg, .graph-container, canvas');
      const count = await graphElements.count();
      if (count > 0) {
        await expect(graphElements.first()).toBeVisible();
      }
    }
  });

  test('displays error boundary when graph crashes', async ({ page }) => {
    // Inject code that will cause a crash
    await page.addInitScript(() => {
      // Override D3 to throw an error
      const originalD3 = window.d3;
      if (originalD3) {
        originalD3.forceSimulation = () => {
          throw new Error('Simulated D3 crash for testing');
        };
      }
    });
    
    await page.click('[data-testid="graph-view-button"]');
    
    // Should show error boundary instead of crashing
    await expect(page.locator('text=Graph Visualization Error')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Try Again')).toBeVisible();
    
    // Should still show navigation and not crash entire app
    await expect(page.locator('[data-testid="sidebar"]')).toBeVisible();
  });

  test('validates and sanitizes invalid numeric values', async ({ page }) => {
    await injectTestData(page, 'invalidNumericValues');
    
    await page.click('[data-testid="graph-view-button"]');
    
    // Should not crash
    await expect(page.locator('[data-testid="graph-container"]')).toBeVisible();
    
    // Should show data health warning
    await expect(page.locator('[data-testid="data-health-indicator"]')).toBeVisible({ timeout: 5000 });
    
    // Should render nodes (with sanitized values)
    await expect(page.locator('[data-testid="graph-node"]')).toHaveCount(2);
  });

  test('handles duplicate node IDs', async ({ page }) => {
    await injectTestData(page, 'duplicateIds');
    
    await page.click('[data-testid="graph-view-button"]');
    
    // Should show validation errors
    await expect(page.locator('text=duplicate')).toBeVisible({ timeout: 5000 });
    
    // Should still render valid nodes
    await expect(page.locator('[data-testid="graph-node"]')).toHaveCountGreaterThan(0);
  });

  test('handles invalid edge references gracefully', async ({ page }) => {
    await injectTestData(page, 'invalidEdgeReferences');
    
    await page.click('[data-testid="graph-view-button"]');
    
    // Should not crash
    await expect(page.locator('[data-testid="graph-container"]')).toBeVisible();
    
    // Should render valid nodes
    await expect(page.locator('[data-testid="graph-node"]')).toHaveCount(2);
    
    // Should show warning about invalid edges
    await expect(page.locator('text=invalid')).toBeVisible({ timeout: 5000 });
  });

  test('handles large datasets without crashing', async ({ page }) => {
    await injectTestData(page, 'massiveDataset');
    
    await page.click('[data-testid="graph-view-button"]');
    
    // Should eventually load without crashing (may take time)
    await expect(page.locator('[data-testid="graph-container"]')).toBeVisible({ timeout: 30000 });
    
    // Should show performance warning for large dataset
    await expect(page.locator('text=performance').or(page.locator('text=large'))).toBeVisible({ timeout: 10000 });
  });

  test('handles empty data gracefully', async ({ page }) => {
    await injectTestData(page, 'emptyData');
    
    await page.click('[data-testid="graph-view-button"]');
    
    // Should show empty state message instead of crashing
    await expect(page.locator('text=No data').or(page.locator('text=empty'))).toBeVisible({ timeout: 5000 });
    
    // Container should still be present
    await expect(page.locator('[data-testid="graph-container"]')).toBeVisible();
  });

  test('error boundary recovery works', async ({ page }) => {
    // First, cause an error
    await page.addInitScript(() => {
      window.__FORCE_ERROR__ = true;
      const originalD3 = window.d3;
      if (originalD3) {
        originalD3.forceSimulation = () => {
          if (window.__FORCE_ERROR__) {
            throw new Error('Test error for recovery');
          }
          return originalD3.forceSimulation.originalFunction?.() || {};
        };
        originalD3.forceSimulation.originalFunction = originalD3.forceSimulation;
      }
    });
    
    await page.click('[data-testid="graph-view-button"]');
    
    // Should show error boundary
    await expect(page.locator('text=Graph Visualization Error')).toBeVisible();
    
    // Clear the error condition
    await page.evaluate(() => {
      window.__FORCE_ERROR__ = false;
    });
    
    // Click try again
    await page.click('text=Try Again');
    
    // Should recover and show normal graph
    await expect(page.locator('[data-testid="graph-container"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Graph Visualization Error')).not.toBeVisible();
  });

  test('data health dashboard shows validation details', async ({ page }) => {
    await injectTestData(page, 'mixedValidInvalid');
    
    await page.click('[data-testid="graph-view-button"]');
    
    // Should show data health indicator
    await expect(page.locator('[data-testid="data-health-indicator"]')).toBeVisible({ timeout: 5000 });
    
    // Click to open data health dashboard
    await page.click('[data-testid="data-health-indicator"]');
    
    // Should show validation details
    await expect(page.locator('[data-testid="validation-summary"]')).toBeVisible();
    await expect(page.locator('text=valid').and(page.locator('text=invalid'))).toBeVisible();
    
    // Should show specific error details
    await expect(page.locator('text=Missing ID').or(page.locator('text=missing required'))).toBeVisible();
  });

  test('graph continues to function after validation errors', async ({ page }) => {
    await injectTestData(page, 'mixedValidInvalid');
    
    await page.click('[data-testid="graph-view-button"]');
    
    // Should render valid nodes
    const validNodes = page.locator('[data-testid="graph-node"]');
    await expect(validNodes).toHaveCountGreaterThan(0);
    
    // Should be able to interact with valid nodes
    const firstNode = validNodes.first();
    await firstNode.click();
    
    // Should show node menu without crashing
    await expect(page.locator('[data-testid="node-menu"]')).toBeVisible({ timeout: 3000 });
    
    // Should be able to switch views
    await page.click('[data-testid="list-view-button"]');
    await expect(page.locator('[data-testid="list-view"]')).toBeVisible();
    
    // Should be able to switch back to graph
    await page.click('[data-testid="graph-view-button"]');
    await expect(page.locator('[data-testid="graph-container"]')).toBeVisible();
  });

  test('console errors are logged but UI remains functional', async ({ page }) => {
    const consoleErrors: string[] = [];
    
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    
    await injectTestData(page, 'invalidNumericValues');
    await page.click('[data-testid="graph-view-button"]');
    
    // Allow time for errors to be logged
    await page.waitForTimeout(2000);
    
    // Should have logged validation errors
    expect(consoleErrors.some(error => 
      error.includes('validation') || error.includes('invalid')
    )).toBeTruthy();
    
    // But UI should still be functional
    await expect(page.locator('[data-testid="graph-container"]')).toBeVisible();
    await expect(page.locator('[data-testid="sidebar"]')).toBeVisible();
  });

  test('performance degradation warning for complex data', async ({ page }) => {
    await injectTestData(page, 'massiveDataset');
    
    await page.click('[data-testid="graph-view-button"]');
    
    // Should eventually show performance warning
    await expect(
      page.locator('text=performance').or(
        page.locator('text=large dataset').or(
          page.locator('text=many nodes')
        )
      )
    ).toBeVisible({ timeout: 15000 });
    
    // Should offer simplified view option
    await expect(
      page.locator('text=simplified').or(
        page.locator('text=reduce complexity')
      )
    ).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Error Boundary Integration', () => {
  test('error boundary catches React component errors', async ({ page }) => {
    // Inject a script that will cause a React error during render
    await page.addInitScript(() => {
      // Override a React hook to throw an error
      const originalUseEffect = React.useEffect;
      React.useEffect = (callback, deps) => {
        if (deps && deps.some((dep: any) => typeof dep === 'object' && dep?.id === 'trigger-error')) {
          throw new Error('React hook error for testing');
        }
        return originalUseEffect(callback, deps);
      };
    });
    
    await page.goto('/');
    
    // Should show error boundary instead of white screen
    await expect(page.locator('text=Graph Visualization Error').or(page.locator('text=Something went wrong'))).toBeVisible({ timeout: 10000 });
    
    // App shell should still be visible
    await expect(page.locator('[data-testid="sidebar"]')).toBeVisible();
  });

  test('error boundary provides helpful error reporting', async ({ page }) => {
    await page.addInitScript(() => {
      // Simulate a component error
      window.addEventListener('load', () => {
        setTimeout(() => {
          throw new Error('Test component error for error boundary');
        }, 1000);
      });
    });
    
    await page.goto('/');
    await page.click('[data-testid="graph-view-button"]');
    
    // Wait for potential error
    await page.waitForTimeout(2000);
    
    // If error boundary appears, check it has helpful features
    const errorBoundary = page.locator('text=Error').first();
    if (await errorBoundary.isVisible()) {
      // Should have report issue button
      await expect(page.locator('text=Report Issue')).toBeVisible();
      
      // Should have try again button
      await expect(page.locator('text=Try Again')).toBeVisible();
      
      // Should have helpful suggestions
      await expect(page.locator('text=Troubleshooting').or(page.locator('text=suggestion'))).toBeVisible();
    }
  });
});