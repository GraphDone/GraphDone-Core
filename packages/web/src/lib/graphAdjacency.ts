/**
 * LIVE-7: hovering a node softly illuminates its 1-hop neighborhood.
 * The adjacency is precomputed once per data change so the hover handler is
 * a Map lookup, never a graph walk — the <16ms budget is structural.
 */

export interface Neighborhood {
  nodes: Set<string>;
  edges: Set<string>;
}

type EdgeLike = {
  id: string;
  source: string | { id: string };
  target: string | { id: string };
};

const idOf = (endpoint: string | { id: string }): string =>
  typeof endpoint === 'string' ? endpoint : endpoint.id;

export function buildNeighborhood(edges: EdgeLike[]): Map<string, Neighborhood> {
  const map = new Map<string, Neighborhood>();
  const entry = (id: string): Neighborhood => {
    let n = map.get(id);
    if (!n) {
      n = { nodes: new Set(), edges: new Set() };
      map.set(id, n);
    }
    return n;
  };

  for (const e of edges) {
    const s = idOf(e.source);
    const t = idOf(e.target);
    const se = entry(s);
    const te = entry(t);
    se.nodes.add(t);
    se.edges.add(e.id);
    te.nodes.add(s);
    te.edges.add(e.id);
  }
  return map;
}
