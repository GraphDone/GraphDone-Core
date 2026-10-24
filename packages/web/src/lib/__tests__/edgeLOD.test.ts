import { describe, it, expect } from 'vitest';
import {
  EDGE_LOD, arrowVisibility, labelVisibility, shouldBundleEdges,
  directionStrategy, perpendicularOffset,
} from '../edgeLOD';

describe('directionStrategy', () => {
  it('hides direction when very zoomed out, minimal mid, full when close', () => {
    expect(directionStrategy(0.2)).toBe('hidden');
    expect(directionStrategy(0.4)).toBe('minimal');
    expect(directionStrategy(0.8)).toBe('full');
  });
  it('uses the FAR/VERY_FAR thresholds as boundaries', () => {
    expect(directionStrategy(EDGE_LOD.VERY_FAR - 0.01)).toBe('hidden');
    expect(directionStrategy(EDGE_LOD.FAR + 0.01)).toBe('full');
  });
});

describe('arrowVisibility', () => {
  it('invisible below FAR, full opacity at/above CLOSE', () => {
    expect(arrowVisibility(0.3).visible).toBe(false);
    expect(arrowVisibility(0.3).opacity).toBe(0);
    expect(arrowVisibility(0.9).visible).toBe(true);
    expect(arrowVisibility(0.9).opacity).toBe(1);
  });
  it('fades in across the FAR→CLOSE band', () => {
    const mid = arrowVisibility((EDGE_LOD.FAR + EDGE_LOD.CLOSE) / 2).opacity;
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1);
  });
  it('shrinks arrow size when several parallel edges share the pair', () => {
    expect(arrowVisibility(1, 1).scale).toBe(1);
    expect(arrowVisibility(1, 4).scale).toBeLessThan(1);
    expect(arrowVisibility(1, 4).scale).toBeGreaterThanOrEqual(0.5);
  });
});

describe('labelVisibility', () => {
  it('returns an opacity in [0,1], invisible when far', () => {
    expect(labelVisibility(0.2)).toBe(0);
    const o = labelVisibility(0.7);
    expect(o).toBeGreaterThan(0);
    expect(o).toBeLessThanOrEqual(1);
  });
  it('reduces opacity as edges crowd the pair', () => {
    expect(labelVisibility(1, 5)).toBeLessThan(labelVisibility(1, 1));
  });
});

describe('shouldBundleEdges', () => {
  it('never bundles a single edge', () => {
    expect(shouldBundleEdges(0.1, 1, 50)).toBe(false);
  });
  it('bundles parallel edges when zoomed out or nodes very close', () => {
    expect(shouldBundleEdges(0.3, 3, 400)).toBe(true);   // zoomed out
    expect(shouldBundleEdges(1.0, 3, 40)).toBe(true);    // nodes too close
  });
  it('separates parallel edges when close + well-spaced', () => {
    expect(shouldBundleEdges(1.0, 3, 400)).toBe(false);
  });
});

describe('perpendicularOffset', () => {
  it('is 0 for a single edge', () => {
    expect(perpendicularOffset(0, 1, 1)).toBe(0);
  });
  it('spreads symmetrically around 0 for parallel edges', () => {
    const a = perpendicularOffset(0, 3, 1);
    const c = perpendicularOffset(2, 3, 1);
    expect(a).toBeCloseTo(-c, 5);
    expect(perpendicularOffset(1, 3, 1)).toBeCloseTo(0, 5); // middle edge centred
  });
  it('collapses toward 0 as you zoom out', () => {
    const close = Math.abs(perpendicularOffset(0, 3, 1));
    const far = Math.abs(perpendicularOffset(0, 3, 0.3));
    expect(far).toBeLessThan(close);
  });
});
