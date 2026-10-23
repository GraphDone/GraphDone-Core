import { test as base, expect } from '@playwright/test';
import { login, TEST_USERS } from '../lib/auth';
import { gql } from '../lib/graphRequest';
import { requirePerfMetrics, requireWorkItemSample, sampleP95 } from '../lib/perf/budget-evidence.mjs';
import { cleanupPerfGraph } from '../lib/perf/fixture-cleanup.mjs';

const SETTLE_MS = 12_000;
const REST_ALPHA = 0.02;
const SNAPSHOT_DRIFT_PX = 25;
const TICK_BUDGET_MS = 8;
const WORK_ITEMS_P95_MS = 800;
const SAMPLE_COUNT = 20;
const WORK_ITEMS_QUERY = 'query PerfWorkItems($id:ID!){workItems(where:{graph:{id:$id}},options:{limit:50}){id title status type}}';
const POSITIONS_QUERY = 'query PerfPositions($id:ID!){workItems(where:{graph:{id:$id}}){id positionX positionY positionZ}}';
const NODE_INPUTS = [
  { title: 'Budget first task', positionX: 200, positionY: 200 },
  { title: 'Budget second task', positionX: 500, positionY: 200 },
  { title: 'Budget third task', positionX: 200, positionY: 500 },
  { title: 'Budget fourth task', positionX: 500, positionY: 500 },
].map(node => ({ ...node, positionZ: 0, type: 'TASK', status: 'PLANNED' }));

type WorkItem = { id: string; title: string; status: string; type: string };
type Position = { id: string; positionX: number; positionY: number; positionZ: number };
type PerfGraph = { id: string; items: WorkItem[]; positions: Position[]; edgeCount: number };
const byId = <T extends { id: string }>(items: T[]) => [...items].sort((a, b) => a.id.localeCompare(b.id));

const test = base.extend<{ perfGraph: PerfGraph }>({
  perfGraph: async ({ page }, use) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() => localStorage.setItem('graphdone.quality.override', 'ULTRA'));
    await login(page, TEST_USERS.ADMIN);
    const owner = (await gql(page, '{me{id}}')).me.id;
    const id = (await gql(page,
      'mutation($input:[GraphCreateInput!]!){createGraphs(input:$input){graphs{id}}}',
      { input: [{ name: `Performance budget ${Date.now()}`, type: 'PROJECT', status: 'ACTIVE', createdBy: owner }] },
    )).createGraphs.graphs[0].id;
    let nodeCount = 0;
    let edgeCount = 0;
    try {
      const created = (await gql(page,
        'mutation($input:[WorkItemCreateInput!]!){createWorkItems(input:$input){workItems{id title status type positionX positionY positionZ}}}',
        { input: NODE_INPUTS.map(node => ({ ...node, graph: { connect: { where: { node: { id } } } } })) },
      )).createWorkItems.workItems;
      nodeCount = created.length;
      expect(nodeCount).toBe(NODE_INPUTS.length);
      const items: WorkItem[] = [];
      const positions: Position[] = [];
      for (const input of NODE_INPUTS) {
        const node = created.find((candidate: WorkItem) => candidate.title === input.title);
        expect(node).toMatchObject(input);
        items.push({ id: node.id, title: input.title, status: input.status, type: input.type });
        positions.push({ id: node.id, positionX: input.positionX, positionY: input.positionY, positionZ: input.positionZ });
      }
      const edges = (await gql(page,
        'mutation($input:[EdgeCreateInput!]!){createEdges(input:$input){edges{id}}}',
        { input: items.slice(1).map((node, index) => ({ type: 'DEPENDS_ON', weight: 1,
          source: { connect: { where: { node: { id: items[index].id } } } },
          target: { connect: { where: { node: { id: node.id } } } },
        })) },
      )).createEdges.edges;
      edgeCount = edges.length;
      expect(edgeCount).toBe(NODE_INPUTS.length - 1);
      await page.evaluate(graphId => {
        localStorage.setItem('currentGraphId', graphId);
        localStorage.setItem('graphdone:viewMode', 'graph');
      }, id);
      await page.goto('/');
      await expect(page.locator('.graph-container .node')).toHaveCount(items.length);
      await expect(page.locator('.graph-container .edge')).toHaveCount(edgeCount);
      expect(await page.locator('.graph-container .node').evaluateAll(nodes => nodes.map(node => (node as any).__data__.id).sort()))
        .toEqual(items.map(node => node.id).sort());
      expect(byId((await gql(page, POSITIONS_QUERY, { id })).workItems)).toEqual(byId(positions));
      await use({ id, items, positions, edgeCount });
    } finally {
      await cleanupPerfGraph({ id, nodeCount, edgeCount }, (query: string, variables: unknown) => gql(page, query, variables));
    }
  },
});

test.describe('performance budgets @perf', () => {
  test.setTimeout(60_000);

  test('graph settles to rest within budget and tick stays cheap', async ({ page, perfGraph }, info) => {
    let metrics: any;
    await expect(async () => {
      metrics = requirePerfMetrics(await page.evaluate(() => (window as any).__graphPerf),
        { graphId: perfGraph.id, nodes: perfGraph.items.length, edges: perfGraph.edgeCount });
      expect(metrics.alpha, `graph must reach rest within ${SETTLE_MS}ms`).toBeLessThanOrEqual(REST_ALPHA);
    }).toPass({ timeout: SETTLE_MS, intervals: [100, 250, 500] });
    expect(metrics.avgTickMs, `average measured tick must stay under ${TICK_BUDGET_MS}ms`).toBeLessThanOrEqual(TICK_BUDGET_MS);
    await info.attach('settled-perf.json', { body: JSON.stringify(metrics, null, 2), contentType: 'application/json' });
  });

  test('a settled placed graph sits on its saved snapshot (no drift)', async ({ page, perfGraph }, info) => {
    await page.waitForTimeout(6000);
    const metrics = requirePerfMetrics(await page.evaluate(() => (window as any).__graphPerf),
      { graphId: perfGraph.id, nodes: perfGraph.items.length, edges: perfGraph.edgeCount });
    expect(metrics.alpha).toBeLessThanOrEqual(REST_ALPHA);
    expect(metrics.spatial.rmsFromSavedPx, 'measured saved-snapshot drift').toBeLessThanOrEqual(SNAPSHOT_DRIFT_PX);
    const rendered = await page.locator('.graph-container .node').evaluateAll(nodes => nodes.map(node => {
      const data = (node as any).__data__;
      return { id: data.id, x: data.x, y: data.y };
    }));
    expect(rendered).toHaveLength(perfGraph.positions.length);
    for (const saved of perfGraph.positions) {
      const actual = rendered.find(node => node.id === saved.id)!;
      expect(Number.isFinite(actual?.x) && Number.isFinite(actual?.y), 'every saved node has a rendered world position').toBe(true);
      expect(Math.hypot(actual.x - saved.positionX, actual.y - saved.positionY), `saved position for ${saved.id}`).toBeLessThanOrEqual(SNAPSHOT_DRIFT_PX);
    }
    expect(byId((await gql(page, POSITIONS_QUERY, { id: perfGraph.id })).workItems)).toEqual(byId(perfGraph.positions));
    await info.attach('saved-snapshot.json', { body: JSON.stringify({ metrics, rendered, saved: perfGraph.positions }, null, 2), contentType: 'application/json' });
  });

  test('owned workItems query p95 latency is within budget', async ({ page, perfGraph }, info) => {
    const times: number[] = [];
    for (let sampleIndex = 0; sampleIndex < SAMPLE_COUNT; sampleIndex++) {
      const sample = await page.evaluate(async ({ query, id }) => {
        const start = performance.now();
        const response = await fetch('/api/graphql', {
          method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('authToken') || ''}` },
          body: JSON.stringify({ query, variables: { id } }),
        });
        const body = await response.json();
        return { status: response.status, body, durationMs: performance.now() - start };
      }, { query: WORK_ITEMS_QUERY, id: perfGraph.id });
      times.push(requireWorkItemSample(sample, perfGraph.items));
    }
    const p95 = sampleP95(times, SAMPLE_COUNT);
    await info.attach('work-items-latency.json', { body: JSON.stringify({ operation: 'PerfWorkItems', times, p95 }, null, 2), contentType: 'application/json' });
    expect(p95, `owned workItems query p95 must stay under ${WORK_ITEMS_P95_MS}ms`).toBeLessThanOrEqual(WORK_ITEMS_P95_MS);
  });
});
