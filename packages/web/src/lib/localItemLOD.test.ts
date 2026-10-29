import { describe, expect, it } from 'vitest';
import { projectItemNeighborhood } from './localItemLOD';
import { projectRelationshipPriority } from './relationshipPriority';
import { indexSemanticRelationships } from './semanticRelationships';
import type { SemanticEdge, SemanticItem } from './semanticLOD';

const item = (id: string, title = id, group = 'Factory'): SemanticItem => ({
  id,
  title,
  type: 'TASK',
  status: 'PROPOSED',
  metadata: { lod: { groupPath: [group] } },
});
const edge = (
  id: string,
  source: string,
  target: string,
  type = 'DEPENDS_ON'
): SemanticEdge => ({ id, source, target, type });
const ids = (edges: readonly SemanticEdge[]) =>
  edges.map(value => value.id).sort();
const hubFixture = () => {
  const items = [
    item('hub', '#2215 Factory'),
    ...Array.from({ length: 107 }, (_, i) =>
      item(`n${i}`, `Task ${i}`, ['Factory', 'Infra', 'Platform'][i % 3])
    ),
  ];
  const edges = items
    .slice(1)
    .map((value, i) =>
      i === 106
        ? edge(`e${i}`, value.id, 'hub')
        : edge(`e${i}`, 'hub', value.id)
    );
  return { items, edges, index: indexSemanticRelationships(items, edges) };
};
const assertPartition = (
  projection: ReturnType<typeof projectItemNeighborhood>
) => {
  const partitions = Object.values(projection.partitions).flat();
  expect(ids(partitions)).toEqual(ids(projection.incident));
  expect(new Set(partitions.map(value => value.id)).size).toBe(
    partitions.length
  );
  expect(projection.connections.flatMap(value => value.edgeIds).sort()).toEqual(
    ids(projection.partitions.representedCandidates)
  );
  expect(
    projection.connections.every(
      connection =>
        projection.cards.some(card => card.id === connection.source) &&
        projection.cards.some(card => card.id === connection.target)
    )
  ).toBe(true);
};

describe('local original-item neighborhoods', () => {
  it('keeps the single incoming parent visible on the first 107-neighbor desktop page without duplicating later pages', () => {
    const { items, edges, index } = hubFixture();
    const first = projectItemNeighborhood(index, 'hub', {
      capacity: 7,
      page: 0,
    });
    const originals = first.cards.filter(
      card => card.kind === 'item' && !card.isFocus
    );
    expect(originals.slice(0, 2).map(card => card.id)).toEqual(['n0', 'n106']);
    expect(
      first.connections.find(connection => connection.edgeIds.includes('e106'))
    ).toMatchObject({ source: 'n106', target: 'hub', type: 'DEPENDS_ON' });
    const allPages: string[] = [];
    for (let page = 0; page < first.pages; page++) {
      const result = projectItemNeighborhood(index, 'hub', {
        capacity: 7,
        page,
      });
      allPages.push(
        ...result.cards
          .filter(card => card.kind === 'item' && !card.isFocus)
          .map(card => card.id)
      );
      assertPartition(result);
    }
    expect(allPages).toHaveLength(107);
    expect(new Set(allPages).size).toBe(107);
    expect([...allPages].sort()).toEqual(
      items
        .slice(1)
        .map(value => value.id)
        .sort()
    );
    const reversed = projectItemNeighborhood(
      indexSemanticRelationships([...items].reverse(), [...edges].reverse()),
      'hub',
      { capacity: 7, page: 0 }
    );
    expect(reversed).toEqual(first);
    const phone = projectItemNeighborhood(index, 'hub', {
      capacity: 2,
      page: 1,
    });
    expect(phone.cards[1].id).toBe('n1');
  });

  it('chooses each direction by its eligible relationship strength before numeric title ties', () => {
    const items = [
      item('hub'),
      item('out10', 'Task 10'),
      item('out2', 'Task 2'),
      item('inStrong', 'Task 99'),
      item('inWeak', 'Task 1'),
      item('both', 'Task 0'),
    ];
    const edges = [
      edge('o10', 'hub', 'out10', 'BLOCKS'),
      edge('o2', 'hub', 'out2', 'BLOCKS'),
      edge('is', 'inStrong', 'hub', 'BLOCKS'),
      edge('iw', 'inWeak', 'hub'),
      edge('bo', 'hub', 'both', 'BLOCKS'),
      edge('bi', 'both', 'hub', 'RELATES_TO'),
    ];
    const result = projectItemNeighborhood(
      indexSemanticRelationships(items, edges),
      'hub',
      { capacity: 4, page: 0 }
    );
    expect(
      result.cards
        .filter(card => card.kind === 'item' && !card.isFocus)
        .map(card => card.id)
    ).toEqual(['both', 'inStrong']);
    const next = projectItemNeighborhood(
      indexSemanticRelationships(items, edges),
      'hub',
      { capacity: 4, page: 1 }
    );
    expect(
      next.cards
        .filter(card => card.kind === 'item' && !card.isFocus)
        .map(card => card.id)
    ).toEqual(['out2', 'out10']);
    assertPartition(result);
  });

  it('uses a retained incoming fallback without reviving priority-summarized reverse edges', () => {
    const items = [
      item('hub'),
      item('a', 'Task 1'),
      item('b', 'Task 2'),
      item('parent', 'Task 99'),
      item('other', 'Task 100'),
    ];
    const edges = [
      edge('a', 'hub', 'a', 'BLOCKS'),
      edge('hidden', 'a', 'hub', 'RELATES_TO'),
      edge('b', 'hub', 'b', 'BLOCKS'),
      edge('parent', 'parent', 'hub'),
      edge('other', 'hub', 'other'),
    ];
    const index = indexSemanticRelationships(items, edges);
    const priority = projectRelationshipPriority(items, edges, 'essential');
    const result = projectItemNeighborhood(index, 'hub', {
      capacity: 4,
      page: 0,
      representedIds: priority.representedIds,
    });
    expect(
      result.cards
        .filter(card => card.kind === 'item' && !card.isFocus)
        .map(card => card.id)
    ).toEqual(['a', 'parent']);
    expect(ids(result.partitions.prioritySummarized)).toEqual(['hidden']);
    expect(
      result.connections.some(connection =>
        connection.edgeIds.includes('hidden')
      )
    ).toBe(false);
    const noIncoming = projectItemNeighborhood(index, 'hub', {
      capacity: 4,
      page: 0,
      representedIds: new Set(['a', 'b', 'other']),
    });
    expect(
      noIncoming.cards
        .filter(card => card.kind === 'item' && !card.isFocus)
        .map(card => card.id)
    ).toEqual(['a', 'b']);
    assertPartition(result);
    assertPartition(noIncoming);
  });

  it('promotes a bidirectional neighbor once and keeps direction balancing inside the selected group', () => {
    const items = [
      item('hub'),
      item('both', 'Task 99'),
      item('a', 'Task 1'),
      item('b', 'Task 2'),
      item('parent', 'Task 0', 'Outside'),
    ];
    const edges = [
      edge('bi', 'both', 'hub', 'BLOCKS'),
      edge('bo', 'hub', 'both', 'BLOCKS'),
      edge('a', 'hub', 'a'),
      edge('b', 'hub', 'b'),
      edge('parent', 'parent', 'hub', 'BLOCKS'),
    ];
    const index = indexSemanticRelationships(items, edges);
    const groupId = projectItemNeighborhood(index, 'hub', {
      capacity: 4,
      page: 0,
    }).groups.find(group => group.label === 'Factory')!.id;
    const result = projectItemNeighborhood(index, 'hub', {
      capacity: 4,
      page: 0,
      groupId,
    });
    expect(
      result.cards
        .filter(card => card.kind === 'item' && !card.isFocus)
        .map(card => card.id)
    ).toEqual(['both', 'a', 'b']);
    expect(ids(result.partitions.spatialDeferred)).toEqual(['parent']);
    expect(result.cards.filter(card => card.id === 'both')).toHaveLength(1);
    assertPartition(result);
  });

  it('gives the 107-neighbor incident a bounded mixed desktop cut while retaining every original', () => {
    const { items, edges, index } = hubFixture();
    const before = JSON.stringify({ items, edges });
    const priority = projectRelationshipPriority(items, edges, 'essential');
    expect(priority.represented).toHaveLength(107);
    const projection = projectItemNeighborhood(index, 'hub', {
      capacity: 7,
      page: 0,
      representedIds: priority.representedIds,
    });
    expect(projection.cards).toHaveLength(7);
    expect(
      projection.cards.filter(card => card.kind === 'item' && !card.isFocus)
    ).toHaveLength(4);
    expect(
      projection.cards.filter(card => card.kind === 'summary')
    ).toHaveLength(2);
    expect(projection.counts.incident).toBe(107);
    expect(projection.counts.neighbors).toBe(107);
    expect(projection.counts.loadedNeighbors).toBe(107);
    expect(projection.focus).toBe(items[0]);
    for (const card of projection.cards)
      if (card.kind === 'item') expect(card.item).toBe(index.byId.get(card.id));
    assertPartition(projection);
    expect(JSON.stringify({ items, edges })).toBe(before);
    expect(projection.work.incidentEntriesVisited).toBe(107);
    expect(projection.work.neighborsConsidered).toBe(107);
  });

  it('keeps focus plus one original on a two-card phone and pages all 107 without invented boundary wires', () => {
    const { index } = hubFixture();
    const seen = new Set<string>();
    for (let page = 0; page < 107; page++) {
      const projection = projectItemNeighborhood(index, 'hub', {
        capacity: 2,
        page,
      });
      expect(projection.cards).toHaveLength(2);
      expect(projection.cards.every(card => card.kind === 'item')).toBe(true);
      expect(projection.pages).toBe(107);
      expect(projection.page).toBe(page);
      expect(projection.overflowGroups.length).toBeGreaterThan(0);
      expect(projection.partitions.spatialDeferred).toHaveLength(106);
      seen.add(projection.cards[1].id);
      assertPartition(projection);
    }
    expect(seen.size).toBe(107);
  });

  it('partitions priority, missing endpoints, self loops, represented and spatial edges exactly', () => {
    const items = [item('hub'), item('a'), item('b')];
    const edges = [
      edge('out', 'hub', 'a', 'BLOCKS'),
      edge('parallel', 'hub', 'a', 'BLOCKS'),
      edge('reverse', 'a', 'hub'),
      edge('low', 'hub', 'a', 'RELATES_TO'),
      edge('later', 'hub', 'b'),
      edge('loop', 'hub', 'hub'),
      edge('missing', 'hub', 'absent'),
      edge('unrelated', 'a', 'b'),
    ];
    const index = indexSemanticRelationships(items, edges);
    const projection = projectItemNeighborhood(index, 'hub', {
      capacity: 2,
      page: 0,
      representedIds: new Set(['out', 'parallel', 'reverse', 'later']),
    });
    expect(ids(projection.partitions.internal)).toEqual(['loop']);
    expect(ids(projection.partitions.pending)).toEqual(['missing']);
    expect(ids(projection.partitions.prioritySummarized)).toEqual(['low']);
    expect(ids(projection.partitions.spatialDeferred)).toEqual(['later']);
    expect(
      projection.connections.map(value => [
        value.source,
        value.target,
        value.type,
        value.edgeIds,
      ])
    ).toEqual([
      ['hub', 'a', 'BLOCKS', ['out', 'parallel']],
      ['a', 'hub', 'DEPENDS_ON', ['reverse']],
    ]);
    expect(projection.counts.neighbors).toBe(3);
    expect(projection.counts.loadedNeighbors).toBe(2);
    assertPartition(projection);
  });

  it('preserves reverse/type identity inside grouped buses and includes only unexpanded members', () => {
    const items = [
      item('hub'),
      item('a', 'First'),
      item('b', 'Second'),
      item('c', 'Third'),
    ];
    const edges = [
      edge('a', 'hub', 'a', 'BLOCKS'),
      edge('b1', 'hub', 'b'),
      edge('b2', 'hub', 'b'),
      edge('c', 'c', 'hub', 'ENABLES'),
    ];
    const result = projectItemNeighborhood(
      indexSemanticRelationships(items, edges),
      'hub',
      { capacity: 3, page: 0 }
    );
    const summary = result.cards.find(card => card.kind === 'summary')!;
    expect(summary.kind).toBe('summary');
    if (summary.kind !== 'summary') throw Error('Missing summary');
    expect(summary.members.map(member => member.id)).toEqual(['b', 'c']);
    expect(summary.edgeIds).toEqual(['b1', 'b2', 'c']);
    expect(
      result.connections.find(connection => connection.edgeIds.includes('b1'))
    ).toMatchObject({
      source: 'hub',
      target: summary.id,
      type: 'DEPENDS_ON',
      edgeIds: ['b1', 'b2'],
    });
    expect(
      result.connections.find(connection => connection.edgeIds.includes('c'))
    ).toMatchObject({ source: summary.id, target: 'hub', type: 'ENABLES' });
    assertPartition(result);
  });

  it('resolves group membership and labels fresh after moves, additions and deletion', () => {
    const initial = [
      item('hub'),
      item('a', 'A', 'Old'),
      item('b', 'B', 'Old'),
      item('c', 'C', 'Other'),
    ];
    const edges = [
      edge('a', 'hub', 'a'),
      edge('b', 'hub', 'b'),
      edge('c', 'hub', 'c'),
    ];
    const first = projectItemNeighborhood(
      indexSemanticRelationships(initial, edges),
      'hub',
      { capacity: 2, page: 0 }
    );
    const groupId = first.groups.find(group => group.label === 'Old')!.id;
    const moved = [
      initial[0],
      item('a', 'Renamed A', 'Other'),
      initial[2],
      initial[3],
      item('d', 'New D', 'Old'),
    ];
    const next = projectItemNeighborhood(
      indexSemanticRelationships(moved, [...edges, edge('d', 'hub', 'd')]),
      'hub',
      { capacity: 7, page: 0, groupId }
    );
    expect(next.missingGroup).toBe(false);
    expect(
      next.cards.filter(card => card.kind === 'item').map(card => card.id)
    ).toEqual(['hub', 'b', 'd']);
    expect(
      next.groups
        .find(group => group.id === groupId)!
        .members.map(value => value.id)
    ).toEqual(['b', 'd']);
    expect(ids(next.partitions.spatialDeferred)).toEqual(['a', 'c']);
    assertPartition(next);
    const lastItems = moved.filter(value => !['b', 'd'].includes(value.id));
    const last = projectItemNeighborhood(
      indexSemanticRelationships(
        lastItems,
        edges.filter(value => value.id !== 'b')
      ),
      'hub',
      { capacity: 7, page: 0, groupId }
    );
    expect(last.missingGroup).toBe(true);
    expect(last.cards.map(card => card.id)).toEqual(['hub']);
    assertPartition(last);
  });

  it('keeps direct parent items separate from their child subgroup', () => {
    const items = [
      item('hub'),
      item('direct'),
      {
        ...item('child'),
        metadata: { lod: { groupPath: ['Factory', 'Delivery'] } },
      },
    ];
    const result = projectItemNeighborhood(
      indexSemanticRelationships(items, [
        edge('d', 'hub', 'direct'),
        edge('c', 'hub', 'child'),
      ]),
      'hub',
      { capacity: 3, page: 0 }
    );
    expect(result.groups.map(group => group.label).sort()).toEqual([
      'Factory / Delivery',
      'Factory / Direct items',
    ]);
    expect(
      result.groups
        .flatMap(group => group.members.map(member => member.id))
        .sort()
    ).toEqual(['child', 'direct']);
  });

  it('sorts priority then human titles and remains identical under shuffled input', () => {
    const items = [
      item('hub'),
      item('n10', 'Task 10'),
      item('n2', 'Task 2'),
      item('n1', 'Task 1'),
      item('block', 'Zebra'),
    ];
    const edges = [
      edge('10', 'hub', 'n10'),
      edge('2', 'hub', 'n2'),
      edge('1', 'hub', 'n1'),
      edge('b', 'hub', 'block', 'BLOCKS'),
    ];
    const a = projectItemNeighborhood(
      indexSemanticRelationships(items, edges),
      'hub',
      { capacity: 2, page: 1 }
    );
    const b = projectItemNeighborhood(
      indexSemanticRelationships([...items].reverse(), [...edges].reverse()),
      'hub',
      { capacity: 2, page: 1 }
    );
    expect(a.neighbors.map(value => value.id)).toEqual([
      'block',
      'n1',
      'n2',
      'n10',
    ]);
    expect(a).toEqual(b);
  });

  it('bounds invalid capacities/pages, and keeps small neighborhoods direct', () => {
    const { index } = hubFixture();
    for (const capacity of [-10, 0, 1, 2, 3, 4, 5, 6, 7, 1000, NaN, Infinity]) {
      const result = projectItemNeighborhood(index, 'hub', {
        capacity,
        page: Infinity,
      });
      expect(result.cards.length).toBeLessThanOrEqual(7);
      expect(result.cards.length).toBeLessThanOrEqual(result.capacity);
      if (result.capacity >= 2)
        expect(result.counts.shownNeighbors).toBeGreaterThanOrEqual(1);
      assertPartition(result);
    }
    const small = indexSemanticRelationships(
      [item('hub'), item('a'), item('b')],
      [edge('a', 'hub', 'a'), edge('b', 'hub', 'b')]
    );
    const result = projectItemNeighborhood(small, 'hub', {
      capacity: 7,
      page: 999,
    });
    expect(result.cards.map(card => card.kind)).toEqual([
      'item',
      'item',
      'item',
    ]);
    expect(result.page).toBe(0);
    expect(result.pages).toBe(1);
  });

  it('handles a removed focus and counts dangling originals without drawing endpoints', () => {
    const result = projectItemNeighborhood(
      indexSemanticRelationships([item('a')], [edge('orphan', 'gone', 'a')]),
      'gone',
      { capacity: 7, page: 0 }
    );
    expect(result.focus).toBeUndefined();
    expect(result.cards).toEqual([]);
    expect(result.connections).toEqual([]);
    expect(ids(result.partitions.pending)).toEqual(['orphan']);
    assertPartition(result);
  });

  it('does not scan global edge/item arrays or inspect unrelated adjacency', () => {
    const { index } = hubFixture();
    Object.defineProperty(index, 'edges', {
      get() {
        throw Error('Global edge scan');
      },
    });
    Object.defineProperty(index.hierarchy, 'items', {
      get() {
        throw Error('Global item scan');
      },
    });
    index.outgoing.set(
      'unrelated',
      new Proxy([], {
        get() {
          throw Error('Unrelated adjacency');
        },
      })
    );
    const projection = projectItemNeighborhood(index, 'hub', {
      capacity: 7,
      page: 0,
    });
    expect(projection.counts.incident).toBe(107);
    expect(projection.work.incidentEntriesVisited).toBe(107);
  });

  it('pages within a live semantic group without losing outside-group originals', () => {
    const { index } = hubFixture();
    const first = projectItemNeighborhood(index, 'hub', {
      capacity: 7,
      page: 0,
    });
    const group = first.groups.find(value => value.label === 'Infra')!;
    const seen = new Set<string>();
    const scoped = projectItemNeighborhood(index, 'hub', {
      capacity: 7,
      page: 0,
      groupId: group.id,
    });
    for (let page = 0; page < scoped.pages; page++) {
      const result = projectItemNeighborhood(index, 'hub', {
        capacity: 7,
        page,
        groupId: group.id,
      });
      expect(result.counts.incident).toBe(107);
      expect(result.cards.length).toBeLessThanOrEqual(7);
      for (const card of result.cards) {
        if (card.kind === 'item' && !card.isFocus) seen.add(card.id);
        if (card.kind === 'summary') expect(card.groupId).toBe(group.id);
      }
      assertPartition(result);
    }
    expect([...seen].sort()).toEqual(
      group.members.map(value => value.id).sort()
    );
  });

  it('keeps object endpoints, frozen inputs and summary/item ID collisions safe', () => {
    const items = [item('hub'), item('a', 'A'), item('b', 'B'), item('c', 'C')];
    const edges = [
      edge('a', 'hub', 'a'),
      edge('b', 'hub', 'b'),
      edge('c', 'hub', 'c'),
    ].map(value =>
      Object.freeze({
        ...value,
        source: Object.freeze({ id: value.source as string }),
        target: Object.freeze({ id: value.target as string }),
      })
    );
    const index = indexSemanticRelationships(items, edges);
    const first = projectItemNeighborhood(index, 'hub', {
      capacity: 3,
      page: 0,
    });
    const summaryId = first.cards.find(card => card.kind === 'summary')!.id;
    index.byId.set(
      summaryId,
      Object.freeze(item(summaryId, 'Unrelated collision'))
    );
    items.forEach(Object.freeze);
    const result = projectItemNeighborhood(index, 'hub', {
      capacity: 3,
      page: 0,
    });
    expect(result.cards.find(card => card.kind === 'summary')!.id).not.toBe(
      summaryId
    );
    expect(new Set(result.cards.map(card => card.id)).size).toBe(
      result.cards.length
    );
    expect(
      result.partitions.representedCandidates.every(value =>
        edges.includes(value as (typeof edges)[number])
      )
    ).toBe(true);
    assertPartition(result);
  });
});
