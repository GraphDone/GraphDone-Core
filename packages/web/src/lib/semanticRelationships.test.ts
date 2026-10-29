import { describe, expect, it } from 'vitest';
import {
  buildSemanticHierarchy,
  projectSemanticHierarchy,
  type SemanticEdge,
  type SemanticItem,
} from './semanticLOD';
import {
  indexSemanticRelationships,
  scopedRelationships,
} from './semanticRelationships';

const items: SemanticItem[] = Array.from({ length: 121 }, (_, i) => ({
  id: `n${i}`,
  title: `Service ${i}`,
  type: 'TASK',
  status: 'ACTIVE',
  metadata: { lod: { groupPath: [i < 60 ? 'A' : 'B', `Area ${i % 3}`] } },
}));
const edges: SemanticEdge[] = [
  ...items.slice(1).map(item => ({
    id: `hub-${item.id}`,
    source: 'n0',
    target: item.id,
    type: 'DEPENDS_ON',
  })),
  {
    id: 'parallel',
    source: { id: 'n0' },
    target: { id: 'n1' },
    type: 'DEPENDS_ON',
  },
  { id: 'reverse', source: 'n1', target: 'n0', type: 'BLOCKS' },
  { id: 'loop', source: 'n0', target: 'n0', type: 'ENABLES' },
  { id: 'cycle', source: 'n2', target: 'n1', type: 'BLOCKS' },
  { id: 'pending', source: 'n0', target: 'unloaded', type: 'DEPENDS_ON' },
];
const ids = (value: readonly SemanticEdge[]) =>
  value.map(edge => edge.id).sort();

describe('semantic relationship exploration', () => {
  it('opens exactly the represented bus originals without dropping parallel or unknown types', () => {
    const originals = [...edges, { id: 'future', source: 'n0', target: 'n1', type: 'FUTURE_LINK' }];
    const index = indexSemanticRelationships(items, originals);
    const group = { id: 'unused-label', direct: false };
    const selected = scopedRelationships(index, { kind: 'bus', source: group, target: group, edgeIds: ['hub-n1', 'parallel', 'future', 'parallel', 'deleted'] });
    expect(ids(selected)).toEqual(['future', 'hub-n1', 'parallel']);
    expect(selected.every(edge => originals.includes(edge))).toBe(true);
  });
  it('opens every original between a pair, including reverse links, while excluding unrelated neighbors', () => {
    const index = indexSemanticRelationships(items, edges);
    expect(ids(scopedRelationships(index, { kind: 'pair', endpoints: ['n0', 'n1'] }))).toEqual(['hub-n1', 'parallel', 'reverse']);
    expect(ids(scopedRelationships(index, { kind: 'pair', endpoints: ['n1', 'n0'] }))).toEqual(['hub-n1', 'parallel', 'reverse']);
    expect(ids(scopedRelationships(index, { kind: 'pair', endpoints: ['n0', 'n0'] }))).toEqual(['loop']);
  });
  it('keeps direct parent membership separate from descendants in a stable group selector', () => {
    const members = ['a', 'b', 'child'].map(id => ({
      id,
      title: id,
      type: 'TASK',
      status: 'ACTIVE',
      metadata: {
        lod: { groupPath: id === 'child' ? ['Parent', 'Child'] : ['Parent'] },
      },
    }));
    const links = [
      { id: 'direct', source: 'a', target: 'b', type: 'BLOCKS' },
      { id: 'child', source: 'a', target: 'child', type: 'BLOCKS' },
    ];
    const index = indexSemanticRelationships(members, links);
    const id = [...index.hierarchy.groups.values()].find(
      group => group.label === 'Parent'
    )!.id;
    expect(
      ids(
        scopedRelationships(index, {
          kind: 'internal',
          group: { id, direct: true },
        })
      )
    ).toEqual(['direct']);
    expect(
      ids(
        scopedRelationships(index, {
          kind: 'internal',
          group: { id, direct: false },
        })
      )
    ).toEqual(['child', 'direct']);
  });
  it('partitions every known-endpoint edge exactly once at every cut while retaining original objects', () => {
    const hierarchy = buildSemanticHierarchy(items, edges);
    const index = indexSemanticRelationships(items, edges);
    for (const expanded of [
      new Set<string>(),
      new Set([...hierarchy.groups.keys()]),
    ]) {
      const projection = projectSemanticHierarchy(hierarchy, expanded);
      const byGroup = new Map(
        projection.groups.map(group => [group.id, group])
      );
      const found = [
        ...projection.groups.flatMap(group =>
          scopedRelationships(index, {
            kind: 'internal',
            group: { id: group.hierarchyId, direct: group.isDirect },
          })
        ),
        ...projection.bundles.flatMap(bundle =>
          scopedRelationships(index, {
            kind: 'bundle',
            source: {
              id: byGroup.get(bundle.source)!.hierarchyId,
              direct: byGroup.get(bundle.source)!.isDirect,
            },
            target: {
              id: byGroup.get(bundle.target)!.hierarchyId,
              direct: byGroup.get(bundle.target)!.isDirect,
            },
            type: bundle.type,
          })
        ),
        ...projection.pendingEdges,
      ];
      expect(ids(found)).toEqual(ids(edges));
      expect(new Set(found).size).toBe(edges.length);
      for (const edge of found)
        expect(edges.find(source => source.id === edge.id)).toBe(edge);
    }
  });

  it('keeps all 100+ hub links, parallel identities, self-loops and unresolved endpoints reachable', () => {
    const index = indexSemanticRelationships(items, edges);
    const found = scopedRelationships(index, { kind: 'node', id: 'n0' });
    expect(found).toHaveLength(124);
    expect(ids(found)).toEqual(ids(edges.filter(edge => edge.id !== 'cycle')));
    expect(found.filter(edge => edge.id === 'loop')).toHaveLength(1);
    expect(scopedRelationships(index, { kind: 'all' })).toHaveLength(125);
  });

  it('follows stored direction for one or two hops without inventing reverse links', () => {
    const index = indexSemanticRelationships(items, edges);
    expect(
      ids(scopedRelationships(index, { kind: 'node', id: 'n2' }, 'outgoing', 1))
    ).toEqual(['cycle']);
    expect(
      ids(scopedRelationships(index, { kind: 'node', id: 'n2' }, 'outgoing', 2))
    ).toEqual(['cycle', 'reverse']);
    expect(
      ids(scopedRelationships(index, { kind: 'node', id: 'n0' }, 'incoming', 1))
    ).toEqual(['loop', 'reverse']);
    expect(
      ids(scopedRelationships(index, { kind: 'node', id: 'n0' }, 'incoming', 2))
    ).toEqual(['cycle', 'hub-n1', 'loop', 'parallel', 'reverse']);
  });

  it('does not traverse through an unloaded endpoint to imply an accessible neighborhood', () => {
    const extra = {
      id: 'beyond',
      source: 'unloaded',
      target: 'n4',
      type: 'BLOCKS',
    };
    const index = indexSemanticRelationships(items, [...edges, extra]);
    expect(
      ids(scopedRelationships(index, { kind: 'node', id: 'n0' }, 'outgoing', 2))
    ).not.toContain('beyond');
    expect(ids(scopedRelationships(index, { kind: 'all' }))).toContain(
      'beyond'
    );
  });

  it('is stable under input reorder and includes current additions without mutating source data', () => {
    const before = JSON.stringify({ items, edges });
    const scopedItems = items.map((item, i) =>
      i < 2
        ? {
            ...item,
            metadata: { lod: { groupPath: [i ? 'Target' : 'Source'] } },
          }
        : item
    );
    const index = indexSemanticRelationships(scopedItems, edges);
    const groupId = (label: string) =>
      [...index.hierarchy.groups.values()].find(group => group.label === label)!
        .id;
    const scope = {
      kind: 'bundle' as const,
      source: { id: groupId('Source'), direct: false },
      target: { id: groupId('Target'), direct: false },
      type: 'DEPENDS_ON',
    };
    expect(ids(scopedRelationships(index, scope))).toEqual([
      'hub-n1',
      'parallel',
    ]);
    const addition = {
      id: 'new',
      source: 'n0',
      target: 'n1',
      type: 'DEPENDS_ON',
    };
    expect(
      ids(
        scopedRelationships(
          indexSemanticRelationships(
            [...scopedItems].reverse(),
            [...edges, addition].reverse()
          ),
          scope
        )
      )
    ).toEqual(['hub-n1', 'new', 'parallel']);
    expect(JSON.stringify({ items, edges })).toBe(before);
  });
});
