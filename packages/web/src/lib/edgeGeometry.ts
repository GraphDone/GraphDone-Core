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

/** A small margin kept around an edge label (px). */
export const LABEL_MARGIN = 14;

/**
 * Distance from a card's center to where the edge crosses its border, along
 * direction (dx,dy) — i.e. how much of the edge the card actually covers at
 * this angle (NOT the worst-case corner). With direction unknown (0,0), falls
 * back to the half short-side. Mirrors rectBorderPoint's reach.
 */
export function borderReach(dims: Dims, dx: number, dy: number): number {
  const hw = dims.width / 2;
  const hh = dims.height / 2;
  if (dx === 0 && dy === 0) return Math.min(hw, hh);
  const sx = dx !== 0 ? hw / Math.abs(dx) : Infinity;
  const sy = dy !== 0 ? hh / Math.abs(dy) : Infinity;
  const s = Math.min(sx, sy);
  return Math.hypot(dx * s, dy * s);
}

export interface MinNeighbor { x: number; y: number; minLen: number; }

/**
 * Clamp a dragged node's target so it never sits closer than `minLen` to any
 * neighbor — drag-time enforcement of the minimum-edge-length rule. Projects
 * the target out of each neighbor's min-radius circle; a few passes resolve
 * multiple neighbors approximately (the cursor simply can't push past the
 * nearest constraint). Pure — the caller supplies neighbor positions + mins.
 */
export function clampToMinNeighbors(target: Pt, neighbors: MinNeighbor[], iterations = 4): Pt {
  let x = target.x;
  let y = target.y;
  for (let i = 0; i < iterations; i++) {
    let moved = false;
    for (const n of neighbors) {
      if (!(n.minLen > 0)) continue;
      let dx = x - n.x;
      let dy = y - n.y;
      let dist = Math.hypot(dx, dy);
      if (dist === 0) { dx = 1; dy = 0; dist = 1; } // arbitrary push-out direction
      if (dist < n.minLen) {
        const s = n.minLen / dist;
        x = n.x + dx * s;
        y = n.y + dy * s;
        moved = true;
      }
    }
    if (!moved) break;
  }
  return { x, y };
}

/**
 * Minimum CENTER-to-CENTER distance so the edge label fits in the
 * border-to-border gap with just a small margin — NOT an oversized buffer.
 * The visible gap = centerLen − reach(src) − reach(tgt); using the per-angle
 * border reach (pass the edge direction dx,dy) makes the gap = labelWidth +
 * margin exactly. Returns 0 for a zero-width label (no constraint).
 */
export function minEdgeLength(
  sourceDims: Dims,
  targetDims: Dims,
  labelWidth: number,
  dx = 0,
  dy = 0,
  margin = LABEL_MARGIN
): number {
  if (!(labelWidth > 0)) return 0;
  // Center distance whose BORDER-TO-BORDER gap is exactly labelWidth + a small
  // margin. We use the per-angle border reach (not the half-diagonal), so the
  // visible edge is just long enough for the label — no excessive buffer.
  return borderReach(sourceDims, dx, dy) + borderReach(targetDims, dx, dy) + labelWidth + margin;
}
