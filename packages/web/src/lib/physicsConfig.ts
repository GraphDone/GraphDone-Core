/**
 * Single source of truth for the graph force-simulation parameters.
 *
 * These used to be hardcoded and scattered across InteractiveGraphVisualization
 * (charge here, collision there, alpha somewhere else), so "why do nodes slip
 * and drift" was impossible to reason about or tune. Centralizing them makes
 * the behavior inspectable, unit-testable, and (via the debug console) live-
 * tuneable. Pure data + pure helpers — no D3 import.
 */

export interface PhysicsConfig {
  charge: { strength: number; distanceMax: number };
  link: {
    /** preferred link length as a fraction of min(viewport w,h) */
    minDistanceFactor: number;
    /** length past which the spring pulls harder, as a fraction */
    maxDistanceFactor: number;
    strengthNormal: number;
    strengthStretched: number;
  };
  centering: { center: number; axis: number };
  collision: { paddingPx: number; strength: number; iterations: number };
  hierarchy: { distance: number; strength: number };
  alpha: {
    /** energy injected when a graph with unplaced nodes loads */
    loadEnergy: number;
    decay: number;
    velocityDecay: number;
    /** resting target — 0 means the sim fully stops when settled */
    restTarget: number;
  };
  reheat: { drag: number; dragNeighbors: number; collisions: number; resize: number };
}

/** Current production defaults (extracted verbatim from the component). */
export const DEFAULT_PHYSICS: PhysicsConfig = {
  charge: { strength: -70, distanceMax: 350 },
  link: { minDistanceFactor: 0.4, maxDistanceFactor: 0.6, strengthNormal: 0.2, strengthStretched: 0.5 },
  // Only a TINY inward pull: a strong centering compresses dense graphs into a
  // core that collision can't separate (the force equilibrium ends up
  // overlapping). A tiny value just contains the layout so it converges instead
  // of slowly expanding, while strong collision still spreads it to a clean,
  // non-overlapping settle. The camera fit handles actual centering.
  centering: { center: 0.0015, axis: 0.0003 },
  collision: { paddingPx: 12, strength: 1, iterations: 4 },
  hierarchy: { distance: 250, strength: 0.05 },
  // Faster cool-down + heavier damping so a one-shot layout reaches REST
  // quickly (it stops when alpha < alphaMin) instead of micro-drifting for
  // many seconds — important on big graphs where low fps stretches the settle.
  alpha: { loadEnergy: 0.7, decay: 0.03, velocityDecay: 0.78, restTarget: 0 },
  reheat: { drag: 0.1, dragNeighbors: 0.2, collisions: 0.3, resize: 0.3 },
};

/** Collision radius for a node card: half its diagonal plus padding. */
export function collisionRadius(
  dims: { width: number; height: number },
  cfg: PhysicsConfig = DEFAULT_PHYSICS
): number {
  return Math.hypot(dims.width, dims.height) / 2 + cfg.collision.paddingPx;
}

/** Preferred link distance for the current viewport. */
export function linkDistance(width: number, height: number, cfg: PhysicsConfig = DEFAULT_PHYSICS): number {
  return Math.min(width, height) * cfg.link.minDistanceFactor;
}

/** Length past which a link spring pulls harder. */
export function linkMaxDistance(width: number, height: number, cfg: PhysicsConfig = DEFAULT_PHYSICS): number {
  return Math.min(width, height) * cfg.link.maxDistanceFactor;
}

/** Spring strength for a link given how stretched it currently is. */
export function linkStrength(currentDistance: number, maxDistance: number, cfg: PhysicsConfig = DEFAULT_PHYSICS): number {
  return currentDistance > maxDistance ? cfg.link.strengthStretched : cfg.link.strengthNormal;
}

/** Merge a partial override onto the defaults (for the live tuning panel). */
export function withOverrides(partial: DeepPartial<PhysicsConfig>, base: PhysicsConfig = DEFAULT_PHYSICS): PhysicsConfig {
  return {
    charge: { ...base.charge, ...partial.charge },
    link: { ...base.link, ...partial.link },
    centering: { ...base.centering, ...partial.centering },
    collision: { ...base.collision, ...partial.collision },
    hierarchy: { ...base.hierarchy, ...partial.hierarchy },
    alpha: { ...base.alpha, ...partial.alpha },
    reheat: { ...base.reheat, ...partial.reheat },
  };
}

type DeepPartial<T> = { [K in keyof T]?: Partial<T[K]> };
