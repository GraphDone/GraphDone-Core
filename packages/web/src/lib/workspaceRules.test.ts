import { describe, expect, it } from 'vitest';
import { exampleLimitMessage, missingStarterGraphs, projectDeleteBlock, seenGraphCount, starterHierarchy, starterStep, type OwnGraph } from './workspaceRules';

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

describe('the 100-graph check before adding the example', () => {
  const check = (existing: number, offline = true) => exampleLimitMessage({ offline, existing, adds: 7, limit: 100 });

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
