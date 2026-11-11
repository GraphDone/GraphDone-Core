import { describe, expect, it } from 'vitest';
import {
  EXAMPLE_PENDING_TAG,
  STARTER_POSITION_BOX,
  awaitExampleIdle,
  buildStarterWorkspace,
  isExamplePending,
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
  const created: Array<{ name: string; tags: string[] }> = [];
  const sizes: number[] = [];
  let busy = 0;
  let mostAtOnce = 0;
  const write = async <R>(size: number, run: () => Promise<R>): Promise<R> => {
    sizes.push(size);
    mostAtOnce = Math.max(mostAtOnce, ++busy);
    await Promise.resolve();
    try { return await run(); } finally { busy--; }
  };
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
        created.push({ name: input.name, tags: [...input.tags] });
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
    async setCounts(graphId: string, { tags, ...value }: { nodeCount: number; edgeCount: number; tags?: string[] }) {
      log.push(`counts ${name(graphId)}`);
      counts.set(graphId, value);
      if (tags) graphs.get(graphId)!.tags = tags;
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
    async createGraphs(inputs) { await land(); return write(inputs.length, () => raw.createGraphs(inputs)); },
    async createItems(graphId, list) { await land(); return write(list.length, () => raw.createItems(graphId, list)); },
    async createEdges(list) { await land(); return write(list.length, () => raw.createEdges(list)); },
    async setCounts(graphId, value) { await land(); return write(1, () => raw.setCounts(graphId, value)); },
    async opened(graphId) {
      log.push(`opened ${name(graphId)}`);
      opened.push(graphId);
    },
    async filled(graphId) {
      log.push(`filled ${name(graphId)}`);
    },
    async ownGraphs() {
      await land();
      return [...graphs].map(([graphId, input]) => ({ id: graphId, name: input.name, type: input.type, parentGraphId: input.parentGraphId, createdAt: input.createdAt, tags: [...input.tags] }));
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
  return { api, raw, log, graphs, items, edges, counts, opened, deleted, landings, clock, created, sizes, mostAtOnce: () => mostAtOnce };
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
/** Every write a whole run sends: each graph, item and connection, each graph's counts, and in pending mode each project's tags. */
const writeTotal = (plan: ReturnType<typeof full>, pending = false) =>
  starterGraphCount(plan) + itemTotal(plan) + edgeTotal(plan) + plan.graphs.length + (pending ? plan.projects.length : 0);
const titlesIn = (backend: Backend, graphId: string) => [...backend.items.values()].filter(entry => entry.graphId === graphId).map(entry => entry.title);

describe('creating the starter workspace', () => {
  it('creates projects, then their graphs with parent, depth and path, then items and connections', async () => {
    const backend = fakeBackend();
    const plan = full();
    const created = await createStarterWorkspace(plan, backend.api);

    const welcome = plan.graphs.find(graph => graph.key === 'welcome')!;
    const filled = backend.log.indexOf('filled Welcome');
    expect(backend.log.slice(0, filled + 1), 'Welcome and its project come first and open at once, then Welcome is filled').toEqual([
      'graphs Getting started', 'graphs Welcome', 'opened Welcome',
      ...welcome.items.map(() => 'items Welcome'), ...welcome.edges.map(() => 'edges Welcome'), 'counts Welcome', 'filled Welcome',
    ]);
    expect(backend.log.slice(filled + 1, filled + 6)).toEqual(['graphs Home', 'graphs Plan a launch', 'graphs Fix bugs', 'graphs Ideas', 'graphs Move house']);
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

  it('stops when the backend does not create an item', async () => {
    const backend = fakeBackend();
    backend.api.createItems = async () => [];
    await expect(createStarterWorkspace(full(), backend.api)).rejects.toThrow(/example item "Welcome to GraphDone" was not created in "Welcome"/);
  });

  it('waits for the user\'s view before each write, and writes nothing while it is loading', async () => {
    const plan = full();
    const backend = fakeBackend();
    const seen: number[] = [];
    await createStarterWorkspace(plan, { ...backend.api, idle: async () => { seen.push(backend.sizes.length); } });
    expect(seen, 'one wait right before every write').toEqual(Array.from({ length: writeTotal(plan) }, (_, i) => i));

    const held = fakeBackend();
    let release!: () => void;
    const loading = new Promise<void>(resolve => { release = resolve; });
    let waits = 0;
    const run = createStarterWorkspace(plan, { ...held.api, idle: async () => { if (++waits === 5) await loading; } });
    for (let i = 0; i < 50; i++) await Promise.resolve();
    expect(held.sizes, 'nothing is written while the view loads').toHaveLength(4);
    release();
    await run;
    expect(held.sizes).toHaveLength(writeTotal(plan));
  });

  it('sends one write at a time, each with one graph, item or connection, so every write has the same small shape', async () => {
    const backend = fakeBackend();
    const plan = full();
    await createStarterWorkspace(plan, backend.api);
    expect(backend.mostAtOnce()).toBe(1);
    expect(new Set(backend.sizes)).toEqual(new Set([1]));
    expect(backend.sizes).toHaveLength(writeTotal(plan));
  });

  it('finishes an interrupted run on resume without creating anything twice', async () => {
    const plan = full();
    for (let stopAfter = 0; stopAfter <= writeTotal(plan); stopAfter++) {
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
    for (let stopAfter = 0; stopAfter <= writeTotal(plan); stopAfter++) {
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
    const resumeWroteProjects = () => backend.log.includes('graphs Getting started');
    await createStarterWorkspace(plan, reloadAfter(backend, 0, resumeWroteProjects), { journal, clock: backend.clock }).catch(() => undefined);
    const created = await createStarterWorkspace(plan, backend.api, { resume: true, inflight: [...open.values()], writeLimitMs: 30_000, clock: backend.clock });

    expect(backend.clock.now(), 'waited out the time limit first').toBeGreaterThanOrEqual(30_000);
    expect(backend.deleted, 'the late, empty project').toHaveLength(1);
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

describe('keeping the unfinished example on the backend', () => {
  const pendingTags = (backend: Backend) => [...backend.graphs.values()].filter(graph => graph.tags.includes(EXAMPLE_PENDING_TAG)).map(graph => graph.name);

  it('creates every part with the pending tag and drops it once that part is finished', async () => {
    const backend = fakeBackend();
    const plan = full();
    await createStarterWorkspace(plan, backend.api, { pending: true });
    expect(backend.created.map(graph => graph.name).sort()).toEqual([...plan.projects, ...plan.graphs].map(graph => graph.name).sort());
    for (const graph of backend.created) expect(graph.tags, graph.name).toContain(EXAMPLE_PENDING_TAG);
    expect(pendingTags(backend)).toEqual([]);
    for (const graph of [...plan.projects, ...plan.graphs]) {
      expect([...backend.graphs.values()].find(g => g.name === graph.name)!.tags).toEqual(graph.tags);
    }
    // A graph loses the tag in the write that sets its counts, after its items and connections.
    const welcome = backend.log.indexOf('counts Welcome');
    expect(backend.log.lastIndexOf('items Welcome')).toBeLessThan(welcome);
    expect(backend.log.lastIndexOf('edges Welcome')).toBeLessThan(welcome);
    expect(backend.log.indexOf('counts Getting started'), 'a project loses it once its graphs exist').toBeGreaterThan(backend.log.indexOf('graphs Move house'));
  });

  it('a fresh session finishes what a closed one left, with nothing written twice', async () => {
    const plan = full();
    for (const landsLate of [true, false]) {
      for (let stopAfter = 0; stopAfter < writeTotal(plan, true); stopAfter++) {
        const backend = fakeBackend();
        // The closed browser's last write lands 5 s later, or never.
        await createStarterWorkspace(plan, reloadAfter(backend, stopAfter, () => landsLate && backend.clock.now() >= 5_000), { pending: true, clock: backend.clock }).catch(() => undefined);
        const at = `stopping at write ${stopAfter}${landsLate ? ', last write landing late' : ''}`;
        // Each later sign-in has no journal of the closed browser: with no graphs it starts the example, and with
        // an unfinished one it waits until nothing changes, then finishes it, as GraphContext does.
        for (let signIn = 0; signIn < 3; signIn++) {
          const own = await backend.api.ownGraphs!();
          if (!own.length) await createStarterWorkspace(plan, backend.api, { pending: true, clock: backend.clock });
          else if (own.some(isExamplePending) && await awaitExampleIdle(backend.api, 30_000, backend.clock)) {
            await createStarterWorkspace(plan, backend.api, { resume: true, pending: true, clock: backend.clock });
          }
          await backend.clock.sleep(60_000);
        }
        if (landsLate) expect(backend.landings, `the held write has landed (${at})`).toHaveLength(0);
        expect(pendingTags(backend), `nothing left pending (${at})`).toEqual([]);
        expect([...backend.graphs.values()].map(graph => graph.name).sort(), `each graph once (${at})`).toEqual([...plan.projects, ...plan.graphs].map(graph => graph.name).sort());
        for (const graph of plan.graphs) {
          const graphId = [...backend.graphs].find(([, g]) => g.name === graph.name)![0];
          expect(titlesIn(backend, graphId).sort(), `${graph.name} items once each (${at})`).toEqual(graph.items.map(entry => entry.title).sort());
          expect(backend.counts.get(graphId), `${graph.name} counts (${at})`).toEqual({ nodeCount: graph.items.length, edgeCount: graph.edges.length });
        }
        expect(backend.edges, `connections once each (${at})`).toHaveLength(edgeTotal(plan));
      }
    }
  });

  it('adds nothing to a finished part, so what the user deleted from it stays deleted', async () => {
    const backend = fakeBackend();
    const plan = full();
    const created = await createStarterWorkspace(plan, backend.api, { pending: true });
    const dropItem = (itemId: string) => {
      backend.items.delete(itemId);
      for (let i = backend.edges.length - 1; i >= 0; i--) if ([backend.edges[i].sourceId, backend.edges[i].targetId].includes(itemId)) backend.edges.splice(i, 1);
    };
    dropItem([...backend.items].find(([, entry]) => entry.graphId === created.ids.welcome)![0]);
    for (const [itemId, entry] of [...backend.items]) if (entry.graphId === created.ids.ideas) dropItem(itemId);
    backend.graphs.delete(created.ids.ideas);
    // Fix bugs is still unfinished: its items and connections were never written.
    for (const [itemId, entry] of [...backend.items]) if (entry.graphId === created.ids['fix-bugs']) dropItem(itemId);
    backend.graphs.get(created.ids['fix-bugs'])!.tags = ['example', EXAMPLE_PENDING_TAG];
    const edgesBefore = backend.edges.length;

    await createStarterWorkspace(plan, backend.api, { resume: true, pending: true });

    expect(titlesIn(backend, created.ids.welcome)).toHaveLength(graphNamed('Welcome').items.length - 1);
    expect([...backend.graphs.values()].some(graph => graph.name === 'Ideas'), 'a deleted graph is not brought back').toBe(false);
    expect(titlesIn(backend, created.ids['fix-bugs']).sort()).toEqual(graphNamed('Fix bugs').items.map(entry => entry.title).sort());
    expect(backend.edges.length - edgesBefore, 'only Fix bugs gets its connections').toBe(graphNamed('Fix bugs').edges.length);
    expect(pendingTags(backend)).toEqual([]);
  });

  it('waits while another session is still writing, and steps back if it finishes', async () => {
    const backend = fakeBackend();
    const plan = full();
    await createStarterWorkspace(plan, reloadAfter(backend, 9, () => false), { pending: true, clock: backend.clock }).catch(() => undefined);
    const welcomeId = [...backend.graphs].find(([, graph]) => graph.name === 'Welcome')![0];
    // The other session adds an item every 10 s for a minute.
    let added = 0;
    const api: StarterApi = {
      ...backend.api,
      async ownGraphs() {
        while (added < 6 && backend.clock.now() >= (added + 1) * 10_000) await backend.raw.createItems(welcomeId, [{ ...graphNamed('Welcome').items[0], title: `Other ${added++}` }]);
        return backend.api.ownGraphs!();
      },
    };
    expect(await awaitExampleIdle(api, 30_000, backend.clock)).toBe(true);
    expect(backend.clock.now(), 'idle only 30 s after the last change').toBeGreaterThanOrEqual(90_000);

    const finished = fakeBackend();
    await createStarterWorkspace(plan, reloadAfter(finished, 9, () => false), { pending: true, clock: finished.clock }).catch(() => undefined);
    const other: StarterApi = {
      ...finished.api,
      async ownGraphs() {
        if (finished.clock.now() >= 10_000) for (const graph of finished.graphs.values()) graph.tags = graph.tags.filter(tag => tag !== EXAMPLE_PENDING_TAG);
        return finished.api.ownGraphs!();
      },
    };
    expect(await awaitExampleIdle(other, 30_000, finished.clock), 'the other session finished it').toBe(false);
    expect(finished.clock.now()).toBeLessThan(30_000);
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
