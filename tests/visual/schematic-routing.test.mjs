import test from 'node:test';
import assert from 'node:assert/strict';
import {
  routeSchematicConnections,
  measureSchematicClutter,
} from '../../packages/web/src/lib/schematicRouting.ts';
import { schematicFixtures, spaghettiFixture } from './schematic-fixtures.mjs';

function assertClean(metrics) {
  assert.equal(
    metrics.cardIntersections,
    0,
    'Wires must not pass through cards or their labels'
  );
  assert.equal(
    metrics.unrelatedCrossings,
    0,
    'Different buses must not form ambiguous crossings'
  );
  assert.equal(
    metrics.unrelatedOverlaps,
    0,
    'Only intentional shared buses may overlap'
  );
  assert.equal(
    metrics.diagonalSegments,
    0,
    'Connections use organized orthogonal routing'
  );
  assert.ok(
    metrics.maxBusesPerCell <= 4,
    'Too many unrelated buses occupy one 48px cell'
  );
}

test('the visual gate rejects a deliberately tangled, overlapping, label-obscuring diagram', () => {
  const metrics = measureSchematicClutter(
    spaghettiFixture.cards,
    spaghettiFixture.segments
  );
  assert.ok(metrics.cardIntersections > 0);
  assert.ok(metrics.unrelatedCrossings > 0);
  assert.ok(metrics.unrelatedOverlaps > 0);
  assert.ok(metrics.diagonalSegments > 0);
  assert.throws(() => assertClean(metrics));
});

for (const fixture of schematicFixtures)
  test(`${fixture.name}: clean routing retains every relationship and useful visible connections`, () => {
    const source = JSON.stringify(fixture);
    const result = routeSchematicConnections(
      fixture.cards,
      fixture.connections,
      fixture.width,
      fixture.height
    );
    assertClean(result.metrics);
    assert.ok(
      result.routes.length >= fixture.minimumRoutes,
      'An empty or nearly empty canvas cannot pass as clean'
    );
    assert.deepEqual(
      [...result.routes, ...result.deferred]
        .flatMap(route => route.edgeIds)
        .sort(),
      fixture.connections.flatMap(connection => connection.edgeIds).sort()
    );
    assert.equal(JSON.stringify(fixture), source);
    const reordered = routeSchematicConnections(
      [...fixture.cards].reverse(),
      [...fixture.connections].reverse(),
      fixture.width,
      fixture.height
    );
    assert.deepEqual(
      reordered,
      result,
      'Input reorder must not reshuffle ports and lanes'
    );
    if (fixture.name === 'fanout') {
      assert.equal(
        result.routes.length,
        4,
        'Types/parallel edges share one bus per source and target'
      );
      assert.ok(
        result.junctions.length >= 3,
        'Shared bus branches need explicit junction dots'
      );
    }
    if (fixture.name === 'dense-cycle')
      assert.ok(
        result.deferred.length > 0,
        'Congestion must be disclosed, not painted as spaghetti'
      );
  });

test('unplaced endpoints retain their exact edge IDs and explain why no wire is drawn', () => {
  const fixture = schematicFixtures[0];
  const connection = {
    id: 'outside',
    source: 'Client',
    target: 'Unplaced',
    type: 'BLOCKS',
    edgeIds: ['original-outside'],
  };
  const result = routeSchematicConnections(
    fixture.cards,
    [connection],
    fixture.width,
    fixture.height
  );
  assert.equal(result.routes.length, 0);
  assert.equal(result.deferred[0].reason, 'endpoint-not-placed');
  assert.deepEqual(result.deferred[0].edgeIds, ['original-outside']);
});

test('failed routes consume the shared invocation work budget before later searches', () => {
  const cards = [
    { id: 'a', x: 30, y: 70, width: 80, height: 50 },
    { id: 'b', x: 600, y: 70, width: 80, height: 50 },
    { id: 'c', x: 30, y: 300, width: 80, height: 50 },
    { id: 'd', x: 240, y: 300, width: 80, height: 50 },
  ];
  const connections = [
    {
      id: 'blocked',
      source: 'a',
      target: 'b',
      type: 'BLOCKS',
      edgeIds: ['blocked-1', 'blocked-2'],
    },
    {
      id: 'reachable',
      source: 'c',
      target: 'd',
      type: 'DEPENDS_ON',
      edgeIds: ['reachable'],
    },
  ];
  const wall = { id: 'wall', x: 400, y: 0, width: 60, height: 500 };
  const result = routeSchematicConnections(
    cards,
    connections,
    800,
    500,
    [wall],
    { maxAttempts: 1, maxExpandedStates: 2000 }
  );
  assert.equal(
    result.routes.length,
    0,
    'An unsuccessful search must spend the invocation allowance'
  );
  assert.equal(result.deferred.length, 2);
  assert.deepEqual(result.deferred.flatMap(route => route.edgeIds).sort(), [
    'blocked-1',
    'blocked-2',
    'reachable',
  ]);
  assert.equal(result.work.attempts, 1);
  assert.ok(result.work.expandedStates <= 2000);
});

test('the total expansion budget stops all remaining searches while retaining their source IDs', () => {
  const fixture = schematicFixtures[0];
  const result = routeSchematicConnections(
    fixture.cards,
    fixture.connections,
    fixture.width,
    fixture.height,
    [],
    { maxExpandedStates: 1 }
  );
  assert.equal(result.work.expandedStates, 1);
  assert.equal(result.work.attempts, 1);
  assert.equal(result.routes.length, 0);
  assert.deepEqual(
    result.deferred.flatMap(route => route.edgeIds).sort(),
    fixture.connections.flatMap(connection => connection.edgeIds).sort()
  );
});

test('incoming branches share a target trunk without reversing original directions', () => {
  const fixture = schematicFixtures.find(entry => entry.name === 'fanout');
  const connections = fixture.connections.map(connection => ({
    ...connection,
    source: connection.target,
    target: connection.source,
  }));
  const result = routeSchematicConnections(
    fixture.cards,
    connections,
    fixture.width,
    fixture.height,
    [],
    { sharedEndpoint: 'target' }
  );
  assert.equal(result.routes.length, 4);
  assert.ok(result.junctions.length >= 3);
  for (const route of result.routes) {
    assert.equal(route.target, 'API');
    assert.equal(route.bus, 'API');
    assert.notEqual(route.source, 'API');
    assert.deepEqual(
      route.edgeIds.sort(),
      connections
        .filter(connection => connection.source === route.source)
        .flatMap(connection => connection.edgeIds)
        .sort()
    );
  }
  assert.equal(result.metrics.cardIntersections, 0);
  assert.equal(result.metrics.unrelatedCrossings, 0);
  assert.equal(result.metrics.unrelatedOverlaps, 0);
});
