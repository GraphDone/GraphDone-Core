import { expect, it } from 'vitest';
import { placeOverviewBusHint } from './overviewBusHint';

it('keeps a hover caption off nearby cards and controls when a free strip exists', () => {
  const obstacles = [
    { id: 'control', x: 12, y: 12, width: 500, height: 60 },
    ...Array.from({ length: 12 }, (_, index) => ({
      id: String(index),
      x: 100 + (index % 4) * 256,
      y: 200 + Math.floor(index / 4) * 120,
      width: 240,
      height: 96,
    })),
  ];
  const point = placeOverviewBusHint(
    { x: 700, y: 310 },
    1300,
    800,
    360,
    120,
    obstacles
  );
  for (const rect of obstacles)
    expect(
      point.x >= rect.x + rect.width ||
        point.x + 360 <= rect.x ||
        point.y >= rect.y + rect.height ||
        point.y + 120 <= rect.y
    ).toBe(true);
  expect(point.x).toBeGreaterThanOrEqual(12);
  expect(point.x + 360).toBeLessThanOrEqual(1288);
  expect(point.y + 120).toBeLessThanOrEqual(788);
});

it('keeps long captions inside a phone viewport even when no clear rectangle exists', () => {
  const point = placeOverviewBusHint({ x: 380, y: 800 }, 390, 820, 366, 300, [
    { id: 'full', x: 0, y: 0, width: 390, height: 820 },
  ]);
  expect(point.x).toBe(12);
  expect(point.y).toBeGreaterThanOrEqual(12);
  expect(point.y + 300).toBeLessThanOrEqual(808);
});
