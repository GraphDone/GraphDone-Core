import { expect, it } from 'vitest';
import { frameOrganizedNeighborhood } from './organizationCamera';

it('keeps the readable hub and vertical neighbors clear of phone controls when side neighbors require panning', () => {
  const cards = [
    { id: 'hub', x: 0, y: 0, width: 220, height: 84 },
    ...[
      [0, -300],
      [0, 300],
      [-300, 0],
      [300, 0],
    ].map(([x, y], i) => ({ id: String(i), x, y, width: 210, height: 56 })),
  ];
  const obstacles = [
    { x: 12, y: 60, width: 212, height: 48 },
    { x: 334, y: 112, width: 44, height: 44 },
    { x: 64, y: 600, width: 172, height: 72 },
  ];
  const at = frameOrganizedNeighborhood(
    cards,
    'hub',
    { width: 390, height: 684 },
    obstacles,
    0.65,
    { x: 195, y: 342 }
  );
  expect(at.x).toBe(195);
  expect(at.y).toBeGreaterThan(320);
  for (const card of cards.filter(c => ['hub', '0', '1'].includes(c.id))) {
    const left = at.x + card.x * 0.65 - (card.width * 0.65) / 2,
      top = at.y + card.y * 0.65 - (card.height * 0.65) / 2;
    for (const o of obstacles)
      expect(
        left < o.x + o.width &&
          left + card.width * 0.65 > o.x &&
          top < o.y + o.height &&
          top + card.height * 0.65 > o.y
      ).toBe(false);
  }
});

it('keeps a desktop hub centered and all neighbors visible instead of hiding cards to avoid controls', () => {
  const cards = [
    { id: 'hub', x: 0, y: 0, width: 220, height: 84 },
    ...Array.from({ length: 8 }, (_, i) => ({
      id: String(i),
      x: 402 * Math.cos((i * Math.PI) / 4),
      y: 402 * Math.sin((i * Math.PI) / 4),
      width: 220,
      height: 56,
    })),
  ];
  const viewport = { width: 1376, height: 750 };
  const obstacles = [
    { x: 12, y: 12, width: 264, height: 48 },
    { x: 12, y: 64, width: 44, height: 92 },
    { x: 1104, y: 542, width: 256, height: 192 },
    { x: 64, y: 636, width: 196, height: 36 },
  ];
  const at = frameOrganizedNeighborhood(
    cards,
    'hub',
    viewport,
    obstacles,
    0.65,
    { x: 688, y: 375 }
  );
  expect(at).toEqual({ x: 688, y: 375 });
  for (const card of cards) {
    const left = at.x + card.x * 0.65 - (card.width * 0.65) / 2,
      top = at.y + card.y * 0.65 - (card.height * 0.65) / 2;
    expect(left).toBeGreaterThan(0);
    expect(top).toBeGreaterThan(0);
    expect(left + card.width * 0.65).toBeLessThan(viewport.width);
    expect(top + card.height * 0.65).toBeLessThan(viewport.height);
    for (const obstacle of obstacles)
      expect(
        left < obstacle.x + obstacle.width &&
          left + card.width * 0.65 > obstacle.x &&
          top < obstacle.y + obstacle.height &&
          top + card.height * 0.65 > obstacle.y
      ).toBe(false);
  }
  const blocked = frameOrganizedNeighborhood(
    cards,
    'hub',
    viewport,
    [...obstacles, { x: 200, y: 90, width: 350, height: 150 }],
    0.65,
    { x: 688, y: 375 }
  );
  expect(blocked.x).toBe(688);
  for (const card of cards) {
    expect(
      blocked.y + card.y * 0.65 - (card.height * 0.65) / 2
    ).toBeGreaterThan(0);
    expect(blocked.y + card.y * 0.65 + (card.height * 0.65) / 2).toBeLessThan(
      viewport.height
    );
  }
});

it('keeps the focused hub clear when a tall overlay leaves room only at the top', () => {
  const at = frameOrganizedNeighborhood(
    [{ id: 'hub', x: 0, y: 0, width: 220, height: 84 }],
    'hub',
    { width: 390, height: 684 },
    [{ x: 12, y: 190, width: 366, height: 490 }],
    0.65,
    { x: 195, y: 342 }
  );
  expect(at.x).toBe(195);
  expect(at.y + (84 * 0.65) / 2).toBeLessThanOrEqual(178);
  expect(at.y - (84 * 0.65) / 2).toBeGreaterThanOrEqual(20);
});
