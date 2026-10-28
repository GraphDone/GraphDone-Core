import type { SemanticEdge, SemanticItem } from './semanticLOD';

export type RelationshipDirection = 'both' | 'incoming' | 'outgoing';
export type RelationshipScope =
  | { kind: 'all' }
  | { kind: 'internal'; members: readonly string[]; label: string }
  | {
      kind: 'bundle';
      sources: readonly string[];
      targets: readonly string[];
      type: string;
      label: string;
    }
  | { kind: 'node'; id: string };

export const relationshipEndpoint = (value: SemanticEdge['source']) =>
  typeof value === 'string' ? value : value.id;

export function indexSemanticRelationships(
  items: readonly SemanticItem[],
  edges: readonly SemanticEdge[]
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
  return { byId, edges: ordered, outgoing, incoming };
}

export type SemanticRelationshipIndex = ReturnType<
  typeof indexSemanticRelationships
>;

export function scopedRelationships(
  index: SemanticRelationshipIndex,
  scope: RelationshipScope,
  direction: RelationshipDirection = 'both',
  hops: 1 | 2 = 1
): readonly SemanticEdge[] {
  if (scope.kind === 'all') return index.edges;
  if (scope.kind === 'internal') {
    const members = new Set(scope.members);
    return index.edges.filter(
      edge =>
        members.has(relationshipEndpoint(edge.source)) &&
        members.has(relationshipEndpoint(edge.target))
    );
  }
  if (scope.kind === 'bundle') {
    const sources = new Set(scope.sources),
      targets = new Set(scope.targets);
    return index.edges.filter(
      edge =>
        edge.type === scope.type &&
        sources.has(relationshipEndpoint(edge.source)) &&
        targets.has(relationshipEndpoint(edge.target))
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
