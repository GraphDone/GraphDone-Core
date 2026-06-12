import { test, expect } from '@playwright/test';
import { HEALTH_URL, gqlRequest, apiLogin } from '../helpers/api';

// API health checks, deployment-agnostic: every URL derives from TEST_URL
// (nginx route layout in production, Vite proxy in dev) and data queries
// authenticate the same way the UI does. See tests/helpers/api.ts.
test.describe('GraphQL API Health Tests', () => {
  let token: string;

  test.beforeAll(async () => {
    token = await apiLogin();
  });

  test('@core Server health endpoint responds correctly', async () => {
    const response = await fetch(HEALTH_URL);
    expect(response.ok).toBeTruthy();

    const health = await response.json();
    expect(health.status).toBeDefined();
    console.log('✅ Server health:', health.status);
  });

  test('GraphQL endpoint returns work items for an authenticated user', async () => {
    const data = await gqlRequest<{ workItems: Array<{ id: string; title: string; status: string }> }>(
      '{ workItems(options: { limit: 25 }) { id title status } }',
      undefined,
      token
    );

    expect(data.errors).toBeUndefined();
    expect(data.data?.workItems).toBeDefined();
    expect(Array.isArray(data.data!.workItems)).toBeTruthy();
    console.log(`✅ Found ${data.data!.workItems.length} work items`);
  });

  test('GraphQL endpoint filters work items by graph', async () => {
    const graphs = await gqlRequest<{ graphs: Array<{ id: string; name: string }> }>(
      '{ graphs(options: { limit: 1 }) { id name } }',
      undefined,
      token
    );
    expect(graphs.data?.graphs).toBeDefined();
    test.skip(graphs.data!.graphs.length === 0, 'no graphs in database');

    const graphId = graphs.data!.graphs[0].id;
    const data = await gqlRequest<{ workItems: Array<{ id: string; graph: { id: string } }> }>(
      `query($where: WorkItemWhere) { workItems(where: $where) { id graph { id } } }`,
      { where: { graph: { id: graphId } } },
      token
    );

    expect(data.errors).toBeUndefined();
    expect(data.data?.workItems).toBeDefined();
    for (const item of data.data!.workItems) {
      expect(item.graph.id).toBe(graphId);
    }
    console.log(`✅ Graph-filtered items: ${data.data!.workItems.length}`);
  });

  test('GraphQL endpoint handles invalid queries gracefully', async () => {
    const data = await gqlRequest('query { invalidField { nonExistentField } }', undefined, token);

    expect(data.errors).toBeDefined();
    expect(Array.isArray(data.errors)).toBeTruthy();
    expect(data.errors!.length).toBeGreaterThan(0);
    console.log('✅ Invalid query properly returned errors');
  });
});
