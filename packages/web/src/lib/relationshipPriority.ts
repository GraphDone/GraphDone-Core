import type { SemanticBundle, SemanticEdge } from './semanticLOD';

export const RELATIONSHIP_PRIORITY_LEVELS = [
  'essential',
  'dependencies',
  'all',
] as const;
export type RelationshipPriorityLevel =
  (typeof RELATIONSHIP_PRIORITY_LEVELS)[number];

const tiers: Readonly<Record<string, number>> = {
  BLOCKS: 0,
  CONFLICTS_WITH: 0,
  DEPENDS_ON: 1,
  ENABLES: 1,
  FOLLOWS: 1,
  VALIDATES: 1,
  SATISFIES: 1,
};

export const relationshipPriorityTier = (type: string) =>
  Object.prototype.hasOwnProperty.call(tiers, type) ? tiers[type] : 2;

export function relationshipPriorityLevel(
  value: unknown
): RelationshipPriorityLevel {
  return RELATIONSHIP_PRIORITY_LEVELS.includes(
    value as RelationshipPriorityLevel
  )
    ? (value as RelationshipPriorityLevel)
    : 'essential';
}

const endpoint = (value: SemanticEdge['source']) =>
  typeof value === 'string' ? value : value.id;
const compareText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const compare = (a: SemanticEdge, b: SemanticEdge) =>
  relationshipPriorityTier(a.type) - relationshipPriorityTier(b.type) ||
  compareText(a.type, b.type) ||
  compareText(endpoint(a.source), endpoint(b.source)) ||
  compareText(endpoint(a.target), endpoint(b.target)) ||
  compareText(a.id, b.id);

export interface PriorityPair<T extends SemanticEdge> {
  id: string;
  endpoints: readonly [string, string];
  original: readonly T[];
  represented: readonly T[];
  summarized: readonly T[];
  primary: T;
  fallback: boolean;
}

export function projectRelationshipPriority<T extends SemanticEdge>(
  items: readonly { id: string }[],
  edges: readonly T[],
  level: RelationshipPriorityLevel
) {
  const known = new Set(items.map(item => item.id));
  const grouped = new Map<
    string,
    { endpoints: [string, string]; edges: T[] }
  >();
  const pending: T[] = [];
  for (const edge of edges) {
    const source = endpoint(edge.source),
      target = endpoint(edge.target);
    if (!known.has(source) || !known.has(target)) {
      pending.push(edge);
      continue;
    }
    const endpoints: [string, string] =
      source < target ? [source, target] : [target, source];
    const id = JSON.stringify(endpoints);
    if (!grouped.has(id)) grouped.set(id, { endpoints, edges: [] });
    grouped.get(id)!.edges.push(edge);
  }
  const threshold = RELATIONSHIP_PRIORITY_LEVELS.indexOf(level);
  const pairs: PriorityPair<T>[] = [];
  const represented: T[] = [],
    summarized: T[] = [];
  const byEdge = new Map<string, PriorityPair<T>>();
  for (const [id, group] of [...grouped].sort(([a], [b]) =>
    compareText(a, b)
  )) {
    const original = group.edges.sort(compare);
    const best = relationshipPriorityTier(original[0].type);
    const admitted = Math.max(threshold, best);
    const pair: PriorityPair<T> = {
      id,
      endpoints: group.endpoints,
      original,
      primary: original[0],
      represented: original.filter(
        edge => relationshipPriorityTier(edge.type) <= admitted
      ),
      summarized: original.filter(
        edge => relationshipPriorityTier(edge.type) > admitted
      ),
      fallback: best > threshold,
    };
    pairs.push(pair);
    for (const edge of pair.represented) represented.push(edge);
    for (const edge of pair.summarized) summarized.push(edge);
    for (const edge of original) byEdge.set(edge.id, pair);
  }
  return {
    level,
    pairs,
    byEdge,
    represented,
    representedIds: new Set(represented.map(edge => edge.id)),
    summarized,
    pending: pending.sort(compare),
  };
}

export function prioritySemanticBundles(
  bundles: readonly SemanticBundle[],
  representedIds: ReadonlySet<string>
): SemanticBundle[] {
  return bundles.flatMap(bundle => {
    const edges = bundle.edges.filter(edge => representedIds.has(edge.id));
    return edges.length ? [{ ...bundle, edges }] : [];
  });
}
