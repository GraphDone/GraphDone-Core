import { expect, it } from 'vitest';
import { createEdgeRoute } from '../edgeRouteGeometry';
import {
  labelsMissed,
  placeItemLabels,
  placeItemLabelsWithRetry,
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

// The renderer places labels again from fresh spots only when that could show
// more: not for labels off screen, not drawn or past the label cap.
it('a label is missed only when one on screen was tried and found no spot', () => {
  const options = { viewport, obstacles: [], segments: route.segments };
  const offScreen = { ...candidate('b-off'), route: createEdgeRoute([{ x: 10000, y: 0 }, { x: 11000, y: 0 }])! };
  const notDrawn = { ...candidate('c-hidden'), eligible: false };
  expect(labelsMissed(placeItemLabels([candidate('a'), offScreen, notDrawn], options))).toBe(false);
  const below = { ...candidate('d-below'), route: createEdgeRoute([{ x: 0, y: 200 }, { x: 300, y: 200 }])! };
  const capped = { labels: 1, attempts: 128, checks: 200000 };
  expect(labelsMissed(placeItemLabels([candidate('a'), below], options, capped), capped)).toBe(false);
  const blocked = placeItemLabels([candidate('a')], { ...options, obstacles: [{ x: 150, y: 0, width: 1000, height: 1000 }] });
  expect(labelsMissed(blocked)).toBe(true);
});

it('counts both placement passes when the fresh positions recover a label', () => {
  const first = { ...candidate('a'), t: 0.9, dims: { width: 100, height: 26 } };
  const second = { ...first, id: 'b', t: 0.5, route: createEdgeRoute([{ x: 200, y: 0 }, { x: 320, y: 0 }])! };
  const options = { viewport: { x: 300, y: 50, width: 700, height: 100 }, obstacles: [], segments: [] };
  const remembered = placeItemLabels([first, second], options);
  const fresh = placeItemLabels([{ ...first, t: 0.5 }, second], options);
  expect(remembered.placements.size).toBe(1);
  expect(fresh.placements.size).toBe(2);

  const result = placeItemLabelsWithRetry([first, second], options);
  expect(result.placements).toEqual(fresh.placements);
  expect(result.attempts).toBe(remembered.attempts + fresh.attempts);
  expect(result.checks).toBe(remembered.checks + fresh.checks);
});

it('uses only the remaining checks and attempts, even when the retry cannot place more labels', () => {
  const labels = Array.from({ length: 60 }, (_, i) => ({ ...candidate(String(i)), t: 0.8 }));
  const options = { viewport, obstacles: [
    ...Array.from({ length: 2000 }, () => ({ x: 146, y: 150, width: 10, height: 10 })),
    { x: 150, y: 0, width: 1000, height: 1000 },
  ], segments: [] };
  const first = placeItemLabels(labels, options);
  expect(first.checks).toBeGreaterThan(ITEM_LABEL_BUDGET.checks / 2);
  expect(first.checks).toBeLessThan(ITEM_LABEL_BUDGET.checks);
  const result = placeItemLabelsWithRetry(labels, options);
  expect(result.placements.size).toBe(0);
  expect(result.checks).toBe(ITEM_LABEL_BUDGET.checks);
  expect(result.attempts).toBeGreaterThan(first.attempts);

  const capped = { ...ITEM_LABEL_BUDGET, attempts: first.attempts + 1 };
  expect(placeItemLabelsWithRetry(labels, options, capped).attempts).toBe(capped.attempts);
});

it('avoids repeating the same placement or resetting a dragged label', () => {
  const labels = [candidate('a'), { ...candidate('b'), t: 0.75, dragged: true }];
  let obstacleReads = 0;
  const obstacle = {
    get x() { obstacleReads++; return 150; },
    y: 0, width: 1000, height: 1000,
  };
  const options = { viewport, obstacles: [obstacle], segments: [] };
  const first = placeItemLabels(labels, options);
  const singlePassReads = obstacleReads;
  expect(singlePassReads).toBeGreaterThan(0);
  obstacleReads = 0;
  expect(placeItemLabelsWithRetry(labels, options)).toEqual(first);
  expect(obstacleReads).toBe(singlePassReads);
});
