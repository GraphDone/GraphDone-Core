export interface OrganizationNode {
  id: string;
}

export interface OrganizationEdge {
  source: string | { id: string };
  target: string | { id: string };
}

import { borderReach } from './edgeGeometry';

type Point = { x: number; y: number };
type Size = { width: number; height: number };

/** Length of the line between two cards' borders (the part a label can use). */
function visibleLength(from: Point, a: Size, to: Point, b: Size) {
  const dx = to.x - from.x,
    dy = to.y - from.y;
  return (
    Math.hypot(dx, dy) - borderReach(a, dx, dy) - borderReach(b, dx, dy)
  );
}

const endpoint = (value: OrganizationEdge['source']) =>
  typeof value === 'string' ? value : value.id;

export function organizationAdjacency(
  nodes: readonly OrganizationNode[],
  edges: readonly OrganizationEdge[]
) {
  const adjacency = new Map(
    [...nodes]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map(node => [node.id, new Set<string>()])
  );
  for (const edge of edges) {
    const source = endpoint(edge.source),
      target = endpoint(edge.target);
    if (source === target || !adjacency.has(source) || !adjacency.has(target))
      continue;
    adjacency.get(source)!.add(target);
    adjacency.get(target)!.add(source);
  }
  return new Map(
    [...adjacency].map(([id, neighbors]) => [id, [...neighbors].sort()])
  );
}

function compactHubRing(
  root: string,
  ring: readonly string[],
  sizes: ReadonlyMap<string, Size>,
  viewport: Size,
  spacing: number,
  linkGap: (a: string, b: string) => number
) {
  const ids = [root, ...ring];
  let best: Map<string, Point> | undefined;
  let bestOverflow = Infinity,
    bestArea = Infinity;
  for (const aspect of [0.35, 0.5, 0.65, 0.8, 1, 1.25]) {
    for (let turn = 0; turn <= 8; turn++) {
      if (ring.length === 4 && turn !== 8) continue;
      const units = [
        { x: 0, y: 0 },
        ...ring.map((_, index) => {
          const angle =
            (index * 2 * Math.PI) / ring.length -
            Math.PI / 2 +
            (turn * Math.PI) / (ring.length * 8);
          return { x: Math.cos(angle) * aspect, y: Math.sin(angle) };
        }),
      ];
      const clear = (radius: number) => {
        for (let i = 0; i < ids.length; i++)
          for (let j = 0; j < i; j++) {
            const a = sizes.get(ids[i])!,
              b = sizes.get(ids[j])!;
            const dx = Math.max(
              0,
              Math.abs(units[i].x - units[j].x) * radius -
                (a.width + b.width) / 2
            );
            const dy = Math.max(
              0,
              Math.abs(units[i].y - units[j].y) * radius -
                (a.height + b.height) / 2
            );
            if (Math.hypot(dx, dy) < spacing) return false;
            const need = linkGap(ids[i], ids[j]);
            if (
              need > 0 &&
              visibleLength(
                { x: units[i].x * radius, y: units[i].y * radius },
                a,
                { x: units[j].x * radius, y: units[j].y * radius },
                b
              ) < need
            )
              return false;
          }
        return true;
      };
      let low = 0,
        high = 1;
      while (!clear(high)) high *= 2;
      for (let step = 0; step < 24; step++) {
        const middle = (low + high) / 2;
        if (clear(middle)) high = middle;
        else low = middle;
      }
      const points = new Map(
        ids.map((id, i) => [id, { x: units[i].x * high, y: units[i].y * high }])
      );
      const width =
        Math.max(
          ...ids.map(id => points.get(id)!.x + sizes.get(id)!.width / 2)
        ) -
        Math.min(
          ...ids.map(id => points.get(id)!.x - sizes.get(id)!.width / 2)
        );
      const height =
        Math.max(
          ...ids.map(id => points.get(id)!.y + sizes.get(id)!.height / 2)
        ) -
        Math.min(
          ...ids.map(id => points.get(id)!.y - sizes.get(id)!.height / 2)
        );
      const overflow = Math.max(
        (width * 0.65) / Math.max(1, viewport.width - 40),
        (height * 0.65) / Math.max(1, viewport.height - 200)
      );
      const area = width * height;
      if (
        overflow < bestOverflow - 0.0001 ||
        (Math.abs(overflow - bestOverflow) <= 0.0001 && area < bestArea)
      ) {
        best = points;
        bestOverflow = overflow;
        bestArea = area;
      }
    }
  }
  return best!;
}

export interface OrganizationOptions<E extends OrganizationEdge> {
  /** Smallest border-to-border gap an edge needs, e.g. room for its label. */
  edgeGap?: (edge: E) => number;
  /**
   * How much to spread one finished component about its first card before
   * packing (1 keeps it), the same along both axes or one factor per axis.
   * Called with the component's own coordinates.
   */
  spread?: (
    ids: readonly string[],
    points: ReadonlyMap<string, Point>
  ) => number | { x: number; y: number };
}

export function organizeTopology<
  T extends OrganizationNode,
  E extends OrganizationEdge = OrganizationEdge,
>(
  nodes: readonly T[],
  edges: readonly E[],
  dimensions: (node: T) => Size,
  viewport: Size,
  gap = 64,
  options: OrganizationOptions<E> = {}
) {
  const adjacency = organizationAdjacency(nodes, edges);
  // Per connected pair, the widest gap any of its edges asks for.
  const pairGaps = new Map<string, number>();
  const pairKey = (a: string, b: string) => (a < b ? `${a}\u0000${b}` : `${b}\u0000${a}`);
  if (options.edgeGap)
    for (const edge of edges) {
      const need = options.edgeGap(edge);
      if (!(need > 0)) continue;
      const key = pairKey(endpoint(edge.source), endpoint(edge.target));
      pairGaps.set(key, Math.max(pairGaps.get(key) ?? 0, need));
    }
  const pairGap = (a: string, b: string) => pairGaps.get(pairKey(a, b)) ?? 0;
  const sizes = new Map(
    nodes.map(node => {
      const size = dimensions(node);
      return [
        node.id,
        {
          width: Number.isFinite(size.width) ? Math.max(1, size.width) : 240,
          height: Number.isFinite(size.height) ? Math.max(1, size.height) : 120,
        },
      ];
    })
  );
  const spacing = Number.isFinite(gap) ? Math.max(32, gap) : 64;
  const visited = new Set<string>();
  const components: {
    ids: string[];
    kind: 'hub' | 'network' | 'chain' | 'cycle' | 'isolated';
    center?: string;
    focus: string;
    points: Map<string, Point>;
    bounds: Size;
  }[] = [];
  const work = {
    refinementPasses: 0,
    pairCandidates: 0,
    edgeEvaluations: 0,
    maxEdgeEvaluations: 40000,
    rectangleEvaluations: 0,
    maxRectangleEvaluations: 40000,
    clearanceRejections: 0,
    spreadComponents: 0,
  };
  for (const start of adjacency.keys()) {
    if (visited.has(start)) continue;
    const ids = [start];
    visited.add(start);
    for (let i = 0; i < ids.length; i++)
      for (const neighbor of adjacency.get(ids[i])!)
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          ids.push(neighbor);
        }
    const degreeOrder = [...ids].sort(
      (a, b) =>
        adjacency.get(b)!.length - adjacency.get(a)!.length ||
        a.localeCompare(b)
    );
    const root = degreeOrder[0];
    const maxDegree = adjacency.get(root)!.length;
    const kind =
      ids.length === 1
        ? 'isolated'
        : maxDegree <= 2
          ? ids.every(id => adjacency.get(id)!.length === 2)
            ? 'cycle'
            : 'chain'
          : maxDegree >= Math.max(3, Math.ceil((ids.length - 1) / 2))
            ? 'hub'
            : 'network';
    const points = new Map<string, Point>();
    // The card a camera should frame first: the hub, the middle of a chain,
    // or the top of a cycle.
    let focus = root;
    if (kind === 'isolated') points.set(root, { x: 0, y: 0 });
    else if (kind === 'chain' || kind === 'cycle') {
      const first =
        kind === 'chain'
          ? [...ids].filter(id => adjacency.get(id)!.length === 1).sort()[0]
          : [...ids].sort()[0];
      const order: string[] = [],
        used = new Set<string>();
      let current: string | undefined = first;
      while (current) {
        order.push(current);
        used.add(current);
        current = adjacency.get(current)!.find(id => !used.has(id));
      }
      const maxWidth = Math.max(...ids.map(id => sizes.get(id)!.width));
      const maxHeight = Math.max(...ids.map(id => sizes.get(id)!.height));
      // Neighbours along a chain or cycle leave room for the widest link.
      const linkGap = Math.max(
        spacing,
        ...order.map((id, i) => pairGap(id, order[(i + 1) % order.length]))
      );
      if (kind === 'chain') {
        // Snake the chain into the column count whose extent the viewport can
        // show at the largest (capped) scale, so a short chain on a phone does
        // not become one unreadably wide row. Ties keep the wider reading row.
        const cellWidth = maxWidth + linkGap,
          cellHeight = maxHeight + linkGap;
        const readableScale = (count: number) =>
          Math.min(
            1.25,
            viewport.width / (count * cellWidth - linkGap),
            viewport.height /
              (Math.ceil(ids.length / count) * cellHeight - linkGap)
          );
        let columns = Math.ceil(
          Math.sqrt(((ids.length * cellHeight) / cellWidth) * 1.5)
        );
        if (viewport.width > 0 && viewport.height > 0) {
          columns = ids.length;
          for (let count = ids.length - 1; count >= 1; count--)
            if (readableScale(count) > readableScale(columns) + 1e-9)
              columns = count;
        }
        focus = order[Math.floor((order.length - 1) / 2)];
        order.forEach((id, index) => {
          const row = Math.floor(index / columns),
            col = index % columns;
          points.set(id, {
            x: (row % 2 ? columns - 1 - col : col) * cellWidth,
            y: row * cellHeight,
          });
        });
      } else {
        focus = order[0];
        const radius =
          (Math.hypot(maxWidth, maxHeight) + linkGap) /
          (2 * Math.sin(Math.PI / ids.length));
        order.forEach((id, index) =>
          points.set(id, {
            x:
              radius *
              Math.cos((index * 2 * Math.PI) / ids.length - Math.PI / 2),
            y:
              radius *
              Math.sin((index * 2 * Math.PI) / ids.length - Math.PI / 2),
          })
        );
      }
    } else {
      const levels: string[][] = [[root]],
        reached = new Set([root]);
      for (let level = 0; level < levels.length; level++) {
        const next: string[] = [];
        for (const parent of levels[level])
          for (const neighbor of adjacency.get(parent)!)
            if (!reached.has(neighbor)) {
              reached.add(neighbor);
              next.push(neighbor);
            }
        if (next.length) levels.push(next);
      }
      points.set(root, { x: 0, y: 0 });
      let previousRadius = 0,
        previousDiameter = Math.hypot(
          sizes.get(root)!.width,
          sizes.get(root)!.height
        );
      for (const [index, ring] of levels.slice(1).entries()) {
        const diameter = Math.max(
          ...ring.map(id =>
            Math.hypot(sizes.get(id)!.width, sizes.get(id)!.height)
          )
        );
        // Room for the links into this ring, and between its own members.
        let radialGap = spacing,
          ringGap = spacing;
        const inner = new Set(levels[index]),
          members = new Set(ring);
        for (const id of ring)
          for (const neighbor of adjacency.get(id)!) {
            if (inner.has(neighbor))
              radialGap = Math.max(radialGap, pairGap(id, neighbor));
            else if (members.has(neighbor))
              ringGap = Math.max(ringGap, pairGap(id, neighbor));
          }
        const radius = Math.max(
          previousRadius + (previousDiameter + diameter) / 2 + radialGap,
          ring.length < 2
            ? 0
            : (diameter + ringGap) / (2 * Math.sin(Math.PI / ring.length))
        );
        ring.forEach((id, index) =>
          points.set(id, {
            x:
              radius *
              Math.cos((index * 2 * Math.PI) / ring.length - Math.PI / 2),
            y:
              radius *
              Math.sin((index * 2 * Math.PI) / ring.length - Math.PI / 2),
          })
        );
        previousRadius = radius;
        previousDiameter = diameter;
      }
      const compactRing =
        viewport.width < 600 &&
        kind === 'hub' &&
        levels.length === 2 &&
        levels[1].length <= 8;
      if (compactRing) {
        for (const [id, point] of compactHubRing(
          root,
          levels[1],
          sizes,
          viewport,
          spacing,
          pairGap
        ))
          points.set(id, point);
      }
      for (
        let pass = 0;
        pass < 4 && work.edgeEvaluations < work.maxEdgeEvaluations;
        pass++
      ) {
        let improved = false;
        work.refinementPasses++;
        for (const ring of levels.slice(1)) {
          if (ring.length < 3) continue;
          for (let index = 0; index < ring.length; index++) {
            const a = ring[index],
              b = ring[(index + 1) % ring.length];
            const cost =
              (adjacency.get(a)!.length + adjacency.get(b)!.length) * 2;
            if (work.edgeEvaluations + cost > work.maxEdgeEvaluations) break;
            work.pairCandidates++;
            work.edgeEvaluations += cost;
            const score = () =>
              [a, b].reduce(
                (sum, id) =>
                  sum +
                  adjacency.get(id)!.reduce((total, neighbor) => {
                    const from = points.get(id)!,
                      to = points.get(neighbor)!;
                    return total + Math.hypot(from.x - to.x, from.y - to.y);
                  }, 0),
                0
              );
            const before = score(),
              pa = points.get(a)!,
              pb = points.get(b)!;
            points.set(a, pb);
            points.set(b, pa);
            const clear =
              !compactRing ||
              [a, b].every(id =>
                ids.every(other => {
                  if (id === other) return true;
                  if (work.rectangleEvaluations >= work.maxRectangleEvaluations)
                    return false;
                  work.rectangleEvaluations++;
                  const from = points.get(id)!,
                    to = points.get(other)!;
                  const first = sizes.get(id)!,
                    second = sizes.get(other)!;
                  const dx = Math.max(
                    0,
                    Math.abs(from.x - to.x) - (first.width + second.width) / 2
                  );
                  const dy = Math.max(
                    0,
                    Math.abs(from.y - to.y) - (first.height + second.height) / 2
                  );
                  return Math.hypot(dx, dy) >= spacing;
                })
              );
            const roomy =
              clear &&
              [a, b].every(id =>
                adjacency.get(id)!.every(neighbor => {
                  const need = pairGap(id, neighbor);
                  return (
                    !(need > 0) ||
                    visibleLength(
                      points.get(id)!,
                      sizes.get(id)!,
                      points.get(neighbor)!,
                      sizes.get(neighbor)!
                    ) >= need
                  );
                })
              );
            if (!roomy) work.clearanceRejections++;
            if (roomy && score() + 0.01 < before) {
              ring[index] = b;
              ring[(index + 1) % ring.length] = a;
              improved = true;
            } else {
              points.set(a, pa);
              points.set(b, pb);
            }
          }
        }
        if (!improved) break;
      }
    }
    const factor = options.spread?.(ids, points) ?? 1;
    const fx = typeof factor === 'number' ? factor : factor.x,
      fy = typeof factor === 'number' ? factor : factor.y;
    if (fx > 1 || fy > 1) {
      const anchor = { ...points.get(root)! };
      for (const point of points.values()) {
        point.x = anchor.x + (point.x - anchor.x) * Math.max(1, fx);
        point.y = anchor.y + (point.y - anchor.y) * Math.max(1, fy);
      }
      work.spreadComponents++;
    }
    const left = Math.min(
      ...ids.map(id => points.get(id)!.x - sizes.get(id)!.width / 2)
    );
    const right = Math.max(
      ...ids.map(id => points.get(id)!.x + sizes.get(id)!.width / 2)
    );
    const top = Math.min(
      ...ids.map(id => points.get(id)!.y - sizes.get(id)!.height / 2)
    );
    const bottom = Math.max(
      ...ids.map(id => points.get(id)!.y + sizes.get(id)!.height / 2)
    );
    for (const point of points.values()) {
      point.x -= left;
      point.y -= top;
    }
    components.push({
      ids,
      kind,
      center: kind === 'hub' || kind === 'network' ? root : undefined,
      focus,
      points,
      bounds: { width: right - left, height: bottom - top },
    });
  }
  components.sort(
    (a, b) => b.ids.length - a.ids.length || a.ids[0].localeCompare(b.ids[0])
  );
  const area = components.reduce(
    (sum, component) =>
      sum +
      (component.bounds.width + spacing * 2) *
        (component.bounds.height + spacing * 2),
    0
  );
  const widest = Math.max(
    1,
    ...components.map(component => component.bounds.width)
  );
  const pack = (aspect: number) => {
    const rowWidth = Math.max(widest, Math.sqrt(area * aspect));
    const positions = new Map<string, Point>();
    let x = 0,
      y = 0,
      rowHeight = 0,
      right = 0;
    for (const component of components) {
      if (x && x + component.bounds.width > rowWidth) {
        x = 0;
        y += rowHeight + spacing * 2;
        rowHeight = 0;
      }
      for (const [id, point] of component.points)
        positions.set(id, { x: point.x + x, y: point.y + y });
      right = Math.max(right, x + component.bounds.width);
      rowHeight = Math.max(rowHeight, component.bounds.height);
      x += component.bounds.width + spacing * 2;
    }
    return { positions, right, y, rowHeight };
  };
  // Rows follow a 3:2 page by default. When the actual viewport's own aspect
  // packs the components at a strictly more readable fit scale (two loose
  // cards side by side on a landscape phone instead of stacked and shrunk),
  // use it instead.
  let packed = pack(1.5);
  if (viewport.width > 0 && viewport.height > 0 && components.length > 1) {
    const fit = (layout: ReturnType<typeof pack>) =>
      Math.min(
        viewport.width / Math.max(1, layout.right),
        viewport.height / Math.max(1, layout.y + layout.rowHeight)
      );
    const fitted = pack(viewport.width / viewport.height);
    if (fit(fitted) > fit(packed) + 1e-9) packed = fitted;
  }
  const { positions, right, y, rowHeight } = packed;
  const offsetX = (viewport.width - right) / 2,
    offsetY = (viewport.height - y - rowHeight) / 2;
  for (const point of positions.values()) {
    point.x += offsetX;
    point.y += offsetY;
  }
  return {
    positions,
    components: components.map(({ ids, kind, center, focus }) => ({
      ids,
      kind,
      center,
      focus,
    })),
    work,
  };
}
