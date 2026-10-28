import { describe, expect, it } from 'vitest';
import {
  createEdgeRoute,
  createParallelEdgeRoute,
  edgeRouteLabel,
  edgeRouteArrowBounds,
  edgeSegmentHitsBox,
  pointOnEdgeRoute,
  projectEdgeRoutePointer,
} from '../edgeRouteGeometry';

const elbow = () =>
  createEdgeRoute([
    { x: 0, y: 0 },
    { x: 200, y: 0 },
    { x: 200, y: 100 },
  ])!;

describe('item wire geometry', () => {
  it('keeps opposite directed wires on distinct lanes without reversing their arrows', () => {
    const a = { id: 'a', x: 0, y: 0 },
      b = { id: 'b', x: 400, y: 0 };
    const forward = createParallelEdgeRoute(a, b, -6)!;
    const reverse = createParallelEdgeRoute(b, a, 6)!;
    expect(forward.points).toEqual([
      { x: 0, y: -6 },
      { x: 400, y: -6 },
    ]);
    expect(reverse.points).toEqual([
      { x: 400, y: 6 },
      { x: 0, y: 6 },
    ]);
    expect(forward.target.angle).toBe(0);
    expect(reverse.target.angle).toBe(180);
  });
  it('uses the actual final segment for the target arrow and distance along every bend', () => {
    const route = elbow();
    expect(route.path).toBe('M0,0 L200,0 L200,100');
    expect(route.target).toEqual({ x: 200, y: 100, angle: 90 });
    expect(pointOnEdgeRoute(route, 0.5)).toEqual({
      x: 150,
      y: 0,
      angle: 0,
      t: 0.5,
    });
    expect(pointOnEdgeRoute(route, 5 / 6)).toEqual({
      x: 200,
      y: 50,
      angle: 90,
      t: 5 / 6,
    });
    expect(pointOnEdgeRoute(route, 2)).toMatchObject({
      x: 200,
      y: 100,
      angle: 90,
    });
    expect(pointOnEdgeRoute(route, -1)).toMatchObject({ x: 0, y: 0, angle: 0 });
  });

  it('removes duplicate/straight knots without mutating source coordinates or removing a return leg', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 40, y: 0 },
      { x: 100, y: 0 },
      { x: 40, y: 0 },
    ];
    const before = structuredClone(points);
    const route = createEdgeRoute(points)!;
    expect(route.path).toBe('M0,0 L100,0 L40,0');
    expect(route.length).toBe(160);
    expect(route.target.angle).toBe(180);
    expect(points).toEqual(before);
    expect(route.points[0]).not.toBe(points[0]);
  });

  it('keeps self-loop travel and original direction when endpoints coincide', () => {
    const points = [
      { x: 10, y: 10 },
      { x: 110, y: 10 },
      { x: 110, y: 110 },
      { x: 10, y: 110 },
      { x: 10, y: 10 },
    ];
    const route = createEdgeRoute(points)!;
    expect(route.length).toBe(400);
    expect(route.target).toEqual({ x: 10, y: 10, angle: -90 });
    expect(pointOnEdgeRoute(route, 0.5)).toMatchObject({ x: 110, y: 110 });
    expect(createEdgeRoute([...points].reverse())!.target.angle).toBe(180);
  });

  it('rejects unpaintable or nonfinite routes instead of emitting broken paths/hitboxes', () => {
    for (const points of [
      [],
      [{ x: 4, y: 4 }],
      [
        { x: 4, y: 4 },
        { x: 4, y: 4 },
      ],
      [
        { x: 0, y: 0 },
        { x: NaN, y: 1 },
      ],
      [
        { x: -1e308, y: 0 },
        { x: 1e308, y: 0 },
      ],
    ]) {
      expect(createEdgeRoute(points)).toBeNull();
    }
  });

  it('slides against the nearest routed segment, not the source-target diagonal', () => {
    const route = elbow();
    expect(projectEdgeRoutePointer(route, { x: 210, y: 60 })).toBeCloseTo(
      260 / 300
    );
    expect(projectEdgeRoutePointer(route, { x: 90, y: -20 })).toBeCloseTo(
      90 / 300
    );
    expect(projectEdgeRoutePointer(route, { x: -100, y: 0 })).toBe(0);
    expect(projectEdgeRoutePointer(route, { x: 200, y: 200 })).toBe(1);
  });

  it('keeps a dragged label on its prior leg when two nearby legs are equally close', () => {
    const route = createEdgeRoute([
      { x: 0, y: 0 },
      { x: 200, y: 0 },
      { x: 200, y: 40 },
      { x: 0, y: 40 },
    ])!;
    expect(projectEdgeRoutePointer(route, { x: 100, y: 20 }, 0.2)).toBeCloseTo(
      100 / 440
    );
    expect(projectEdgeRoutePointer(route, { x: 100, y: 20 }, 0.8)).toBeCloseTo(
      340 / 440
    );
    expect(projectEdgeRoutePointer(route, { x: NaN, y: 0 }, 0.8)).toBe(0.8);
  });

  it('drags an offset label along its rendered lane when the neighboring wire is closer', () => {
    const route = createEdgeRoute([
      { x: 0, y: 0 },
      { x: 200, y: 0 },
      { x: 200, y: 40 },
      { x: 0, y: 40 },
    ])!;
    const label = edgeRouteLabel(route, {
      dims: { width: 60, height: 20 },
      t: 340 / 440,
    })!;
    expect(label).toMatchObject({
      x: 100,
      y: 18,
      rotation: 0,
      iconRotation: 180,
    });
    expect(projectEdgeRoutePointer(route, label, label.t)).toBeCloseTo(
      100 / 440
    );
    expect(
      projectEdgeRoutePointer(route, label, label.t, { offset: 22 })
    ).toBeCloseTo(340 / 440);
    expect(
      projectEdgeRoutePointer(route, { x: 80, y: 18 }, label.t, { offset: 22 })
    ).toBeCloseTo(360 / 440);
  });

  it('fits whole labels on a segment away from bends and retains original arrow orientation', () => {
    const route = createEdgeRoute([
      { x: 200, y: 100 },
      { x: 0, y: 100 },
      { x: 0, y: 0 },
    ])!;
    const label = edgeRouteLabel(route, {
      dims: { width: 80, height: 20 },
      t: 0.65,
    })!;
    expect(label.rotation).toBe(0);
    expect(label.iconRotation).toBe(180);
    expect(label.x).toBeGreaterThanOrEqual(48);
    expect(label.y).toBe(78);
    expect(label.t).toBeCloseTo(152 / 300);
  });

  it('moves labels away from cards/earlier labels and explicitly defers when none fit', () => {
    const route = createEdgeRoute([
      { x: 0, y: 0 },
      { x: 400, y: 0 },
    ])!;
    const dims = { width: 80, height: 20 };
    const label = edgeRouteLabel(route, {
      dims,
      obstacles: [{ x: 200, y: -22, width: 140, height: 40 }],
    })!;
    expect(Math.abs(label.x - 200)).toBeGreaterThanOrEqual(118);
    expect(
      edgeRouteLabel(route, {
        dims,
        obstacles: [{ x: 200, y: -22, width: 1000, height: 1000 }],
      })
    ).toBeNull();
    expect(
      edgeRouteLabel(elbow(), { dims: { width: 250, height: 20 } })
    ).toBeNull();
  });

  it('uses the rotated label footprint when avoiding obstacles on a vertical segment', () => {
    const route = createEdgeRoute([
      { x: 0, y: 0 },
      { x: 0, y: 400 },
    ])!;
    const label = edgeRouteLabel(route, {
      dims: { width: 100, height: 20 },
      obstacles: [{ x: 22, y: 240, width: 20, height: 20 }],
    })!;
    expect(label.rotation).toBe(90);
    expect(label.x).toBeCloseTo(22);
    expect(Math.abs(label.y - 240)).toBeGreaterThanOrEqual(68);
    expect(
      edgeRouteLabel(route, { dims: { width: NaN, height: 20 } })
    ).toBeNull();
  });
  it('places opposite-direction labels on clear sides instead of covering the neighboring wire', () => {
    const upper = createEdgeRoute([
      { x: 0, y: -7 },
      { x: 400, y: -7 },
    ])!;
    const lower = createEdgeRoute([
      { x: 400, y: 7 },
      { x: 0, y: 7 },
    ])!;
    const segments = [...upper.segments, ...lower.segments];
    const dims = { width: 110, height: 26 };
    const first = edgeRouteLabel(upper, {
      dims,
      offset: 25,
      offsets: [25, -25],
      segments,
    })!;
    const second = edgeRouteLabel(lower, {
      dims,
      offset: 25,
      offsets: [25, -25],
      segments,
    })!;
    expect(first.y).toBe(-32);
    expect(second.y).toBe(32);
    expect(second.offset).toBe(-25);
    for (const label of [first, second])
      expect(
        segments.some(segment =>
          edgeSegmentHitsBox(segment, { ...label, ...dims }, 8)
        )
      ).toBe(false);
  });

  it('reserves arrowheads and rejects diagonal wires through a label footprint', () => {
    const route = createEdgeRoute([
      { x: 0, y: 0 },
      { x: 0, y: 300 },
    ])!;
    const arrow = edgeRouteArrowBounds(route);
    expect(arrow.x).toBeCloseTo(0);
    expect(arrow).toMatchObject({
      y: 292,
      width: 16,
      height: 16,
    });
    const box = { x: 50, y: 50, width: 20, height: 20 };
    expect(
      edgeSegmentHitsBox(
        { source: { x: 0, y: 0 }, target: { x: 100, y: 100 } },
        box
      )
    ).toBe(true);
    expect(
      edgeSegmentHitsBox(
        { source: { x: 0, y: 0 }, target: { x: 20, y: 100 } },
        box
      )
    ).toBe(false);
    const horizontal = createEdgeRoute([
      { x: 0, y: 0 },
      { x: 300, y: 0 },
    ])!;
    const label = edgeRouteLabel(horizontal, {
      dims: { width: 70, height: 26 },
      t: 1,
      offset: 25,
      obstacles: [edgeRouteArrowBounds(horizontal)],
    })!;
    expect(label.x + 35).toBeLessThanOrEqual(300);
  });

  it('admits only full label footprints within the visible viewport', () => {
    const route = createEdgeRoute([
      { x: 0, y: 0 },
      { x: 300, y: 0 },
    ])!;
    expect(
      edgeRouteLabel(route, {
        dims: { width: 100, height: 26 },
        viewport: { x: 150, y: -22, width: 120, height: 50 },
      })
    ).not.toBeNull();
    expect(
      edgeRouteLabel(route, {
        dims: { width: 100, height: 26 },
        viewport: { x: 150, y: -22, width: 80, height: 50 },
      })
    ).toBeNull();
  });
});
