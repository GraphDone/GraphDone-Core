import { describe, expect, it } from 'vitest';
import {
  metadataRecord,
  buildSemanticHierarchy,
  projectSemanticHierarchy,
  MAX_SEMANTIC_DEPTH,
  overviewAtScale,
  semanticDepthAtScale,
  automaticSemanticExpansion,
  overviewLabelCapacity,
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

describe('nested semantic cuts', () => {
  it('reveals explicit children while retaining direct members and exact edge accounting', () => {
    const items = [
      item('system', { lod: { groupPath: ['System'] } }),
      item('api', { lod: { groupPath: ['System', 'API'] } }),
      item('worker', { lod: { groupPath: ['System', 'Workers', 'Queue'] } }),
      item('other', { lod: { groupPath: ['Other'] } }),
    ];
    const edges = [
      edge('1', 'system', 'api'),
      edge('2', 'api', 'worker'),
      edge('3', 'worker', 'api', 'BLOCKS'),
      edge('4', 'worker', 'other'),
      edge('5', 'worker', 'unloaded'),
    ];
    const top = projectSemanticGraph(items, edges);
    const system = top.membership.get('system')!;
    const expanded = projectSemanticGraph(items, edges, new Set([system]));
    expect(expanded.groups.map(group => group.label).sort()).toEqual([
      'API',
      'Other',
      'System · direct items',
      'Workers',
    ]);
    expect(
      expanded.groups
        .flatMap(group => group.members)
        .map(member => member.id)
        .sort()
    ).toEqual(items.map(member => member.id).sort());
    expect(
      [
        ...expanded.groups.flatMap(group => group.internalEdges),
        ...expanded.bundles.flatMap(bundle => bundle.edges),
        ...expanded.pendingEdges,
      ]
        .map(link => link.id)
        .sort()
    ).toEqual(edges.map(link => link.id).sort());
    const workers = expanded.membership.get('worker')!;
    const nested = projectSemanticGraph(
      items,
      edges,
      new Set([system, workers])
    );
    expect(
      nested.groups.find(group =>
        group.members.some(member => member.id === 'worker')
      )?.label
    ).toBe('Queue');
    expect(projectSemanticGraph(items, edges).membership).toEqual(
      top.membership
    );
  });

  it('conserves every source entity through all cuts and reordered snapshots', () => {
    const items = Array.from({ length: 200 }, (_, i) => ({
      ...item(`n${i}`, {
        lod: {
          groupPath: [
            `System ${i % 4}`,
            `Service ${i % 9}`,
            `Component ${i % 7}`,
          ],
        },
        untouched: { keep: true },
      }),
      status: i % 5 === 0 ? 'BLOCKED' : i % 7 === 0 ? 'COMPLETED' : 'ACTIVE',
    }));
    const edges = Array.from({ length: 503 }, (_, i) =>
      edge(
        `e${i}`,
        `n${i % 200}`,
        i % 31 === 0 ? 'unloaded' : `n${(i * 17) % 200}`,
        i % 3 ? 'DEPENDS_ON' : 'BLOCKS'
      )
    );
    const before = JSON.stringify({ items, edges });
    const hierarchy = buildSemanticHierarchy(items, edges);
    const reordered = buildSemanticHierarchy(
      [...items].reverse(),
      [...edges].reverse()
    );
    for (const depth of [0, 1, 2, 3, 32]) {
      const expanded = new Set(
        [...hierarchy.groups.values()]
          .filter(group => group.ancestors.length < depth)
          .map(group => group.id)
      );
      expanded.add('missing group');
      const cut = projectSemanticHierarchy(hierarchy, expanded);
      const other = projectSemanticHierarchy(reordered, expanded);
      expect(cut).toEqual(other);
      const members = cut.groups.flatMap(group => group.members);
      expect(members.map(member => member.id).sort()).toEqual(
        items.map(member => member.id).sort()
      );
      expect(
        [
          ...cut.groups.flatMap(group => group.internalEdges),
          ...cut.bundles.flatMap(bundle => bundle.edges),
          ...cut.pendingEdges,
        ]
          .map(link => link.id)
          .sort()
      ).toEqual(edges.map(link => link.id).sort());
      for (const group of cut.groups) {
        expect(group.blocked).toBe(
          group.members.filter(member => member.status === 'BLOCKED').length
        );
        expect(group.completed).toBe(
          group.members.filter(member => member.status === 'COMPLETED').length
        );
        for (const member of group.members)
          expect(items.find(source => source.id === member.id)).toBe(member);
      }
    }
    expect(JSON.stringify({ items, edges })).toBe(before);
  });

  it('keeps a parent when its children cannot all fit the automatic label budget', () => {
    const hierarchy = buildSemanticHierarchy(
      [
        item('direct', { groupPath: ['System'] }),
        ...['A', 'B', 'C'].map(id => item(id, { groupPath: ['System', id] })),
      ],
      []
    );
    const top = projectSemanticHierarchy(hierarchy);
    expect(automaticSemanticExpansion(hierarchy, 3, 3).size).toBe(0);
    expect(
      projectSemanticHierarchy(
        hierarchy,
        automaticSemanticExpansion(hierarchy, 3, 3)
      ).groups
    ).toEqual(top.groups);
    const expanded = automaticSemanticExpansion(hierarchy, 3, 4);
    expect(expanded.size).toBe(1);
    expect(projectSemanticHierarchy(hierarchy, expanded).groups).toHaveLength(
      4
    );
    expect(automaticSemanticExpansion(hierarchy, 3, Number.NaN).size).toBe(0);
  });

  it('keeps cyclic parents finite and their descendants expandable', () => {
    const items = ['a', 'b', 'c', 'd'].map(id => item(id));
    const edges = [
      edge('1', 'a', 'b', 'IS_PART_OF'),
      edge('2', 'b', 'a', 'IS_PART_OF'),
      edge('3', 'c', 'b', 'IS_PART_OF'),
      edge('4', 'd', 'c', 'IS_PART_OF'),
    ];
    const hierarchy = buildSemanticHierarchy(items, edges);
    const root = hierarchy.paths.get('a')![0];
    const cut = projectSemanticHierarchy(hierarchy, new Set([root]));
    expect(cut.membership.get('a')).toBe(cut.membership.get('b'));
    expect(cut.membership.get('c')).toBe(cut.membership.get('d'));
    expect(cut.membership.get('a')).not.toBe(cut.membership.get('c'));
    expect(cut.groups.flatMap(group => group.members)).toHaveLength(4);
    expect(cut.diagnostics.some(message => message.includes('cycles'))).toBe(
      true
    );
  });

  it('bounds deep paths without recursive traversal or losing descendant items', () => {
    const items = Array.from({ length: 2000 }, (_, i) => item(`n${i}`));
    const edges = items
      .slice(1)
      .map((entry, i) => edge(`e${i}`, entry.id, items[i].id, 'IS_PART_OF'));
    const hierarchy = buildSemanticHierarchy(items, edges);
    expect(
      Math.max(...[...hierarchy.paths.values()].map(path => path.length))
    ).toBe(MAX_SEMANTIC_DEPTH);
    expect(hierarchy.groups.size).toBe(MAX_SEMANTIC_DEPTH);
    const cut = projectSemanticHierarchy(
      hierarchy,
      new Set(hierarchy.groups.keys())
    );
    expect(cut.groups.flatMap(group => group.members)).toHaveLength(2000);
    expect(cut.diagnostics.some(message => message.includes('32 levels'))).toBe(
      true
    );
    const explicit = buildSemanticHierarchy(
      [
        item('long', {
          groupPath: Array.from({ length: 100 }, (_, i) => `level${i}`),
        }),
      ],
      []
    );
    expect(explicit.paths.get('long')).toHaveLength(MAX_SEMANTIC_DEPTH);
    expect(projectSemanticHierarchy(explicit).groups[0].members).toHaveLength(
      1
    );
  });

  it('keeps literal path segments distinct and falls back after invalid segments', () => {
    const items = [
      item('a', { groupPath: ['System/a', 'b'] }),
      item('b', { groupPath: ['System', 'a/b'] }),
      item('c', { groupPath: ['System', null, 'ignored'] }),
      item('d', { groupPath: [null], lane: 'Fallback' }),
    ];
    const hierarchy = buildSemanticHierarchy(items, []);
    expect(hierarchy.paths.get('a')![0]).not.toBe(hierarchy.paths.get('b')![0]);
    expect(hierarchy.paths.get('c')).toHaveLength(1);
    expect(
      projectSemanticHierarchy(hierarchy).groups.find(group =>
        group.members.some(member => member.id === 'd')
      )?.label
    ).toBe('Fallback');
    expect(
      hierarchy.diagnostics.some(message =>
        message.includes('Invalid group path')
      )
    ).toBe(true);
  });

  it('expands native containment without treating dependency links as hierarchy', () => {
    const items = ['system', 'service', 'component', 'other'].map(id =>
      item(id)
    );
    const edges = [
      edge('1', 'system', 'service', 'CONTAINS'),
      edge('2', 'component', 'service', 'IS_PART_OF'),
      edge('3', 'other', 'component'),
    ];
    const top = projectSemanticGraph(items, edges);
    const cut = projectSemanticGraph(
      items,
      edges,
      new Set([top.membership.get('system')!])
    );
    expect(cut.membership.get('component')).toBe(cut.membership.get('service'));
    expect(cut.membership.get('system')).not.toBe(
      cut.membership.get('service')
    );
    expect(cut.membership.get('other')).not.toBe(cut.membership.get('service'));
    expect(cut.groups.flatMap(group => group.members)).toHaveLength(4);
  });
});

describe('readable overview', () => {
  it('uses stable nested detail bands and preserves the previous band on invalid scale', () => {
    let depth = 1;
    expect(
      [0.1, 0.45, 0.44, 0.9, 0.89, 0.73, 0.71, 0.37, 0.35].map(
        scale => (depth = semanticDepthAtScale(depth, scale))
      )
    ).toEqual([1, 2, 2, 3, 3, 3, 2, 2, 1]);
    expect(semanticDepthAtScale(3, Number.NaN)).toBe(3);
    expect(semanticDepthAtScale(3, 0)).toBe(3);
    expect(semanticDepthAtScale(1, Number.MAX_VALUE)).toBe(MAX_SEMANTIC_DEPTH);
  });
  it('uses the same usable label slots for automatic expansion and placement', () => {
    const anchors = Array.from({ length: 100 }, (_, i) => ({
      id: `a${i}`,
      x: 500,
      y: 400,
    }));
    const obstacles = [{ left: 0, top: 0, right: 700, bottom: 180 }];
    const placed = placeOverviewLabels(anchors, 1200, 800, obstacles);
    expect(overviewLabelCapacity(1200, 800, obstacles)).toBe(
      placed.placed.length
    );
    expect(overviewLabelCapacity(1200, 800, obstacles)).toBeLessThan(
      overviewLabelCapacity(1200, 800)
    );
  });

  it('retains parent coverage across the zoom dead zone and resists boundary jitter', () => {
    let visible = false;
    const states = [0.1, 0.99, 1.01, 0.99, 1.14, 1.16, 1.14, 1.01, 0.99].map(
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
