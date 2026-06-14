import { describe, it, expect } from 'vitest';
import {
  DEFAULT_PHYSICS,
  collisionRadius,
  linkDistance,
  linkMaxDistance,
  linkStrength,
  withOverrides,
} from '../physicsConfig';

describe('physicsConfig defaults', () => {
  it('matches the production-tuned values', () => {
    // Tuned for one-shot, non-overlapping settle (PR-A): centering near-off so
    // dense graphs expand until collision is satisfied, stronger collision,
    // faster cool-down + damping so the sim reaches rest quickly.
    expect(DEFAULT_PHYSICS.charge.strength).toBe(-70);
    expect(DEFAULT_PHYSICS.alpha.velocityDecay).toBe(0.78);
    expect(DEFAULT_PHYSICS.alpha.restTarget).toBe(0); // fully stops when settled
    expect(DEFAULT_PHYSICS.collision.strength).toBe(1);
  });
});

describe('collisionRadius', () => {
  it('is half the card diagonal plus padding', () => {
    // 200x120 card → diag 233.2 / 2 = 116.6 + 12 = 128.6
    expect(collisionRadius({ width: 200, height: 120 })).toBeCloseTo(128.6, 1);
  });
  it('grows with card size', () => {
    expect(collisionRadius({ width: 300, height: 200 })).toBeGreaterThan(collisionRadius({ width: 100, height: 60 }));
  });
});

describe('link distances', () => {
  it('preferred + max scale with the smaller viewport dimension', () => {
    expect(linkDistance(1000, 800)).toBeCloseTo(800 * 0.4, 5);
    expect(linkMaxDistance(1000, 800)).toBeCloseTo(800 * 0.6, 5);
  });
});

describe('linkStrength', () => {
  it('pulls harder once stretched past max', () => {
    const max = linkMaxDistance(1000, 800);
    expect(linkStrength(max + 1, max)).toBe(DEFAULT_PHYSICS.link.strengthStretched);
    expect(linkStrength(max - 1, max)).toBe(DEFAULT_PHYSICS.link.strengthNormal);
  });
});

describe('withOverrides (live tuning)', () => {
  it('overrides only the named fields, keeps the rest', () => {
    const tuned = withOverrides({ charge: { strength: -120 }, alpha: { velocityDecay: 0.5 } });
    expect(tuned.charge.strength).toBe(-120);
    expect(tuned.charge.distanceMax).toBe(DEFAULT_PHYSICS.charge.distanceMax); // untouched
    expect(tuned.alpha.velocityDecay).toBe(0.5);
    expect(tuned.collision.strength).toBe(DEFAULT_PHYSICS.collision.strength); // untouched
  });
  it('does not mutate the defaults', () => {
    withOverrides({ charge: { strength: 999 } });
    expect(DEFAULT_PHYSICS.charge.strength).toBe(-70);
  });
});
