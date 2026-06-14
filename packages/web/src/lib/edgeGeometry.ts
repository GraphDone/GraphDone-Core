/**
 * Edge geometry: where an edge meets a node, and how far apart connected nodes
 * must sit for their label to fit. Pure functions, no D3 — unit-testable and
 * shared by the renderer (border attachment) and the force sim (min length).
 *
 * Model: a node card is an axis-aligned box centered at (x,y). An edge is the
 * straight line between two node centers; it should *draw* from border to
 * border (the point where that line crosses each card), and the two nodes
 * should never sit so close that the edge's label can't fit in the gap.
 */

export interface Pt { x: number; y: number; }
export interface Dims { width: number; height: number; }

/**
 * The point on a node card's border along the ray from its center toward
 * `toward`. As the two nodes move around each other this point slides around
 * the border, always giving the shortest border-to-border connection.
 *
 * If the cards overlap (the other center is inside this card) the scaled point
 * lands outside the segment; we clamp to the border so the result is always on
 * the card edge, never past `toward`.
 */
export function rectBorderPoint(center: Pt, dims: Dims, toward: Pt): Pt {
  const dx = toward.x - center.x;
  const dy = toward.y - center.y;
  if (dx === 0 && dy === 0) return { x: center.x, y: center.y };
  const hw = dims.width / 2;
  const hh = dims.height / 2;
  const sx = dx !== 0 ? hw / Math.abs(dx) : Infinity;
  const sy = dy !== 0 ? hh / Math.abs(dy) : Infinity;
  // Smaller scale = the first border (vertical vs horizontal) the ray hits.
  const s = Math.min(sx, sy);
  return { x: center.x + dx * s, y: center.y + dy * s };
}

export interface EdgeEndpoints { x1: number; y1: number; x2: number; y2: number; }

/**
 * Border-to-border endpoints for an edge: from the source card's border (facing
 * the target) to the target card's border (facing the source).
 */
export function edgeBorderEndpoints(
  source: Pt,
  sourceDims: Dims,
  target: Pt,
  targetDims: Dims
): EdgeEndpoints {
  const p1 = rectBorderPoint(source, sourceDims, target);
  const p2 = rectBorderPoint(target, targetDims, source);
  return { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y };
}

/** Half the box diagonal — the largest distance from center to border (a
 * corner), i.e. the worst-case projection of the card onto any edge angle. */
export function halfDiagonal(dims: Dims): number {
  return Math.hypot(dims.width, dims.height) / 2;
}

/**
 * Minimum CENTER-to-CENTER distance so the edge label always fits in the
 * border-to-border gap, at ANY angle. The visible gap = centerLen − proj(src) −
 * proj(tgt); projection peaks at the half-diagonal (edge toward a corner), so
 * requiring centerLen ≥ halfDiag(src) + halfDiag(tgt) + labelWidth + pad
 * guarantees gap ≥ labelWidth regardless of how the nodes are oriented.
 *
 * Returns 0 for a zero-width label (no constraint).
 */
export function minEdgeLength(
  sourceDims: Dims,
  targetDims: Dims,
  labelWidth: number,
  pad = 16
): number {
  if (!(labelWidth > 0)) return 0;
  return halfDiagonal(sourceDims) + halfDiagonal(targetDims) + labelWidth + pad;
}
