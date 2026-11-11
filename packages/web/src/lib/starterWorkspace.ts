/**
 * The example content of a new workspace (#277). `hierarchy: true` gives two
 * projects (Getting started: Welcome, Plan a launch, Fix bugs, Ideas; Home:
 * Move house); `hierarchy: false` gives today's single top-level Welcome graph.
 * Ids come from the backend at creation, never from this definition.
 */

export type StarterGraphType = 'PROJECT' | 'SUBGRAPH';

export interface StarterItem {
  key: string;
  title: string;
  description: string;
  type: string;
  status: string;
  priority: number;
  x: number;
  y: number;
  tags: string[];
}

export interface StarterEdge {
  source: string;
  target: string;
  type: string;
}

export interface StarterProject {
  key: string;
  name: string;
  description: string;
  tags: string[];
}

export interface StarterGraph {
  key: string;
  project: string | null;
  name: string;
  description: string;
  type: StarterGraphType;
  tags: string[];
  items: StarterItem[];
  edges: StarterEdge[];
}

export interface StarterWorkspace {
  projects: StarterProject[];
  graphs: StarterGraph[];
  opensFirst: string;
}

export interface StarterOptions {
  hierarchy: boolean;
  takenNames?: Iterable<string>;
}

export const STARTER_POSITION_BOX = { x: 800, y: 400 };

const item = (
  key: string,
  title: string,
  type: string,
  status: string,
  priority: number,
  x: number,
  y: number,
  description: string,
  tags: string[] = ['example']
): StarterItem => ({ key, title, description, type, status, priority, x, y, tags });

const dependsOn = (source: string, target: string): StarterEdge => ({ source, target, type: 'DEPENDS_ON' });

const WELCOME: Omit<StarterGraph, 'project' | 'type'> = {
  key: 'welcome',
  name: 'Welcome',
  description: 'A tutorial graph to help you understand GraphDone. Feel free to explore and experiment!',
  tags: ['tutorial', 'welcome', 'getting-started'],
  items: [
    item('welcome', 'Welcome to GraphDone', 'MILESTONE', 'IN_PROGRESS', 0.9, 0, -100,
      'GraphDone helps you organize work through natural dependencies instead of rigid hierarchies. Start by exploring this tutorial graph.',
      ['tutorial', 'introduction']),
    item('first-item', 'Create your first work item', 'TASK', 'COMPLETED', 0.7, -150, 50,
      'Use the + button at the top to create a new work item. Try it now!',
      ['tutorial', 'basics']),
    item('connect', 'Connect work items together', 'TASK', 'PLANNED', 0.6, 150, 50,
      'Drag from one work item to another to create connections. This shows dependencies and relationships.',
      ['tutorial', 'connections']),
    item('views', 'Explore different views', 'TASK', 'PLANNED', 0.5, 0, 200,
      'Switch between Graph, Table, Kanban, Gantt, Calendar, and Card views using the buttons at the top.',
      ['tutorial', 'views']),
  ],
  edges: [dependsOn('welcome', 'first-item'), dependsOn('first-item', 'connect'), dependsOn('connect', 'views')],
};

const PLAN_A_LAUNCH: Omit<StarterGraph, 'project' | 'type'> = {
  key: 'plan-a-launch',
  name: 'Plan a launch',
  description: 'An example plan: a launch milestone, the features and tasks it depends on, and one blocked task.',
  tags: ['example'],
  items: [
    item('launch-day', 'Launch day', 'MILESTONE', 'PLANNED', 0.9, 0, -300,
      'The day the product opens to everyone.'),
    item('publish-terms', 'Publish terms of service', 'TASK', 'PLANNED', 0.7, -680, -120,
      'Put the reviewed terms on the website before launch.'),
    item('test-phones', 'Test sign-up on phones', 'TASK', 'PLANNED', 0.6, -340, -120,
      'Sign up on a small phone and a tablet, and fix anything that does not fit.'),
    item('pricing-page', 'Pricing page', 'FEATURE', 'PLANNED', 0.7, 0, -120,
      'One page that shows each plan and what it costs.'),
    item('announcement', 'Write the announcement', 'TASK', 'IN_PROGRESS', 0.6, 340, -120,
      'A short post that says what the product does and who it is for.'),
    item('analytics', 'Set up analytics', 'TASK', 'COMPLETED', 0.4, 680, -120,
      'Count sign-ups so you can see how the launch goes.'),
    item('legal-review', 'Legal review of the terms', 'TASK', 'BLOCKED', 0.8, -680, 60,
      'Blocked: waiting for the lawyer to reply. The terms cannot be published until this is done.'),
    item('signup-page', 'Sign-up page', 'FEATURE', 'IN_PROGRESS', 0.85, -340, 60,
      'A page where new people create an account.'),
    item('beta-users', 'Invite beta users', 'TASK', 'PLANNED', 0.5, 0, 60,
      'Ask a few friendly people to try the product before launch.'),
    item('launch-date', 'Pick a launch date', 'TASK', 'COMPLETED', 0.5, 340, 60,
      'Choose a day and tell everyone who is helping.'),
    item('draft-terms', 'Draft terms of service', 'TASK', 'COMPLETED', 0.6, -680, 240,
      'A first version of the terms, ready for review.'),
    item('welcome-email', 'Welcome email', 'FEATURE', 'PROPOSED', 0.4, -340, 240,
      'An email that new people get right after they sign up.'),
  ],
  edges: [
    dependsOn('launch-day', 'publish-terms'),
    dependsOn('publish-terms', 'legal-review'),
    dependsOn('legal-review', 'draft-terms'),
    dependsOn('launch-day', 'test-phones'),
    dependsOn('test-phones', 'signup-page'),
    dependsOn('launch-day', 'pricing-page'),
    dependsOn('launch-day', 'announcement'),
    dependsOn('announcement', 'launch-date'),
    dependsOn('launch-day', 'analytics'),
    dependsOn('beta-users', 'signup-page'),
    dependsOn('welcome-email', 'signup-page'),
  ],
};

const FIX_BUGS: Omit<StarterGraph, 'project' | 'type'> = {
  key: 'fix-bugs',
  name: 'Fix bugs',
  description: 'An example bug list with mixed priorities and statuses.',
  tags: ['example'],
  items: [
    item('signin-link', 'Sign-in link expires too soon', 'BUG', 'IN_PROGRESS', 0.9, -340, -90,
      'People who open the email a few minutes late have to ask for a new link.'),
    item('release-fixes', 'Release the bug fixes', 'TASK', 'PLANNED', 0.7, 0, -90,
      'Ship the fixes together once they are done.'),
    item('safari-export', 'Export button does nothing in Safari', 'BUG', 'COMPLETED', 0.6, 340, -90,
      'Fixed: the download now starts in Safari too.'),
    item('signin-test', 'Add a test for sign-in links', 'TASK', 'PLANNED', 0.6, -340, 90,
      'A test that fails if a sign-in link expires early again.'),
    item('accent-search', 'Search misses accented words', 'BUG', 'PLANNED', 0.5, 0, 90,
      'Searching for "cafe" does not find "café".'),
    item('dark-mode-text', 'Dark mode text is hard to read', 'BUG', 'PROPOSED', 0.3, 340, 90,
      'Grey text on the dark background has too little contrast.'),
  ],
  edges: [
    dependsOn('release-fixes', 'signin-link'),
    dependsOn('release-fixes', 'safari-export'),
    dependsOn('signin-test', 'signin-link'),
  ],
};

const IDEAS: Omit<StarterGraph, 'project' | 'type'> = {
  key: 'ideas',
  name: 'Ideas',
  description: 'Loose ideas that are not connected to anything yet.',
  tags: ['example'],
  items: [
    item('weekly-summary', 'Weekly summary email', 'IDEA', 'PROPOSED', 0.4, -340, -90,
      'A short email every Monday with what changed last week.'),
    item('calendar-sync', 'Calendar sync', 'IDEA', 'PROPOSED', 0.5, 0, -150,
      'Show due dates in the calendar app people already use.'),
    item('templates', 'Templates for common projects', 'IDEA', 'PROPOSED', 0.3, 340, -90,
      'Start a new project from a ready-made plan.'),
    item('shortcuts', 'Keyboard shortcuts sheet', 'IDEA', 'PROPOSED', 0.2, -170, 90,
      'One page that lists every keyboard shortcut.'),
    item('read-only-link', 'Share a read-only link', 'IDEA', 'PROPOSED', 0.4, 170, 90,
      'Let someone look at a graph without being able to change it.'),
  ],
  edges: [],
};

const MOVE_HOUSE: Omit<StarterGraph, 'project' | 'type'> = {
  key: 'move-house',
  name: 'Move house',
  description: 'An example plan for moving to a new home.',
  tags: ['example'],
  items: [
    item('movers', 'Book the movers', 'TASK', 'COMPLETED', 0.8, -340, -90,
      'Booked for the morning of moving day.'),
    item('moving-day', 'Moving day', 'MILESTONE', 'PLANNED', 0.9, 0, -90,
      'Everything leaves the old home and arrives at the new one.'),
    item('clean-old', 'Clean the old apartment', 'TASK', 'PLANNED', 0.5, 340, -90,
      'Clean once it is empty, then hand back the keys.'),
    item('pack-kitchen', 'Pack the kitchen', 'TASK', 'IN_PROGRESS', 0.6, -340, 90,
      'Keep out one pan, plates and cups for the last few days.'),
    item('bank-address', 'Change address with the bank', 'TASK', 'PLANNED', 0.4, 0, 90,
      'Update the address so letters go to the new home.'),
    item('internet', 'Set up internet at the new place', 'TASK', 'PLANNED', 0.5, 340, 90,
      'Book the installation for the week you move in.'),
  ],
  edges: [
    dependsOn('moving-day', 'movers'),
    dependsOn('moving-day', 'pack-kitchen'),
    dependsOn('clean-old', 'moving-day'),
  ],
};

const PROJECTS: StarterProject[] = [
  {
    key: 'getting-started',
    name: 'Getting started',
    description: 'An example project: a few graphs that show how GraphDone organizes work. Change or delete anything.',
    tags: ['example'],
  },
  {
    key: 'home',
    name: 'Home',
    description: 'An example project for life at home, so you can see two projects side by side.',
    tags: ['example'],
  },
];

const IN_PROJECTS: Array<[string, Omit<StarterGraph, 'project' | 'type'>]> = [
  ['getting-started', WELCOME],
  ['getting-started', PLAN_A_LAUNCH],
  ['getting-started', FIX_BUGS],
  ['getting-started', IDEAS],
  ['home', MOVE_HOUSE],
];

export function uniqueName(name: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  if (!used.has(name)) return name;
  for (let n = 2; ; n++) if (!used.has(`${name} (${n})`)) return `${name} (${n})`;
}

const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value));

export function buildStarterWorkspace({ hierarchy, takenNames = [] }: StarterOptions): StarterWorkspace {
  const taken = [...takenNames];
  if (!hierarchy) {
    return {
      projects: [],
      graphs: [{ ...copy(WELCOME), name: uniqueName(WELCOME.name, taken), project: null, type: 'PROJECT' }],
      opensFirst: WELCOME.key,
    };
  }
  return {
    projects: PROJECTS.map(project => ({ ...copy(project), name: uniqueName(project.name, taken) })),
    graphs: IN_PROJECTS.map(([project, graph]) => ({ ...copy(graph), project, type: 'SUBGRAPH' })),
    opensFirst: WELCOME.key,
  };
}

export const starterGraphCount = (plan: StarterWorkspace) => plan.projects.length + plan.graphs.length;

export interface StarterGraphInput {
  name: string;
  description: string;
  type: StarterGraphType;
  tags: string[];
  parentGraphId: string | null;
  depth: number;
  path: string[];
}

export interface StarterLink {
  sourceId: string;
  targetId: string;
  type: string;
}

export interface ExistingGraph {
  id: string;
  name: string;
  type: string;
  parentGraphId?: string | null;
  createdAt?: string | null;
  tags?: string[] | null;
}

/**
 * Marks a part of the example that is not finished yet, on the backend itself,
 * so any later sign-in in any browser can see what is left (#277).
 */
export const EXAMPLE_PENDING_TAG = 'example:pending';
export const isExamplePending = (graph: { tags?: string[] | null }) => !!graph.tags?.includes(EXAMPLE_PENDING_TAG);
/** A part still pending this long after it was created is given up on: no sign-in resumes it, and its tag is cleared. */
export const EXAMPLE_PENDING_MAX_AGE_MS = 10 * 60_000;
export const withoutPendingTag = (tags: string[] | null | undefined) => (tags || []).filter(tag => tag !== EXAMPLE_PENDING_TAG);

/** Pending parts a sign-in may still finish (`open`), and those too old to (`stale`). A part of unknown age is open. */
export function examplePendingParts<G extends ExistingGraph>(graphs: G[], now: number): { open: G[]; stale: G[] } {
  const pending = graphs.filter(isExamplePending);
  const stale = pending.filter(graph => now - Date.parse(graph.createdAt ?? '') > EXAMPLE_PENDING_MAX_AGE_MS);
  return { open: pending.filter(graph => !stale.includes(graph)), stale };
}

export interface StarterContent {
  items: Array<{ id: string; title: string }>;
  edges: Array<StarterLink & { id?: string }>;
}

export interface StarterApi {
  createGraphs(inputs: StarterGraphInput[]): Promise<Array<{ id: string; name: string }>>;
  createItems(graphId: string, items: StarterItem[]): Promise<string[]>;
  createEdges(edges: StarterLink[]): Promise<void>;
  /** Writes a graph's counts last; `tags`, when given, replace its tags in the same write. */
  setCounts(graphId: string, counts: { nodeCount: number; edgeCount: number; tags?: string[] }): Promise<void>;
  opened?(graphId: string): Promise<void>;
  /** Called once the graph that opened first has all its items and connections. */
  filled?(graphId: string): Promise<void>;
  ownGraphs?(): Promise<ExistingGraph[]>;
  content?(graphId: string): Promise<StarterContent>;
  deleteGraph?(graphId: string): Promise<void>;
  /** Removes items and connections by id; connections first. */
  deleteContent?(itemIds: string[], edgeIds: string[]): Promise<void>;
  /** Replaces a graph's tags. */
  setTags?(graphId: string, tags: string[]): Promise<void>;
  /**
   * Resolves once the user's own view is not waiting for the backend. The
   * example waits for it before each of its reads and writes, so it never
   * slows what the user is loading.
   */
  idle?(): Promise<void>;
}

/** A write sent to the backend whose answer has not arrived yet. */
export type StarterWrite =
  | { id: string; sentAt: number; kind: 'graphs'; graphs: Array<{ name: string; type: string; parentGraphId: string | null }> }
  | { id: string; sentAt: number; kind: 'items'; graphId: string; titles: string[] }
  | { id: string; sentAt: number; kind: 'edges'; graphId: string; links: StarterLink[] };

/** Records each write before it is sent and forgets it once answered, so a later page load knows what may still land. */
export interface StarterJournal {
  begin(write: StarterWrite): void;
  end(id: string): void;
}

export interface StarterClock {
  now(): number;
  sleep(ms: number): Promise<void>;
}

const realClock: StarterClock = {
  now: () => Date.now(),
  sleep: ms => new Promise(resolve => setTimeout(resolve, ms)),
};

export const STARTER_POLL_MS = 1000;
export const STARTER_WATCH_MS = 2000;

export interface StarterRunOptions {
  /** Find what an interrupted run already wrote and add only what is missing. */
  resume?: boolean;
  journal?: StarterJournal;
  /** Writes the interrupted run sent without seeing an answer. */
  inflight?: StarterWrite[];
  /** How long after it was sent such a write may still land; 0 for browser-local writes, which never land late. */
  writeLimitMs?: number;
  /**
   * Keep the unfinished state on the backend: each graph is created with
   * EXAMPLE_PENDING_TAG and loses it in the write that sets its counts, after
   * its items and connections; a project loses it once its graphs exist. A
   * resume then adds nothing to a part that is already finished, so items a
   * user deleted from it never come back.
   */
  pending?: boolean;
  clock?: StarterClock;
}

export interface CreatedStarter {
  ids: Record<string, string>;
  opensFirst: string;
}

const sameLink = (a: StarterLink, b: StarterLink) => a.sourceId === b.sourceId && a.targetId === b.targetId && a.type === b.type;

/** Whether everything a write asked for can be seen now. */
export function writeLanded(write: StarterWrite, own: ExistingGraph[], content?: StarterContent): boolean {
  if (write.kind === 'graphs') {
    return write.graphs.every(graph => own.some(g => g.name === graph.name && g.type === graph.type && (g.parentGraphId ?? null) === graph.parentGraphId));
  }
  if (!content) return false;
  if (write.kind === 'items') return write.titles.every(title => content.items.some(item => item.title === title));
  return write.links.every(link => content.edges.some(edge => sameLink(edge, link)));
}

/** Starter graphs that share a name, type and place: what a write that landed late leaves behind. */
export function starterDuplicateGroups(plan: StarterWorkspace, own: ExistingGraph[]): ExistingGraph[][] {
  const projectNames = new Set(plan.projects.map(project => project.name));
  const topNames = new Set(plan.graphs.filter(graph => !graph.project).map(graph => graph.name));
  const projectIds = new Set(own.filter(g => g.type === 'PROJECT' && !g.parentGraphId && projectNames.has(g.name)).map(g => g.id));
  const isStarter = (g: ExistingGraph) => !g.parentGraphId
    ? g.type === 'PROJECT' && (projectNames.has(g.name) || topNames.has(g.name))
    : projectIds.has(g.parentGraphId) && plan.graphs.some(graph => graph.project && graph.name === g.name && graph.type === g.type);
  const groups = new Map<string, ExistingGraph[]>();
  for (const g of own.filter(isStarter)) {
    const key = `${g.type}|${g.name}|${g.parentGraphId ?? ''}`;
    groups.set(key, [...(groups.get(key) || []), g]);
  }
  return [...groups.values()].filter(group => group.length > 1);
}

/**
 * Which duplicates to remove. In each group the graph with items or graphs
 * inside it, else the oldest, is kept; only empty graphs with nothing inside
 * are removed, and a graph whose item count is unknown is always kept.
 */
export function duplicateStarterGraphs(plan: StarterWorkspace, own: ExistingGraph[], itemCounts: Map<string, number>): string[] {
  const used = (g: ExistingGraph) => own.some(other => other.parentGraphId === g.id) || (itemCounts.get(g.id) ?? 1) > 0;
  return starterDuplicateGroups(plan, own).flatMap(group => [...group]
    .sort((a, b) => Number(used(b)) - Number(used(a)) || (a.createdAt ?? '').localeCompare(b.createdAt ?? '') || a.id.localeCompare(b.id))
    .slice(1)
    .filter(g => !used(g))
    .map(g => g.id));
}

async function awaitInflight(writes: StarterWrite[], api: StarterApi, limitMs: number, clock: StarterClock) {
  let open = writes;
  for (;;) {
    open = open.filter(write => clock.now() < write.sentAt + limitMs);
    if (!open.length) return;
    await api.idle?.();
    const own = api.ownGraphs ? await api.ownGraphs() : [];
    const contents = new Map<string, StarterContent>();
    for (const write of open) {
      if (write.kind !== 'graphs' && api.content && !contents.has(write.graphId)) contents.set(write.graphId, await api.content(write.graphId));
    }
    open = open.filter(write => !writeLanded(write, own, write.kind === 'graphs' ? undefined : contents.get(write.graphId)));
    if (!open.length) return;
    await clock.sleep(STARTER_POLL_MS);
  }
}

/**
 * Waits while another browser may still be writing the example. Returns false
 * once the backend shows no unfinished part (it was finished elsewhere), and
 * true once the unfinished parts and their items and connections have not
 * changed for `idleMs`: nobody is writing them, so this browser may finish them.
 */
/**
 * How long nothing may change before a browser that is not writing the
 * example decides nobody is: longer than the time a resuming browser waits for
 * its own lost writes (`writeLimitMs`), plus its first checks and reads.
 */
export const exampleIdleMs = (writeLimitMs: number) => writeLimitMs + 10_000;

export async function awaitExampleIdle(api: StarterApi, idleMs: number, clock: StarterClock = realClock): Promise<boolean> {
  if (!api.ownGraphs) return true;
  let seen = '';
  let since = clock.now();
  for (;;) {
    await api.idle?.();
    const { open } = examplePendingParts(await api.ownGraphs(), clock.now());
    if (!open.length) return false;
    const parts: string[] = [];
    for (const graph of [...open].sort((a, b) => a.id.localeCompare(b.id))) {
      const content = graph.parentGraphId && api.content ? await api.content(graph.id) : null;
      parts.push(`${graph.id}:${content?.items.length ?? '-'}:${content?.edges.length ?? '-'}`);
    }
    const now = parts.join('|');
    if (now !== seen) {
      seen = now;
      since = clock.now();
    } else if (clock.now() - since >= idleMs) {
      return true;
    }
    await clock.sleep(STARTER_WATCH_MS);
  }
}

async function removeDuplicates(plan: StarterWorkspace, api: StarterApi) {
  if (!api.ownGraphs || !api.content || !api.deleteGraph) return;
  for (let pass = 0; pass < 2; pass++) {
    await api.idle?.();
    const own = await api.ownGraphs();
    const groups = starterDuplicateGroups(plan, own);
    if (!groups.length) return;
    const counts = new Map<string, number>();
    for (const g of groups.flat()) counts.set(g.id, (await api.content(g.id)).items.length);
    const remove = duplicateStarterGraphs(plan, own, counts);
    if (!remove.length) return;
    const inProject = (id: string) => !!own.find(g => g.id === id)?.parentGraphId;
    for (const id of [...remove.filter(inProject), ...remove.filter(id => !inProject(id))]) await api.deleteGraph(id);
  }
}

/**
 * The graph that opens first is created (with its project) and opened before
 * anything else, so the user has a view at once and their first reads are not
 * queued behind the example; its items and connections follow, then the other
 * projects, their graphs, and each graph's items, connections and counts. Every
 * graph, item and connection is its own write, sent one at a time: each write
 * then has the same small shape, which the database plans once, and the
 * user's own reads never wait behind a large example write. With `resume`,
 * whatever an interrupted run already wrote is found and kept, so a reload
 * during the first sign-in never leaves the example half-built: the resume
 * first waits until each write the interrupted run sent has landed or its time
 * limit has passed, then adds only what is missing, then removes empty
 * duplicates a later landing left behind.
 */
export async function createStarterWorkspace(
  plan: StarterWorkspace,
  api: StarterApi,
  { resume = false, journal, inflight = [], writeLimitMs = 0, pending = false, clock = realClock }: StarterRunOptions = {}
): Promise<CreatedStarter> {
  let writeNumber = 0;
  const tracked = async <R>(write: StarterWrite, send: () => Promise<R>): Promise<R> => {
    await api.idle?.();
    journal?.begin(write);
    const result = await send();
    journal?.end(write.id);
    return result;
  };
  const writeId = () => `${clock.now().toString(36)}-${++writeNumber}-${Math.random().toString(36).slice(2, 8)}`;

  if (resume) await awaitInflight(inflight, api, writeLimitMs, clock);
  if (resume) await api.idle?.();
  const own = resume && api.ownGraphs ? await api.ownGraphs() : [];
  const setCounts: StarterApi['setCounts'] = async (graphId, counts) => {
    await api.idle?.();
    await api.setCounts(graphId, counts);
  };
  const tagsWithoutPending = async (graphId: string, planned: string[]) => {
    if (!api.ownGraphs) return withoutPendingTag(planned);
    await api.idle?.();
    const graph = (await api.ownGraphs()).find(g => g.id === graphId);
    return withoutPendingTag(graph ? graph.tags : planned);
  };
  const ids: Record<string, string> = {};
  const found = new Map<string, ExistingGraph>();
  // In pending mode, a part the backend shows without the tag is finished: nothing is added to it.
  const finished = (key: string) => pending && found.has(key) && !isExamplePending(found.get(key)!);
  const ensureGraph = async (key: string, input: StarterGraphInput) => {
    const existing = own.find(g => g.name === input.name && g.type === input.type && (g.parentGraphId ?? null) === input.parentGraphId);
    if (existing) {
      ids[key] = existing.id;
      found.set(key, existing);
      return;
    }
    const created = await tracked(
      { id: writeId(), sentAt: clock.now(), kind: 'graphs', graphs: [{ name: input.name, type: input.type, parentGraphId: input.parentGraphId }] },
      () => api.createGraphs([{ ...input, tags: pending ? [...input.tags, EXAMPLE_PENDING_TAG] : input.tags }])
    );
    const match = created.find(g => g.name === input.name);
    if (!match) throw new Error(`Failed to create the "${input.name}" graph`);
    ids[key] = match.id;
  };
  const ensureProject = async (key: string) => {
    if (ids[key]) return;
    const project = plan.projects.find(p => p.key === key)!;
    await ensureGraph(key, { name: project.name, description: project.description, type: 'PROJECT', tags: project.tags, parentGraphId: null, depth: 0, path: [] });
  };
  const place = async (graph: StarterGraph) => {
    if (graph.project) await ensureProject(graph.project);
    const parent = graph.project ? ids[graph.project] : null;
    if (graph.project && !parent) throw new Error(`The example graph "${graph.name}" has no project.`);
    // A graph missing from a finished project was deleted by the user: it stays deleted.
    const inPlace = own.some(g => g.name === graph.name && g.type === graph.type && (g.parentGraphId ?? null) === parent);
    if (graph.project && finished(graph.project) && !inPlace) return;
    await ensureGraph(graph.key, { name: graph.name, description: graph.description, type: graph.type, tags: graph.tags, parentGraphId: parent, depth: parent ? 1 : 0, path: parent ? [parent] : [] });
  };
  const canonical = (items: StarterContent['items'], title: string) =>
    items.filter(item => item.title === title).sort((a, b) => a.id.localeCompare(b.id))[0];
  const fill = async (graph: StarterGraph) => {
    const graphId = ids[graph.key];
    if (!graphId || finished(graph.key)) return;
    const read = async (): Promise<StarterContent> => {
      if (!resume || !api.content) return { items: [], edges: [] };
      await api.idle?.();
      return api.content(graphId);
    };
    const byKey = new Map<string, string>();
    for (const entry of graph.items) {
      const existing = canonical((await read()).items, entry.title);
      if (existing) {
        byKey.set(entry.key, existing.id);
        continue;
      }
      const [itemId] = await tracked(
        { id: writeId(), sentAt: clock.now(), kind: 'items', graphId, titles: [entry.title] },
        () => api.createItems(graphId, [entry])
      );
      if (!itemId) throw new Error(`The example item "${entry.title}" was not created in "${graph.name}".`);
      byKey.set(entry.key, itemId);
    }
    const titleOf = (key: string) => graph.items.find(entry => entry.key === key)!.title;
    const connect = async () => {
      for (const edge of graph.edges) {
        const have = await read();
        const idOf = (key: string) => canonical(have.items, titleOf(key))?.id ?? byKey.get(key)!;
        const link = { sourceId: idOf(edge.source), targetId: idOf(edge.target), type: edge.type };
        if (have.edges.some(e => sameLink(e, link))) continue;
        await tracked({ id: writeId(), sentAt: clock.now(), kind: 'edges', graphId, links: [link] }, () => api.createEdges([link]));
      }
    };
    await connect();
    if (resume && pending && api.deleteContent) {
      const have = await read();
      const titles = new Set(graph.items.map(entry => entry.title));
      const kept = new Set(graph.items.map(entry => canonical(have.items, entry.title)?.id));
      const extraItems = have.items.filter(item => titles.has(item.title) && !kept.has(item.id)).map(item => item.id);
      const seen = new Set<string>();
      const extraEdges: string[] = [];
      for (const edge of [...have.edges].sort((a, b) => (a.id ?? '').localeCompare(b.id ?? ''))) {
        const key = `${edge.sourceId}|${edge.targetId}|${edge.type}`;
        if (extraItems.includes(edge.sourceId) || extraItems.includes(edge.targetId) || seen.has(key)) {
          if (edge.id) extraEdges.push(edge.id);
        } else {
          seen.add(key);
        }
      }
      if (extraItems.length || extraEdges.length) {
        await api.idle?.();
        await api.deleteContent(extraItems, extraEdges);
        await connect();
      }
    }
    await setCounts(graphId, { nodeCount: graph.items.length, edgeCount: graph.edges.length, ...(pending && { tags: await tagsWithoutPending(graphId, graph.tags) }) });
  };
  const first = plan.graphs.find(graph => graph.key === plan.opensFirst);
  if (first) {
    await place(first);
    if (ids[first.key]) {
      await api.opened?.(ids[first.key]);
      await fill(first);
      await api.filled?.(ids[first.key]);
    }
  }
  for (const project of plan.projects) await ensureProject(project.key);
  for (const graph of plan.graphs) {
    if (graph !== first) await place(graph);
  }
  if (pending) {
    for (const project of plan.projects) {
      if (!finished(project.key)) await setCounts(ids[project.key], { nodeCount: 0, edgeCount: 0, tags: await tagsWithoutPending(ids[project.key], project.tags) });
    }
  }
  for (const graph of plan.graphs) {
    if (graph !== first) await fill(graph);
  }
  if (resume) await removeDuplicates(plan, api);
  if (resume && pending && api.ownGraphs && api.setTags) {
    const example = new Set(Object.values(ids));
    for (const graph of (await api.ownGraphs()).filter(isExamplePending)) {
      if (!example.has(graph.id)) await api.setTags(graph.id, withoutPendingTag(graph.tags));
    }
  }
  return { ids, opensFirst: plan.opensFirst };
}
