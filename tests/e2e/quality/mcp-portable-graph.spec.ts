import { test, expect } from '@playwright/test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { CallToolResultSchema } from '@modelcontextprotocol/sdk/types.js';
import neo4j from 'neo4j-driver';
import { resolve } from 'node:path';
import { login, TEST_USERS } from '../../lib/auth';

const URI = process.env.NEO4J_URI || 'bolt://127.0.0.1:7687';
const USER = process.env.NEO4J_USER || 'neo4j';
const PASS = process.env.NEO4J_PASSWORD || 'graphdone_password';
const callOptions = { timeout: 10000, maxTotalTimeout: 10000 };

test('MCP-authored portable hierarchy renders and inspects its original source item @portable-ai', async ({ page }) => {
  test.setTimeout(180000);
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ['--import', 'tsx', 'src/index.ts'],
    cwd: resolve('packages/mcp-server'),
    stderr: 'pipe',
    env: { NEO4J_URI: URI, NEO4J_USER: USER, NEO4J_PASSWORD: PASS, MCP_HEALTH_PORT: '0', CI: 'true' },
  });
  const client = new Client({ name: 'portable-ai-browser-acceptance', version: '1.0.0' }, { capabilities: {} });
  const driver = neo4j.driver(URI, neo4j.auth.basic(USER, PASS));
  let graphId = '';
  let provenanceId = '';
  const parse = (result: any) => JSON.parse(result.content[0].text);
  try {
    const provenanceName = `Portable API provenance ${Date.now()}`;
    const provenance = driver.session();
    try {
      const result = await provenance.run(`
        CREATE (g:Graph {id: randomUUID(), name:$name, description:'', type:'SUBGRAPH', status:'ACTIVE',
          depth:0, path:[], isShared:true, settings:'{}', createdAt:datetime(), updatedAt:datetime(),
          nodeCount:0, edgeCount:0, contributorCount:0}) RETURN g.id AS id
      `, { name: provenanceName });
      provenanceId = result.records[0].get('id');
    } finally { await provenance.close(); }
    await login(page, TEST_USERS.ADMIN);
    await page.reload();
    await page.getByTestId('graph-selector').click();
    await expect(page.getByTestId('graph-selector-dropdown').getByText(provenanceName, { exact: true }),
      'the browser GraphQL API and stdio driver must read the same disposable Neo4j').toBeVisible();
    await page.keyboard.press('Escape');

    await client.connect(transport, { timeout: 15000, maxTotalTimeout: 15000 });
    const graphName = `Portable MCP hierarchy ${Date.now()}`;
    const graph = await client.callTool({ name: 'create_graph', arguments: { name: graphName, type: 'SUBGRAPH', isShared: true } }, CallToolResultSchema, callOptions);
    graphId = parse(graph).graph.id;
    const system = 'Sistema internacional de pagos / 国際決済システム';
    const service = 'API de cobros / 決済 API';
    const specs = [
      { title: 'Original architecture source item', type: 'MILESTONE', metadata: { lod: { groupPath: [system] }, source: { kind: 'architecture', key: 'payments-root' } } },
      { title: 'Payment request handler', type: 'FEATURE', metadata: { lod: { groupPath: [system, service] } } },
      { title: 'Fraud scorer / 不正検知', type: 'TASK', metadata: { lod: { groupPath: [system, service, 'Fraud / 不正検知'] } } },
      { title: 'System runbook direct member', type: 'TASK', metadata: { lod: { groupPath: [system] } } },
      { title: 'Disconnected audit archive', type: 'TASK', metadata: { lod: { groupPath: ['Archive / 保管'] } } },
    ];
    const ids: string[] = [];
    for (const spec of specs) {
      const result = await client.callTool({ name: 'create_node', arguments: { ...spec, graph_id: graphId } }, CallToolResultSchema, callOptions);
      expect(result.isError).not.toBe(true);
      ids.push(parse(result).node.id);
    }
    const supporting = await Promise.all(Array.from({ length: 35 }, (_, index) =>
      client.callTool({ name: 'create_node', arguments: { title: `Supporting component ${index}`, type: 'TASK', graph_id: graphId, metadata: { lod: { groupPath: [system, `Support service ${index % 4}`] } } } }, CallToolResultSchema, callOptions)
    ));
    for (const result of supporting) expect(result.isError).not.toBe(true);
    for (const edge of [
      { source_id: ids[0], target_id: ids[1], type: 'DEPENDS_ON' },
      { source_id: ids[0], target_id: ids[1], type: 'RELATES_TO' },
      { source_id: ids[1], target_id: ids[2], type: 'BLOCKS' },
      { source_id: ids[2], target_id: ids[0], type: 'RELATES_TO' },
    ]) {
      const result = await client.callTool({ name: 'create_edge', arguments: edge }, CallToolResultSchema, callOptions);
      expect(result.isError).not.toBe(true);
    }
    const details = await client.callTool({ name: 'get_node_details', arguments: { node_id: ids[0] } }, CallToolResultSchema, callOptions);
    expect(parse(details).node).toMatchObject({ id: ids[0], metadata: { source: { kind: 'architecture', key: 'payments-root' } } });

    const ownerId = await page.evaluate(() => JSON.parse(localStorage.getItem('currentUser') || sessionStorage.getItem('currentUser') || 'null').id);
    const ownership = driver.session();
    try {
      await ownership.run('MATCH (g:Graph {id:$graphId}) SET g.createdBy=$ownerId', { graphId, ownerId });
    } finally { await ownership.close(); }
    await page.evaluate(id => { localStorage.setItem('currentGraphId', id);localStorage.setItem('graphdone:viewMode', 'graph'); }, graphId);
    await page.reload();
    await page.getByTestId('graph-selector').click();
    await page.getByTestId('graph-selector-dropdown').getByText(graphName, { exact: true }).click();
    const overview = page.locator('.semantic-overview');
    await expect(overview.getByRole('button', { name: /groups · 40 items/ })).toBeVisible({ timeout: 30000 });
    await overview.getByRole('combobox', { name: 'Graph detail' }).selectOption('overview');
    await expect(overview).toHaveAttribute('data-active', 'true');
    await expect(overview).toHaveAttribute('data-internal-relationships', '4');
    await overview.getByRole('button', { name: /groups · 40 items/ }).click();
    const groups = page.getByRole('region', { name: 'Graph groups' });
    await expect(groups.getByRole('button', { name: new RegExp(system) })).toBeVisible();
    await expect(groups.getByRole('button', { name: /Archive \/ 保管/ })).toBeVisible();
    await groups.getByRole('button', { name: new RegExp(system) }).click();
    let members = page.getByRole('region', { name: `${system} members` });
    await members.getByRole('button', { name: /Show 5 subgroups/ }).click();
    await overview.getByRole('button', { name: /groups · 40 items/ }).click();
    await expect(groups.getByRole('button', { name: new RegExp(`${system} / ${service}`) })).toBeVisible();
    await groups.getByRole('button', { name: new RegExp(`${system} / ${service}`) }).click();
    members = page.getByRole('region', { name: `${service} members` });
    await members.getByRole('button', { name: 'Show 1 subgroups' }).click();
    await overview.getByRole('button', { name: /groups · 40 items/ }).click();
    await expect(groups.getByRole('button', { name: new RegExp(`${system} / ${service} / Fraud / 不正検知`) })).toBeVisible();
    await groups.getByRole('button', { name: new RegExp(`${system} / Direct items`) }).click();
    members = page.getByRole('region', { name: `${system} · direct items members` });
    await members.getByRole('textbox', { name: 'Find an item' }).fill(ids[0]);
    await members.getByRole('button', { name: /Original architecture source item MILESTONE/ }).click();
    await expect(page.getByTestId('node-inspector')).toContainText('Original architecture source item');
  } finally {
    await client.close().catch(() => {});
    await transport.close().catch(() => {});
    if (provenanceId) {
      const session = driver.session();
      try { await session.run('MATCH (g:Graph {id:$provenanceId}) DETACH DELETE g', { provenanceId }); }
      finally { await session.close(); }
    }
    if (graphId) {
      const session = driver.session();
      try {
        await session.run('MATCH (g:Graph {id:$graphId})<-[:BELONGS_TO]-(w:WorkItem)<-[:EDGE_SOURCE|EDGE_TARGET]-(e:Edge) DETACH DELETE e', { graphId });
        await session.run('MATCH (g:Graph {id:$graphId})<-[:BELONGS_TO]-(w:WorkItem) DETACH DELETE w', { graphId });
        await session.run('MATCH (g:Graph {id:$graphId}) DETACH DELETE g', { graphId });
      } finally { await session.close(); }
    }
    await driver.close();
  }
});
