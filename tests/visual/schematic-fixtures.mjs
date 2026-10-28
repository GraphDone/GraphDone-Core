const card = (id, x, y, label = id) => ({
  id,
  x,
  y,
  width: 152,
  height: 64,
  label,
});
const link = (source, target, count = 1, type = 'DEPENDS_ON') => ({
  id: `${source}:${target}:${type}`,
  source,
  target,
  type,
  edgeIds: Array.from(
    { length: count },
    (_, i) => `${source}:${target}:${type}:${i}`
  ),
});

export const schematicFixtures = [
  {
    name: 'chain',
    title: 'A clear service path',
    width: 1000,
    height: 340,
    minimumRoutes: 3,
    cards: [
      card('Client', 40, 140),
      card('Gateway', 280, 140),
      card('Queue', 520, 140),
      card('Worker', 760, 140),
    ],
    connections: [
      link('Client', 'Gateway', 12),
      link('Gateway', 'Queue', 8),
      link('Queue', 'Worker', 16),
    ],
  },
  {
    name: 'fanout',
    title: 'One source, shared bus, exact branches',
    width: 1000,
    height: 560,
    minimumRoutes: 4,
    cards: [
      card('API', 70, 240),
      card('Billing', 690, 80),
      card('Search', 690, 190),
      card('Events', 690, 300),
      card('Storage', 690, 410),
    ],
    connections: ['Billing', 'Search', 'Events', 'Storage'].flatMap(
      (target, i) => [
        link('API', target, 4 + i),
        link('API', target, 2, 'BLOCKS'),
      ]
    ),
  },
  {
    name: 'dense-cycle',
    title: 'Dense systems disclose collapsed connections',
    width: 1000,
    height: 560,
    minimumRoutes: 4,
    cards: Array.from({ length: 8 }, (_, i) =>
      card(
        `Service ${i + 1}`,
        70 + (i % 4) * 230,
        130 + Math.floor(i / 4) * 240
      )
    ),
    connections: Array.from({ length: 8 }, (_, i) =>
      Array.from({ length: 8 }, (_, j) =>
        i === j
          ? null
          : link(
              `Service ${i + 1}`,
              `Service ${j + 1}`,
              ((i + j) % 3) + 1,
              i % 2 ? 'BLOCKS' : 'DEPENDS_ON'
            )
      )
    )
      .flat()
      .filter(Boolean),
  },
  {
    name: 'phone',
    title: 'Narrow screens keep readable ports',
    width: 390,
    height: 700,
    minimumRoutes: 2,
    cards: [
      card('Gateway', 115, 150, 'Gateway · API'),
      card('Delivery', 115, 330, 'Delivery · Queue'),
      card('Settlement', 115, 510, 'Settlement · Workers'),
    ],
    connections: [
      link('Gateway', 'Delivery', 14),
      link('Delivery', 'Settlement', 7),
      link('Settlement', 'Gateway', 2, 'BLOCKS'),
    ],
  },
];

export const spaghettiFixture = {
  cards: [card('Blocked label', 110, 100)],
  segments: [
    { a: { x: 20, y: 130 }, b: { x: 300, y: 130 }, bus: 'a' },
    { a: { x: 60, y: 20 }, b: { x: 60, y: 220 }, bus: 'b' },
    { a: { x: 40, y: 130 }, b: { x: 290, y: 130 }, bus: 'c' },
    { a: { x: 30, y: 30 }, b: { x: 280, y: 210 }, bus: 'd' },
  ],
};
