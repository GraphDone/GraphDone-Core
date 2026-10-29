import { expect, it } from 'vitest';
import { indexOverviewBusHits, nearestOverviewBus } from './overviewBusHit';
import { routeSchematicConnections } from './schematicRouting';

it('selects the actual routed center line instead of a later overlapping hit stroke', () => {
  const cards = Array.from({ length: 8 }, (_, index) => ({
    id: String(index),
    x: 100 + (index % 4) * 256,
    y: 180 + Math.floor(index / 4) * 120,
    width: 240,
    height: 96,
  }));
  const connections = cards.flatMap(source =>
    cards
      .filter(target => target.id !== source.id)
      .map(target => ({
        id: `${source.id}-${target.id}`,
        source: source.id,
        target: target.id,
        type: 'BLOCKS',
        edgeIds: [`${source.id}-${target.id}`],
      }))
  );
  const routed = routeSchematicConnections(cards, connections, 1300, 750);
  expect(routed.routes).toHaveLength(14);
  const later = routed.routes.find(
    route => route.source === '3' && route.target === '4'
  )!;
  const hits = indexOverviewBusHits(routed.routes);
  expect(nearestOverviewBus(hits, { x: 412, y: 172 }, later.id)?.source).toBe(
    '0'
  );
  expect(nearestOverviewBus(hits, { x: 412, y: 166 }, later.id)?.source).toBe(
    '3'
  );
  const shared = routed.routes.find(
    route => route.source === '0' && route.target === '2'
  )!;
  expect(nearestOverviewBus(hits, { x: 412, y: 172 }, shared.id)?.id).toBe(
    shared.id
  );
  expect(nearestOverviewBus(hits, { x: NaN, y: 0 }, later.id)?.id).toBe(
    later.id
  );
});
