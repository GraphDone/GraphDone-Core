import { describe, expect, it } from 'vitest';
import {
  STARTER_POSITION_BOX,
  buildStarterWorkspace,
  createStarterWorkspace,
  starterGraphCount,
  uniqueName,
  duplicateStarterGraphs,
  type ExistingGraph,
  type StarterApi,
  type StarterClock,
  type StarterGraphInput,
  type StarterItem,
  type StarterJournal,
  type StarterLink,
  type StarterWrite,
} from './starterWorkspace';

const full = () => buildStarterWorkspace({ hierarchy: true });
const graphNamed = (name: string) => full().graphs.find(graph => graph.name === name)!;

// The Welcome graph GraphContext created inline before #277, item for item.
const TODAY_WELCOME = {
  name: 'Welcome',
  description: 'A tutorial graph to help you understand GraphDone. Feel free to explore and experiment!',
  tags: ['tutorial', 'welcome', 'getting-started'],
  items: [
    { title: 'Welcome to GraphDone', description: 'GraphDone helps you organize work through natural dependencies instead of rigid hierarchies. Start by exploring this tutorial graph.', type: 'MILESTONE', status: 'IN_PROGRESS', priority: 0.9, x: 0, y: -100, tags: ['tutorial', 'introduction'] },
    { title: 'Create your first work item', description: 'Use the + button at the top to create a new work item. Try it now!', type: 'TASK', status: 'COMPLETED', priority: 0.7, x: -150, y: 50, tags: ['tutorial', 'basics'] },
    { title: 'Connect work items together', description: 'Drag from one work item to another to create connections. This shows dependencies and relationships.', type: 'TASK', status: 'PLANNED', priority: 0.6, x: 150, y: 50, tags: ['tutorial', 'connections'] },
    { title: 'Explore different views', description: 'Switch between Graph, Table, Kanban, Gantt, Calendar, and Card views using the buttons at the top.', type: 'TASK', status: 'PLANNED', priority: 0.5, x: 0, y: 200, tags: ['tutorial', 'views'] },
  ],
  edges: [[0, 1], [1, 2], [2, 3]],
};

function welcomeAsToday(hierarchy: boolean) {
  const welcome = buildStarterWorkspace({ hierarchy }).graphs.find(graph => graph.key === 'welcome')!;
  const index = new Map(welcome.items.map((entry, i) => [entry.key, i]));
  return {
    name: welcome.name,
    description: welcome.description,
    tags: welcome.tags,
    items: welcome.items.map(({ key: _key, ...rest }) => rest),
    edges: welcome.edges.map(edge => {
      expect(edge.type).toBe('DEPENDS_ON');
      return [index.get(edge.source), index.get(edge.target)];
    }),
  };
}

describe('starter workspace definition', () => {
  it('has 2 projects and 5 graphs, each graph inside a project', () => {
    const plan = full();
    expect(plan.projects.map(project => project.name)).toEqual(['Getting started', 'Home']);
    expect(plan.graphs.map(graph => graph.name)).toEqual(['Welcome', 'Plan a launch', 'Fix bugs', 'Ideas', 'Move house']);
    const projects = new Map(plan.projects.map(project => [project.key, project.name]));
    for (const graph of plan.graphs) {
      expect(projects.has(graph.project!), `${graph.name} belongs to a project`).toBe(true);
      expect(graph.type).toBe('SUBGRAPH');
    }
    expect(plan.graphs.filter(graph => projects.get(graph.project!) === 'Getting started').map(graph => graph.name))
      .toEqual(['Welcome', 'Plan a launch', 'Fix bugs', 'Ideas']);
    expect(plan.graphs.filter(graph => projects.get(graph.project!) === 'Home').map(graph => graph.name)).toEqual(['Move house']);
    expect(plan.opensFirst).toBe('welcome');
    expect(starterGraphCount(plan)).toBe(7);
    expect(new Set([...plan.projects, ...plan.graphs].map(entry => entry.key)).size).toBe(7);
  });

  it('connects only two different items of the same graph, at most once', () => {
    for (const graph of full().graphs) {
      const keys = new Set(graph.items.map(entry => entry.key));
      expect(keys.size, `${graph.name} item keys are unique`).toBe(graph.items.length);
      expect(new Set(graph.items.map(entry => entry.title)).size, `${graph.name} titles are unique`).toBe(graph.items.length);
      for (const edge of graph.edges) {
        expect(keys.has(edge.source) && keys.has(edge.target), `${graph.name}: ${edge.source} -> ${edge.target}`).toBe(true);
        expect(edge.source).not.toBe(edge.target);
      }
      const pairs = graph.edges.map(edge => [edge.source, edge.target].sort().join('|'));
      expect(new Set(pairs).size, `${graph.name} has no duplicate connection`).toBe(pairs.length);
    }
  });

  it('places every item at a unique, non-overlapping position inside a fixed box', () => {
    for (const graph of full().graphs) {
      const spots = graph.items.map(entry => `${entry.x},${entry.y}`);
      expect(new Set(spots).size, `${graph.name} positions are unique`).toBe(spots.length);
      for (const entry of graph.items) {
        expect(Math.abs(entry.x)).toBeLessThanOrEqual(STARTER_POSITION_BOX.x);
        expect(Math.abs(entry.y)).toBeLessThanOrEqual(STARTER_POSITION_BOX.y);
      }
      for (const a of graph.items) for (const b of graph.items) {
        if (a === b) continue;
        expect(Math.abs(a.x - b.x) >= 300 || Math.abs(a.y - b.y) >= 150, `${graph.name}: "${a.title}" and "${b.title}" overlap`).toBe(true);
      }
    }
  });

  it('keeps the Welcome graph exactly as new users got it before, in both shapes', () => {
    expect(welcomeAsToday(true)).toEqual(TODAY_WELCOME);
    expect(welcomeAsToday(false)).toEqual(TODAY_WELCOME);
  });

  it('gives each example graph the shape it is meant to show', () => {
    const launch = graphNamed('Plan a launch');
    expect(launch.items).toHaveLength(12);
    expect(launch.items.filter(entry => entry.type === 'MILESTONE')).toHaveLength(1);
    expect(launch.items.filter(entry => entry.status === 'BLOCKED')).toHaveLength(1);
    expect(new Set(launch.items.map(entry => entry.type))).toEqual(new Set(['MILESTONE', 'FEATURE', 'TASK']));
    const next = new Map<string, string[]>();
    for (const edge of launch.edges.filter(edge => edge.type === 'DEPENDS_ON')) next.set(edge.source, [...(next.get(edge.source) || []), edge.target]);
    const longest = (key: string): number => 1 + Math.max(0, ...(next.get(key) || []).map(longest));
    expect(longest('launch-day'), 'a dependency chain of at least four items').toBeGreaterThanOrEqual(4);
    const blocked = launch.items.find(entry => entry.status === 'BLOCKED')!;
    expect(launch.edges.some(edge => edge.target === blocked.key), 'the blocked item holds up other work').toBe(true);

    const bugs = graphNamed('Fix bugs');
    expect(bugs.items).toHaveLength(6);
    expect(new Set(bugs.items.map(entry => entry.type))).toEqual(new Set(['BUG', 'TASK']));
    expect(new Set(bugs.items.map(entry => entry.priority)).size).toBeGreaterThanOrEqual(4);
    expect(new Set(bugs.items.map(entry => entry.status)).size).toBeGreaterThanOrEqual(3);
    expect(bugs.edges.length).toBeGreaterThan(0);

    const ideas = graphNamed('Ideas');
    expect(ideas.items).toHaveLength(5);
    expect(ideas.items.every(entry => entry.type === 'IDEA')).toBe(true);
    expect(ideas.edges).toEqual([]);

    const move = graphNamed('Move house');
    expect(move.items).toHaveLength(6);
    expect(move.edges.length).toBeGreaterThan(0);

    for (const graph of full().graphs) for (const entry of graph.items) {
      expect(entry.priority).toBeGreaterThanOrEqual(0);
      expect(entry.priority).toBeLessThanOrEqual(1);
      expect(entry.title.length).toBeLessThanOrEqual(200);
    }
  });

  it('falls back to the single top-level Welcome graph without a hierarchy', () => {
    const plan = buildStarterWorkspace({ hierarchy: false });
    expect(plan.projects).toEqual([]);
    expect(plan.graphs).toHaveLength(1);
    expect(plan.graphs[0]).toMatchObject({ name: 'Welcome', project: null, type: 'PROJECT' });
    expect(plan.opensFirst).toBe('welcome');
  });

  it('is deterministic, and every build is an independent copy', () => {
    const a = full();
    const b = full();
    expect(b).toEqual(a);
    a.graphs[0].items[0].title = 'Changed';
    a.projects[0].tags.push('changed');
    expect(full()).toEqual(b);
  });

  it('renames a top-level name that is already taken', () => {
    expect(uniqueName('Home', [])).toBe('Home');
    expect(uniqueName('Home', ['Home', 'Home (2)'])).toBe('Home (3)');
    const again = buildStarterWorkspace({ hierarchy: true, takenNames: ['Getting started', 'Welcome', 'Fix bugs'] });
    expect(again.projects.map(project => project.name)).toEqual(['Getting started (2)', 'Home']);
    expect(again.graphs.map(graph => graph.name)).toEqual(['Welcome', 'Plan a launch', 'Fix bugs', 'Ideas', 'Move house']);
    expect(buildStarterWorkspace({ hierarchy: false, takenNames: ['Welcome'] }).graphs[0].name).toBe('Welcome (2)');
  });
});

function fakeBackend() {
  let next = 0;
  let time = 0;
  const id = (prefix: string) => `${prefix}-${++next}-${Math.random().toString(36).slice(2, 8)}`;
  const log: string[] = [];
  const graphs = new Map<string, StarterGraphInput & { createdAt: string }>();
  const items = new Map<string, { graphId: string; title: string }>();
  const edges: StarterLink[] = [];
  const counts = new Map<string, { nodeCount: number; edgeCount: number }>();
  const opened: string[] = [];
  const deleted: string[] = [];
  const landings: Array<{ due: () => boolean; apply: () => Promise<unknown> }> = [];
  const clock: StarterClock = { now: () => time, sleep: async ms => { time += ms; } };
  const name = (graphId: string) => graphs.get(graphId)!.name;
  const raw = {
    async createGraphs(inputs: StarterGraphInput[]) {
      log.push(`graphs ${inputs.map(input => input.name).join(', ')}`);
      return [...inputs].reverse().map(input => {
        const graphId = id('graph');
        graphs.set(graphId, { ...input, createdAt: String(next).padStart(6, '0') });
        return { id: graphId, name: input.name };
      });
    },
    async createItems(graphId: string, list: StarterItem[]) {
      log.push(`items ${name(graphId)}`);
      return list.map(entry => { const itemId = id('item'); items.set(itemId, { graphId, title: entry.title }); return itemId; });
    },
    async createEdges(list: StarterLink[]) {
      log.push(`edges ${name(items.get(list[0].sourceId)!.graphId)}`);
      edges.push(...list);
    },
    async setCounts(graphId: string, value: { nodeCount: number; edgeCount: number }) {
      log.push(`counts ${name(graphId)}`);
      counts.set(graphId, value);
    },
  };
  // A write held back by the network lands at the backend's next call once it is due.
  const land = async () => {
    for (const landing of [...landings]) {
      if (!landing.due()) continue;
      landings.splice(landings.indexOf(landing), 1);
      await landing.apply();
    }
  };
  const api: StarterApi = {
    async createGraphs(inputs) { await land(); return raw.createGraphs(inputs); },
    async createItems(graphId, list) { await land(); return raw.createItems(graphId, list); },
    async createEdges(list) { await land(); return raw.createEdges(list); },
    async setCounts(graphId, value) { await land(); return raw.setCounts(graphId, value); },
    async opened(graphId) {
      log.push(`opened ${name(graphId)}`);
      opened.push(graphId);
    },
    async ownGraphs() {
      await land();
      return [...graphs].map(([graphId, input]) => ({ id: graphId, name: input.name, type: input.type, parentGraphId: input.parentGraphId, createdAt: input.createdAt }));
    },
    async content(graphId) {
      await land();
      return {
        items: [...items].filter(([, entry]) => entry.graphId === graphId).map(([itemId, entry]) => ({ id: itemId, title: entry.title })),
        edges: edges.filter(edge => items.get(edge.sourceId)!.graphId === graphId),
      };
    },
    async deleteGraph(graphId) {
      await land();
      if ([...graphs.values()].some(graph => graph.parentGraphId === graphId)) throw new Error('graphs still inside');
      deleted.push(graphId);
      graphs.delete(graphId);
    },
  };
  return { api, raw, log, graphs, items, edges, counts, opened, deleted, landings, clock };
}

function journalOf() {
  const open = new Map<string, StarterWrite>();
  const journal: StarterJournal = { begin: write => { open.set(write.id, write); }, end: writeId => { open.delete(writeId); } };
  return { open, journal };
}

type Backend = ReturnType<typeof fakeBackend>;
type Writer = keyof Backend['raw'];

/** Lets `stopAfter` calls through, then loses the page: the next call is held by the network and lands when `due`, and later calls never leave. */
function reloadAfter(backend: Backend, stopAfter: number, due: () => boolean): StarterApi {
  let calls = 0;
  const wrap = <K extends Writer>(key: K) => (async (...args: unknown[]) => {
    if (++calls <= stopAfter) return (backend.api[key] as (...a: unknown[]) => Promise<unknown>)(...args);
    if (calls === stopAfter + 1) backend.landings.push({ due, apply: () => (backend.raw[key] as (...a: unknown[]) => Promise<unknown>)(...args) });
    throw new Error('page reloaded');
  }) as unknown as StarterApi[K];
  return { ...backend.api, createGraphs: wrap('createGraphs'), createItems: wrap('createItems'), createEdges: wrap('createEdges'), setCounts: wrap('setCounts') };
}

const itemTotal = (plan: ReturnType<typeof full>) => plan.graphs.reduce((sum, graph) => sum + graph.items.length, 0);
const edgeTotal = (plan: ReturnType<typeof full>) => plan.graphs.reduce((sum, graph) => sum + graph.edges.length, 0);

describe('creating the starter workspace', () => {
  it('creates projects, then their graphs with parent, depth and path, then items and connections', async () => {
    const backend = fakeBackend();
    const plan = full();
    const created = await createStarterWorkspace(plan, backend.api);

    expect(backend.log.slice(0, 6)).toEqual([
      'graphs Getting started, Home',
      'graphs Welcome, Plan a launch, Fix bugs, Ideas, Move house',
      'items Welcome', 'edges Welcome', 'counts Welcome', 'opened Welcome',
    ]);
    expect(backend.opened).toEqual([created.ids.welcome]);

    for (const project of plan.projects) {
      expect(backend.graphs.get(created.ids[project.key])).toMatchObject({ name: project.name, type: 'PROJECT', parentGraphId: null, depth: 0, path: [] });
    }
    for (const graph of plan.graphs) {
      const parent = created.ids[graph.project!];
      expect(backend.graphs.get(created.ids[graph.key])).toMatchObject({ name: graph.name, type: 'SUBGRAPH', parentGraphId: parent, depth: 1, path: [parent] });
      expect(backend.counts.get(created.ids[graph.key])).toEqual({ nodeCount: graph.items.length, edgeCount: graph.edges.length });
    }
    for (const edge of backend.edges) expect(backend.items.get(edge.sourceId)!.graphId).toBe(backend.items.get(edge.targetId)!.graphId);
    expect(backend.edges).toHaveLength(edgeTotal(plan));
    expect(backend.items.size).toBe(itemTotal(plan));
    expect(backend.log).not.toContain('edges Ideas');
  });

  it('uses fresh backend ids every time while keeping the same structure', async () => {
    const first = await createStarterWorkspace(full(), fakeBackend().api);
    const second = await createStarterWorkspace(full(), fakeBackend().api);
    expect(Object.keys(second.ids).sort()).toEqual(Object.keys(first.ids).sort());
    expect(Object.values(second.ids)).not.toEqual(Object.values(first.ids));
  });

  it('creates the flat Welcome graph at the top level', async () => {
    const backend = fakeBackend();
    const created = await createStarterWorkspace(buildStarterWorkspace({ hierarchy: false }), backend.api);
    expect([...backend.graphs.values()]).toEqual([expect.objectContaining({ name: 'Welcome', type: 'PROJECT', parentGraphId: null, depth: 0, path: [] })]);
    expect(backend.opened).toEqual([created.ids.welcome]);
  });

  it('stops when the backend creates fewer items than asked', async () => {
    const backend = fakeBackend();
    backend.api.createItems = async () => ['only-one'];
    await expect(createStarterWorkspace(full(), backend.api)).rejects.toThrow(/Only 1 of 4 example items/);
  });

  it('finishes an interrupted run on resume without creating anything twice', async () => {
    const plan = full();
    for (let stopAfter = 0; stopAfter <= 16; stopAfter++) {
      const backend = fakeBackend();
      const real = { ...backend.api };
      let calls = 0;
      const interrupt = <A extends unknown[], R>(fn: (...args: A) => Promise<R>) => async (...args: A) => {
        if (++calls <= stopAfter) return fn(...args);
        // The first lost call reaches the backend; only its answer is lost.
        if (calls === stopAfter + 1) await fn(...args);
        throw new Error('page reloaded');
      };
      const flaky: StarterApi = { ...real, createGraphs: interrupt(real.createGraphs), createItems: interrupt(real.createItems), createEdges: interrupt(real.createEdges), setCounts: interrupt(real.setCounts) };
      await createStarterWorkspace(plan, flaky).catch(() => undefined);
      const created = await createStarterWorkspace(plan, real, { resume: true });

      expect(backend.graphs.size, `graphs after stopping at call ${stopAfter}`).toBe(7);
      expect(backend.items.size, `items after stopping at call ${stopAfter}`).toBe(itemTotal(plan));
      expect(backend.edges, `connections after stopping at call ${stopAfter}`).toHaveLength(edgeTotal(plan));
      for (const graph of plan.graphs) {
        expect(backend.counts.get(created.ids[graph.key])).toEqual({ nodeCount: graph.items.length, edgeCount: graph.edges.length });
        expect(backend.graphs.get(created.ids[graph.key])!.parentGraphId).toBe(created.ids[graph.project!]);
      }
    }
  });

  it('waits for a write that lands after the resume first looks, so nothing is written twice', async () => {
    const plan = full();
    for (let stopAfter = 0; stopAfter <= 16; stopAfter++) {
      const backend = fakeBackend();
      const { open, journal } = journalOf();
      const landsAt = 20_000;
      await createStarterWorkspace(plan, reloadAfter(backend, stopAfter, () => backend.clock.now() >= landsAt), { journal, clock: backend.clock }).catch(() => undefined);
      const unanswered = open.size;
      const resumed = journalOf();
      const created = await createStarterWorkspace(plan, backend.api, { resume: true, journal: resumed.journal, inflight: [...open.values()], writeLimitMs: 30_000, clock: backend.clock });

      const at = `stopping at call ${stopAfter}`;
      if (unanswered) expect(backend.clock.now(), `the resume waited for the held write (${at})`).toBeGreaterThanOrEqual(landsAt);
      await backend.clock.sleep(60_000);
      await backend.api.ownGraphs!();
      expect(backend.landings, `every held write has landed (${at})`).toHaveLength(0);
      expect(backend.graphs.size, `graphs after ${at}`).toBe(7);
      expect(backend.items.size, `items after ${at}`).toBe(itemTotal(plan));
      expect(backend.edges, `connections after ${at}`).toHaveLength(edgeTotal(plan));
      expect(backend.deleted, `nothing to clean up after ${at}`).toEqual([]);
      for (const graph of plan.graphs) expect(backend.graphs.get(created.ids[graph.key])!.parentGraphId).toBe(created.ids[graph.project!]);
      expect(resumed.open.size, `every write of the resume was answered (${at})`).toBe(0);
    }
  });

  it('removes the empty projects a write left behind when it landed after its time limit', async () => {
    const plan = full();
    const backend = fakeBackend();
    const { open, journal } = journalOf();
    const resumeWroteProjects = () => backend.log.includes('graphs Getting started, Home');
    await createStarterWorkspace(plan, reloadAfter(backend, 0, resumeWroteProjects), { journal, clock: backend.clock }).catch(() => undefined);
    const created = await createStarterWorkspace(plan, backend.api, { resume: true, inflight: [...open.values()], writeLimitMs: 30_000, clock: backend.clock });

    expect(backend.clock.now(), 'waited out the time limit first').toBeGreaterThanOrEqual(30_000);
    expect(backend.deleted, 'the two late, empty projects').toHaveLength(2);
    expect(backend.graphs.size).toBe(7);
    for (const project of plan.projects) expect(backend.graphs.has(created.ids[project.key])).toBe(true);
    for (const graph of plan.graphs) expect(backend.graphs.get(created.ids[graph.key])!.parentGraphId).toBe(created.ids[graph.project!]);
    expect(backend.items.size).toBe(itemTotal(plan));
  });

  it('does not wait for browser-local writes, which never land late', async () => {
    const plan = full();
    const backend = fakeBackend();
    const { open, journal } = journalOf();
    await createStarterWorkspace(plan, reloadAfter(backend, 3, () => false), { journal, clock: backend.clock }).catch(() => undefined);
    expect(open.size).toBeGreaterThan(0);
    await createStarterWorkspace(plan, backend.api, { resume: true, inflight: [...open.values()], writeLimitMs: 0, clock: backend.clock });
    expect(backend.clock.now()).toBe(0);
    expect(backend.graphs.size).toBe(7);
    expect(backend.items.size).toBe(itemTotal(plan));
  });
});

describe('choosing which duplicate starter graphs to remove', () => {
  const plan = full();
  const graph = (id: string, name: string, type: string, parentGraphId: string | null, createdAt: string): ExistingGraph => ({ id, name, type, parentGraphId, createdAt });

  it('keeps the project with graphs inside it and removes the empty one', () => {
    const own = [graph('late', 'Getting started', 'PROJECT', null, '1'), graph('used', 'Getting started', 'PROJECT', null, '2'), graph('w', 'Welcome', 'SUBGRAPH', 'used', '3')];
    expect(duplicateStarterGraphs(plan, own, new Map([['late', 0], ['used', 0]]))).toEqual(['late']);
  });

  it('keeps the graph with items, else the older one', () => {
    const own = [graph('p', 'Getting started', 'PROJECT', null, '1'), graph('a', 'Ideas', 'SUBGRAPH', 'p', '2'), graph('b', 'Ideas', 'SUBGRAPH', 'p', '3')];
    expect(duplicateStarterGraphs(plan, own, new Map([['a', 0], ['b', 5]]))).toEqual(['a']);
    expect(duplicateStarterGraphs(plan, own, new Map([['a', 0], ['b', 0]]))).toEqual(['b']);
  });

  it('never removes a graph with items, one whose count is unknown, or a graph that is not a starter graph', () => {
    const own = [graph('p', 'Getting started', 'PROJECT', null, '1'), graph('a', 'Ideas', 'SUBGRAPH', 'p', '2'), graph('b', 'Ideas', 'SUBGRAPH', 'p', '3')];
    expect(duplicateStarterGraphs(plan, own, new Map([['a', 5], ['b', 2]]))).toEqual([]);
    expect(duplicateStarterGraphs(plan, own, new Map())).toEqual([]);
    expect(duplicateStarterGraphs(plan, own, new Map([['a', 0]])), 'b, whose count is unknown, stays').toEqual(['a']);
    const mine = [graph('n1', 'Notes', 'PROJECT', null, '1'), graph('n2', 'Notes', 'PROJECT', null, '2')];
    expect(duplicateStarterGraphs(plan, mine, new Map([['n1', 0], ['n2', 0]]))).toEqual([]);
  });
});
