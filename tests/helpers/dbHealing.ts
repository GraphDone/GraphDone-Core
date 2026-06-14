import neo4j, { Driver } from 'neo4j-driver';

/**
 * Self-healing for the dev Neo4j so test runs never leave the database dirty —
 * even when a run is killed mid-flight (timeout, Ctrl-C) and its per-test
 * cleanup never executes.
 *
 * Heavy suites (scale-sweep, visual-vlm) call sweepTestData() in beforeAll
 * (heal leftovers from a previous interrupted run) AND afterAll (clean up this
 * run). It removes:
 *   - graphs whose name carries the test sentinel (or a legacy test prefix),
 *     with their WorkItems and Edge nodes,
 *   - orphan WorkItems (no BELONGS_TO) — what a half-finished delete leaves,
 *   - orphan Edge nodes (missing a source or target) — these 500 the edges
 *     query, the original data-integrity incident.
 *
 * It NEVER touches seed/demo graphs (Welcome, Cycle 2, Aquarium, …) — only
 * sentinel/test-named graphs and true orphans. Fully graceful: if Neo4j is
 * unreachable it logs and returns zeros rather than failing the run.
 */

/** Every test-seeded graph name starts with this so the sweep can find them
 * unambiguously without ever matching a real graph. */
export const TEST_GRAPH_PREFIX = '[E2E]';

// Legacy/explicit test-name patterns (graphs created before the sentinel, or by
// ad-hoc probes). Anchored so they can't match real graphs.
const LEGACY_TEST_NAME_REGEX =
  '^(\\[E2E\\]|Scale |VLM |Clone|Parity|PathP|NodeAttach|Contract|CloneFix|CloneProbe|Pop|TP |Empty Smoke|Living E2E|ParityV|Smoke ).*';

const URI = process.env.NEO4J_URI || 'bolt://localhost:7687';
const USER = process.env.NEO4J_USER || 'neo4j';
const PASS = process.env.NEO4J_PASSWORD || 'graphdone_password';

export interface SweepResult {
  testGraphs: number;
  testGraphNodes: number;
  orphanNodes: number;
  orphanEdges: number;
  ok: boolean;
}

async function deleteInBatches(session: any, matchDelete: string): Promise<number> {
  // matchDelete must be a query of shape: MATCH ... WITH x LIMIT 5000 DETACH DELETE x RETURN count(x) AS c
  let total = 0;
  for (;;) {
    const r = await session.run(matchDelete);
    const c = r.records[0]?.get('c')?.toNumber?.() ?? 0;
    total += c;
    if (c === 0) break;
  }
  return total;
}

export async function sweepTestData(label = ''): Promise<SweepResult> {
  const result: SweepResult = { testGraphs: 0, testGraphNodes: 0, orphanNodes: 0, orphanEdges: 0, ok: false };
  let driver: Driver | undefined;
  try {
    driver = neo4j.driver(URI, neo4j.auth.basic(USER, PASS));
    await driver.verifyConnectivity();
    const session = driver.session();
    try {
      // 1) WorkItems + Edge nodes that belong to test-named graphs.
      result.testGraphNodes = await deleteInBatches(
        session,
        `MATCH (g:Graph) WHERE g.name =~ '${LEGACY_TEST_NAME_REGEX}'
         MATCH (g)<-[:BELONGS_TO]-(w:WorkItem)
         OPTIONAL MATCH (w)<-[:EDGE_SOURCE|EDGE_TARGET]-(e:Edge)
         WITH w, e LIMIT 5000 DETACH DELETE e, w RETURN count(w) AS c`
      );
      // 2) The test-named graphs themselves.
      const g = await session.run(
        `MATCH (g:Graph) WHERE g.name =~ '${LEGACY_TEST_NAME_REGEX}' DETACH DELETE g RETURN count(g) AS c`
      );
      result.testGraphs = g.records[0]?.get('c')?.toNumber?.() ?? 0;
      // 3) Orphan WorkItems (belong to no graph) — what a killed delete leaves.
      result.orphanNodes = await deleteInBatches(
        session,
        `MATCH (w:WorkItem) WHERE NOT (w)-[:BELONGS_TO]->(:Graph) WITH w LIMIT 5000 DETACH DELETE w RETURN count(w) AS c`
      );
      // 4) Orphan Edge nodes (missing a source or target) — these break the
      //    edges query for everyone.
      result.orphanEdges = await deleteInBatches(
        session,
        `MATCH (e:Edge) WHERE NOT (e)-[:EDGE_SOURCE]->(:WorkItem) OR NOT (e)-[:EDGE_TARGET]->(:WorkItem) WITH e LIMIT 5000 DETACH DELETE e RETURN count(e) AS c`
      );
      result.ok = true;
      const touched = result.testGraphs + result.testGraphNodes + result.orphanNodes + result.orphanEdges;
      if (touched > 0) {
        // eslint-disable-next-line no-console
        console.log(
          `[db-heal${label ? ' ' + label : ''}] swept ${result.testGraphs} test graphs, ${result.testGraphNodes} their nodes, ${result.orphanNodes} orphan nodes, ${result.orphanEdges} orphan edges`
        );
      }
    } finally {
      await session.close();
    }
  } catch (err) {
    // Graceful: never fail the test run because healing couldn't connect.
    // eslint-disable-next-line no-console
    console.warn(`[db-heal] skipped (${err instanceof Error ? err.message.split('\n')[0] : String(err)})`);
  } finally {
    await driver?.close();
  }
  return result;
}
