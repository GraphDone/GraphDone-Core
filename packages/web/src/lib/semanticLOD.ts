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
  hierarchyId: string;
  parentId?: string;
  ancestors: string[];
  children: string[];
  isDirect: boolean;
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

export const MAX_SEMANTIC_DEPTH = 32;

export interface SemanticHierarchyGroup {
  id: string;
  label: string;
  basis: SemanticGroup['basis'];
  parentId?: string;
  ancestors: string[];
  children: string[];
  memberCount: number;
  directCount: number;
}

export interface SemanticHierarchy {
  groups: ReadonlyMap<string, SemanticHierarchyGroup>;
  paths: ReadonlyMap<string, readonly string[]>;
  items: readonly SemanticItem[];
  edges: readonly SemanticEdge[];
  diagnostics: readonly string[];
}

export function buildSemanticHierarchy(
  items: readonly SemanticItem[],
  edges: readonly SemanticEdge[]
): SemanticHierarchy {
  const byId = new Map(items.map(item => [item.id, item]));
  const ordered = [...byId.values()].sort((a, b) =>
    a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  );
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
  const primary = new Map<string, string>();
  for (const [child, candidates] of parents) {
    primary.set(child, [...candidates].sort()[0]);
    if (candidates.size > 1)
      diagnostics.add(
        'Some items have multiple containers; the lowest ID is used for the overview.'
      );
  }
  const containers = new Set(primary.values());
  const nativePaths = new Map<string, string[]>();
  const nativePath = (id: string): string[] => {
    if (nativePaths.has(id)) return nativePaths.get(id)!;
    const chain: string[] = [];
    const visited = new Map<string, number>();
    let next = id;
    while (!nativePaths.has(next)) {
      const cycleStart = visited.get(next);
      if (cycleStart !== undefined) {
        const cycle = chain.slice(cycleStart);
        const root = [...cycle].sort()[0];
        for (const member of cycle) nativePaths.set(member, [root]);
        diagnostics.add(
          'Containment cycles are grouped together; original relationships are retained.'
        );
        break;
      }
      visited.set(next, chain.length);
      chain.push(next);
      const parent = primary.get(next);
      if (!parent) {
        nativePaths.set(next, containers.has(next) ? [next] : []);
        break;
      }
      next = parent;
    }
    for (const member of [...chain].reverse()) {
      if (nativePaths.has(member)) continue;
      const parentPath = nativePaths.get(primary.get(member)!)!;
      const path = containers.has(member)
        ? [...parentPath, member]
        : parentPath;
      if (path.length > MAX_SEMANTIC_DEPTH)
        diagnostics.add(
          'Group paths deeper than 32 levels retain their items in the last supported parent.'
        );
      nativePaths.set(member, path.slice(0, MAX_SEMANTIC_DEPTH));
    }
    return nativePaths.get(id)!;
  };
  const groups = new Map<string, SemanticHierarchyGroup>();
  const paths = new Map<string, string[]>();
  for (const item of ordered) {
    const metadata = metadataRecord(item.metadata);
    const lod = metadataRecord(metadata.lod);
    const rawPath = lod.groupPath ?? metadata.groupPath;
    const parts = Array.isArray(rawPath)
      ? rawPath
      : (text(rawPath)
          ?.split('/')
          .filter(part => part.trim()) ?? []);
    const explicit: string[] = [];
    for (const part of parts) {
      const value = text(part);
      if (!value) {
        diagnostics.add(
          'Invalid group path segments retain items in their last valid parent or fallback group.'
        );
        break;
      }
      if (explicit.length === MAX_SEMANTIC_DEPTH) {
        diagnostics.add(
          'Group paths deeper than 32 levels retain their items in the last supported parent.'
        );
        break;
      }
      explicit.push(value);
    }
    const native = nativePath(item.id);
    let basis: SemanticGroup['basis'];
    let keys: string[];
    let labels: string[];
    if (explicit.length) {
      basis = 'path';
      keys = explicit;
      labels = explicit;
      if (parents.has(item.id))
        diagnostics.add(
          'Explicit group paths take precedence over containment in this overview.'
        );
    } else if (native.length) {
      basis = 'containment';
      keys = native;
      labels = native.map(id => byId.get(id)!.title);
    } else if (text(metadata.lane)) {
      basis = 'lane';
      keys = [text(metadata.lane)!];
      labels = keys.map(label);
    } else if (text(metadata.kind)) {
      basis = 'kind';
      keys = [text(metadata.kind)!];
      labels = keys.map(label);
    } else {
      basis = 'type';
      keys = [item.type || 'Items'];
      labels = keys.map(label);
    }
    const path: string[] = [];
    for (let depth = 0; depth < keys.length; depth++) {
      const id = JSON.stringify(['group', basis, ...keys.slice(0, depth + 1)]);
      const parentId = path[path.length - 1];
      if (!groups.has(id)) {
        groups.set(id, {
          id,
          label: labels[depth],
          basis,
          parentId,
          ancestors: [...path],
          children: [],
          memberCount: 0,
          directCount: 0,
        });
        if (parentId) groups.get(parentId)!.children.push(id);
      }
      groups.get(id)!.memberCount++;
      path.push(id);
    }
    groups.get(path[path.length - 1]!)!.directCount++;
    paths.set(item.id, path);
  }
  for (const group of groups.values()) group.children.sort();
  return {
    groups,
    paths,
    items: ordered,
    edges,
    diagnostics: [...diagnostics].sort(),
  };
}

export function projectSemanticHierarchy(
  hierarchy: SemanticHierarchy,
  expanded: ReadonlySet<string> = new Set()
) {
  const groups = new Map<string, SemanticGroup>();
  const membership = new Map<string, string>();
  for (const item of hierarchy.items) {
    const path = hierarchy.paths.get(item.id)!;
    const representative =
      path.find(id => !expanded.has(id)) ?? path[path.length - 1]!;
    const node = hierarchy.groups.get(representative)!;
    const isDirect =
      representative === path[path.length - 1] &&
      expanded.has(representative) &&
      node.children.length > 0;
    const id = isDirect
      ? JSON.stringify(['direct', representative])
      : representative;
    if (!groups.has(id))
      groups.set(id, {
        id,
        label: isDirect ? `${node.label} · direct items` : node.label,
        basis: node.basis,
        hierarchyId: node.id,
        parentId: isDirect ? node.id : node.parentId,
        ancestors: isDirect ? [...node.ancestors, node.id] : node.ancestors,
        children: isDirect ? [] : node.children,
        isDirect,
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
  for (const edge of [...hierarchy.edges].sort((a, b) =>
    a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  )) {
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
    diagnostics: hierarchy.diagnostics,
  };
}

export function projectSemanticGraph(
  items: readonly SemanticItem[],
  edges: readonly SemanticEdge[],
  expanded: ReadonlySet<string> = new Set()
) {
  return projectSemanticHierarchy(
    buildSemanticHierarchy(items, edges),
    expanded
  );
}

/** Hysteresis keeps the parent readable throughout the transition band. Inspired
 * by CodeGraph's parent fallback; independent GraphDone policy/implementation. */
export function overviewAtScale(previous: boolean, scale: number): boolean {
  // Long, multiline source titles are fitted inside cards; the nominal 12px
  // counter-scale alone cannot keep them readable below normal item scale.
  return previous ? scale < 1.15 : scale < 1;
}

export function automaticSemanticExpansion(
  hierarchy: SemanticHierarchy,
  depth: number,
  capacity: number
): ReadonlySet<string> {
  const queue = [...hierarchy.groups.values()]
    .filter(group => !group.parentId)
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  let visible = queue.length;
  const expanded = new Set<string>();
  for (let i = 0; i < queue.length; i++) {
    const group = queue[i];
    if (group.ancestors.length + 1 >= depth || !group.children.length) continue;
    const added = group.children.length + (group.directCount ? 1 : 0) - 1;
    if (
      visible + added > Math.max(0, Math.floor(capacity)) ||
      !Number.isFinite(capacity)
    )
      continue;
    expanded.add(group.id);
    visible += added;
    queue.push(...group.children.map(id => hierarchy.groups.get(id)!));
  }
  return expanded;
}

export function semanticDepthAtScale(previous: number, scale: number): number {
  let depth = Math.max(
    1,
    Math.min(MAX_SEMANTIC_DEPTH, Math.floor(previous) || 1)
  );
  if (!Number.isFinite(scale) || scale <= 0) return depth;
  while (depth < MAX_SEMANTIC_DEPTH && scale >= 0.45 * 2 ** (depth - 1))
    depth++;
  while (depth > 1 && scale < 0.36 * 2 ** (depth - 2)) depth--;
  return depth;
}

export interface OverviewAnchor {
  id: string;
  x: number;
  y: number;
}
type OverviewObstacle = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

function overviewSlots(
  width: number,
  height: number,
  obstacles: readonly OverviewObstacle[]
) {
  const cardWidth = Math.min(240, Math.max(160, width - 32)),
    cardHeight = 96;
  const columns = Math.max(1, Math.floor((width - 32 + 64) / (cardWidth + 64)));
  const rows = Math.max(0, Math.floor((height - 100 + 64) / (cardHeight + 64)));
  const span = columns * (cardWidth + 64) - 64;
  const step = cardHeight + 64;
  const phase = (y: number) => 20 + ((((y - 20) % step) + step) % step);
  const phases = [
    ...new Set([
      64,
      ...obstacles.flatMap(obstacle => [
        phase(obstacle.bottom + 20),
        phase(obstacle.top - 20 - cardHeight),
      ]),
    ]),
  ]
    .sort((a, b) => Math.abs(a - 64) - Math.abs(b - 64) || a - b)
    .slice(0, 32);
  let slots: { x: number; y: number }[] = [];
  for (const offset of phases) {
    const candidate: { x: number; y: number }[] = [];
    for (let row = 0; row < rows; row++)
      for (let col = 0; col < columns; col++) {
        const slot = {
          x: (width - span) / 2 + col * (cardWidth + 64),
          y: offset + row * step,
        };
        if (
          slot.y + cardHeight <= height - 20 &&
          !obstacles.some(
            obstacle =>
              slot.x < obstacle.right + 20 &&
              slot.x + cardWidth > obstacle.left - 20 &&
              slot.y < obstacle.bottom + 20 &&
              slot.y + cardHeight > obstacle.top - 20
          )
        )
          candidate.push(slot);
      }
    if (candidate.length > slots.length) slots = candidate;
  }
  return { slots, cardWidth, cardHeight };
}

export function overviewLabelCapacity(
  width: number,
  height: number,
  obstacles: readonly OverviewObstacle[] = []
): number {
  return overviewSlots(width, height, obstacles).slots.length;
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
  }[] = [],
  preserveOrder = false
) {
  const { slots, cardWidth, cardHeight } = overviewSlots(
    width,
    height,
    obstacles
  );
  const placed: (OverviewAnchor & {
    anchorX: number;
    anchorY: number;
    width: number;
    height: number;
  })[] = [];
  const hidden: string[] = [];
  for (const anchor of preserveOrder
    ? anchors
    : [...anchors].sort((a, b) => a.id.localeCompare(b.id))) {
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
