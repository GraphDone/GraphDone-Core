import { expect, it } from 'vitest';
import { createEdgeRoute } from '../edgeRouteGeometry';
import {
  placeItemLabels,
  ITEM_LABEL_BUDGET,
  type ItemLabelCandidate,
} from '../edgeLabelPlacement';

const route = createEdgeRoute([
  { x: 0, y: 0 },
  { x: 300, y: 0 },
])!;
const candidate = (id: string): ItemLabelCandidate => ({
  id,
  route,
  eligible: true,
  dims: { width: 104, height: 26 },
  t: 0.5,
  offset: 25,
});
const viewport = { x: 150, y: 0, width: 600, height: 400 };

it('spends contested label space on the higher-priority relationship first', () => {
  const result = placeItemLabels([
    { ...candidate('a-context'), priority: 2 },
    { ...candidate('z-blocker'), priority: 0 },
  ], { viewport: { x: 150, y: 25, width: 130, height: 50 }, obstacles: [], segments: route.segments });
  expect([...result.placements.keys()]).toEqual(['z-blocker']);
});

it('bounds failed attempts even when every label is blocked', () => {
  const result = placeItemLabels(
    Array.from({ length: 2000 }, (_, index) => candidate(String(index))),
    {
      viewport,
      obstacles: [{ x: 150, y: 0, width: 1000, height: 1000 }],
      segments: [],
    }
  );
  expect(result.placements.size).toBe(0);
  expect(result.attempts).toBe(ITEM_LABEL_BUDGET.attempts);
  expect(result.checks).toBeLessThanOrEqual(ITEM_LABEL_BUDGET.checks);
});

it('stops total obstacle work without admitting a partially checked candidate', () => {
  const result = placeItemLabels(
    Array.from({ length: 2000 }, (_, index) => candidate(String(index))),
    {
      viewport,
      obstacles: [
        ...Array.from({ length: 25000 }, () => ({
          x: 10000,
          y: 10000,
          width: 10,
          height: 10,
        })),
        { x: 150, y: 0, width: 1000, height: 1000 },
      ],
      segments: [],
    }
  );
  expect(result.placements.size).toBe(0);
  expect(result.checks).toBe(ITEM_LABEL_BUDGET.checks);
  expect(result.attempts).toBeLessThan(ITEM_LABEL_BUDGET.attempts);
});

it('hidden and offscreen routes cannot consume the visible-label budget', () => {
  const hidden = Array.from({ length: 2000 }, (_, index) => ({
    ...candidate(`a-${index}`),
    eligible: false,
  }));
  const outside = {
    ...candidate('b'),
    route: createEdgeRoute([
      { x: 10000, y: 0 },
      { x: 11000, y: 0 },
    ])!,
  };
  const result = placeItemLabels([...hidden, outside, candidate('visible')], {
    viewport,
    obstacles: [],
    segments: route.segments,
  });
  expect([...result.placements.keys()]).toEqual(['visible']);
  expect(result.attempts).toBe(1);
});

it('places labels along the visible slice of a long route without changing its identity', () => {
  const long = createEdgeRoute([
    { x: 0, y: 0 },
    { x: 10000, y: 0 },
  ])!;
  const result = placeItemLabels([{ ...candidate('long'), route: long }], {
    viewport: { x: 9000, y: 0, width: 800, height: 400 },
    obstacles: [{ x: 8600, y: 0, width: 300, height: 200 }],
    segments: long.segments,
  });
  const label = result.placements.get('long');
  expect(label).toBeDefined();
  expect(label!.x).toBeGreaterThan(8800);
  expect(label!.x + 52).toBeLessThanOrEqual(9392);
  expect(label!.t).toBeCloseTo(label!.x / long.length);
  expect(result.attempts).toBe(1);
  expect(result.checks).toBeLessThan(ITEM_LABEL_BUDGET.checks);
});
