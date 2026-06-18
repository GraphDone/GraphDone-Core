/**
 * Edge level-of-detail (#22): pure, zoom-aware rules for how edges render —
 * direction indication, arrow/label fade, and parallel-edge bundling/offset —
 * so multiple edges stay legible at every zoom level. No D3/DOM here; the
 * renderer calls these during tick/zoom updates.
 */

// Zoom thresholds (mirror the node LOD bands so edges degrade in step).
export const EDGE_LOD = {
  VERY_FAR: 0.3, // below: hide direction entirely
  FAR: 0.5,      // below: arrows hidden; minimal direction marker
  CLOSE: 0.6,    // at/above: full arrows + labels
  LABEL_IN: 0.4, // labels start fading in here
  LABEL_FULL: 0.8, // labels at full opacity here
  MIN_PAIR_DIST: 80, // node-centre distance under which parallels must bundle
  PARALLEL_GAP: 14, // base perpendicular spacing between parallel edges (px, graph units)
} as const;

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

/** How to indicate edge direction at this zoom: hidden / minimal marker / full arrow. */
export function directionStrategy(scale: number): 'hidden' | 'minimal' | 'full' {
  if (scale < EDGE_LOD.VERY_FAR) return 'hidden';
  if (scale < EDGE_LOD.FAR) return 'minimal';
  return 'full';
}

/** Arrow head visibility/fade + size (smaller when many parallels share a pair). */
export function arrowVisibility(scale: number, edgeCount = 1): { visible: boolean; opacity: number; scale: number } {
  const opacity = scale < EDGE_LOD.FAR ? 0 : clamp01((scale - EDGE_LOD.FAR) / (EDGE_LOD.CLOSE - EDGE_LOD.FAR));
  const size = edgeCount > 1 ? Math.max(0.5, 1 - (edgeCount - 1) * 0.1) : 1;
  return { visible: opacity > 0, opacity, scale: size };
}

/** Label opacity (0..1): fades over LABEL_IN→LABEL_FULL, dimmed when edges crowd. */
export function labelVisibility(scale: number, edgeCount = 1): number {
  const base = clamp01((scale - EDGE_LOD.LABEL_IN) / (EDGE_LOD.LABEL_FULL - EDGE_LOD.LABEL_IN));
  const crowd = edgeCount > 1 ? 1 / Math.sqrt(edgeCount) : 1;
  return clamp01(base * crowd);
}

/** Bundle parallel edges (collapse to one path) when zoomed out or nodes too close. */
export function shouldBundleEdges(scale: number, edgeCount: number, nodeDistance: number): boolean {
  if (edgeCount <= 1) return false;
  return scale < EDGE_LOD.FAR - 0.05 || nodeDistance < EDGE_LOD.MIN_PAIR_DIST;
}

/**
 * Perpendicular offset for edge `edgeIndex` of `totalCount` parallels: a signed
 * distance (graph units) to shift the edge off the centre line so siblings don't
 * overlap. Symmetric around 0; collapses toward 0 as you zoom out.
 */
export function perpendicularOffset(edgeIndex: number, totalCount: number, scale: number): number {
  if (totalCount <= 1) return 0;
  const centred = edgeIndex - (totalCount - 1) / 2; // …,-1,0,1,…
  const zoomFactor = clamp01((scale - EDGE_LOD.VERY_FAR) / (EDGE_LOD.CLOSE - EDGE_LOD.VERY_FAR));
  return centred * EDGE_LOD.PARALLEL_GAP * zoomFactor;
}
