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
  dragged?: boolean;
}

export const ITEM_LABEL_BUDGET = {
  labels: 32,
  attempts: 128,
  checks: 200000,
} as const;

export type ItemLabelBudget = { labels: number; attempts: number; checks: number };

interface ItemLabelOptions {
  viewport: ObstacleBox;
  obstacles: readonly ObstacleBox[];
  segments: readonly Pick<EdgeRouteSegment, 'source' | 'target'>[];
}

export function placeItemLabels(
  candidates: readonly ItemLabelCandidate[],
  options: ItemLabelOptions,
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

/**
 * Whether placing the same labels again from other spots could show more: a
 * label on screen was tried and found no spot, and the label cap leaves room
 * for it. Labels off screen, not drawn, or past the cap are never tried.
 */
export function labelsMissed(
  result: { placements: ReadonlyMap<string, unknown>; attempts: number },
  limits: ItemLabelBudget = ITEM_LABEL_BUDGET
) {
  return result.placements.size < Math.min(result.attempts, limits.labels);
}

const FRESH_LABEL_RETRY_MAX = 60;

/** Keep the better placement while charging both passes to the same render budget. */
export function placeItemLabelsWithRetry(
  candidates: readonly ItemLabelCandidate[],
  options: ItemLabelOptions,
  limits: ItemLabelBudget = ITEM_LABEL_BUDGET
) {
  const first = placeItemLabels(candidates, options, limits);
  const attemptsLeft = limits.attempts - first.attempts;
  const checksLeft = limits.checks - first.checks;
  if (candidates.length > FRESH_LABEL_RETRY_MAX || attemptsLeft <= 0 || checksLeft <= 0 || !labelsMissed(first, limits)) return first;

  const hasRememberedPosition = candidates.some(candidate =>
    !candidate.dragged && candidate.eligible && (candidate.t !== 0.5 || candidate.offset < 0) &&
    candidate.route?.segments.some(segment => edgeSegmentHitsBox(segment, options.viewport))
  );
  if (!hasRememberedPosition) return first;

  const midpoints = candidates.map(candidate => candidate.dragged ? candidate : {
    ...candidate, t: 0.5, offset: Math.abs(candidate.offset),
  });
  const fresh = placeItemLabels(midpoints, options, {
    labels: limits.labels,
    attempts: attemptsLeft,
    checks: checksLeft,
  });
  return {
    placements: fresh.placements.size > first.placements.size ? fresh.placements : first.placements,
    attempts: first.attempts + fresh.attempts,
    checks: first.checks + fresh.checks,
  };
}
