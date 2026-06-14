import { describe, it, expect } from 'vitest';
import { rectBorderPoint, edgeBorderEndpoints, halfDiagonal, minEdgeLength, clampToMinNeighbors, borderReach, LABEL_MARGIN } from '../edgeGeometry';

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

describe('borderReach', () => {
  const dims = { width: 170, height: 106 }; // hw=85, hh=53
  it('is the half-width for a horizontal edge', () => {
    expect(borderReach(dims, 1, 0)).toBeCloseTo(85, 6);
  });
  it('is the half-height for a vertical edge', () => {
    expect(borderReach(dims, 0, 1)).toBeCloseTo(53, 6);
  });
  it('never exceeds the half-diagonal (corner is the worst case)', () => {
    for (const a of [0.2, 0.9, 1.4, 2.2]) {
      expect(borderReach(dims, Math.cos(a), Math.sin(a))).toBeLessThanOrEqual(halfDiagonal(dims) + 1e-9);
    }
  });
});

describe('minEdgeLength', () => {
  it('is zero when there is no label', () => {
    expect(minEdgeLength({ width: 170, height: 105 }, { width: 170, height: 105 }, 0)).toBe(0);
  });

  it('leaves only a SMALL margin around the label, not an oversized buffer', () => {
    const a = { width: 170, height: 105 };
    const b = { width: 160, height: 100 };
    const labelW = 104;
    // horizontal edge: the border-to-border gap should equal labelW + margin exactly.
    const min = minEdgeLength(a, b, labelW, 1, 0);
    const gap = min - borderReach(a, 1, 0) - borderReach(b, 1, 0);
    expect(gap).toBeCloseTo(labelW + LABEL_MARGIN, 6);
    // and it must be far tighter than the old half-diagonal buffer.
    expect(min).toBeLessThan(halfDiagonal(a) + halfDiagonal(b) + labelW);
  });

  it('keeps the gap == label + margin at a vertical angle too', () => {
    const a = { width: 170, height: 105 };
    const b = { width: 170, height: 105 };
    const labelW = 90;
    const min = minEdgeLength(a, b, labelW, 0, 1);
    const gap = min - borderReach(a, 0, 1) - borderReach(b, 0, 1);
    expect(gap).toBeCloseTo(labelW + LABEL_MARGIN, 6);
  });
});

describe('clampToMinNeighbors (drag-time min edge length)', () => {
  it('leaves a target that is already far enough alone', () => {
    const p = clampToMinNeighbors({ x: 300, y: 0 }, [{ x: 0, y: 0, minLen: 200 }]);
    expect(p).toEqual({ x: 300, y: 0 });
  });

  it('pushes a too-close target out to exactly the min radius', () => {
    const p = clampToMinNeighbors({ x: 50, y: 0 }, [{ x: 0, y: 0, minLen: 200 }]);
    expect(Math.hypot(p.x, p.y)).toBeCloseTo(200, 6);
    expect(p.y).toBeCloseTo(0, 6); // stays on the same ray
    expect(p.x).toBeCloseTo(200, 6);
  });

  it('pushes out in a stable direction when the target sits on the neighbor', () => {
    const p = clampToMinNeighbors({ x: 0, y: 0 }, [{ x: 0, y: 0, minLen: 120 }]);
    expect(Math.hypot(p.x, p.y)).toBeCloseTo(120, 6);
  });

  it('respects multiple neighbors (target ends up outside every min radius)', () => {
    const neighbors = [
      { x: 0, y: 0, minLen: 150 },
      { x: 100, y: 0, minLen: 150 },
    ];
    const p = clampToMinNeighbors({ x: 50, y: 10 }, neighbors, 8);
    for (const n of neighbors) {
      expect(Math.hypot(p.x - n.x, p.y - n.y)).toBeGreaterThanOrEqual(150 - 1e-6);
    }
  });

  it('ignores neighbors with no minimum', () => {
    const p = clampToMinNeighbors({ x: 5, y: 5 }, [{ x: 0, y: 0, minLen: 0 }]);
    expect(p).toEqual({ x: 5, y: 5 });
  });
});
