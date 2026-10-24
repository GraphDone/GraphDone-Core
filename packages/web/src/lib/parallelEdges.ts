/**
 * Parallel-edge grouping (#22): assign each edge an index within its undirected
 * node-pair group plus the group size, so the renderer can offset siblings
 * perpendicular to the edge line (edgeLOD.perpendicularOffset) and keep multiple
 * edges between the same two nodes legible. Pure: no D3/DOM here.
 */

export interface ParallelEdgeInfo {
  index: number;
  total: number;
}

const endpointId = (end: unknown): string => {
  if (end && typeof end === 'object') {
    return String((end as { id?: unknown }).id ?? '');
  }
  return String(end ?? '');
};

/** Stable, order-independent key for the pair of nodes an edge connects. */
export function nodePairKey(source: unknown, target: unknown): string {
  const a = endpointId(source);
  const b = endpointId(target);
  return a < b ? `${a}__${b}` : `${b}__${a}`;
}

/**
 * Map each edge id → its index within its node-pair group and the group total.
 * Edges sharing the same unordered {source,target} pair are siblings; the index
 * is assigned in input order (stable) starting at 0, and `total` is the count of
 * siblings in that pair (1 for a lone edge).
 */
export function assignParallelEdgeIndices(
  edges: Array<{ id: string; source: unknown; target: unknown }>
): Map<string, ParallelEdgeInfo> {
  const groups = new Map<string, string[]>();
  for (const e of edges) {
    const key = nodePairKey(e.source, e.target);
    const list = groups.get(key);
    if (list) {
      list.push(e.id);
    } else {
      groups.set(key, [e.id]);
    }
  }

  const result = new Map<string, ParallelEdgeInfo>();
  for (const ids of groups.values()) {
    const total = ids.length;
    ids.forEach((id, index) => result.set(id, { index, total }));
  }
  return result;
}
