import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanupPerfGraph } from './fixture-cleanup.mjs';

const fixture = { id: 'owned-perf-graph', nodeCount: 4, edgeCount: 3 };
const success = [{ deleteEdges: { nodesDeleted: 3 } }, { deleteWorkItems: { nodesDeleted: 4 } }, { deleteGraphs: { nodesDeleted: 1 } }];

test('cleanup preserves dependency order and always scopes mutations to its graph', async () => {
  const requests = [];
  await cleanupPerfGraph(fixture, async (query, variables) => {
    requests.push({ query, variables });
    return success[requests.length - 1];
  });
  assert.deepEqual(requests, [
    { query: 'mutation($id:ID!){deleteEdges(where:{source:{graph:{id:$id}}}){nodesDeleted}}', variables: { id: fixture.id } },
    { query: 'mutation($id:ID!){deleteWorkItems(where:{graph:{id:$id}}){nodesDeleted}}', variables: { id: fixture.id } },
    { query: 'mutation($id:ID!){deleteGraphs(where:{id:$id}){nodesDeleted}}', variables: { id: fixture.id } },
  ]);
});

for (const stage of [0, 1]) {
  for (const failure of ['request error', 'unconfirmed count']) {
    test(`${failure} at child stage ${stage} retains later ownership relationships`, async () => {
      let calls = 0;
      await assert.rejects(cleanupPerfGraph(fixture, async () => {
        const index = calls++;
        if (index === stage) {
          if (failure === 'request error') throw new Error('Injected cleanup failure');
          return { [stage === 0 ? 'deleteEdges' : 'deleteWorkItems']: { nodesDeleted: 0 } };
        }
        return success[index];
      }));
      assert.equal(calls, stage + 1);
    });
  }
}

test('missing ownership ID never executes cleanup', async () => {
  await assert.rejects(cleanupPerfGraph({ ...fixture, id: '' }, () => assert.fail('must not mutate')));
});
