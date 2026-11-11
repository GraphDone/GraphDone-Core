import { describe, expect, it } from 'vitest';
import { STARTER_MARKER_TTL_MS, exampleAction, exampleLimitMessage, graphTree, missingStarterGraphs, parseStarterMarker, projectDeleteBlock, seenGraphCount, starterHierarchy, starterStep, systemLocked, type OwnGraph } from './workspaceRules';

describe('deleting a project', () => {
  const project = { id: 'p', name: 'Getting started', parentGraphId: null };
  const inside = (count: number) => Array.from({ length: count }, (_, i) => ({ id: `g${i}`, name: `Graph ${i}`, parentGraphId: 'p' }));

  it('is refused while graphs sit inside it, naming the project and how many', () => {
    expect(projectDeleteBlock(project, [project, ...inside(4)])).toBe('Getting started holds 4 graphs. Delete or move them first.');
    expect(projectDeleteBlock(project, [project, ...inside(1)])).toBe('Getting started holds 1 graph. Delete or move them first.');
  });

  it('is allowed once nothing sits inside it', () => {
    expect(projectDeleteBlock(project, [project])).toBeNull();
    expect(projectDeleteBlock(project, [project, { id: 'x', name: 'Elsewhere', parentGraphId: 'other' }])).toBeNull();
    expect(projectDeleteBlock({ id: 'g0', name: 'Graph 0', parentGraphId: 'p' }, [project, ...inside(2)])).toBeNull();
  });
});

describe('the graph list as a tree', () => {
  type Named = { id: string; name: string; parentGraphId?: string | null };
  type Node = { name: string; children: Node[] };
  const tree = (graphs: Named[]) => graphTree(graphs, (graph, children: Node[]) => ({ name: graph.name, children }));
  const g = (id: string, parentGraphId: string | null = null) => ({ id, name: id, parentGraphId });

  it('nests each graph under its project', () => {
    expect(tree([g('Getting started'), g('Welcome', 'Getting started'), g('Home'), g('Move house', 'Home')])).toEqual([
      { name: 'Getting started', children: [{ name: 'Welcome', children: [] }] },
      { name: 'Home', children: [{ name: 'Move house', children: [] }] },
    ]);
  });

  it('lists a graph whose project is gone or unknown at the top instead of dropping it', () => {
    expect(tree([g('Home'), g('Orphan', 'deleted project'), g('Child of orphan', 'Orphan')])).toEqual([
      { name: 'Home', children: [] },
      { name: 'Orphan', children: [{ name: 'Child of orphan', children: [] }] },
    ]);
    expect(tree([{ id: 'x', name: 'Own parent', parentGraphId: 'x' }])).toEqual([{ name: 'Own parent', children: [] }]);
  });

  it('keeps every graph of a parent loop, once each', () => {
    const listed = tree([g('A', 'B'), g('B', 'A'), g('C')]);
    const names = (nodes: Node[]): string[] => nodes.flatMap(node => [node.name, ...names(node.children)]);
    expect(names(listed).sort()).toEqual(['A', 'B', 'C']);
  });
});

describe('which graphs only the system may change', () => {
  it('locks system graphs and the shared Welcome', () => {
    expect(systemLocked({ id: 'overview', name: 'System Overview', createdBy: 'system' }, 'me')).toBe(true);
    expect(systemLocked({ id: 'welcome-graph-shared', name: 'Welcome', createdBy: 'me' }, 'me')).toBe(true);
    expect(systemLocked({ id: 'w', name: 'Welcome', createdBy: 'someone else' }, 'me'), "another user's Welcome").toBe(true);
    expect(systemLocked({ id: 'w', name: 'Welcome' }, 'me'), 'a Welcome whose owner is unknown').toBe(true);
  });

  it("leaves the user's own Welcome and every other graph to the user", () => {
    expect(systemLocked({ id: 'w', name: 'Welcome', createdBy: 'me' }, 'me')).toBe(false);
    expect(systemLocked({ id: 'p', name: 'Plan a launch', createdBy: 'me' }, 'me')).toBe(false);
  });
});

describe('which starter a user gets', () => {
  it('gives guests and self-hosted users the projects, and signed-in hosted accounts the single Welcome graph', () => {
    expect(starterHierarchy({ offline: false, guest: false }), 'self-hosted').toBe(true);
    expect(starterHierarchy({ offline: true, guest: true }), 'hosted guest').toBe(true);
    expect(starterHierarchy({ offline: true, guest: false }), 'signed-in hosted').toBe(false);
  });

  it('creates the starter only for a user who can see no graphs at all', () => {
    expect(starterStep({ graphsSeen: 0, pending: false })).toBe('create');
    expect(starterStep({ graphsSeen: 1, pending: false }), 'an existing user with graphs gets nothing').toBe('none');
    expect(starterStep({ graphsSeen: 40, pending: false })).toBe('none');
  });

  it('finishes an interrupted starter whatever is already there', () => {
    expect(starterStep({ graphsSeen: 3, pending: true })).toBe('finish');
    expect(starterStep({ graphsSeen: 0, pending: true })).toBe('finish');
  });

  it('counts own, shared and system graphs once each', () => {
    const own = { id: 'a', name: 'A' };
    expect(seenGraphCount({ userGraphs: [own], sharedGraphs: [own, { id: 'b', name: 'B' }], systemGraphs: [{ id: 'c', name: 'C' }] })).toBe(3);
    expect(seenGraphCount({ userGraphs: [], sharedGraphs: [], systemGraphs: [{ id: 'overview', name: 'System Overview' }] }), 'a shared or system graph counts as a graph').toBe(1);
    expect(seenGraphCount(undefined)).toBe(0);
  });
});

describe('the marker of a starter being written', () => {
  const start = 1_000_000;
  const write = { id: 'w1', sentAt: start + 2000, kind: 'graphs', graphs: [{ name: 'Getting started', type: 'PROJECT', parentGraphId: null }] };
  const marker = { hierarchy: true, startedAt: start, inflight: [write] };

  it('is read back while it is fresh', () => {
    expect(parseStarterMarker(JSON.stringify(marker), start + 5000)).toEqual(marker);
    expect(parseStarterMarker(JSON.stringify(marker), start + STARTER_MARKER_TTL_MS)).toEqual(marker);
  });

  it('expires after about ten minutes, so it cannot bring back deleted example graphs', () => {
    expect(STARTER_MARKER_TTL_MS).toBe(10 * 60_000);
    expect(parseStarterMarker(JSON.stringify(marker), start + STARTER_MARKER_TTL_MS + 1)).toBeNull();
    expect(parseStarterMarker(JSON.stringify(marker), start - 120_000), 'a marker from the future').toBeNull();
  });

  it('ignores a missing or malformed marker', () => {
    expect(parseStarterMarker(null, start)).toBeNull();
    expect(parseStarterMarker('not json', start)).toBeNull();
    expect(parseStarterMarker(JSON.stringify({ hierarchy: true, inflight: [] }), start), 'no start time').toBeNull();
    expect(parseStarterMarker(JSON.stringify({ ...marker, hierarchy: 'yes' }), start)).toBeNull();
  });

  it('keeps only well-formed unanswered writes, and reads without an expiry while it is being written', () => {
    const items = { id: 'w2', sentAt: start, kind: 'items', graphId: 'g', titles: ['Launch day'] };
    const raw = JSON.stringify({ ...marker, inflight: [write, items, { id: 'w3', kind: 'items' }, 'junk'] });
    expect(parseStarterMarker(raw, start)!.inflight).toEqual([write, items]);
    expect(parseStarterMarker(JSON.stringify(marker))).toEqual(marker);
    expect(parseStarterMarker(JSON.stringify(marker), start + STARTER_MARKER_TTL_MS + 1)).toBeNull();
  });
});

describe('the 100-graph check before adding the example', () => {
  const check = (existing: number, offline = true) => exampleLimitMessage({ offline, hierarchy: true, existing, adds: 7, limit: 100 });

  it('lets the example in while it fits', () => {
    expect(check(0)).toBeNull();
    expect(check(93)).toBeNull();
  });

  it('says how many to delete when it would go over', () => {
    expect(check(94)).toBe('This browser workspace holds up to 100 projects and graphs, and the example project adds 7. Delete 1 first.');
    expect(check(100)).toBe('This browser workspace holds up to 100 projects and graphs, and the example project adds 7. Delete 7 first.');
  });

  it('has no limit on a self-hosted server', () => {
    expect(check(500, false)).toBeNull();
  });

  it('speaks of one Welcome graph for a signed-in hosted account', () => {
    const flat = (existing: number) => exampleLimitMessage({ offline: true, hierarchy: false, existing, adds: 1, limit: 100 });
    expect(flat(99)).toBeNull();
    expect(flat(100)).toBe('This account holds up to 100 graphs. Delete 1 to add a Welcome graph.');
  });
});

describe('naming the add-example action', () => {
  it('offers the example project where projects are kept, and a Welcome graph where they are not', () => {
    const projects = exampleAction(true);
    expect([projects.label, projects.busy, projects.failed, projects.added('Welcome')]).toEqual(['Add example project', 'Adding example project…', 'The example project could not be added.', 'Added the example project. "Welcome" is open.']);
    const flat = exampleAction(false);
    expect([flat.label, flat.busy, flat.failed, flat.added('Welcome (2)')]).toEqual(['Add a Welcome graph', 'Adding a Welcome graph…', 'The Welcome graph could not be added.', 'Added a Welcome graph. "Welcome (2)" is open.']);
  });
});

describe('what is still missing from a starter workspace', () => {
  const complete = () => {
    const own: OwnGraph[] = [
      { id: 'gs', name: 'Getting started', type: 'PROJECT', parentGraphId: null, nodeCount: 0 },
      { id: 'home', name: 'Home', type: 'PROJECT', parentGraphId: null, nodeCount: 0 },
    ];
    for (const [name, count] of [['Welcome', 4], ['Plan a launch', 12], ['Fix bugs', 6], ['Ideas', 5]] as const) {
      own.push({ id: name, name, type: 'SUBGRAPH', parentGraphId: 'gs', nodeCount: count });
    }
    own.push({ id: 'move', name: 'Move house', type: 'SUBGRAPH', parentGraphId: 'home', nodeCount: 6 });
    return own;
  };

  it('is nothing once every project and graph exists with its items', () => {
    expect(missingStarterGraphs(complete())).toEqual([]);
  });

  it('names a missing project, a graph in the wrong project, and a graph without all its items', () => {
    const own = complete().filter(g => g.id !== 'home');
    expect(missingStarterGraphs(own)).toEqual(['project Home', 'Move house (6 items)']);
    const moved = complete().map(g => g.id === 'Ideas' ? { ...g, parentGraphId: 'home' } : g);
    expect(missingStarterGraphs(moved)).toEqual(['Ideas (5 items)']);
    const short = complete().map(g => g.id === 'Plan a launch' ? { ...g, nodeCount: 11 } : g);
    expect(missingStarterGraphs(short)).toEqual(['Plan a launch (12 items)']);
  });

  it('checks only a flat Welcome graph when there is no example project', () => {
    expect(missingStarterGraphs([{ id: 'w', name: 'Welcome', type: 'PROJECT', parentGraphId: null, nodeCount: 0 }])).toEqual(['Welcome items']);
    expect(missingStarterGraphs([{ id: 'w', name: 'Welcome', type: 'PROJECT', parentGraphId: null, nodeCount: 4 }])).toEqual([]);
    expect(missingStarterGraphs([{ id: 'x', name: 'My plan', type: 'PROJECT', parentGraphId: null, nodeCount: 9 }])).toEqual([]);
  });
});
