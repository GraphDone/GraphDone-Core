import { test, expect } from '@playwright/test';

test.describe('GraphQL API Health Tests', () => {
  const baseUrl = 'http://localhost:4127/graphql';
  const healthUrl = 'http://localhost:4127/health';

  test('Server health endpoint responds correctly', async () => {
    const response = await fetch(healthUrl);
    expect(response.ok).toBeTruthy();
    
    const health = await response.json();
    expect(health.status).toBeDefined();
    console.log('✅ Server health:', health.status);
  });

  test('GraphQL endpoint returns work items', async () => {
    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: '{ workItems { id title status } }'
      })
    });

    expect(response.ok).toBeTruthy();
    const data = await response.json();
    expect(data.data).toBeDefined();
    expect(data.data.workItems).toBeDefined();
    expect(Array.isArray(data.data.workItems)).toBeTruthy();
    
    console.log(`✅ Found ${data.data.workItems.length} work items`);
  });

  test('GraphQL endpoint handles team-specific queries', async () => {
    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: 'query { workItems(where: { teamId: "team-1" }) { id title type teamId } }'
      })
    });

    expect(response.ok).toBeTruthy();
    const data = await response.json();
    expect(data.data).toBeDefined();
    expect(data.data.workItems).toBeDefined();
    
    // Verify team filtering if items exist
    if (data.data.workItems.length > 0) {
      data.data.workItems.forEach(item => {
        expect(item.teamId).toBe('team-1');
      });
    }
    
    console.log(`✅ Team-1 filtered items: ${data.data.workItems.length}`);
  });

  test('GraphQL endpoint handles invalid queries gracefully', async () => {
    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: 'query { invalidField { nonExistentField } }'
      })
    });

    expect(response.ok).toBeTruthy();
    const data = await response.json();
    expect(data.errors).toBeDefined();
    expect(Array.isArray(data.errors)).toBeTruthy();
    expect(data.errors.length).toBeGreaterThan(0);
    
    console.log('✅ Invalid query properly returned errors');
  });
});