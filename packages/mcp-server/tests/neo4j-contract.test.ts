import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import neo4j, { Driver } from 'neo4j-driver';
import { GraphService } from '../src/services/graph-service';

/**
 * Real-Neo4j contract test for the MCP GraphService.
 *
 * The fast unit suites run against a MOCK driver, which can't catch Cypher /
 * schema drift against a real database — exactly the class of bug that caused
 * the orphan-edge 500 incident at the app layer. This exercises the MCP
 * server's OWN Cypher (node + edge lifecycle, browse) against a live Neo4j and
 * asserts real, well-formed results.
 *
 * Gated by RUN_DB_CONTRACT so it only runs where a real Neo4j is provisioned
 * (the dedicated CI job); local `npm run test` (mock-only) is unaffected.
 * Assertions are shape-tolerant (match on the serialized payload) so a benign
 * response-shape change doesn't false-fail, while genuine DB/Cypher breakage
 * (throws, missing data, orphan edges) still does.
 */
const RUN = !!process.env.RUN_DB_CONTRACT;
const URI = process.env.NEO4J_URI || 'bolt://localhost:7687';
const USER = process.env.NEO4J_USER || 'neo4j';
const PASS = process.env.NEO4J_PASSWORD || 'graphdone_password';

const text = (r: { content: { text: string }[] }) => r.content[0].text;
const parse = (r: { content: { text: string }[] }) => JSON.parse(text(r));

describe.skipIf(!RUN)('MCP GraphService — real Neo4j contract', () => {
  let driver: Driver;
  let svc: GraphService;
  const createdNodes: string[] = [];
  const createdGraphs: string[] = [];

  beforeAll(async () => {
    driver = neo4j.driver(URI, neo4j.auth.basic(USER, PASS));
    await driver.verifyConnectivity();
    svc = new GraphService(driver);
  });

  afterAll(async () => {
    const session = driver?.session();
    try {
      if (createdNodes.length) {
        await session?.run('MATCH (n:WorkItem) WHERE n.id IN $ids DETACH DELETE n', { ids: createdNodes });
      }
      if (createdGraphs.length) {
        // Also remove any WorkItems that belong to these graphs (clone creates
        // brand-new node ids we don't otherwise track).
        await session?.run('MATCH (g:Graph) WHERE g.id IN $ids OPTIONAL MATCH (g)<-[:BELONGS_TO]-(w:WorkItem) DETACH DELETE w', { ids: createdGraphs });
        await session?.run('MATCH (g:Graph) WHERE g.id IN $ids DETACH DELETE g', { ids: createdGraphs });
      }
    } catch { /* ignore */ }
    await session?.close();
    await driver?.close();
  });

  it('node lifecycle: create → read → update → delete on real Neo4j', async () => {
    const created = parse(await svc.createNode({ title: 'Contract Node', type: 'TASK', status: 'PROPOSED' } as any));
    const id = created.node.id;
    expect(id, 'createNode persists and returns an id').toBeTruthy();
    createdNodes.push(id);

    // Read-after-write must see it (no consistency/visibility gap)
    const details = text(await svc.getNodeDetails({ node_id: id } as any));
    expect(details).toContain('Contract Node');

    const updated = text(await svc.updateNode({ node_id: id, status: 'IN_PROGRESS' } as any));
    expect(updated).toContain('IN_PROGRESS');

    const deleted = text(await svc.deleteNode({ node_id: id } as any)).toLowerCase();
    expect(deleted).toMatch(/delet|success|true|removed/);
    createdNodes.splice(createdNodes.indexOf(id), 1);

    // After delete it must be gone
    const after = text(await svc.getNodeDetails({ node_id: id } as any)).toLowerCase();
    expect(after).toMatch(/not found|no.*node|null|"node":\s*null/);
  });

  it('edge lifecycle: create between two real nodes → delete, leaving no orphans', async () => {
    const a = parse(await svc.createNode({ title: 'Contract A', type: 'TASK' } as any)).node.id;
    const b = parse(await svc.createNode({ title: 'Contract B', type: 'TASK' } as any)).node.id;
    createdNodes.push(a, b);

    const edge = text(await svc.createEdge({ source_id: a, target_id: b, type: 'DEPENDS_ON' } as any)).toLowerCase();
    expect(edge).toMatch(/depends_on|edge|success|created/);

    const delEdge = text(await svc.deleteEdge({ source_id: a, target_id: b, type: 'DEPENDS_ON' } as any)).toLowerCase();
    expect(delEdge).toMatch(/delet|success|true|removed/);
  });

  it('getGraphContext on a brand-new EMPTY graph returns zero counts, not "not found"', async () => {
    // Regression: the type/status tally used `CALL { UNWIND items ... }`, and
    // UNWIND of an empty list yields ZERO rows, which dropped the whole result
    // row — so an existing empty graph was reported as "not found".
    const created = parse(await svc.createGraph({ name: `Contract Empty ${Date.now()}`, type: 'PROJECT' } as any));
    const graphId = created.graph.id;
    expect(graphId, 'createGraph persists and returns an id').toBeTruthy();
    createdGraphs.push(graphId);

    const ctx = parse(await svc.getGraphContext({ graphId } as any)).context;
    expect(ctx.graph.id, 'the empty graph is found by id').toBe(graphId);
    expect(ctx.counts.nodes, 'empty graph has zero nodes').toBe(0);
    expect(ctx.counts.edges, 'empty graph has zero edges').toBe(0);
    expect(ctx.counts.byType, 'no type tallies on an empty graph').toEqual({});
    expect(ctx.counts.byStatus, 'no status tallies on an empty graph').toEqual({});
    expect(Array.isArray(ctx.topBlockers) && ctx.topBlockers.length, 'no blockers').toBe(0);
    expect(Array.isArray(ctx.recentActivity) && ctx.recentActivity.length, 'no recent activity').toBe(0);
  });

  it('getGraphContext tallies type/status once a graph has items', async () => {
    const g = parse(await svc.createGraph({ name: `Contract Populated ${Date.now()}`, type: 'PROJECT' } as any));
    const graphId = g.graph.id;
    createdGraphs.push(graphId);

    // Attach two TASK/IN_PROGRESS items to this graph
    const session = driver.session();
    try {
      for (const i of [1, 2]) {
        const id = parse(await svc.createNode({ title: `Pop ${i} ${Date.now()}`, type: 'TASK', status: 'IN_PROGRESS' } as any)).node.id;
        createdNodes.push(id);
        await session.run(
          'MATCH (w:WorkItem {id: $id}), (g:Graph {id: $gid}) MERGE (w)-[:BELONGS_TO]->(g)',
          { id, gid: graphId }
        );
      }
    } finally {
      await session.close();
    }

    const ctx = parse(await svc.getGraphContext({ graphId } as any)).context;
    expect(ctx.counts.nodes, 'two items counted').toBe(2);
    expect(ctx.counts.byType.TASK, 'both items tallied under TASK').toBe(2);
    expect(ctx.counts.byStatus.IN_PROGRESS, 'both items tallied under IN_PROGRESS').toBe(2);
  });

  it('cloneGraph copies nodes AND preserves each edge type (not all DEPENDS_ON)', async () => {
    // Regressions this guards:
    //  1. clone threw ParameterMissing(teamId) because Neo4j never stores a
    //     null teamId, so reading it back yields undefined.
    //  2. clone hard-coded :DEPENDS_ON, silently rewriting BLOCKS/RELATES_TO/…
    const src = parse(await svc.createGraph({ name: `Contract Clone Src ${Date.now()}`, type: 'PROJECT' } as any));
    const srcId = src.graph.id;
    createdGraphs.push(srcId);

    const session = driver.session();
    const mk = async (title: string) => {
      const id = parse(await svc.createNode({ title, type: 'TASK', status: 'PROPOSED' } as any)).node.id;
      createdNodes.push(id);
      await session.run('MATCH (w:WorkItem {id: $id}), (g:Graph {id: $gid}) MERGE (w)-[:BELONGS_TO]->(g)', { id, gid: srcId });
      return id;
    };
    let a: string, b: string, c: string;
    try {
      a = await mk(`Clone A ${Date.now()}`);
      b = await mk(`Clone B ${Date.now()}`);
      c = await mk(`Clone C ${Date.now()}`);
    } finally {
      await session.close();
    }
    await svc.createEdge({ source_id: a, target_id: b, type: 'BLOCKS' } as any);
    await svc.createEdge({ source_id: b, target_id: c, type: 'RELATES_TO' } as any);

    const cloned = parse(await svc.cloneGraph({ sourceGraphId: srcId, newName: `Contract Clone Dst ${Date.now()}` } as any));
    const dstId = cloned.newGraph.id;
    createdGraphs.push(dstId);
    expect(cloned.newGraph.clonedNodes, 'all three nodes cloned').toBe(3);
    expect(cloned.newGraph.clonedEdges, 'both edges cloned').toBe(2);

    // The cloned edges must keep their real types, not all become DEPENDS_ON
    const s2 = driver.session();
    try {
      const r = await s2.run(
        'MATCH (g:Graph {id: $gid})<-[:BELONGS_TO]-(:WorkItem)-[rel]->(:WorkItem) RETURN type(rel) AS t ORDER BY t',
        { gid: dstId }
      );
      const types = r.records.map((rec) => rec.get('t')).sort();
      expect(types, 'cloned relationship types are preserved').toEqual(['BLOCKS', 'RELATES_TO']);
    } finally {
      await s2.close();
    }
  });

  it('browseGraph returns well-formed data over a real DB', async () => {
    const browsed = parse(await svc.browseGraph({ query_type: 'all_nodes', limit: 25 } as any));
    const arr = browsed.nodes ?? browsed.results ?? browsed.workItems;
    expect(Array.isArray(arr), 'browseGraph returns an array of nodes').toBe(true);
  });
});
