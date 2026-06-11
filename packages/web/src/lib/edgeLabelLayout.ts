/**
 * Edge label layout: clear algorithm for keeping labels off the node cards.
 *
 * Model: an edge is the segment source→target. Each endpoint is covered by
 * its node card (an axis-aligned box) plus padding. The "clear segment"
 * [t0, t1] is the parameter range of the line not covered by either box.
 * Labels are placed at parameter t within that range (default: its middle),
 * offset perpendicular to the edge, with rotation kept within ±90° so text
 * reads upright. Users may slide a label along its edge; the slide is the
 * pointer projected back onto the segment and clamped to the clear range.
 */

export interface Point {
  x: number;
  y: number;
}

export interface Dims {
  width: number;
  height: number;
}

export interface Segment {
  t0: number;
  t1: number;
}

export interface LabelPlacement {
  x: number;
  y: number;
  rotation: number;
  /** The t actually used after clamping — persist this as the user's slide. */
  t: number;
}

const DEFAULT_PADDING = 10;
const PERP_OFFSET = 22;

/**
 * Conservative card-exclusion radius along the edge direction: half the box
 * diagonal. Cheap, rotation-free, and never under-estimates the card.
 */
function exclusionRadius(dims: Dims, padding: number): number {
  return Math.hypot(dims.width, dims.height) / 2 + padding;
}

export function clearSegment(
  source: Point,
  target: Point,
  sourceDims: Dims,
  targetDims: Dims,
  padding: number = DEFAULT_PADDING
): Segment {
  const length = Math.hypot(target.x - source.x, target.y - source.y);
  if (length === 0) return { t0: 0.5, t1: 0.5 };

  // For near-axis edges the diagonal radius over-excludes; use the box's
  // projection onto the edge direction instead.
  const ux = Math.abs(target.x - source.x) / length;
  const uy = Math.abs(target.y - source.y) / length;
  const project = (d: Dims) => (d.width / 2) * ux + (d.height / 2) * uy + padding;

  const t0 = Math.min(1, project(sourceDims) / length);
  const t1 = Math.max(0, 1 - project(targetDims) / length);
  if (t0 > t1) {
    // Cards overlap along the edge — collapse to the midpoint of the overlap.
    const mid = (Math.max(0, Math.min(1, t0)) + Math.max(0, Math.min(1, t1))) / 2;
    return { t0: mid, t1: mid };
  }
  return { t0, t1 };
}

export function clampLabelT(t: number, segment: Segment): number {
  if (segment.t0 > segment.t1) return 0.5;
  return Math.max(segment.t0, Math.min(segment.t1, t));
}

export interface PlacementInput {
  source: Point;
  target: Point;
  sourceDims: Dims;
  targetDims: Dims;
  /** Desired slide position along the edge; defaults to the clear-segment middle. */
  t?: number;
  padding?: number;
  perpOffset?: number;
}

export function edgeLabelPlacement(input: PlacementInput): LabelPlacement {
  const { source, target, sourceDims, targetDims } = input;
  const padding = input.padding ?? DEFAULT_PADDING;
  const perpOffset = input.perpOffset ?? PERP_OFFSET;

  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const length = Math.hypot(dx, dy);
  if (length === 0) {
    return { x: source.x, y: source.y - perpOffset, rotation: 0, t: 0.5 };
  }

  const segment = clearSegment(source, target, sourceDims, targetDims, padding);
  const defaultT = (segment.t0 + segment.t1) / 2;
  const t = clampLabelT(input.t ?? defaultT, segment);

  const px = source.x + dx * t;
  const py = source.y + dy * t;

  let angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  // Keep text upright; the perpendicular flips with it so the label stays on
  // a consistent visual side of the line.
  let side = 1;
  if (angle > 90 || angle < -90) {
    angle = angle > 90 ? angle - 180 : angle + 180;
    side = -1;
  }

  const perp = ((Math.atan2(dy, dx) + Math.PI / 2) * side);
  const x = px + Math.cos(perp) * perpOffset * -1;
  const y = py + Math.sin(perp) * perpOffset * -1;

  return { x, y, rotation: angle, t };
}

export interface ObstacleBox {
  /** Center coordinates. */
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ChooseTInput extends PlacementInput {
  /** All node cards in the graph (centers + dims). Endpoint cards are fine to include. */
  obstacles: ObstacleBox[];
  labelDims: Dims;
}

const T_SAMPLES = [0, 0.12, -0.12, 0.24, -0.24, 0.36, -0.36, 0.48, -0.48];

function overlapArea(cx: number, cy: number, dims: Dims, o: ObstacleBox): number {
  const ox = Math.min(cx + dims.width / 2, o.x + o.width / 2) - Math.max(cx - dims.width / 2, o.x - o.width / 2);
  const oy = Math.min(cy + dims.height / 2, o.y + o.height / 2) - Math.max(cy - dims.height / 2, o.y - o.height / 2);
  return ox > 0 && oy > 0 ? ox * oy : 0;
}

/**
 * Obstacle-aware slide position: sample t values across the clear segment
 * (center-out, so the label stays as centered as possible) and take the
 * first collision-free spot; if every candidate collides, take the least-bad
 * one. O(samples × obstacles) — cheap enough to run at simulation settle.
 */
export function chooseLabelT(input: ChooseTInput): number {
  const { obstacles, labelDims: rawDims, ...placement } = input;
  // The label renders rotated to the edge angle; score with its axis-aligned
  // footprint so "clear" in the scorer means clear on screen too.
  const angle = Math.atan2(input.target.y - input.source.y, input.target.x - input.source.x);
  const cos = Math.abs(Math.cos(angle));
  const sin = Math.abs(Math.sin(angle));
  const labelDims: Dims = {
    width: rawDims.width * cos + rawDims.height * sin,
    height: rawDims.width * sin + rawDims.height * cos
  };
  const segment = clearSegment(
    input.source,
    input.target,
    input.sourceDims,
    input.targetDims,
    input.padding ?? DEFAULT_PADDING
  );
  const center = (segment.t0 + segment.t1) / 2;
  const span = Math.max(0, segment.t1 - segment.t0);

  let bestT = center;
  let bestScore = Infinity;
  for (const offset of T_SAMPLES) {
    const t = clampLabelT(center + offset * span, segment);
    const placed = edgeLabelPlacement({ ...placement, t });
    let score = 0;
    for (const o of obstacles) {
      score += overlapArea(placed.x, placed.y, labelDims, o);
      if (score >= bestScore) break;
    }
    if (score === 0) return t;
    if (score < bestScore) {
      bestScore = score;
      bestT = t;
    }
  }
  return bestT;
}

/** Project a pointer (graph coordinates) onto the edge and clamp to the clear segment. */
export function slideTFromPointer(
  pointer: Point,
  source: Point,
  target: Point,
  segment: Segment
): number {
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) return 0.5;
  const raw = ((pointer.x - source.x) * dx + (pointer.y - source.y) * dy) / lengthSq;
  return clampLabelT(raw, segment);
}
