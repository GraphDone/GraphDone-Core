export interface OrganizationNode {
  id: string;
}

export interface OrganizationEdge {
  source: string | { id: string };
  target: string | { id: string };
}

type Point = { x: number; y: number };
type Size = { width: number; height: number };

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
  spacing: number
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

export function organizeTopology<T extends OrganizationNode>(
  nodes: readonly T[],
  edges: readonly OrganizationEdge[],
  dimensions: (node: T) => Size,
  viewport: Size,
  gap = 64
) {
  const adjacency = organizationAdjacency(nodes, edges);
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
    points: Map<string, Point>;
    bounds: Size;
  }[] = [];
  const work = {
    refinementPasses: 0,
    pairCandidates: 0,
    edgeEvaluations: 0,
    maxEdgeEvaluations: 40000,
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
      if (kind === 'chain') {
        const columns =
          ids.length <= 6
            ? ids.length
            : Math.ceil(
                Math.sqrt(
                  ((ids.length * (maxHeight + spacing)) /
                    (maxWidth + spacing)) *
                    1.5
                )
              );
        order.forEach((id, index) => {
          const row = Math.floor(index / columns),
            col = index % columns;
          points.set(id, {
            x: (row % 2 ? columns - 1 - col : col) * (maxWidth + spacing),
            y: row * (maxHeight + spacing),
          });
        });
      } else {
        const radius =
          (Math.hypot(maxWidth, maxHeight) + spacing) /
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
      for (const ring of levels.slice(1)) {
        const diameter = Math.max(
          ...ring.map(id =>
            Math.hypot(sizes.get(id)!.width, sizes.get(id)!.height)
          )
        );
        const radius = Math.max(
          previousRadius + (previousDiameter + diameter) / 2 + spacing,
          ring.length < 2
            ? 0
            : (diameter + spacing) / (2 * Math.sin(Math.PI / ring.length))
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
      if (
        viewport.width < 600 &&
        kind === 'hub' &&
        levels.length === 2 &&
        levels[1].length <= 8
      ) {
        for (const [id, point] of compactHubRing(
          root,
          levels[1],
          sizes,
          viewport,
          spacing
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
            if (score() + 0.01 < before) {
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
      points,
      bounds: { width: right - left, height: bottom - top },
    });
  }
  components.sort(
    (a, b) => b.ids.length - a.ids.length || a.ids[0].localeCompare(b.ids[0])
  );
  const positions = new Map<string, Point>();
  const area = components.reduce(
    (sum, component) =>
      sum +
      (component.bounds.width + spacing * 2) *
        (component.bounds.height + spacing * 2),
    0
  );
  const rowWidth = Math.max(
    1,
    ...components.map(component => component.bounds.width),
    Math.sqrt(area * 1.5)
  );
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
  const offsetX = (viewport.width - right) / 2,
    offsetY = (viewport.height - y - rowHeight) / 2;
  for (const point of positions.values()) {
    point.x += offsetX;
    point.y += offsetY;
  }
  return {
    positions,
    components: components.map(({ ids, kind, center }) => ({
      ids,
      kind,
      center,
    })),
    work,
  };
}
