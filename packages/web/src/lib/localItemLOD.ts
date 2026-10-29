import type { SemanticEdge, SemanticItem } from './semanticLOD';
import type { SchematicConnection } from './schematicRouting';
import {
  relationshipEndpoint,
  type SemanticRelationshipIndex,
} from './semanticRelationships';
import { relationshipPriorityTier } from './relationshipPriority';

export interface LocalItemGroup {
  id: string;
  label: string;
  members: readonly SemanticItem[];
  edgeIds: readonly string[];
}

export type LocalItemCard =
  | { kind: 'item'; id: string; item: SemanticItem; isFocus: boolean }
  | {
      kind: 'summary';
      id: string;
      groupId: string;
      label: string;
      members: readonly SemanticItem[];
      edgeIds: readonly string[];
    };

export interface LocalItemPartitions {
  representedCandidates: SemanticEdge[];
  prioritySummarized: SemanticEdge[];
  pending: SemanticEdge[];
  internal: SemanticEdge[];
  spatialDeferred: SemanticEdge[];
}

export interface LocalItemNeighborhoodOptions {
  capacity: number;
  page: number;
  groupId?: string;
  representedIds?: ReadonlySet<string>;
}

const compareText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const titleOrder = new Intl.Collator('en', {
  numeric: true,
  sensitivity: 'base',
});
const compareTitle = (a: string, b: string) =>
  titleOrder.compare(a, b) || compareText(a, b);
const compareEdge = (a: SemanticEdge, b: SemanticEdge) =>
  relationshipPriorityTier(a.type) - relationshipPriorityTier(b.type) ||
  compareText(a.type, b.type) ||
  compareText(a.id, b.id);

export function projectItemNeighborhood(
  index: SemanticRelationshipIndex,
  focusId: string,
  options: LocalItemNeighborhoodOptions
) {
  const capacity = Number.isFinite(options.capacity)
    ? Math.max(0, Math.min(7, Math.floor(options.capacity)))
    : 0;
  const focus = index.byId.get(focusId);
  const originalById = new Map<string, SemanticEdge>();
  let incidentEntriesVisited = 0;
  for (const adjacent of [
    index.outgoing.get(focusId),
    index.incoming.get(focusId),
  ]) {
    for (const edge of adjacent ?? []) {
      incidentEntriesVisited++;
      if (
        relationshipEndpoint(edge.source) === focusId ||
        relationshipEndpoint(edge.target) === focusId
      )
        originalById.set(edge.id, edge);
    }
  }
  const incident = [...originalById.values()].sort(compareEdge);
  const neighborEdges = new Map<string, SemanticEdge[]>();
  const neighborPriority = new Map<string, number>();
  const incomingPriority = new Map<string, number>();
  const outgoingPriority = new Map<string, number>();
  for (const edge of incident) {
    const source = relationshipEndpoint(edge.source);
    const target = relationshipEndpoint(edge.target);
    const neighbor = source === focusId ? target : source;
    if (neighbor === focusId) continue;
    if (!neighborEdges.has(neighbor)) neighborEdges.set(neighbor, []);
    neighborEdges.get(neighbor)!.push(edge);
    neighborPriority.set(
      neighbor,
      Math.min(
        neighborPriority.get(neighbor) ?? Infinity,
        relationshipPriorityTier(edge.type)
      )
    );
    if (!options.representedIds || options.representedIds.has(edge.id)) {
      const direction =
        source === focusId ? outgoingPriority : incomingPriority;
      direction.set(
        neighbor,
        Math.min(
          direction.get(neighbor) ?? Infinity,
          relationshipPriorityTier(edge.type)
        )
      );
    }
  }
  const compareItem = (a: SemanticItem, b: SemanticItem) =>
    (neighborPriority.get(a.id) ?? Infinity) -
      (neighborPriority.get(b.id) ?? Infinity) ||
    compareTitle(a.title, b.title) ||
    compareText(a.id, b.id);
  const neighbors = [...neighborEdges.keys()]
    .flatMap(id => {
      const value = index.byId.get(id);
      return value ? [value] : [];
    })
    .sort(compareItem);
  const groupByMember = new Map<string, string>();
  const grouped = new Map<
    string,
    { label: string; members: SemanticItem[]; edges: SemanticEdge[] }
  >();
  for (const member of neighbors) {
    const path = index.hierarchy.paths.get(member.id) ?? [];
    const leaf = path[path.length - 1];
    const definition = leaf ? index.hierarchy.groups.get(leaf) : undefined;
    const id = definition?.id ?? JSON.stringify(['local-type', member.type]);
    const label = definition
      ? [
          ...path.flatMap(key => {
            const group = index.hierarchy.groups.get(key);
            return group ? [group.label] : [];
          }),
          ...(definition.children.length ? ['Direct items'] : []),
        ].join(' / ')
      : member.type.replace(/[_-]+/g, ' ');
    groupByMember.set(member.id, id);
    if (!grouped.has(id)) grouped.set(id, { label, members: [], edges: [] });
    grouped.get(id)!.members.push(member);
    grouped.get(id)!.edges.push(...neighborEdges.get(member.id)!);
  }
  const groups: LocalItemGroup[] = [...grouped]
    .map(([id, group]) => ({
      id,
      label: group.label,
      members: group.members,
      edgeIds: group.edges.map(edge => edge.id).sort(compareText),
    }))
    .sort(
      (a, b) =>
        (neighborPriority.get(a.members[0].id) ?? Infinity) -
          (neighborPriority.get(b.members[0].id) ?? Infinity) ||
        compareTitle(a.label, b.label) ||
        compareText(a.id, b.id)
    );
  const missingGroup =
    options.groupId !== undefined &&
    !index.hierarchy.groups.has(options.groupId) &&
    !grouped.has(options.groupId);
  const scopedNeighbors =
    options.groupId === undefined
      ? neighbors
      : neighbors.filter(
          member => groupByMember.get(member.id) === options.groupId
        );
  const scopedGroups =
    options.groupId === undefined
      ? groups
      : groups.filter(group => group.id === options.groupId);
  const available = focus ? Math.max(0, capacity - 1) : 0;
  const summaryBudget =
    scopedNeighbors.length > available && available >= 2
      ? Math.min(capacity >= 5 ? 2 : 1, available - 1, scopedGroups.length)
      : 0;
  const pageSize = Math.max(1, available - summaryBudget);
  const pages = Math.max(1, Math.ceil(scopedNeighbors.length / pageSize));
  const page = Math.min(
    pages - 1,
    Number.isFinite(options.page) ? Math.max(0, Math.floor(options.page)) : 0
  );
  let pagingNeighbors = scopedNeighbors;
  if (pageSize >= 2) {
    const bestFor = (priority: ReadonlyMap<string, number>) =>
      scopedNeighbors.reduce<SemanticItem | undefined>((best, member) => {
        const tier = priority.get(member.id);
        if (tier === undefined) return best;
        if (
          !best ||
          tier < priority.get(best.id)! ||
          (tier === priority.get(best.id)! &&
            (compareTitle(member.title, best.title) ||
              compareText(member.id, best.id)) < 0)
        )
          return member;
        return best;
      }, undefined);
    const incoming = bestFor(incomingPriority),
      outgoing = bestFor(outgoingPriority);
    if (incoming && outgoing) {
      const representatives = [
        { item: incoming, tier: incomingPriority.get(incoming.id)! },
        { item: outgoing, tier: outgoingPriority.get(outgoing.id)! },
      ].sort(
        (a, b) =>
          a.tier - b.tier ||
          compareTitle(a.item.title, b.item.title) ||
          compareText(a.item.id, b.item.id)
      );
      const promoted = [
        ...new Map(
          representatives.map(value => [value.item.id, value.item])
        ).values(),
      ];
      const promotedIds = new Set(promoted.map(member => member.id));
      pagingNeighbors = [
        ...promoted,
        ...scopedNeighbors.filter(member => !promotedIds.has(member.id)),
      ];
    }
  }
  const selected = available
    ? pagingNeighbors.slice(page * pageSize, (page + 1) * pageSize)
    : [];
  const selectedIds = new Set(selected.map(member => member.id));
  const overflowGroups: LocalItemGroup[] = groups.flatMap(group => {
    const members = group.members.filter(member => !selectedIds.has(member.id));
    return members.length
      ? [
          {
            id: group.id,
            label: group.label,
            members,
            edgeIds: members
              .flatMap(member =>
                neighborEdges.get(member.id)!.map(edge => edge.id)
              )
              .sort(compareText),
          },
        ]
      : [];
  });
  const summaries = overflowGroups
    .filter(
      group => options.groupId === undefined || group.id === options.groupId
    )
    .slice(0, summaryBudget);
  const cards: LocalItemCard[] =
    focus && capacity > 0
      ? [
          { kind: 'item', id: focus.id, item: focus, isFocus: true },
          ...selected.map(member => ({
            kind: 'item' as const,
            id: member.id,
            item: member,
            isFocus: false,
          })),
        ]
      : [];
  const displayByOriginal = new Map(cards.map(card => [card.id, card.id]));
  for (const group of summaries) {
    let id = JSON.stringify(['local-summary', focusId, group.id]);
    while (index.byId.has(id)) id = `summary:${id}`;
    cards.push({
      kind: 'summary',
      id,
      groupId: group.id,
      label: group.label,
      members: group.members,
      edgeIds: group.edgeIds,
    });
    for (const member of group.members) displayByOriginal.set(member.id, id);
  }
  const partitions: LocalItemPartitions = {
    representedCandidates: [],
    prioritySummarized: [],
    pending: [],
    internal: [],
    spatialDeferred: [],
  };
  const connectionsById = new Map<
    string,
    SchematicConnection & { edgeIds: string[] }
  >();
  for (const edge of incident) {
    const source = relationshipEndpoint(edge.source),
      target = relationshipEndpoint(edge.target);
    if (!index.byId.has(source) || !index.byId.has(target)) {
      partitions.pending.push(edge);
    } else if (source === target) {
      partitions.internal.push(edge);
    } else if (options.representedIds && !options.representedIds.has(edge.id)) {
      partitions.prioritySummarized.push(edge);
    } else {
      const shownSource = displayByOriginal.get(source),
        shownTarget = displayByOriginal.get(target);
      if (!shownSource || !shownTarget) {
        partitions.spatialDeferred.push(edge);
        continue;
      }
      partitions.representedCandidates.push(edge);
      const id = JSON.stringify([
        'local-connection',
        shownSource,
        shownTarget,
        edge.type,
      ]);
      if (!connectionsById.has(id))
        connectionsById.set(id, {
          id,
          source: shownSource,
          target: shownTarget,
          type: edge.type,
          edgeIds: [],
          priority: relationshipPriorityTier(edge.type),
        });
      connectionsById.get(id)!.edgeIds.push(edge.id);
    }
  }
  const connections: SchematicConnection[] = [...connectionsById.values()]
    .map(connection => ({
      ...connection,
      edgeIds: connection.edgeIds.sort(compareText),
    }))
    .sort(
      (a, b) =>
        a.priority! - b.priority! ||
        compareText(a.type, b.type) ||
        compareText(a.source, b.source) ||
        compareText(a.target, b.target)
    );
  return {
    focus,
    capacity,
    cards,
    connections,
    groups,
    overflowGroups,
    incident,
    neighbors,
    groupId: options.groupId,
    missingGroup,
    page,
    pageSize,
    pages,
    partitions,
    counts: {
      incident: incident.length,
      neighbors: neighborEdges.size,
      loadedNeighbors: neighbors.length,
      shownNeighbors: selected.length,
      summaryNeighbors: summaries.reduce(
        (sum, group) => sum + group.members.length,
        0
      ),
      representedCandidates: partitions.representedCandidates.length,
      prioritySummarized: partitions.prioritySummarized.length,
      pending: partitions.pending.length,
      internal: partitions.internal.length,
      spatialDeferred: partitions.spatialDeferred.length,
    },
    work: {
      incidentEntriesVisited,
      neighborsConsidered: neighbors.length,
      groups: groups.length,
    },
  };
}
