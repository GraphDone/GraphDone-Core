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

/** The two graph layout modes. 'force' is the organic default. */
export type LayoutMode = 'force' | 'hierarchical';

/** localStorage key the graph view persists the chosen layout mode under. */
export const LAYOUT_MODE_STORAGE_KEY = 'graphdone:layoutMode';

/** Coerce any stored/raw value to a valid LayoutMode (defaults to 'force'). */
export function parseLayoutMode(raw: string | undefined | null): LayoutMode {
  return raw === 'hierarchical' ? 'hierarchical' : 'force';
}

/**
 * Per-node target Y for the hierarchical layout: assign dependency layers, map
 * each layer to a Y, then resolve every node to its layer's Y. The simulation
 * pins each node's fy to this so it settles into dependency layers (X stays free
 * to arrange organically). Pure glue over the two layering primitives.
 */
export function computeNodeLayerY(
  nodes: NodeLike[],
  edges: EdgeLike[],
  viewport: { width: number; height: number },
  verticalPadding = 60,
): Map<string, number> {
  const layers = assignLayersByDependencyDirection(nodes, edges);
  const layerY = computeLayerYPositions(layers, viewport, verticalPadding);
  const out = new Map<string, number>();
  for (const node of nodes) {
    const layer = layers.get(node.id) ?? 0;
    out.set(node.id, layerY.get(layer) ?? verticalPadding);
  }
  return out;
}

/**
 * Rows for the hierarchical layout. Dependency layers come first (prerequisite
 * higher). Inside a layer, cards joined by other relationships would otherwise
 * share a row and their edges would run through the cards between them, so a
 * connected group is split into sub-rows by breadth-first distance from its
 * busiest card; a simple path stays in one row in path order. Cards in a row
 * are ordered by where their neighbours in the rows above sit. Cards with no
 * relationship at all wrap like a reading list; computeCompactLayout wraps
 * the other rows once it knows their gaps.
 */
function hierarchyRows<T extends NodeLike>(nodes: T[], edges: EdgeLike[], width: (node: T) => number, maxRowWidth: number): T[][] {
  const layers = assignLayersByDependencyDirection(nodes, edges);
  const byId = new Map(nodes.map(node => [node.id, node]));
  const linked = new Map<string, Set<string>>(nodes.map(node => [node.id, new Set<string>()]));
  for (const edge of edges) {
    const a = idOf(edge.source), b = idOf(edge.target);
    if (a === b || !linked.has(a) || !linked.has(b)) continue;
    linked.get(a)!.add(b);
    linked.get(b)!.add(a);
  }
  const sortedIds = (ids: Iterable<string>) => [...ids].sort((a, b) => a.localeCompare(b));
  const rows: T[][] = [];
  const position = new Map<string, number>();
  const place = (row: T[]) => {
    row.forEach((node, index) => position.set(node.id, index - (row.length - 1) / 2));
    rows.push(row);
  };
  // Mean position of a card's neighbours already placed; unplaced cards keep id order.
  const barycentre = (id: string) => {
    const placed = [...linked.get(id)!].filter(other => position.has(other)).map(other => position.get(other)!);
    return placed.length ? placed.reduce((sum, value) => sum + value, 0) / placed.length : Infinity;
  };
  const byBarycentre = (ids: string[]) => ids
    .map((id, index) => ({ id, key: barycentre(id), index }))
    .sort((a, b) => (a.key === b.key ? a.index - b.index : a.key - b.key))
    .map(entry => entry.id);
  const layerIds = new Map<number, string[]>();
  for (const node of nodes) {
    const layer = layers.get(node.id)!;
    if (!layerIds.has(layer)) layerIds.set(layer, []);
    layerIds.get(layer)!.push(node.id);
  }
  for (const [, members] of [...layerIds].sort(([a], [b]) => a - b)) {
    const inLayer = new Set(members);
    const inner = (id: string) => sortedIds([...linked.get(id)!].filter(other => inLayer.has(other)));
    const subRows: string[][] = [];
    const loose: string[] = [];
    const seen = new Set<string>();
    for (const start of sortedIds(members)) {
      if (seen.has(start)) continue;
      const group = [start];
      seen.add(start);
      for (let i = 0; i < group.length; i++)
        for (const next of inner(group[i])) if (!seen.has(next)) { seen.add(next); group.push(next); }
      if (group.length === 1) {
        (linked.get(start)!.size ? (subRows[0] ??= []) : loose).push(start);
        continue;
      }
      const degree = (id: string) => inner(id).length;
      const links = group.reduce((sum, id) => sum + degree(id), 0) / 2;
      if (group.every(id => degree(id) <= 2) && links === group.length - 1) {
        // A path: one row, in path order, from its smaller end.
        const ends = sortedIds(group.filter(id => degree(id) === 1));
        const path: string[] = [];
        for (let at: string | undefined = ends[0]; at; at = inner(at).find(next => !path.includes(next))) path.push(at);
        (subRows[0] ??= []).push(...path);
        continue;
      }
      const root = [...group].sort((a, b) => degree(b) - degree(a) || a.localeCompare(b))[0];
      const depth = new Map([[root, 0]]);
      const queue = [root];
      for (let i = 0; i < queue.length; i++)
        for (const next of inner(queue[i])) if (!depth.has(next)) { depth.set(next, depth.get(queue[i])! + 1); queue.push(next); }
      for (const id of queue) (subRows[depth.get(id)!] ??= []).push(id);
    }
    for (const ids of subRows) {
      if (!ids?.length) continue;
      // Keep each path together; order the rest by their neighbours above.
      const paths: string[][] = [];
      const singles: string[] = [];
      for (let i = 0; i < ids.length; i++) {
        const run = [ids[i]];
        while (i + 1 < ids.length && linked.get(ids[i])!.has(ids[i + 1]) && inLayer.has(ids[i + 1])) run.push(ids[++i]);
        if (run.length > 1) paths.push(run); else singles.push(run[0]);
      }
      const units = [...paths.map(run => ({ ids: run, key: Math.min(...run.map(barycentre)) })), ...byBarycentre(singles).map(id => ({ ids: [id], key: barycentre(id) }))];
      units.sort((a, b) => (a.key === b.key ? 0 : a.key - b.key));
      place(units.flatMap(unit => unit.ids).map(id => byId.get(id)!));
    }
    // Cards with no relationship wrap like a reading list.
    let row: T[] = [], used = 0;
    for (const id of sortedIds(loose)) {
      const node = byId.get(id)!;
      if (row.length && used + 36 + width(node) > maxRowWidth) { place(row); row = []; used = 0; }
      used += (row.length ? 36 : 0) + width(node);
      row.push(node);
    }
    if (row.length) place(row);
  }
  return rows;
}

/**
 * Fewer crossings: sweep down and up the rows a few times, ordering each row
 * by where its cards' neighbours sit in the rows above (down) or below (up),
 * as fractions of their row. A run of cards linked inside the row (a chain)
 * moves as one; a card with no neighbour on that side keeps its place.
 */
function orderRows<T extends NodeLike>(rows: T[][], edges: EdgeLike[]) {
  const rowOf = new Map<string, number>();
  rows.forEach((row, index) => row.forEach(node => rowOf.set(node.id, index)));
  const across = new Map<string, string[]>();
  const inRow = new Set<string>();
  for (const edge of edges) {
    const a = idOf(edge.source), b = idOf(edge.target);
    const ra = rowOf.get(a), rb = rowOf.get(b);
    if (ra === undefined || rb === undefined) continue;
    if (ra === rb) { inRow.add(`${a}\u0000${b}`).add(`${b}\u0000${a}`); continue; }
    if (!across.has(a)) across.set(a, []);
    if (!across.has(b)) across.set(b, []);
    across.get(a)!.push(b);
    across.get(b)!.push(a);
  }
  const where = new Map<string, number>();
  const measure = (row: T[]) => row.forEach((node, i) => where.set(node.id, (i + 0.5) / row.length));
  rows.forEach(measure);
  for (let sweep = 0; sweep < 4; sweep++) {
    const down = sweep % 2 === 0;
    const order = [...rows.keys()];
    if (!down) order.reverse();
    for (const index of order) {
      const row = rows[index];
      const units: { nodes: T[]; key: number; at: number }[] = [];
      for (const node of row) {
        const last = units[units.length - 1];
        if (last && inRow.has(`${last.nodes[last.nodes.length - 1].id}\u0000${node.id}`)) last.nodes.push(node);
        else units.push({ nodes: [node], key: 0, at: units.length });
      }
      for (const unit of units) {
        const sides = unit.nodes.flatMap(node => (across.get(node.id) ?? []).filter(id => (down ? rowOf.get(id)! < index : rowOf.get(id)! > index)));
        const own = unit.nodes.reduce((sum, node) => sum + where.get(node.id)!, 0) / unit.nodes.length;
        unit.key = sides.length ? sides.reduce((sum, id) => sum + where.get(id)!, 0) / sides.length : own;
      }
      units.sort((a, b) => a.key - b.key || a.at - b.at);
      rows[index] = units.flatMap(unit => unit.nodes);
      measure(rows[index]);
    }
  }
  return rows;
}

/** Closest non-decreasing sequence to `values` (weighted least squares). */
function isotonic(values: number[], weights: number[]): number[] {
  const blocks: { mean: number; weight: number; count: number }[] = [];
  values.forEach((value, i) => {
    blocks.push({ mean: value, weight: weights[i], count: 1 });
    while (blocks.length > 1 && blocks[blocks.length - 2].mean > blocks[blocks.length - 1].mean) {
      const last = blocks.pop()!, prev = blocks[blocks.length - 1];
      const weight = prev.weight + last.weight;
      prev.mean = (prev.mean * prev.weight + last.mean * last.weight) / weight;
      prev.weight = weight;
      prev.count += last.count;
    }
  });
  return blocks.flatMap(block => Array<number>(block.count).fill(block.mean));
}

/** Compact rows use actual card sizes, independent of viewport expansion.
 * Pin both axes so repulsion cannot stretch a row after it has been arranged.
 * `edgeGap` widens the gap between two rows (or two cards in a row) to the
 * largest border-to-border room any edge across it asks for, e.g. its label.
 */
export function computeCompactLayout<T extends NodeLike, E extends EdgeLike = EdgeLike>(
  nodes: T[], edges: E[], viewport: { width: number; height: number },
  dimensions: (node: T) => { width: number; height: number },
  options: { edgeGap?: (edge: E) => number } = {},
): Map<string, { x: number; y: number }> {
  const maxRowWidth = Math.max(560, Math.min(viewport.width - 64, 1100));
  const pairKey = (a: string, b: string) => (a < b ? `${a}\u0000${b}` : `${b}\u0000${a}`);
  const pairNeed = new Map<string, number>();
  for (const edge of edges) {
    const need = options.edgeGap?.(edge) ?? 0;
    const key = pairKey(idOf(edge.source), idOf(edge.target));
    pairNeed.set(key, Math.max(pairNeed.get(key) ?? 0, need));
  }
  // Two neighbours in a row sit 36 apart, or further when an edge between them asks for it.
  const gapBetween = (a: T, b: T) => Math.max(36, pairNeed.get(pairKey(a.id, b.id)) ?? 0);
  // A row wider than the screen wraps when no edge leaves it (edges from other
  // rows would run through the wrapped cards); a row of linked cards (a chain)
  // wraps back and forth so each wrap edge stays short.
  const rows = orderRows(hierarchyRows(nodes, edges, node => dimensions(node).width, maxRowWidth), edges);
  const firstRow = new Map<string, number>();
  rows.forEach((row, index) => row.forEach(node => firstRow.set(node.id, index)));
  const leaves = new Set<number>();
  for (const edge of edges) {
    const a = firstRow.get(idOf(edge.source)), b = firstRow.get(idOf(edge.target));
    if (a !== undefined && b !== undefined && a !== b) leaves.add(a).add(b);
  }
  const ordered: T[][] = [];
  for (const [index, row] of rows.entries()) {
    if (leaves.has(index)) {
      ordered.push(row);
      continue;
    }
    const chunks: T[][] = [];
    let chunk: T[] = [], used = 0;
    for (const node of row) {
      const gap = chunk.length ? gapBetween(chunk[chunk.length - 1], node) : 0;
      if (chunk.length && used + gap + dimensions(node).width > maxRowWidth) {
        chunks.push(chunk);
        chunk = [];
        used = 0;
      }
      used += (chunk.length ? gap : 0) + dimensions(node).width;
      chunk.push(node);
    }
    if (chunk.length) chunks.push(chunk);
    const chain = row.some((node, i) => i > 0 && pairNeed.has(pairKey(row[i - 1].id, node.id)));
    chunks.forEach((part, i) => ordered.push(chain && i % 2 ? [...part].reverse() : part));
  }
  const rowOf = new Map<string, number>();
  ordered.forEach((row, index) => row.forEach(node => rowOf.set(node.id, index)));
  const rowGaps = ordered.map(() => 64);
  for (const edge of edges) {
    const need = options.edgeGap?.(edge) ?? 0;
    const a = rowOf.get(idOf(edge.source)), b = rowOf.get(idOf(edge.target));
    if (!(need > 0) || a === undefined || b === undefined) continue;
    for (let gap = Math.min(a, b); gap < Math.max(a, b); gap++) rowGaps[gap] = Math.max(rowGaps[gap], need);
  }
  const heights = ordered.map(row => Math.max(...row.map(n => dimensions(n).height)));
  const totalHeight = heights.reduce((sum, h) => sum + h, 0) + rowGaps.slice(0, -1).reduce((sum, gap) => sum + gap, 0);
  // Centre distance each card keeps from the first card of its row.
  const offsets = ordered.map(row => {
    const out = [0];
    for (let i = 1; i < row.length; i++)
      out.push(out[i - 1] + (dimensions(row[i - 1]).width + dimensions(row[i]).width) / 2 + gapBetween(row[i - 1], row[i]));
    return out;
  });
  const xs = new Map<string, number>();
  ordered.forEach((row, index) => {
    const width = offsets[index][row.length - 1] + (dimensions(row[0]).width + dimensions(row[row.length - 1]).width) / 2;
    const left = (viewport.width - width) / 2 + dimensions(row[0]).width / 2;
    row.forEach((node, i) => xs.set(node.id, left + offsets[index][i]));
  });
  // Pull each card over its neighbours in other rows so edges run short and
  // steep, keeping the row's order and gaps (weighted isotonic regression).
  const across = new Map<string, string[]>(nodes.map(node => [node.id, []]));
  for (const edge of edges) {
    const a = idOf(edge.source), b = idOf(edge.target);
    if (rowOf.get(a) === undefined || rowOf.get(b) === undefined || rowOf.get(a) === rowOf.get(b)) continue;
    across.get(a)!.push(b);
    across.get(b)!.push(a);
  }
  for (let sweep = 0; sweep < 4; sweep++) {
    const order = [...ordered.keys()];
    if (sweep % 2) order.reverse();
    for (const index of order) {
      const row = ordered[index];
      const wanted = row.map(node => {
        const others = across.get(node.id)!;
        return others.length ? others.reduce((sum, id) => sum + xs.get(id)!, 0) / others.length : xs.get(node.id)!;
      });
      const fitted = isotonic(
        wanted.map((x, i) => x - offsets[index][i]),
        row.map(node => (across.get(node.id)!.length ? 1 : 0.05))
      );
      row.forEach((node, i) => xs.set(node.id, fitted[i] + offsets[index][i]));
    }
  }
  let minX = Infinity, maxX = -Infinity;
  for (const node of nodes) {
    const half = dimensions(node).width / 2;
    minX = Math.min(minX, xs.get(node.id)! - half);
    maxX = Math.max(maxX, xs.get(node.id)! + half);
  }
  const shift = nodes.length ? viewport.width / 2 - (minX + maxX) / 2 : 0;
  let y = (viewport.height - totalHeight) / 2;
  const out = new Map<string, { x: number; y: number }>();
  ordered.forEach((row, index) => {
    for (const node of row) out.set(node.id, { x: xs.get(node.id)! + shift, y: y + heights[index] / 2 });
    y += heights[index] + rowGaps[index];
  });
  return out;
}
