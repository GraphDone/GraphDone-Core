import { describe, expect, it } from 'vitest';
import {
  buildSemanticHierarchy,
  projectSemanticHierarchy,
  type SemanticEdge,
} from '../semanticLOD';
import {
  prioritySemanticBundles,
  projectRelationshipPriority,
  relationshipPriorityLevel,
  relationshipPriorityTier,
} from '../relationshipPriority';

const items = ['a', 'b', 'c', 'd'].map(id => ({
  id,
  title: id,
  type: 'TASK',
  status: 'ACTIVE',
  metadata: { lod: { groupPath: [id < 'c' ? 'Left' : 'Right'] } },
}));
const edge = (
  id: string,
  source: string,
  target: string,
  type: string
): SemanticEdge => ({ id, source, target, type });
const ids = (edges: readonly SemanticEdge[]) =>
  edges.map(edge => edge.id).sort();

describe('relationship priority projection', () => {
  it('promotes a blocker without reversing or rewriting other original meaning', () => {
    const edges = [
      edge('blocking', 'a', 'b', 'BLOCKS'),
      edge('reverse', 'b', 'a', 'DEPENDS_ON'),
      edge('different', 'a', 'b', 'DEPENDS_ON'),
    ];
    const original = JSON.stringify(edges);
    const essential = projectRelationshipPriority(items, edges, 'essential');
    expect(ids(essential.represented)).toEqual(['blocking']);
    expect(ids(essential.summarized)).toEqual(['different', 'reverse']);
    expect(essential.pairs[0].original).toHaveLength(3);
    expect(essential.pairs[0].primary).toBe(edges[0]);
    expect(essential.byEdge.get('reverse')).toBe(essential.pairs[0]);
    expect(
      ids(projectRelationshipPriority(items, edges, 'dependencies').represented)
    ).toEqual(ids(edges));
    expect(JSON.stringify(edges)).toBe(original);
  });

  it('keeps highest available ties, directions, repeated originals and self links', () => {
    const edges = [
      edge('r1', 'a', 'b', 'REFERENCES'),
      edge('r2', 'a', 'b', 'REFERENCES'),
      edge('r3', 'b', 'a', 'RELATES_TO'),
      edge('self', 'c', 'c', 'ENABLES'),
    ];
    const result = projectRelationshipPriority(items, edges, 'essential');
    expect(ids(result.represented)).toEqual(ids(edges));
    expect(result.pairs.map(pair => pair.fallback)).toEqual([true, true]);
    expect(result.summarized).toEqual([]);
    for (const original of edges)
      expect(result.represented).toContain(original);
  });

  it('reveals a dependency then a reference when higher-priority originals disappear', () => {
    const edges = [
      edge('r', 'a', 'b', 'REFERENCES'),
      edge('d', 'a', 'b', 'DEPENDS_ON'),
      edge('b', 'a', 'b', 'BLOCKS'),
    ];
    expect(
      ids(projectRelationshipPriority(items, edges, 'essential').represented)
    ).toEqual(['b']);
    expect(
      ids(
        projectRelationshipPriority(items, edges.slice(0, 2), 'essential')
          .represented
      )
    ).toEqual(['d']);
    expect(
      ids(
        projectRelationshipPriority(items, edges.slice(0, 1), 'essential')
          .represented
      )
    ).toEqual(['r']);
  });

  it('preserves unknown imported types without interpreting their business meaning', () => {
    expect(relationshipPriorityTier('__proto__')).toBe(2);
    expect(relationshipPriorityTier('IMPORTED_SIGNAL')).toBe(2);
    const edges = [
      edge('unknown', 'a', 'b', 'IMPORTED_SIGNAL'),
      edge('known', 'c', 'd', 'BLOCKS'),
    ];
    expect(
      ids(projectRelationshipPriority(items, edges, 'essential').represented)
    ).toEqual(['known', 'unknown']);
    expect(relationshipPriorityLevel('invalid')).toBe('essential');
    expect(relationshipPriorityLevel('all')).toBe('all');
  });

  it('partitions missing endpoints separately and uses unambiguous pair identities', () => {
    const nodes = [...items, { id: 'a:b' }, { id: 'b:c' }];
    const edges = [
      edge('one', 'a:b', 'c', 'BLOCKS'),
      edge('two', 'a', 'b:c', 'REFERENCES'),
      edge('missing', 'a', 'absent', 'BLOCKS'),
    ];
    const result = projectRelationshipPriority(nodes, edges, 'essential');
    expect(result.pairs).toHaveLength(2);
    expect(ids(result.pending)).toEqual(['missing']);
    expect(
      ids([...result.represented, ...result.summarized, ...result.pending])
    ).toEqual(ids(edges));
  });

  it('is deterministic under reorder and monotonic as meaning is expanded', () => {
    const edges = [
      edge('a', 'a', 'b', 'BLOCKS'),
      edge('b', 'b', 'a', 'CONFLICTS_WITH'),
      edge('c', 'a', 'b', 'SATISFIES'),
      edge('d', 'a', 'b', 'REFERENCES'),
      edge('e', 'c', 'd', 'REFERENCES'),
    ];
    let previous: string[] = [];
    for (const level of ['essential', 'dependencies', 'all'] as const) {
      const result = projectRelationshipPriority(items, edges, level);
      const reordered = projectRelationshipPriority(
        [...items].reverse(),
        [...edges].reverse(),
        level
      );
      expect(result.pairs).toEqual(reordered.pairs);
      expect(ids(result.represented)).toEqual(expect.arrayContaining(previous));
      previous = ids(result.represented);
      expect(
        ids([...result.represented, ...result.summarized, ...result.pending])
      ).toEqual(ids(edges));
      expect(result.pairs.every(pair => pair.represented.length > 0)).toBe(
        true
      );
    }
    expect(previous).toEqual(ids(edges));
  });

  it('keeps lower-tier member-pair coverage before group aggregation', () => {
    const edges = [
      edge('block', 'a', 'c', 'BLOCKS'),
      edge('hidden', 'c', 'a', 'DEPENDS_ON'),
      edge('fallback', 'b', 'd', 'REFERENCES'),
      edge('internal', 'a', 'b', 'CONTAINS'),
    ];
    const hierarchy = buildSemanticHierarchy(items, edges);
    const canonical = projectSemanticHierarchy(hierarchy);
    const priority = projectRelationshipPriority(items, edges, 'essential');
    const bundles = prioritySemanticBundles(
      canonical.bundles,
      priority.representedIds
    );
    expect(ids(bundles.flatMap(bundle => bundle.edges))).toEqual([
      'block',
      'fallback',
    ]);
    expect(ids(canonical.groups.flatMap(group => group.internalEdges))).toEqual(
      ['internal']
    );
    expect(ids(canonical.bundles.flatMap(bundle => bundle.edges))).toEqual([
      'block',
      'fallback',
      'hidden',
    ]);
  });

  it('conserves 50,000 originals across 10,000 items with bounded pair coverage', () => {
    const nodes = Array.from({ length: 10000 }, (_, i) => ({ id: String(i) }));
    const types = ['BLOCKS', 'DEPENDS_ON', 'REFERENCES', 'ENABLES', 'CONTAINS'];
    const edges = Array.from({ length: 50000 }, (_, i) =>
      edge(
        String(i),
        String(i % 10000),
        String((i + 1) % 10000),
        types[Math.floor(i / 10000)]
      )
    );
    const result = projectRelationshipPriority(nodes, edges, 'essential');
    expect(result.pairs).toHaveLength(10000);
    expect(result.represented).toHaveLength(10000);
    expect(result.summarized).toHaveLength(40000);
    expect(result.pending).toEqual([]);
    expect(
      new Set(
        [...result.represented, ...result.summarized].map(edge => edge.id)
      ).size
    ).toBe(50000);
    expect(
      result.pairs.every(
        pair => pair.represented.length === 1 && pair.original.length === 5
      )
    ).toBe(true);
  });
});
