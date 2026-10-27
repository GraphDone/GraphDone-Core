import { describe, expect, it } from 'vitest';
import {
  metadataRecord,
  overviewAtScale,
  placeOverviewLabels,
  projectSemanticGraph,
  type SemanticItem,
} from './semanticLOD';

const item = (id: string, metadata?: unknown): SemanticItem => ({
  id,
  title: `Item ${id}`,
  type: 'TASK',
  status: 'PROPOSED',
  metadata,
});
const edge = (
  id: string,
  source: string,
  target: string,
  type = 'DEPENDS_ON'
) => ({ id, source, target, type });

describe('semantic graph projection', () => {
  it('conserves source identity and every directed typed relationship without mutating inputs', () => {
    const items = [
      item('a', { lane: 'one' }),
      item('b', { lane: 'one' }),
      item('c', { lane: 'two' }),
    ];
    const edges = [
      edge('internal', 'a', 'b'),
      edge('loop', 'a', 'a'),
      edge('parallel1', 'a', 'c'),
      edge('parallel2', 'b', 'c'),
      edge('reverse', 'c', 'a'),
      edge('block', 'a', 'c', 'BLOCKS'),
      edge('missing', 'a', 'unloaded'),
    ];
    const before = JSON.stringify({ items, edges });
    const projected = projectSemanticGraph(items, edges);
    expect(projected.groups.flatMap(group => group.members)).toEqual(
      expect.arrayContaining(items)
    );
    expect(projected.groups.flatMap(group => group.members)).toHaveLength(
      items.length
    );
    expect(projected.groups[0].members[0]).toBe(items[0]);
    const accounted = [
      ...projected.groups.flatMap(group => group.internalEdges),
      ...projected.bundles.flatMap(bundle => bundle.edges),
      ...projected.pendingEdges,
    ];
    expect(accounted.map(value => value.id).sort()).toEqual(
      edges.map(value => value.id).sort()
    );
    expect(projected.bundles).toHaveLength(3);
    expect(projected.bundles.map(bundle => bundle.edges.length).sort()).toEqual(
      [1, 1, 2]
    );
    expect(JSON.stringify({ items, edges })).toBe(before);
  });

  it('uses explicit paths ahead of native containment and never treats dependencies as parents', () => {
    const items = [
      item('parent'),
      item('child'),
      item(
        'explicit',
        JSON.stringify({ lod: { groupPath: ['Subsystem', 'Worker'] } })
      ),
      item('dependency', { lane: 'loose' }),
    ];
    const projection = projectSemanticGraph(items, [
      edge('1', 'child', 'parent', 'IS_PART_OF'),
      edge('2', 'parent', 'explicit', 'CONTAINS'),
      edge('3', 'dependency', 'child'),
    ]);
    expect(projection.membership.get('parent')).toBe(
      projection.membership.get('child')
    );
    expect(projection.membership.get('explicit')).not.toBe(
      projection.membership.get('parent')
    );
    expect(
      projection.groups.find(group =>
        group.members.some(member => member.id === 'explicit')
      )?.label
    ).toBe('Subsystem');
    expect(projection.membership.get('dependency')).not.toBe(
      projection.membership.get('parent')
    );
    expect(projection.diagnostics).toHaveLength(1);
  });

  it('terminates cycles and chooses stable membership through input reordering and multiple parents', () => {
    const items = ['a', 'b', 'c', 'd'].map(id => item(id));
    const edges = [
      edge('1', 'a', 'b', 'IS_PART_OF'),
      edge('2', 'b', 'a', 'IS_PART_OF'),
      edge('3', 'c', 'b', 'IS_PART_OF'),
      edge('4', 'd', 'c', 'IS_PART_OF'),
      edge('5', 'd', 'a', 'IS_PART_OF'),
    ];
    const first = projectSemanticGraph(items, edges);
    const second = projectSemanticGraph(
      [...items].reverse(),
      [...edges].reverse()
    );
    expect([...first.membership]).toEqual([...second.membership]);
    expect(first.groups).toHaveLength(1);
    expect(first.groups[0].members).toHaveLength(4);
    expect(first.diagnostics).toHaveLength(2);
    expect(first.groups[0].internalEdges).toHaveLength(5);
  });

  it('recovers malformed metadata and keeps label collisions in separate namespaces', () => {
    for (const metadata of ['{bad', 'null', '[]', null, 3])
      expect(metadataRecord(metadata)).toEqual({});
    const projection = projectSemanticGraph(
      [
        item('a', { lane: 'TASK' }),
        item('b', { kind: 'TASK' }),
        item('c', '{bad'),
      ],
      []
    );
    expect(projection.groups).toHaveLength(3);
    expect(new Set(projection.groups.map(group => group.id)).size).toBe(3);
  });

  it('retains group identity and canonical positions through unrelated snapshot updates', () => {
    const a = {
      ...item('a', { groupPath: 'System/Worker' }),
      positionX: 120,
      positionY: 200,
    };
    const before = projectSemanticGraph([a], []);
    const after = projectSemanticGraph(
      [item('new', { groupPath: 'System/API' }), a],
      []
    );
    expect(after.membership.get(a.id)).toBe(before.membership.get(a.id));
    expect(after.groups[0].members.find(member => member.id === a.id)).toBe(a);
    expect(a.positionX).toBe(120);
    expect(a.positionY).toBe(200);
  });
});

describe('readable overview', () => {
  it('retains parent coverage across the zoom dead zone and resists boundary jitter', () => {
    let visible = false;
    const states = [0.1, 0.84, 0.86, 0.84, 0.99, 1.01, 0.99, 0.86, 0.84].map(
      scale => (visible = overviewAtScale(visible, scale))
    );
    expect(states).toEqual([
      true,
      true,
      true,
      true,
      true,
      false,
      false,
      false,
      true,
    ]);
  });
  it.each([
    [390, 600],
    [1280, 800],
    [320, 180],
  ])(
    'has no label collisions at %i × %i and accounts for overflow',
    (width, height) => {
      const anchors = Array.from({ length: 40 }, (_, index) => ({
        id: String(index),
        x: width / 2,
        y: height / 2,
      }));
      const layout = placeOverviewLabels(anchors, width, height);
      expect(layout.placed.length + layout.hidden.length).toBe(anchors.length);
      for (const a of layout.placed) {
        expect(a.x).toBeGreaterThanOrEqual(0);
        expect(a.x + a.width).toBeLessThanOrEqual(width);
        expect(a.y + a.height).toBeLessThanOrEqual(height);
        for (const b of layout.placed.filter(b => b.id !== a.id)) {
          expect(
            a.x < b.x + b.width &&
              a.x + a.width > b.x &&
              a.y < b.y + b.height &&
              a.y + a.height > b.y
          ).toBe(false);
        }
      }
    }
  );
});
