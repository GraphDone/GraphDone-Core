import {
  buildSemanticHierarchy,
  projectSemanticHierarchy,
  type SemanticEdge,
  type SemanticItem,
} from './semanticLOD';
import { relationshipPriorityTier } from './relationshipPriority';

export const SUBGRAPH_PREVIEW_ITEMS = 300;
export const SUBGRAPH_PREVIEW_EDGES = 600;
const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

export function projectSubgraphPreview(
  items: readonly SemanticItem[],
  edges: readonly SemanticEdge[]
) {
  const projection = projectSemanticHierarchy(
    buildSemanticHierarchy(items, edges)
  );
  const groups = [...projection.groups].sort(
    (a, b) =>
      b.blocked - a.blocked ||
      b.members.length - a.members.length ||
      compare(a.id, b.id)
  );
  const labels = new Map(groups.map(group => [group.id, group.label]));
  const connections = projection.bundles.map(bundle => ({
    ...bundle,
    sourceLabel: labels.get(bundle.source)!,
    targetLabel: labels.get(bundle.target)!,
  }));
  for (const group of groups) {
    const byType = new Map<string, SemanticEdge[]>();
    for (const edge of group.internalEdges) {
      if (!byType.has(edge.type)) byType.set(edge.type, []);
      byType.get(edge.type)!.push(edge);
    }
    for (const [type, original] of byType)
      connections.push({
        id: JSON.stringify([group.id, group.id, type]),
        source: group.id,
        target: group.id,
        sourceLabel: group.label,
        targetLabel: group.label,
        type,
        edges: original,
      });
  }
  connections.sort(
    (a, b) =>
      relationshipPriorityTier(a.type) - relationshipPriorityTier(b.type) ||
      b.edges.length - a.edges.length ||
      compare(a.id, b.id)
  );
  return {
    groups,
    visibleGroups: groups.slice(0, 4).map(group => ({
      ...group,
      examples: [...group.members]
        .sort((a, b) => compare(a.title, b.title) || compare(a.id, b.id))
        .filter(
          (item, index, ordered) =>
            index === 0 || item.title !== ordered[index - 1].title
        )
        .slice(0, 2),
    })),
    connections,
    visibleConnections: connections.slice(0, 3),
    pending: projection.pendingEdges,
  };
}
