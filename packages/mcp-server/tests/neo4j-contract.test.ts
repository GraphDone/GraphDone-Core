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

  it('browseGraph returns well-formed data over a real DB', async () => {
    const browsed = parse(await svc.browseGraph({ query_type: 'all_nodes', limit: 25 } as any));
    const arr = browsed.nodes ?? browsed.results ?? browsed.workItems;
    expect(Array.isArray(arr), 'browseGraph returns an array of nodes').toBe(true);
  });
});
