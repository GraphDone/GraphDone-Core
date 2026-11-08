import type { SemanticBundle, SemanticGroup } from './semanticLOD';

export interface SemanticTraceSelection {
  groupId: string;
  direction: 'incoming' | 'outgoing';
  page: number;
}

export function projectSemanticTrace(
  groups: readonly SemanticGroup[],
  bundles: readonly SemanticBundle[],
  selection: SemanticTraceSelection,
  capacity: number
) {
  const focus = groups.find(group => group.id === selection.groupId);
  const endpoint = selection.direction === 'incoming' ? 'target' : 'source';
  const neighbor = selection.direction === 'incoming' ? 'source' : 'target';
  const related = focus
    ? bundles.filter(bundle => bundle[endpoint] === focus.id)
    : [];
  const neighbors = [
    ...new Set(related.map(bundle => bundle[neighbor])),
  ].sort();
  const pageSize = Math.max(
    1,
    Math.min(5, (Number.isFinite(capacity) ? Math.floor(capacity) : 0) - 1)
  );
  const pages = Math.max(1, Math.ceil(neighbors.length / pageSize));
  const page = Math.max(
    0,
    Math.min(pages - 1, Math.floor(selection.page) || 0)
  );
  const selected = new Set(
    neighbors.slice(page * pageSize, (page + 1) * pageSize)
  );
  return {
    focus,
    page,
    pages,
    totalNeighbors: neighbors.length,
    shownNeighbors: capacity >= 2 ? selected.size : 0,
    groups: focus
      ? [
          focus,
          ...(capacity >= 2
            ? groups.filter(group => selected.has(group.id))
            : []),
        ]
      : [],
    bundles:
      capacity >= 2
        ? related.filter(bundle => selected.has(bundle[neighbor]))
        : [],
    hasRoom: capacity >= 2,
  };
}
