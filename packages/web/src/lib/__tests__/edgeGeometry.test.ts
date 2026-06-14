import { describe, it, expect } from 'vitest';
import { rectBorderPoint, edgeBorderEndpoints, halfDiagonal, minEdgeLength } from '../edgeGeometry';

describe('rectBorderPoint', () => {
  const dims = { width: 100, height: 60 }; // hw=50, hh=30

  it('hits the vertical border for a horizontal ray', () => {
    expect(rectBorderPoint({ x: 0, y: 0 }, dims, { x: 100, y: 0 })).toEqual({ x: 50, y: 0 });
    expect(rectBorderPoint({ x: 0, y: 0 }, dims, { x: -100, y: 0 })).toEqual({ x: -50, y: 0 });
  });

  it('hits the horizontal border for a vertical ray', () => {
    expect(rectBorderPoint({ x: 0, y: 0 }, dims, { x: 0, y: 100 })).toEqual({ x: 0, y: 30 });
    expect(rectBorderPoint({ x: 0, y: 0 }, dims, { x: 0, y: -100 })).toEqual({ x: 0, y: -30 });
  });

  it('hits the nearer border on a diagonal', () => {
    // toward (100,100): sx=50/100=0.5, sy=30/100=0.3 -> s=0.3 -> (30,30)
    expect(rectBorderPoint({ x: 0, y: 0 }, dims, { x: 100, y: 100 })).toEqual({ x: 30, y: 30 });
  });

  it('respects the center offset', () => {
    expect(rectBorderPoint({ x: 200, y: 100 }, dims, { x: 400, y: 100 })).toEqual({ x: 250, y: 100 });
  });

  it('returns the center when toward equals center', () => {
    expect(rectBorderPoint({ x: 5, y: 5 }, dims, { x: 5, y: 5 })).toEqual({ x: 5, y: 5 });
  });

  it('always lands on the border (distance from center = exactly one half-extent)', () => {
    for (const angle of [0.1, 0.7, 1.2, 2.5, -1.9, 3.0]) {
      const p = rectBorderPoint({ x: 0, y: 0 }, dims, { x: Math.cos(angle) * 1000, y: Math.sin(angle) * 1000 });
      const onVertical = Math.abs(Math.abs(p.x) - 50) < 1e-9;
      const onHorizontal = Math.abs(Math.abs(p.y) - 30) < 1e-9;
      expect(onVertical || onHorizontal, `point ${JSON.stringify(p)} should be on a border`).toBe(true);
      // and within the box on the other axis
      expect(Math.abs(p.x)).toBeLessThanOrEqual(50 + 1e-9);
      expect(Math.abs(p.y)).toBeLessThanOrEqual(30 + 1e-9);
    }
  });
});

describe('edgeBorderEndpoints', () => {
  it('connects the facing borders of two horizontally-separated cards', () => {
    const e = edgeBorderEndpoints({ x: 0, y: 0 }, { width: 100, height: 60 }, { x: 300, y: 0 }, { width: 100, height: 60 });
    expect(e).toEqual({ x1: 50, y1: 0, x2: 250, y2: 0 });
  });

  it('the drawn segment is shorter than center-to-center (it starts at borders)', () => {
    const s = { x: 0, y: 0 }, t = { x: 300, y: 0 };
    const e = edgeBorderEndpoints(s, { width: 100, height: 60 }, t, { width: 100, height: 60 });
    const drawn = Math.hypot(e.x2 - e.x1, e.y2 - e.y1);
    const center = Math.hypot(t.x - s.x, t.y - s.y);
    expect(drawn).toBeLessThan(center);
    expect(drawn).toBe(200); // 300 - 50 - 50
  });
});

describe('minEdgeLength', () => {
  it('is zero when there is no label', () => {
    expect(minEdgeLength({ width: 170, height: 105 }, { width: 170, height: 105 }, 0)).toBe(0);
  });

  it('guarantees the label fits in the border gap at any angle', () => {
    const a = { width: 170, height: 105 };
    const b = { width: 160, height: 100 };
    const labelW = 104;
    const min = minEdgeLength(a, b, labelW, 16);
    expect(min).toBeCloseTo(halfDiagonal(a) + halfDiagonal(b) + 104 + 16, 6);
    // At the worst angle (toward a corner) the projections sum to the two half
    // diagonals; the remaining gap must still cover the label.
    const gap = min - halfDiagonal(a) - halfDiagonal(b);
    expect(gap).toBeGreaterThanOrEqual(labelW);
  });
});
