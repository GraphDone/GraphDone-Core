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
