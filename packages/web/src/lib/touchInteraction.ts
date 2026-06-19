/**
 * Pure touch-interaction logic for the graph (#29 mobile touch overhaul). The D3
 * layer feeds raw touch timing/movement here and applies the verdicts; keeping
 * the thresholds + classification here makes them unit-testable without a DOM.
 *
 * Gestures on a node:
 *  - tap         → select / open (short, didn't move)
 *  - long-press  → context menu (held, didn't move)
 *  - drag/pan    → move the node or pan the canvas (moved past the slop)
 */
export const MIN_TOUCH_TARGET = 44; // px — WCAG 2.5.5 / Apple HIG minimum
export const TAP_MAX_MS = 500;      // held longer (without moving) = long-press
export const TAP_MAX_MOVE_PX = 10;  // moved farther = drag/pan, not a tap

export function distance(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}

/** A quick touch that didn't move = a tap (select/open). */
export function isTap(
  durationMs: number,
  movePx: number,
  { maxMs = TAP_MAX_MS, maxMove = TAP_MAX_MOVE_PX } = {},
): boolean {
  return durationMs >= 0 && durationMs < maxMs && movePx <= maxMove;
}

/** A held touch that didn't move = a long-press (context menu). */
export function isLongPress(
  durationMs: number,
  movePx: number,
  { minMs = TAP_MAX_MS, maxMove = TAP_MAX_MOVE_PX } = {},
): boolean {
  return durationMs >= minMs && movePx <= maxMove;
}

/**
 * The hit-area side length for an on-canvas control. On touch we guarantee at
 * least MIN_TOUCH_TARGET regardless of how small the icon is drawn; on a mouse
 * pointer the visual size is fine.
 */
export function touchHitSize(visualPx: number, isTouch: boolean, min = MIN_TOUCH_TARGET): number {
  return isTouch ? Math.max(min, visualPx) : visualPx;
}

/** Coarse-pointer (touch) detection; safe in non-browser/test contexts. */
export function isCoarsePointer(): boolean {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(pointer: coarse)').matches;
}
