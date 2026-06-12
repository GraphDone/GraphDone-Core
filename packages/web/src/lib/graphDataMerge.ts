/**
 * Identity-preserving merges between freshly-fetched graph data and the live
 * D3 simulation.
 *
 * Why this exists: the graph polls the API frequently. Swapping new object
 * arrays into simulation.nodes()/links() while the DOM stays data-bound to
 * the old objects splits the world in two — physics moves objects the DOM
 * can't see, positions reset (x/y/vx/vy lived on the discarded objects), and
 * edges visibly detach from their nodes. The merge keeps ONE set of objects
 * alive forever: incoming data mutates them in place, physics state is never
 * touched, and DOM bindings stay valid across every poll.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

const PHYSICS_KEYS = new Set(['x', 'y', 'vx', 'vy', 'fx', 'fy', 'index']);
/** Internal D3/runtime fields that must never be diffed or copied. */
const SKIP_KEYS = new Set([...PHYSICS_KEYS, 'positionX', 'positionY', 'positionZ', '__typename']);

export interface NodeMergeResult<N extends { id: string }> {
  nodes: N[];
  addedIds: string[];
  removedIds: string[];
  /** Existing nodes whose visible properties changed this merge. */
  changedIds: string[];
}

export function mergeSimulationNodes<N extends { id: string }>(
  simNodes: N[],
  incoming: Array<Record<string, any> & { id: string }>
): NodeMergeResult<N> {
  const simById = new Map(simNodes.map((n) => [n.id, n]));
  const incomingIds = new Set(incoming.map((n) => n.id));

  const addedIds: string[] = [];
  const changedIds: string[] = [];
  const nodes: N[] = [];

  for (const fresh of incoming) {
    const existing = simById.get(fresh.id);
    if (existing) {
      let changed = false;
      for (const [key, value] of Object.entries(fresh)) {
        if (SKIP_KEYS.has(key)) continue;
        if ((existing as any)[key] !== value) {
          (existing as any)[key] = value;
          changed = true;
        }
      }
      if (changed) changedIds.push(existing.id);
      nodes.push(existing);
    } else {
      const node: any = {};
      for (const [key, value] of Object.entries(fresh)) {
        if (PHYSICS_KEYS.has(key)) continue;
        node[key] = value;
      }
      if (typeof fresh.positionX === 'number') node.x = fresh.positionX;
      if (typeof fresh.positionY === 'number') node.y = fresh.positionY;
      addedIds.push(node.id);
      nodes.push(node as N);
    }
  }

  const removedIds = simNodes.filter((n) => !incomingIds.has(n.id)).map((n) => n.id);
  return { nodes, addedIds, removedIds, changedIds };
}

export interface EdgeMergeResult<E extends { id: string }> {
  edges: E[];
  addedIds: string[];
  removedIds: string[];
  /** Incoming edges discarded because an endpoint node doesn't exist. */
  droppedIds: string[];
}

const endpointId = (endpoint: any): string =>
  typeof endpoint === 'string' ? endpoint : endpoint?.id;

export function mergeSimulationEdges<E extends { id: string; source: any; target: any }>(
  simEdges: E[],
  incoming: Array<Record<string, any> & { id: string; source: any; target: any }>,
  liveNodes: Array<{ id: string }>
): EdgeMergeResult<E> {
  const nodeById = new Map(liveNodes.map((n) => [n.id, n]));
  const simById = new Map(simEdges.map((e) => [e.id, e]));
  const incomingIds = new Set(incoming.map((e) => e.id));

  const addedIds: string[] = [];
  const droppedIds: string[] = [];
  const edges: E[] = [];

  for (const fresh of incoming) {
    const sourceNode = nodeById.get(endpointId(fresh.source));
    const targetNode = nodeById.get(endpointId(fresh.target));
    if (!sourceNode || !targetNode) {
      droppedIds.push(fresh.id);
      continue;
    }

    const existing = simById.get(fresh.id);
    if (existing) {
      for (const [key, value] of Object.entries(fresh)) {
        if (key === 'source' || key === 'target' || key === '__typename') continue;
        (existing as any)[key] = value;
      }
      existing.source = sourceNode;
      existing.target = targetNode;
      edges.push(existing);
    } else {
      const edge: any = { ...fresh, source: sourceNode, target: targetNode };
      delete edge.__typename;
      addedIds.push(edge.id);
      edges.push(edge as E);
    }
  }

  const removedIds = simEdges.filter((e) => !incomingIds.has(e.id)).map((e) => e.id);
  return { edges, addedIds, removedIds, droppedIds };
}
