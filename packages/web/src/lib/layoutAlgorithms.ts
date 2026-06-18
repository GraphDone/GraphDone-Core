/**
 * Structured layout helpers (#30): pure, dependency-aware node layering for an
 * optional hierarchical arrangement (vs the organic force layout). No D3/DOM —
 * the simulation calls these to seed/pin Y positions by layer.
 */

type NodeLike = { id: string };
type EdgeLike = { source: string | { id: string }; target: string | { id: string }; type?: string };

const idOf = (v: string | { id: string }): string => (typeof v === 'string' ? v : v?.id);

/**
 * Assign each node a layer index by DEPENDS_ON direction: a node that depends on
 * nothing is layer 0; a node is one layer below the deepest thing it depends on
 * (longest dependency path). Non-DEPENDS_ON edges are ignored. Cycle-safe.
 *
 * Edge semantics: `A DEPENDS_ON B` means A needs B first ⇒ B is the prerequisite
 * (higher, smaller layer) and A sits below it.
 */
export function assignLayersByDependencyDirection(nodes: NodeLike[], edges: EdgeLike[]): Map<string, number> {
  const ids = new Set(nodes.map((n) => n.id));
  // deps: node -> the prerequisites it DEPENDS_ON (both endpoints must be real nodes)
  const deps = new Map<string, string[]>();
  for (const n of nodes) deps.set(n.id, []);
  for (const e of edges) {
    if (e.type !== 'DEPENDS_ON') continue;
    const s = idOf(e.source), t = idOf(e.target);
    if (ids.has(s) && ids.has(t)) deps.get(s)!.push(t);
  }

  const layer = new Map<string, number>();
  const visiting = new Set<string>();
  const resolve = (id: string): number => {
    if (layer.has(id)) return layer.get(id)!;
    if (visiting.has(id)) return 0; // cycle guard — break at current node
    visiting.add(id);
    let max = -1;
    for (const p of deps.get(id) || []) max = Math.max(max, resolve(p));
    visiting.delete(id);
    const v = max + 1; // 0 if it depends on nothing
    layer.set(id, v);
    return v;
  };
  for (const n of nodes) resolve(n.id);
  return layer;
}

/**
 * Map each layer index to a Y coordinate, spreading layers top→bottom within the
 * viewport (layer 0 nearest the top). Single-layer graphs collapse to one row.
 */
export function computeLayerYPositions(
  layers: Map<string, number>,
  viewport: { width: number; height: number },
  verticalPadding = 60,
): Map<number, number> {
  const indices = [...new Set(layers.values())].sort((a, b) => a - b);
  const maxLayer = indices.length ? indices[indices.length - 1] : 0;
  const usable = Math.max(1, viewport.height - 2 * verticalPadding);
  const gap = maxLayer > 0 ? usable / maxLayer : 0;
  const out = new Map<number, number>();
  for (const i of indices) out.set(i, verticalPadding + i * gap);
  if (!out.has(0)) out.set(0, verticalPadding);
  return out;
}

/** Whether the configured layout mode is the hierarchical (structured) one. */
export function isHierarchicalLayout(mode: string | undefined | null): boolean {
  return mode === 'hierarchical';
}
