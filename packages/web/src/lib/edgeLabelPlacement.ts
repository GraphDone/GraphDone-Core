import {
  edgeRouteLabel,
  edgeSegmentHitsBox,
  type EdgeRouteGeometry,
  type EdgeRouteLabel,
  type EdgeRouteSegment,
} from './edgeRouteGeometry';
import type { Dims, ObstacleBox } from './edgeLabelLayout';

export interface ItemLabelCandidate {
  id: string;
  route: EdgeRouteGeometry | null;
  eligible: boolean;
  dims: Dims;
  t: number;
  offset: number;
  priority?: number;
}

export const ITEM_LABEL_BUDGET = {
  labels: 32,
  attempts: 128,
  checks: 200000,
} as const;

export function placeItemLabels(
  candidates: readonly ItemLabelCandidate[],
  options: {
    viewport: ObstacleBox;
    obstacles: readonly ObstacleBox[];
    segments: readonly Pick<EdgeRouteSegment, 'source' | 'target'>[];
  }
) {
  const placements = new Map<string, EdgeRouteLabel>();
  const occupied: ObstacleBox[] = [];
  const budget = { remaining: ITEM_LABEL_BUDGET.checks as number };
  let attempts = 0;
  for (const candidate of [...candidates].sort((a, b) =>
    (a.priority ?? 0) - (b.priority ?? 0) || a.id.localeCompare(b.id)
  )) {
    if (
      placements.size >= ITEM_LABEL_BUDGET.labels ||
      attempts >= ITEM_LABEL_BUDGET.attempts ||
      budget.remaining <= 0
    )
      break;
    if (
      !candidate.eligible ||
      !candidate.route ||
      !candidate.route.segments.some(segment =>
        edgeSegmentHitsBox(segment, options.viewport)
      )
    )
      continue;
    attempts++;
    const placement = edgeRouteLabel(candidate.route, {
      dims: candidate.dims,
      t: candidate.t,
      offset: candidate.offset,
      offsets: [candidate.offset, -candidate.offset],
      obstacles: options.obstacles.concat(occupied),
      segments: options.segments,
      viewport: options.viewport,
      budget,
    });
    if (!placement) continue;
    placements.set(candidate.id, placement);
    const angle = (placement.rotation * Math.PI) / 180;
    occupied.push({
      x: placement.x,
      y: placement.y,
      width:
        Math.abs(Math.cos(angle)) * candidate.dims.width +
        Math.abs(Math.sin(angle)) * candidate.dims.height,
      height:
        Math.abs(Math.sin(angle)) * candidate.dims.width +
        Math.abs(Math.cos(angle)) * candidate.dims.height,
    });
  }
  return {
    placements,
    attempts,
    checks: ITEM_LABEL_BUDGET.checks - budget.remaining,
  };
}
