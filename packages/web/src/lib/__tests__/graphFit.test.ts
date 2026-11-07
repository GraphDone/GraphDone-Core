import { describe, expect, it } from 'vitest';
import { computeGraphFit, fitRegions } from '../graphFit';
import { graphItemLayout, type TextMeasure } from '../graphSymbolLayout';

const measure: TextMeasure = (text, size) => Array.from(text).length * size * 0.55;
const card = (title: string, x = 0, y = 0) => ({ title, type: 'TASK', description: 'A short brief for the team.', x, y });
type Card = ReturnType<typeof card>;
const dimensionsAt = (item: Card, scale: number) => graphItemLayout(item, measure, scale);
const phoneTitle = 'Prepare the school presentation';

/** The fit the old camera computed: card geometry taken from the current zoom. */
function legacyFit(cards: Card[], width: number, height: number, currentScale: number) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const item of cards) {
    const size = dimensionsAt(item, currentScale);
    minX = Math.min(minX, item.x - size.width / 2);
    maxX = Math.max(maxX, item.x + size.width / 2);
    minY = Math.min(minY, item.y - size.height / 2);
    maxY = Math.max(maxY, item.y + size.height / 2);
  }
  return Math.min(width / (maxX - minX + 120), height / (maxY - minY + 120), 1.25);
}

describe('graph camera fit', () => {
  // Documents the failure mode only (it runs a copy of the old algorithm); the
  // production guard is fit-focus.spec.ts, which fails on the old camera code.
  it('documents why fitting the current zoom geometry cannot settle', () => {
    const cards = [card(phoneTitle)];
    const first = legacyFit(cards, 390, 738, 1);
    const second = legacyFit(cards, 390, 738, first);
    const third = legacyFit(cards, 390, 738, second);
    expect(first).toBeLessThan(1);
    expect(second).toBeGreaterThanOrEqual(1);
    expect(third).toBeCloseTo(first);
  });

  it('keeps a full card at 100% when it fits with a small margin', () => {
    const cards = [card(phoneTitle)];
    const fit = computeGraphFit({ width: 390, height: 738, obstacles: [], cards, dimensionsAt })!;
    expect(fit.scale).toBe(1);
    const size = dimensionsAt(cards[0], fit.scale);
    expect(fit.translateX - size.width / 2).toBeGreaterThanOrEqual(12);
    expect(fit.translateX + size.width / 2).toBeLessThanOrEqual(390 - 12);
  });

  it('frames every card with the geometry it is drawn with at the fitted scale', () => {
    // The result depends only on the cards and viewport, never on the current
    // zoom, so a repeated fit (resize, framing retries) lands on the same camera.
    for (const width of [320, 360, 390, 430, 667, 844, 932, 1440])
      for (const height of [302, 375, 568, 738, 900])
        for (const cards of [
          [card(phoneTitle)],
          [card('Plan the neighborhood picnic 844', -150, -183), card('Invite the neighbors 844', 260, 0)],
          Array.from({ length: 40 }, (_, index) => card(`Task ${index}`, (index % 8) * 360, Math.floor(index / 8) * 220)),
        ]) {
          const fit = computeGraphFit({ width, height, obstacles: [], cards, dimensionsAt })!;
          const label = `${width}x${height} ${cards.length}`;
          for (const item of cards) {
            const size = dimensionsAt(item, fit.scale);
            expect(size.compact, label).toBe(fit.scale < 1);
            expect(fit.translateX + (item.x - size.width / 2) * fit.scale, label).toBeGreaterThanOrEqual(-0.5);
            expect(fit.translateX + (item.x + size.width / 2) * fit.scale, label).toBeLessThanOrEqual(width + 0.5);
            expect(fit.translateY + (item.y - size.height / 2) * fit.scale, label).toBeGreaterThanOrEqual(-0.5);
            expect(fit.translateY + (item.y + size.height / 2) * fit.scale, label).toBeLessThanOrEqual(height + 0.5);
          }
        }
  });

  it('fits compact geometry below 100% and never lands on a scale that turns cards full', () => {
    const cards = [card(phoneTitle)];
    const fit = computeGraphFit({ width: 320, height: 462, obstacles: [], cards, dimensionsAt })!;
    expect(fit.scale).toBeLessThan(1);
    const compact = dimensionsAt(cards[0], fit.scale);
    expect(compact.compact).toBe(true);
    expect(fit.scale).toBeCloseTo(Math.min(320 / (compact.width + 120), 1 - 0.001), 4);
  });

  it('keeps the existing zoom-in cap and obstacle avoidance', () => {
    const cards = [card('Review')];
    expect(computeGraphFit({ width: 1440, height: 900, obstacles: [], cards, dimensionsAt })!.scale).toBe(1.25);
    const obstacle = { left: 0, top: 0, right: 1440, bottom: 300 };
    const fit = computeGraphFit({ width: 1440, height: 900, obstacles: [obstacle], cards, dimensionsAt })!;
    const size = dimensionsAt(cards[0], fit.scale);
    expect(fit.translateY - (size.height / 2) * fit.scale).toBeGreaterThanOrEqual(300);
    expect(fitRegions(100, 100, [{ left: 0, top: 0, right: 0, bottom: 10 }])).toEqual([{ x: 0, y: 0, width: 100, height: 100 }]);
  });

  it('returns null until a card has a position', () => {
    expect(computeGraphFit({ width: 390, height: 844, obstacles: [], cards: [{ ...card('x'), x: Number.NaN }], dimensionsAt })).toBeNull();
  });
});
