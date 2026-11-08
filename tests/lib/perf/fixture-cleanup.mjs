import assert from 'node:assert/strict';

export async function cleanupPerfGraph({ id, nodeCount, edgeCount }, mutate) {
  assert.ok(typeof id === 'string' && id.length > 0, 'Cleanup requires the owned graph ID');
  for (const [entity, where, expected] of [
    ['Edges', 'source:{graph:{id:$id}}', edgeCount],
    ['WorkItems', 'graph:{id:$id}', nodeCount],
    ['Graphs', 'id:$id', 1],
  ]) {
    const result = await mutate(`mutation($id:ID!){delete${entity}(where:{${where}}){nodesDeleted}}`, { id });
    assert.equal(result?.[`delete${entity}`]?.nodesDeleted, expected,
      `Owned graph ${id}: ${entity} cleanup must be confirmed before deleting its parents`);
  }
}
