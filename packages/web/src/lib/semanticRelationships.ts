import {
  buildSemanticHierarchy,
  type SemanticEdge,
  type SemanticItem,
  type SemanticHierarchy,
} from './semanticLOD';

export type RelationshipDirection = 'both' | 'incoming' | 'outgoing';
export interface RelationshipGroup {
  id: string;
  direct: boolean;
}
export type RelationshipScope =
  | { kind: 'all' }
  | { kind: 'internal'; group: RelationshipGroup }
  | {
      kind: 'bundle';
      source: RelationshipGroup;
      target: RelationshipGroup;
      type: string;
    }
  | { kind: 'node'; id: string };

export const relationshipEndpoint = (value: SemanticEdge['source']) =>
  typeof value === 'string' ? value : value.id;

export function indexSemanticRelationships(
  items: readonly SemanticItem[],
  edges: readonly SemanticEdge[],
  hierarchy: SemanticHierarchy = buildSemanticHierarchy(items, edges)
) {
  const byId = new Map(items.map(item => [item.id, item]));
  const outgoing = new Map<string, SemanticEdge[]>();
  const incoming = new Map<string, SemanticEdge[]>();
  const ordered = [...edges].sort((a, b) =>
    a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  );
  for (const edge of ordered) {
    const source = relationshipEndpoint(edge.source),
      target = relationshipEndpoint(edge.target);
    if (!outgoing.has(source)) outgoing.set(source, []);
    if (!incoming.has(target)) incoming.set(target, []);
    outgoing.get(source)!.push(edge);
    incoming.get(target)!.push(edge);
  }
  return { byId, edges: ordered, outgoing, incoming, hierarchy };
}

export type SemanticRelationshipIndex = ReturnType<
  typeof indexSemanticRelationships
>;

export function relationshipGroupLabel(
  index: SemanticRelationshipIndex,
  reference: RelationshipGroup
) {
  const group = index.hierarchy.groups.get(reference.id);
  if (!group) return undefined;
  return [
    ...group.ancestors.map(id => index.hierarchy.groups.get(id)!.label),
    group.label,
    ...(reference.direct ? ['Direct items'] : []),
  ].join(' / ');
}

export function scopedRelationships(
  index: SemanticRelationshipIndex,
  scope: RelationshipScope,
  direction: RelationshipDirection = 'both',
  hops: 1 | 2 = 1
): readonly SemanticEdge[] {
  if (scope.kind === 'all') return index.edges;
  const belongs = (id: string, reference: RelationshipGroup) => {
    const path = index.hierarchy.paths.get(id);
    return Boolean(
      path &&
        (reference.direct
          ? path[path.length - 1] === reference.id
          : path.includes(reference.id))
    );
  };
  if (scope.kind === 'internal') {
    return index.edges.filter(
      edge =>
        belongs(relationshipEndpoint(edge.source), scope.group) &&
        belongs(relationshipEndpoint(edge.target), scope.group)
    );
  }
  if (scope.kind === 'bundle') {
    return index.edges.filter(
      edge =>
        edge.type === scope.type &&
        belongs(relationshipEndpoint(edge.source), scope.source) &&
        belongs(relationshipEndpoint(edge.target), scope.target)
    );
  }
  const visited = new Set<string>();
  let frontier = new Set([scope.id]);
  const selected = new Set<SemanticEdge>();
  for (let depth = 0; depth < hops; depth++) {
    const next = new Set<string>();
    for (const id of frontier) {
      if (visited.has(id)) continue;
      visited.add(id);
      for (const edge of direction === 'incoming'
        ? []
        : (index.outgoing.get(id) ?? [])) {
        selected.add(edge);
        const target = relationshipEndpoint(edge.target);
        if (index.byId.has(target)) next.add(target);
      }
      for (const edge of direction === 'outgoing'
        ? []
        : (index.incoming.get(id) ?? [])) {
        selected.add(edge);
        const source = relationshipEndpoint(edge.source);
        if (index.byId.has(source)) next.add(source);
      }
    }
    frontier = next;
  }
  return index.edges.filter(edge => selected.has(edge));
}
