/** GraphDone's display projection. These objects must never enter the simulation
 * or position-save queue. Source IDs and typed, directed edges remain canonical. */
export interface SemanticItem {
  id: string;
  title: string;
  type: string;
  status: string;
  metadata?: unknown;
}
export interface SemanticEdge {
  id: string;
  source: string | { id: string };
  target: string | { id: string };
  type: string;
}
export interface SemanticGroup {
  id: string;
  label: string;
  basis: 'path' | 'containment' | 'lane' | 'kind' | 'type';
  members: SemanticItem[];
  internalEdges: SemanticEdge[];
  blocked: number;
  completed: number;
}
export interface SemanticBundle {
  id: string;
  source: string;
  target: string;
  type: string;
  edges: SemanticEdge[];
}

const endpoint = (value: SemanticEdge['source']) =>
  typeof value === 'string' ? value : value.id;
const text = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined;
const label = (value: string) => value.replace(/[_-]+/g, ' ');

export function metadataRecord(value: unknown): Record<string, unknown> {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch {
    return {};
  }
}

/** First slice: top-level paths, native containment, release lanes, then kinds /
 * types. Never interpret dependency edges as containment. Multiple parents use
 * a deterministic primary parent; all original relationships stay accounted for. */
export function projectSemanticGraph(
  items: readonly SemanticItem[],
  edges: readonly SemanticEdge[]
) {
  const byId = new Map(items.map(item => [item.id, item]));
  const parents = new Map<string, Set<string>>();
  const diagnostics = new Set<string>();
  for (const edge of edges) {
    const source = endpoint(edge.source),
      target = endpoint(edge.target);
    const child =
      edge.type === 'IS_PART_OF'
        ? source
        : edge.type === 'CONTAINS'
          ? target
          : undefined;
    const parent = edge.type === 'IS_PART_OF' ? target : source;
    if (child && byId.has(child) && byId.has(parent)) {
      if (!parents.has(child)) parents.set(child, new Set());
      parents.get(child)!.add(parent);
    }
  }
  for (const candidates of parents.values()) {
    if (candidates.size > 1)
      diagnostics.add(
        'Some items have multiple containers; the lowest ID is used for the overview.'
      );
  }
  const roots = new Map<string, string>();
  const rootFor = (id: string): string => {
    if (roots.has(id)) return roots.get(id)!;
    const path: string[] = [];
    const visited = new Map<string, number>();
    let next = id;
    while (!roots.has(next) && !visited.has(next)) {
      visited.set(next, path.length);
      path.push(next);
      const parent = [...(parents.get(next) ?? [])].sort()[0];
      if (!parent) break;
      next = parent;
    }
    let root = roots.get(next) ?? next;
    if (parents.has(next) && visited.has(next)) {
      root = path.slice(visited.get(next)).sort()[0];
      diagnostics.add(
        'Containment cycles are grouped together; original relationships are retained.'
      );
    }
    for (const member of path) roots.set(member, root);
    return root;
  };
  const containerIds = new Set(
    [...parents.values()].flatMap(values => [...values])
  );
  const groups = new Map<string, SemanticGroup>();
  const membership = new Map<string, string>();
  for (const item of [...byId.values()].sort((a, b) =>
    a.id.localeCompare(b.id)
  )) {
    const metadata = metadataRecord(item.metadata);
    const lod = metadataRecord(metadata.lod);
    const rawPath = lod.groupPath ?? metadata.groupPath;
    const path = Array.isArray(rawPath)
      ? text(rawPath[0])
      : text(rawPath)
          ?.split('/')
          .map(p => p.trim())
          .find(Boolean);
    const root = rootFor(item.id);
    let basis: SemanticGroup['basis'], key: string, title: string;
    if (path) {
      basis = 'path';
      key = path;
      title = path;
      if (parents.has(item.id))
        diagnostics.add(
          'Explicit group paths take precedence over containment in this overview.'
        );
    } else if (parents.has(item.id) || containerIds.has(item.id)) {
      basis = 'containment';
      key = root;
      title = byId.get(root)!.title;
    } else if (text(metadata.lane)) {
      basis = 'lane';
      key = text(metadata.lane)!;
      title = label(key);
    } else if (text(metadata.kind)) {
      basis = 'kind';
      key = text(metadata.kind)!;
      title = label(key);
    } else {
      basis = 'type';
      key = item.type || 'Items';
      title = label(key);
    }
    const id = JSON.stringify(['group', basis, key]);
    if (!groups.has(id))
      groups.set(id, {
        id,
        label: title,
        basis,
        members: [],
        internalEdges: [],
        blocked: 0,
        completed: 0,
      });
    const group = groups.get(id)!;
    group.members.push(item);
    if (item.status === 'BLOCKED') group.blocked++;
    if (item.status === 'COMPLETED') group.completed++;
    membership.set(item.id, id);
  }
  const bundles = new Map<string, SemanticBundle>();
  const pendingEdges: SemanticEdge[] = [];
  for (const edge of edges) {
    const source = membership.get(endpoint(edge.source)),
      target = membership.get(endpoint(edge.target));
    if (!source || !target) {
      pendingEdges.push(edge);
      continue;
    }
    if (source === target) {
      groups.get(source)!.internalEdges.push(edge);
      continue;
    }
    const id = JSON.stringify([source, target, edge.type]);
    if (!bundles.has(id))
      bundles.set(id, { id, source, target, type: edge.type, edges: [] });
    bundles.get(id)!.edges.push(edge);
  }
  return {
    groups: [...groups.values()],
    bundles: [...bundles.values()],
    membership,
    pendingEdges,
    diagnostics: [...diagnostics],
  };
}

/** Hysteresis keeps the parent readable throughout the transition band. Inspired
 * by CodeGraph's parent fallback; independent GraphDone policy/implementation. */
export function overviewAtScale(previous: boolean, scale: number): boolean {
  // Long, multiline source titles are fitted inside cards; the nominal 12px
  // counter-scale alone cannot keep them readable below normal item scale.
  return previous ? scale < 1 : scale < 0.85;
}

export interface OverviewAnchor {
  id: string;
  x: number;
  y: number;
}
/** Screen-space placement keeps labels readable without changing source layout.
 * A bounded grid offers non-overlapping slots; nearest slots retain spatial
 * context. Excess groups stay reachable in the overview's complete group list. */
export function placeOverviewLabels(
  anchors: readonly OverviewAnchor[],
  width: number,
  height: number,
  obstacles: readonly {
    left: number;
    top: number;
    right: number;
    bottom: number;
  }[] = []
) {
  const cardWidth = Math.min(184, Math.max(120, width - 32)),
    cardHeight = 72;
  const columns = Math.max(1, Math.floor((width - 32) / (cardWidth + 16)));
  const rows = Math.max(0, Math.floor((height - 100) / (cardHeight + 24)));
  const slots: { x: number; y: number }[] = [];
  const span = columns * (cardWidth + 16) - 16;
  for (let row = 0; row < rows; row++)
    for (let col = 0; col < columns; col++) {
      const slot = {
        x: (width - span) / 2 + col * (cardWidth + 16),
        y: 64 + row * (cardHeight + 24),
      };
      if (
        !obstacles.some(
          obstacle =>
            slot.x < obstacle.right + 8 &&
            slot.x + cardWidth > obstacle.left - 8 &&
            slot.y < obstacle.bottom + 8 &&
            slot.y + cardHeight > obstacle.top - 8
        )
      )
        slots.push(slot);
    }
  const placed: (OverviewAnchor & {
    anchorX: number;
    anchorY: number;
    width: number;
    height: number;
  })[] = [];
  const hidden: string[] = [];
  for (const anchor of [...anchors].sort((a, b) => a.id.localeCompare(b.id))) {
    if (!slots.length) {
      hidden.push(anchor.id);
      continue;
    }
    let best = 0,
      distance = Infinity;
    slots.forEach((slot, index) => {
      const d =
        (slot.x + cardWidth / 2 - anchor.x) ** 2 +
        (slot.y + cardHeight / 2 - anchor.y) ** 2;
      if (d < distance) {
        distance = d;
        best = index;
      }
    });
    const slot = slots.splice(best, 1)[0];
    placed.push({
      ...anchor,
      ...slot,
      anchorX: anchor.x,
      anchorY: anchor.y,
      width: cardWidth,
      height: cardHeight,
    });
  }
  return { placed, hidden };
}
