type PaintScopedEdge = {
  _priorityVisible?: boolean;
  source?: { _culled?: boolean };
  target?: { _culled?: boolean };
};

/** Whether route geometry can contribute to the current item viewport. */
export function edgeNeedsPaintGeometry(edge: PaintScopedEdge, cullActive: boolean) {
  return edge._priorityVisible !== false &&
    !(cullActive && edge.source?._culled && edge.target?._culled);
}

/** A cached route alone is stale after label avoidance dismisses its rectangle. */
export function edgeLabelHasCurrentPlacement(routeLabel: unknown, hasPlacementRect: boolean) {
  return !!routeLabel && hasPlacementRect;
}
