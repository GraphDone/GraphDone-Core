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
  labels: 64,
  attempts: 160,
  checks: 200000,
} as const;

export type ItemLabelBudget = { labels: number; attempts: number; checks: number };

export function placeItemLabels(
  candidates: readonly ItemLabelCandidate[],
  options: {
    viewport: ObstacleBox;
    obstacles: readonly ObstacleBox[];
    segments: readonly Pick<EdgeRouteSegment, 'source' | 'target'>[];
  },
  limits: ItemLabelBudget = ITEM_LABEL_BUDGET
) {
  const placements = new Map<string, EdgeRouteLabel>();
  const occupied: ObstacleBox[] = [];
  const budget = { remaining: limits.checks };
  let attempts = 0;
  for (const candidate of [...candidates].sort((a, b) =>
    (a.priority ?? 0) - (b.priority ?? 0) || a.id.localeCompare(b.id)
  )) {
    if (
      placements.size >= limits.labels ||
      attempts >= limits.attempts ||
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
    occupied.push({
      x: placement.x,
      y: placement.y,
      width: candidate.dims.width,
      height: candidate.dims.height,
      rotation: placement.rotation,
    });
  }
  return {
    placements,
    attempts,
    checks: limits.checks - budget.remaining,
  };
}
