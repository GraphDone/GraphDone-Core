import { expect, it } from 'vitest';
import { projectSubgraphPreview } from './subgraphPreview';
import type { SemanticItem, SemanticEdge } from './semanticLOD';

const items: SemanticItem[] = ['a', 'b', 'c'].map(id => ({
  id,
  title: `Full ${id} title`,
  type: 'TASK',
  status: id === 'c' ? 'BLOCKED' : 'ACTIVE',
  metadata: { lod: { groupPath: [id === 'c' ? 'Right' : 'Left'] } },
}));
const edge = (
  id: string,
  source: string,
  target: string,
  type: string
): SemanticEdge => ({ id, source, target, type });
const ids = (edges: readonly SemanticEdge[]) =>
  edges.map(edge => edge.id).sort();

it('accounts for every original including parallel, reverse, internal, self and unloaded endpoints', () => {
  const edges = [
    edge('block', 'a', 'c', 'BLOCKS'),
    edge('copy', 'a', 'c', 'BLOCKS'),
    edge('reverse', 'c', 'a', 'DEPENDS_ON'),
    edge('internal', 'a', 'b', 'REFERENCES'),
    edge('self', 'a', 'a', 'ENABLES'),
    edge('pending', 'a', 'outside', 'BLOCKS'),
    edge('incoming', 'outside', 'a', 'DEPENDS_ON'),
  ];
  const before = JSON.stringify({ items, edges });
  const preview = projectSubgraphPreview(items, edges);
  expect(
    ids([
      ...preview.connections.flatMap(connection => connection.edges),
      ...preview.pending,
    ])
  ).toEqual(ids(edges));
  expect(ids(preview.pending)).toEqual(['incoming', 'pending']);
  expect(preview.visibleGroups[0].label).toBe('Right');
  expect(preview.connections[0]).toMatchObject({
    sourceLabel: 'Left',
    targetLabel: 'Right',
    type: 'BLOCKS',
  });
  expect(ids(preview.connections[0].edges)).toEqual(['block', 'copy']);
  expect(
    preview.connections.find(connection => connection.type === 'DEPENDS_ON')
  ).toMatchObject({ sourceLabel: 'Right', targetLabel: 'Left' });
  for (const original of preview.connections.flatMap(
    connection => connection.edges
  ))
    expect(edges).toContain(original);
  expect(JSON.stringify({ items, edges })).toBe(before);
});

it('bounds visible groups, example names and connection groups without discarding underlying counts', () => {
  const nodes = Array.from({ length: 300 }, (_, i) => ({
    ...items[0],
    id: String(i),
    title: `Item ${i}`,
    metadata: { lod: { groupPath: [`System ${i % 20}`] } },
  }));
  const edges = Array.from({ length: 600 }, (_, i) =>
    edge(
      String(i),
      String(i % 300),
      String((i + 1) % 300),
      i < 300 ? 'BLOCKS' : 'REFERENCES'
    )
  );
  const preview = projectSubgraphPreview(nodes, edges);
  expect(preview.groups).toHaveLength(20);
  expect(
    preview.groups.reduce((count, group) => count + group.members.length, 0)
  ).toBe(300);
  expect(preview.visibleGroups).toHaveLength(4);
  expect(preview.visibleGroups.flatMap(group => group.examples)).toHaveLength(
    8
  );
  expect(preview.visibleConnections).toHaveLength(3);
  expect(
    preview.connections.reduce(
      (count, connection) => count + connection.edges.length,
      0
    )
  ).toBe(600);
  const reordered = projectSubgraphPreview(
    [...nodes].reverse(),
    [...edges].reverse()
  );
  expect(
    reordered.visibleGroups.map(group => [
      group.id,
      group.examples.map(item => item.id),
    ])
  ).toEqual(
    preview.visibleGroups.map(group => [
      group.id,
      group.examples.map(item => item.id),
    ])
  );
  expect(reordered.visibleConnections.map(connection => connection.id)).toEqual(
    preview.visibleConnections.map(connection => connection.id)
  );
});

it('preserves long multilingual names, unknown types and empty data', () => {
  const title = '配送サービス / ' + 'verylongunbrokenname'.repeat(12);
  const preview = projectSubgraphPreview(
    [{ ...items[0], title }],
    [edge('signal', 'a', 'a', '__proto__')]
  );
  expect(preview.visibleGroups[0].examples[0].title).toBe(title);
  expect(preview.connections[0].type).toBe('__proto__');
  expect(projectSubgraphPreview([], []).groups).toEqual([]);
});

it('uses distinct example titles while retaining same-named items in the group count', () => {
  const preview = projectSubgraphPreview(
    [
      { ...items[0], id: 'a', title: 'Gateway' },
      { ...items[0], id: 'b', title: 'Gateway' },
      { ...items[0], id: 'c', title: 'Worker' },
    ],
    []
  );
  expect(preview.visibleGroups[0].members).toHaveLength(3);
  expect(preview.visibleGroups[0].examples.map(item => item.title)).toEqual([
    'Gateway',
    'Worker',
  ]);
});
