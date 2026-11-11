/**
 * The example content of a new workspace (#277). `hierarchy: true` gives two
 * projects (Getting started: Welcome, Plan a launch, Fix bugs, Ideas; Personal:
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
  description: 'An example personal plan for moving to a new home.',
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
    key: 'personal',
    name: 'Personal',
    description: 'An example personal project, so you can see two projects side by side.',
    tags: ['example'],
  },
];

const IN_PROJECTS: Array<[string, Omit<StarterGraph, 'project' | 'type'>]> = [
  ['getting-started', WELCOME],
  ['getting-started', PLAN_A_LAUNCH],
  ['getting-started', FIX_BUGS],
  ['getting-started', IDEAS],
  ['personal', MOVE_HOUSE],
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
}

export interface StarterApi {
  createGraphs(inputs: StarterGraphInput[]): Promise<Array<{ id: string; name: string }>>;
  createItems(graphId: string, items: StarterItem[]): Promise<string[]>;
  createEdges(edges: StarterLink[]): Promise<void>;
  setCounts(graphId: string, counts: { nodeCount: number; edgeCount: number }): Promise<void>;
  opened?(graphId: string): Promise<void>;
  ownGraphs?(): Promise<ExistingGraph[]>;
  content?(graphId: string): Promise<{ items: Array<{ id: string; title: string }>; edges: StarterLink[] }>;
}

export interface CreatedStarter {
  ids: Record<string, string>;
  opensFirst: string;
}

/**
 * Projects first, then their graphs, then each graph's items, connections and
 * counts; the graph that opens first is complete before the rest. With
 * `resume`, whatever an interrupted run already wrote is found and kept, so a
 * reload during the first sign-in never leaves the example half-built.
 */
export async function createStarterWorkspace(
  plan: StarterWorkspace,
  api: StarterApi,
  { resume = false }: { resume?: boolean } = {}
): Promise<CreatedStarter> {
  const own = resume && api.ownGraphs ? await api.ownGraphs() : [];
  const ids: Record<string, string> = {};
  const ensureGraphs = async (entries: Array<{ key: string; input: StarterGraphInput }>) => {
    const missing = entries.filter(({ key, input }) => {
      const found = own.find(g => g.name === input.name && g.type === input.type && (g.parentGraphId ?? null) === input.parentGraphId);
      if (found) ids[key] = found.id;
      return !found;
    });
    if (!missing.length) return;
    const created = await api.createGraphs(missing.map(entry => entry.input));
    for (const { key, input } of missing) {
      const match = created.find(g => g.name === input.name);
      if (!match) throw new Error(`Failed to create the "${input.name}" graph`);
      ids[key] = match.id;
    }
  };
  await ensureGraphs(plan.projects.map(project => ({
    key: project.key,
    input: { name: project.name, description: project.description, type: 'PROJECT', tags: project.tags, parentGraphId: null, depth: 0, path: [] },
  })));
  await ensureGraphs(plan.graphs.map(graph => {
    const parent = graph.project ? ids[graph.project] : null;
    if (graph.project && !parent) throw new Error(`The example graph "${graph.name}" has no project.`);
    return {
      key: graph.key,
      input: { name: graph.name, description: graph.description, type: graph.type, tags: graph.tags, parentGraphId: parent, depth: parent ? 1 : 0, path: parent ? [parent] : [] },
    };
  }));
  const fill = async (graph: StarterGraph) => {
    const graphId = ids[graph.key];
    const have = resume && api.content ? await api.content(graphId) : { items: [], edges: [] };
    const byKey = new Map<string, string>();
    const missing = graph.items.filter(entry => {
      const found = have.items.find(existing => existing.title === entry.title);
      if (found) byKey.set(entry.key, found.id);
      return !found;
    });
    if (missing.length) {
      const created = await api.createItems(graphId, missing);
      if (created.length !== missing.length) {
        throw new Error(`Only ${created.length} of ${missing.length} example items were created in "${graph.name}".`);
      }
      missing.forEach((entry, index) => byKey.set(entry.key, created[index]));
    }
    const links = graph.edges
      .map(edge => ({ sourceId: byKey.get(edge.source)!, targetId: byKey.get(edge.target)!, type: edge.type }))
      .filter(link => !have.edges.some(e => e.sourceId === link.sourceId && e.targetId === link.targetId && e.type === link.type));
    if (links.length) await api.createEdges(links);
    await api.setCounts(graphId, { nodeCount: graph.items.length, edgeCount: graph.edges.length });
  };
  const first = plan.graphs.find(graph => graph.key === plan.opensFirst);
  if (first) {
    await fill(first);
    await api.opened?.(ids[first.key]);
  }
  await Promise.all(plan.graphs.filter(graph => graph !== first).map(fill));
  return { ids, opensFirst: plan.opensFirst };
}
