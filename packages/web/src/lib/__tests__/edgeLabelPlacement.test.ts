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
