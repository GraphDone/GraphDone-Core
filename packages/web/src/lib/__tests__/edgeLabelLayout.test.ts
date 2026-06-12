import { describe, it, expect } from 'vitest';
import { clearSegment, edgeLabelPlacement, clampLabelT, slideTFromPointer, chooseLabelT } from '../edgeLabelLayout';

const box = (w: number, h: number) => ({ width: w, height: h });

describe('clearSegment — the part of an edge not covered by its node cards', () => {
  it('excludes both node boxes plus padding from the usable segment', () => {
    // Horizontal edge: source card 100 wide at x=0, target at x=400.
    const seg = clearSegment({ x: 0, y: 0 }, { x: 400, y: 0 }, box(100, 60), box(100, 60), 10);
    // Clear span starts after source half-width (50) + padding, ends before target half-width + padding.
    expect(seg.t0).toBeCloseTo((50 + 10) / 400, 2);
    expect(seg.t1).toBeCloseTo(1 - (50 + 10) / 400, 2);
  });

  it('degenerates gracefully when nodes overlap (no clear span)', () => {
    const seg = clearSegment({ x: 0, y: 0 }, { x: 60, y: 0 }, box(100, 60), box(100, 60), 10);
    expect(seg.t0).toBeLessThanOrEqual(seg.t1);
    expect(seg.t0).toBeGreaterThanOrEqual(0);
    expect(seg.t1).toBeLessThanOrEqual(1);
  });
});

describe('clampLabelT — users may slide labels, within reason', () => {
  it('keeps t inside the clear segment with a margin', () => {
    const seg = { t0: 0.2, t1: 0.8 };
    expect(clampLabelT(0.5, seg)).toBe(0.5);
    expect(clampLabelT(0.05, seg)).toBeCloseTo(0.2, 5);
    expect(clampLabelT(0.99, seg)).toBeCloseTo(0.8, 5);
  });

  it('falls back to midpoint when the segment is degenerate', () => {
    expect(clampLabelT(0.3, { t0: 0.6, t1: 0.4 })).toBe(0.5);
  });
});

describe('edgeLabelPlacement', () => {
  it('centers the label in the clear segment by default, offset perpendicular to the edge', () => {
    const p = edgeLabelPlacement({
      source: { x: 0, y: 0 },
      target: { x: 400, y: 0 },
      sourceDims: box(100, 60),
      targetDims: box(100, 60)
    });
    // Default t = middle of clear span = 0.5 for symmetric boxes.
    expect(p.x).toBeCloseTo(200, 0);
    // Perpendicular offset lifts the label off the line.
    expect(Math.abs(p.y)).toBeGreaterThan(0);
    expect(p.rotation).toBe(0);
  });

  it('never places the label inside either node box', () => {
    const p = edgeLabelPlacement({
      source: { x: 0, y: 0 },
      target: { x: 400, y: 0 },
      sourceDims: box(100, 60),
      targetDims: box(100, 60),
      t: 0.01 // user tried to slide all the way to the source
    });
    expect(p.x).toBeGreaterThanOrEqual(60); // half-width 50 + padding 10
  });

  it('keeps text upright: rotation stays within ±90°', () => {
    // Right-to-left edge would naively rotate 180°.
    const p = edgeLabelPlacement({
      source: { x: 400, y: 0 },
      target: { x: 0, y: 0 },
      sourceDims: box(10, 10),
      targetDims: box(10, 10)
    });
    expect(p.rotation).toBeGreaterThanOrEqual(-90);
    expect(p.rotation).toBeLessThanOrEqual(90);
  });

  it('handles a zero-length edge without NaN', () => {
    const p = edgeLabelPlacement({
      source: { x: 5, y: 5 },
      target: { x: 5, y: 5 },
      sourceDims: box(10, 10),
      targetDims: box(10, 10)
    });
    expect(Number.isFinite(p.x)).toBe(true);
    expect(Number.isFinite(p.y)).toBe(true);
    expect(Number.isFinite(p.rotation)).toBe(true);
  });
});

describe('slideTFromPointer — dragging a label along its edge', () => {
  it('projects the pointer onto the edge and returns clamped t', () => {
    const source = { x: 0, y: 0 };
    const target = { x: 400, y: 0 };
    const seg = { t0: 0.15, t1: 0.85 };
    expect(slideTFromPointer({ x: 200, y: 50 }, source, target, seg)).toBeCloseTo(0.5, 5);
    expect(slideTFromPointer({ x: -100, y: 0 }, source, target, seg)).toBeCloseTo(0.15, 5);
    expect(slideTFromPointer({ x: 700, y: 0 }, source, target, seg)).toBeCloseTo(0.85, 5);
  });
});

describe('chooseLabelT — obstacle-aware placement against ALL node cards', () => {
  const obstacleAt = (x: number, y: number) => ({ x, y, width: 80, height: 50 });

  it('keeps the center when nothing is in the way', () => {
    const t = chooseLabelT({
      source: { x: 0, y: 0 },
      target: { x: 400, y: 0 },
      sourceDims: { width: 10, height: 10 },
      targetDims: { width: 10, height: 10 },
      labelDims: { width: 60, height: 20 },
      obstacles: []
    });
    expect(t).toBeCloseTo(0.5, 1);
  });

  it('slides the label off a third-party card sitting at the midpoint', () => {
    const t = chooseLabelT({
      source: { x: 0, y: 0 },
      target: { x: 400, y: 0 },
      sourceDims: { width: 10, height: 10 },
      targetDims: { width: 10, height: 10 },
      labelDims: { width: 60, height: 20 },
      obstacles: [obstacleAt(200, -22)] // covers the default label spot
    });
    const placed = edgeLabelPlacement({
      source: { x: 0, y: 0 },
      target: { x: 400, y: 0 },
      sourceDims: { width: 10, height: 10 },
      targetDims: { width: 10, height: 10 },
      t
    });
    const half = { w: 30, h: 10 };
    const o = obstacleAt(200, -22);
    const intersects =
      Math.abs(placed.x - o.x) < half.w + o.width / 2 &&
      Math.abs(placed.y - o.y) < half.h + o.height / 2;
    expect(intersects).toBe(false);
  });

  it('returns the least-bad t when every candidate overlaps something', () => {
    const wall = Array.from({ length: 9 }, (_, i) => obstacleAt(40 + i * 45, -22));
    const t = chooseLabelT({
      source: { x: 0, y: 0 },
      target: { x: 400, y: 0 },
      sourceDims: { width: 10, height: 10 },
      targetDims: { width: 10, height: 10 },
      labelDims: { width: 60, height: 20 },
      obstacles: wall
    });
    expect(t).toBeGreaterThanOrEqual(0);
    expect(t).toBeLessThanOrEqual(1);
  });
});
