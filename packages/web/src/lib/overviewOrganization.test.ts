import { expect, it } from 'vitest';
import { organizeOverview } from './overviewOrganization';
import {
  measureSchematicClearance,
  routeSchematicConnections,
  type SchematicRoute,
} from './schematicRouting';

const anchors = Array.from({ length: 8 }, (_, i) => ({
  id: `group-${i}`,
  x: 500,
  y: 300,
}));
const links = anchors
  .slice(1)
  .map(node => ({
    id: node.id,
    source: 'group-0',
    target: node.id,
    type: 'BLOCKS',
    edgeIds: [node.id],
  }));
const obstacles = [
  { left: 60, right: 700, top: 12, bottom: 70 },
  { left: 1110, right: 1360, top: 540, bottom: 740 },
];

it('gives overview cards generous gutters and keeps the hub central among its neighbors', () => {
  const result = organizeOverview(anchors, links, 1376, 750, obstacles);
  expect(result.placed).toHaveLength(8);
  for (const a of result.placed)
    for (const b of result.placed) {
      if (a.id === b.id) continue;
      const dx = Math.max(0, Math.abs(a.x - b.x) - (a.width + b.width) / 2);
      const dy = Math.max(0, Math.abs(a.y - b.y) - (a.height + b.height) / 2);
      expect(Math.hypot(dx, dy)).toBeGreaterThanOrEqual(64);
    }
  const hub = result.placed.find(card => card.id === 'group-0')!;
  expect(result.placed.some(card => card.x < hub.x)).toBe(true);
  expect(result.placed.some(card => card.x > hub.x)).toBe(true);
  expect(result.placed.some(card => card.y < hub.y)).toBe(true);
  expect(result.placed.some(card => card.y > hub.y)).toBe(true);
  expect(result.work.after).toBeLessThanOrEqual(result.work.before);
  expect(result.work.candidates).toBeLessThanOrEqual(1024);
  expect(
    organizeOverview(
      [...anchors].reverse(),
      [...links].reverse(),
      1376,
      750,
      obstacles
    )
  ).toEqual(result);
  const routed = routeSchematicConnections(
    result.placed,
    links,
    1376,
    750,
    obstacles.map((o, i) => ({
      id: `control-${i}`,
      x: o.left,
      y: o.top,
      width: o.right - o.left,
      height: o.bottom - o.top,
    })),
    { cardClearance: 20, wireClearance: 16 }
  );
  expect(routed.routes.length).toBeGreaterThanOrEqual(5);
  expect(routed.routes.length + routed.deferred.length).toBe(7);
  const clearance = measureSchematicClearance(result.placed, routed.routes);
  expect(clearance.minCardClearance).toBeGreaterThanOrEqual(20);
  expect(routed.metrics.cardIntersections).toBe(0);
});

it('rejects a mathematically noncrossing but unreadably close pair of wires', () => {
  const routes: SchematicRoute[] = [0, 1].map(i => ({
    id: String(i),
    bus: String(i),
    source: `source-${i}`,
    target: `target-${i}`,
    edgeIds: [String(i)],
    connections: [],
    points: [
      { x: 100, y: 100 + i * 6 },
      { x: 500, y: 100 + i * 6 },
    ],
  }));
  const bad = measureSchematicClearance(
    [{ id: 'near-card', x: 150, y: 110, width: 240, height: 96 }],
    routes
  );
  expect(bad.minUnrelatedWireClearance).toBe(6);
  expect(bad.minCardClearance).toBe(4);
  expect(
    bad.minUnrelatedWireClearance! >= 16 && bad.minCardClearance! >= 20
  ).toBe(false);
});

it('routes useful distinct buses with clearance and retains phone overflow identities', () => {
  const connections = anchors
    .slice(1)
    .map((node, i) => ({
      id: node.id,
      source: anchors[i].id,
      target: node.id,
      type: 'BLOCKS',
      edgeIds: [node.id],
    }));
  const result = organizeOverview(anchors, connections, 1376, 750, obstacles);
  const routed = routeSchematicConnections(
    result.placed,
    connections,
    1376,
    750,
    [],
    { cardClearance: 20, wireClearance: 16 }
  );
  expect(routed.routes.length).toBeGreaterThanOrEqual(4);
  const clearance = measureSchematicClearance(result.placed, routed.routes);
  expect(clearance.minUnrelatedWireClearance).toBeGreaterThanOrEqual(16);
  expect(clearance.minCardClearance).toBeGreaterThanOrEqual(20);
  const phone = organizeOverview(anchors, links, 390, 740, [
    { left: 12, right: 220, top: 12, bottom: 155 },
  ]);
  expect(phone.placed.length).toBeGreaterThanOrEqual(2);
  expect(
    new Set([...phone.placed.map(card => card.id), ...phone.hidden])
  ).toEqual(new Set(anchors.map(a => a.id)));
});
