import { expect, Page } from '@playwright/test';
import { TEST_GRAPH_PREFIX } from './dbHealing';

/**
 * Seeds realistically-shaped graphs of arbitrary size through the real GraphQL
 * API (the same path a human or AI uses), so the perf sweep measures the true
 * stack — Neo4j + Apollo + the web force simulation — not a synthetic shortcut.
 *
 * Nodes are spread on a grid (real positions, not all stacked at the origin),
 * statuses/types/priorities are varied so living-graph effects and priority
 * glow actually exercise, and edges form a connected backbone plus extra links
 * to hit a target edge:node ratio. Edges are created as Edge nodes (the
 * canonical model the web renders). Everything batches to stay within request
 * limits, and cleanup deletes edges before nodes (orphan edges break the whole
 * edges query).
 */

/**
 * A first sign-in makes the app build the user's Welcome graph in the
 * background (GraphContext: graph, items, edges, then the counts) when the user
 * can see no graphs at all, own or shared. Seeding at the same time made both
 * writes take ~19 s on a cold CI database (UI Fit, run 42750745652), so wait
 * until that work is done: the user can see a graph, and any Welcome graph of
 * theirs has its counts, which the app writes last. Returns at once when the
 * user could already see graphs. A failed read is retried, not fatal.
 */
export async function waitForStarterGraph(page: Page, timeoutMs = 60_000) {
  const me = await gql<{ me: { id: string } }>(page, '{ me { id } }');
  let last = 'no answer yet';
  const done = expect
    .poll(
      async () => {
        try {
          const { own, shared } = await gql<{ own: { name: string; nodeCount: number | null }[]; shared: { id: string }[] }>(
            page,
            'query($id: String!) { own: graphs(where: { createdBy: $id }) { name nodeCount } shared: graphs(where: { isShared: true }) { id } }',
            { id: me.me.id }
          );
          const unfinished = own.filter(g => g.name === 'Welcome' && !(g.nodeCount ?? 0));
          last = `${own.length} own and ${shared.length} shared graphs; ${unfinished.length} Welcome graph(s) still at 0 items`;
          return own.length + shared.length > 0 && unfinished.length === 0;
        } catch (error) {
          last = `read failed: ${(error as Error).message}`;
          return false;
        }
      },
      { timeout: timeoutMs }
    )
    .toBe(true);
  // The message is built after the wait, so it reports the final state.
  await done.catch(() => {
    throw new Error(`The app did not finish creating the Welcome graph within ${timeoutMs / 1000} s of the first sign-in (last check: ${last})`);
  });
}

export interface SeededGraph {
  graphId: string;
  nodeIds: string[];
  edgeCount: number;
}

async function gql<T = any>(page: Page, query: string, variables?: unknown): Promise<T> {
  return page.evaluate(
    async ({ query, variables }) => {
      const token = localStorage.getItem('authToken') ?? '';
      const res = await fetch('/api/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ query, variables }),
      });
      const body = await res.json();
      if (body.errors) throw new Error(body.errors[0]?.message ?? 'GraphQL error');
      return body.data;
    },
    { query, variables }
  );
}

const STATUSES = ['PROPOSED', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED'] as const;
const TYPES = ['TASK', 'BUG', 'FEATURE', 'MILESTONE', 'OUTCOME'] as const;
const EDGE_TYPES = ['DEPENDS_ON', 'BLOCKS', 'RELATES_TO'] as const;

function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

export interface SeedOptions {
  size: number;
  /** edges ≈ edgeFactor * size (default 1.4). */
  edgeFactor?: number;
  /** grid spacing in px (default 130). */
  spacing?: number;
  namePrefix?: string;
  metadataForIndex?: (index: number) => Record<string, unknown>;
  titleForIndex?: (index: number, type: string) => string;
  additionalEdges?: ReadonlyArray<{ sourceIndex: number; targetIndex: number; type: string }>;
  /** Smaller repeated mutation shapes avoid Neo4j planning hundreds of creates. */
  batchSize?: number;
  /** Register ownership before node/edge setup, so partial setup can be cleaned. */
  onGraphCreated?: (graphId: string) => void;
  /** Stop future writes, while draining an in-flight create for its owned ID. */
  signal?: AbortSignal;
}

export async function seedLargeGraph(page: Page, opts: SeedOptions): Promise<SeededGraph> {
  const { size, edgeFactor = 1.4, spacing = 130, namePrefix = 'Scale' } = opts;
  for (const edge of opts.additionalEdges ?? []) {
    if ([edge.sourceIndex, edge.targetIndex].some(index => !Number.isInteger(index) || index < 0 || index >= size))
      throw new Error('Additional fixture edge endpoint is outside the requested graph');
  }
  opts.signal?.throwIfAborted();
  const me = await gql(page, '{ me { id } }');
  const userId = me.me.id;

  opts.signal?.throwIfAborted();
  const g = await gql(
    page,
    `mutation($input: [GraphCreateInput!]!) { createGraphs(input: $input) { graphs { id } } }`,
    { input: [{ name: `${TEST_GRAPH_PREFIX} ${namePrefix} ${size}n ${Date.now()}`, type: 'PROJECT', status: 'ACTIVE', createdBy: userId, isShared: true }] }
  );
  const graphId = g.createGraphs.graphs[0].id as string;
  opts.onGraphCreated?.(graphId);

  // Grid layout centered on the origin so the sim starts from a real arrangement.
  const cols = Math.ceil(Math.sqrt(size));
  const half = (cols * spacing) / 2;
  const nodeInputs = Array.from({ length: size }, (_, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    // Deterministic pseudo-variety without Math.random (kept reproducible).
    const status = STATUSES[i % STATUSES.length];
    const type = TYPES[(i * 7) % TYPES.length];
    const priority = ((i * 37) % 100) / 100;
    return {
      type,
      title: opts.titleForIndex?.(i, type) ?? `${type} ${i}`,
      status,
      priority,
      positionX: col * spacing - half,
      positionY: row * spacing - half,
      positionZ: 0,
      ...(opts.metadataForIndex ? { metadata: JSON.stringify(opts.metadataForIndex(i)) } : {}),
      owner: { connect: { where: { node: { id: userId } } } },
      graph: { connect: { where: { node: { id: graphId } } } },
    };
  });

  const nodeIds: string[] = [];
  for (const batch of chunk(nodeInputs, opts.batchSize ?? 100)) {
    opts.signal?.throwIfAborted();
    const res = await gql(
      page,
      `mutation($input: [WorkItemCreateInput!]!) { createWorkItems(input: $input) { workItems { id } } }`,
      { input: batch }
    );
    for (const w of res.createWorkItems.workItems) nodeIds.push(w.id);
  }

  // Backbone chain guarantees connectivity; extra forward links add realism.
  const targetEdges = Math.round(size * edgeFactor);
  const edgeInputs: Array<Record<string, unknown>> = [];
  const link = (a: string, b: string, t: string) =>
    edgeInputs.push({
      type: t,
      weight: 0.5 + ((edgeInputs.length % 5) / 10),
      source: { connect: { where: { node: { id: a } } } },
      target: { connect: { where: { node: { id: b } } } },
    });
  for (let i = 0; i + 1 < nodeIds.length; i++) link(nodeIds[i], nodeIds[i + 1], 'DEPENDS_ON');
  let extra = targetEdges - edgeInputs.length;
  for (let i = 0; i < nodeIds.length && extra > 0; i++) {
    const jump = 2 + ((i * 5) % Math.max(2, Math.floor(nodeIds.length / 4)));
    const j = i + jump;
    if (j < nodeIds.length) {
      link(nodeIds[i], nodeIds[j], EDGE_TYPES[i % EDGE_TYPES.length]);
      extra--;
    }
  }

  let edgeCount = 0;
  for (const edge of opts.additionalEdges ?? []) link(nodeIds[edge.sourceIndex], nodeIds[edge.targetIndex], edge.type);
  for (const batch of chunk(edgeInputs, opts.batchSize ?? 100)) {
    opts.signal?.throwIfAborted();
    const res = await gql(
      page,
      `mutation($input: [EdgeCreateInput!]!) { createEdges(input: $input) { edges { id } } }`,
      { input: batch }
    );
    if (res.createEdges.edges.length !== batch.length) throw new Error(`Fixture edge batch returned ${res.createEdges.edges.length} edges; expected ${batch.length}`);
    edgeCount += res.createEdges.edges.length;
  }

  return { graphId, nodeIds, edgeCount };
}

export async function deleteGraphDeep(page: Page, graphId: string, options: { strict?: boolean } = {}): Promise<void> {
  const handleFailure = (error: unknown) => { if (options.strict) throw error; };
  // Edges first (orphan edges break the edges query), then nodes, then graph.
  await gql(
    page,
    `mutation($id: ID!) { deleteEdges(where: { source: { graph: { id: $id } } }) { nodesDeleted } }`,
    { id: graphId }
  ).catch(handleFailure);
  await gql(
    page,
    `mutation($id: ID!) { deleteWorkItems(where: { graph: { id: $id } }) { nodesDeleted } }`,
    { id: graphId }
  ).catch(handleFailure);
  await gql(page, `mutation($id: ID!) { deleteGraphs(where: { id: $id }) { nodesDeleted } }`, { id: graphId }).catch(handleFailure);
}
