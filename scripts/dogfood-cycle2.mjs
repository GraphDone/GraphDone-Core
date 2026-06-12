#!/usr/bin/env node
/**
 * Dogfooding: plan GraphDone Cycle 2 inside GraphDone itself, through the
 * same public GraphQL API the web UI and AI agents use. Idempotent-ish:
 * skips creation if the graph already exists.
 *
 * Usage: node scripts/dogfood-cycle2.mjs [http://localhost:4127]
 */

const API = (process.argv[2] || 'http://localhost:4127') + '/graphql';
const GRAPH_NAME = 'GraphDone — Cycle 2: The Living Graph';

async function gql(query, variables, token) {
  const res = await fetch(API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify({ query, variables })
  });
  const body = await res.json();
  if (body.errors) throw new Error(JSON.stringify(body.errors, null, 2));
  return body.data;
}

const login = await gql(
  `mutation { login(input: {emailOrUsername: "admin", password: "graphdone"}) { token user { id username } } }`
);
const token = login.login.token;
const userId = login.login.user.id;
console.log(`logged in as ${login.login.user.username}`);

const existing = await gql(
  `query($where: GraphWhere) { graphs(where: $where) { id name } }`,
  { where: { name: GRAPH_NAME } },
  token
);
if (existing.graphs.length > 0) {
  console.log(`graph already exists: ${existing.graphs[0].id}`);
  process.exit(0);
}

const graphRes = await gql(
  `mutation CreateGraph($input: GraphCreateInput!) {
    createGraphs(input: [$input]) { graphs { id name } }
  }`,
  {
    input: {
      name: GRAPH_NAME,
      description:
        'The real Cycle 2 plan, managed in GraphDone itself. Stories live in docs/USER_STORIES.md; this graph is the living view of the work.',
      type: 'PROJECT',
      status: 'ACTIVE',
      createdBy: userId,
      isShared: true
    }
  },
  token
);
const graphId = graphRes.createGraphs.graphs[0].id;
console.log(`created graph ${graphId}`);

// Layout: rough hand-placed positions so the demo opens beautifully.
// status drives the living effects: IN_PROGRESS breathes, BLOCKED aches,
// COMPLETED radiates energy along its edges. priority drives glow.
const ITEMS = [
  { key: 'cycle2', type: 'MILESTONE', title: 'Cycle 2 complete', status: 'PLANNED', priority: 0.95, x: 0, y: 0,
    description: 'Definition: section A empty, two joy stories shipped test-first, CI green 3x, next plan written.' },

  { key: 'e2e-epic', type: 'EPIC', title: 'E2E burn-down', status: 'IN_PROGRESS', priority: 0.9, x: -420, y: -160,
    description: '17 PR-critical Playwright tests failing against the prod stack. The repaired CI gate finally shows them.' },
  { key: 'e2e-root', type: 'TASK', title: 'Find common root cause of 2s failures', status: 'IN_PROGRESS', priority: 0.9, x: -640, y: -300,
    description: 'Every failure dies in ~2s — almost certainly one shared cause in auth/navigation against https://localhost:3128.' },
  { key: 'e2e-auth', type: 'BUG', title: 'Auth flow fails in prod-stack E2E', status: 'PROPOSED', priority: 0.8, x: -700, y: -80,
    description: 'Login helper times out; suspected cert/redirect handling under HTTPS.' },

  { key: 'alive-epic', type: 'EPIC', title: 'Living Graph polish', status: 'IN_PROGRESS', priority: 0.8, x: 380, y: -220,
    description: 'The joy epic: celebration, illumination, flow. See USER_STORIES Epic 1.' },
  { key: 'live3', type: 'FEATURE', title: 'LIVE-3: celebration burst on completion', status: 'PLANNED', priority: 0.7, x: 620, y: -360,
    description: '≤1.2s particle ripple, tier-gated, reduced-motion safe.' },
  { key: 'live7', type: 'FEATURE', title: 'LIVE-7: hover neighborhood illumination', status: 'PLANNED', priority: 0.6, x: 660, y: -140,
    description: '1-hop highlight in <16ms via precomputed adjacency.' },
  { key: 'live6', type: 'TASK', title: 'LIVE-6: simulation settle tuning', status: 'PROPOSED', priority: 0.4, x: 700, y: 40,
    description: 'Alpha decay to rest <3s after drag on 200-node graph.' },

  { key: 'adapt-epic', type: 'EPIC', title: 'Adaptive performance', status: 'IN_PROGRESS', priority: 0.85, x: -80, y: 320,
    description: 'Quality tiers shipped; streaming and CI budgets next.' },
  { key: 'adapt-engine', type: 'FEATURE', title: 'Adaptive quality engine (ADAPT-1/2/3/5/6/9)', status: 'COMPLETED', priority: 0.85, x: -340, y: 420,
    description: 'LOW→ULTRA tiers, FPS governor, Save-Data caps, Settings override. 30 unit tests.' },
  { key: 'living-shipped', type: 'FEATURE', title: 'Living graph effects (LIVE-1/2/4/5/8)', status: 'COMPLETED', priority: 0.8, x: 160, y: 480,
    description: 'Breathing, ache, glow, energy flow, entrance. Shipped in PR #35.' },
  { key: 'ci-fixed', type: 'TASK', title: 'CI resurrection (compose v2, build window, health port)', status: 'COMPLETED', priority: 0.75, x: -560, y: 200,
    description: 'PR Critical Tests gate runs honestly for the first time in months.' },
  { key: 'adapt4', type: 'FEATURE', title: 'ADAPT-4: progressive graph streaming', status: 'BLOCKED', priority: 0.75, x: 120, y: 660,
    description: 'Bounded initial query + background frontier fetch. Blocked on design doc.' },
  { key: 'adapt4-design', type: 'RESEARCH', title: 'Streaming design doc (relevance ranking)', status: 'PLANNED', priority: 0.7, x: -160, y: 620,
    description: 'My-items + priority-center first; periphery progressive. Decide server pagination shape.' },
  { key: 'adapt8', type: 'TASK', title: 'ADAPT-8: perf budgets in CI', status: 'PLANNED', priority: 0.65, x: -420, y: 560,
    description: 'Bundle ≤450kB gzip, 500-node render <1.5s, dropped frames <20%.' },

  { key: 'resp-epic', type: 'EPIC', title: 'Responsive everywhere', status: 'PLANNED', priority: 0.6, x: 520, y: 300,
    description: 'Viewport matrix is green; now the phone-native interactions.' },
  { key: 'resp1', type: 'FEATURE', title: 'RESP-1: bottom-sheet editor on phones', status: 'PROPOSED', priority: 0.55, x: 760, y: 420,
    description: 'One-handed editing below 640px.' },
  { key: 'resp2', type: 'FEATURE', title: 'RESP-2: pinch/long-press touch gestures', status: 'PROPOSED', priority: 0.55, x: 620, y: 560,
    description: 'Playwright touch emulation as the regression net.' },

  { key: 'tog1', type: 'IDEA', title: 'TOG-1: live presence cursors', status: 'PROPOSED', priority: 0.35, x: 40, y: -480,
    description: 'The graph as an inhabited, shared space.' }
];

const input = ITEMS.map((it) => ({
  type: it.type,
  title: it.title,
  description: it.description,
  status: it.status,
  priority: it.priority,
  positionX: it.x,
  positionY: it.y,
  positionZ: 0,
  owner: { connect: { where: { node: { id: userId } } } },
  graph: { connect: { where: { node: { id: graphId } } } }
}));

const created = await gql(
  `mutation CreateWorkItems($input: [WorkItemCreateInput!]!) {
    createWorkItems(input: $input) { workItems { id title } }
  }`,
  { input },
  token
);
// createWorkItems does NOT preserve input order — map ids back by title.
const keyByTitle = Object.fromEntries(ITEMS.map((it) => [it.title, it.key]));
const idByKey = {};
created.createWorkItems.workItems.forEach((w) => (idByKey[keyByTitle[w.title]] = w.id));
console.log(`created ${created.createWorkItems.workItems.length} work items`);

const EDGES = [
  // Energy should visibly flow out of the completed work.
  ['adapt-epic', 'adapt-engine', 'DEPENDS_ON'],
  ['adapt4', 'adapt-engine', 'DEPENDS_ON'],
  ['alive-epic', 'living-shipped', 'DEPENDS_ON'],
  ['e2e-epic', 'ci-fixed', 'DEPENDS_ON'],
  ['adapt8', 'ci-fixed', 'DEPENDS_ON'],
  // The dependency web of the plan itself.
  ['cycle2', 'e2e-epic', 'DEPENDS_ON'],
  ['cycle2', 'alive-epic', 'DEPENDS_ON'],
  ['cycle2', 'adapt-epic', 'DEPENDS_ON'],
  ['e2e-root', 'e2e-epic', 'IS_PART_OF'],
  ['e2e-auth', 'e2e-epic', 'IS_PART_OF'],
  ['e2e-auth', 'e2e-root', 'BLOCKS'],
  ['live3', 'alive-epic', 'IS_PART_OF'],
  ['live7', 'alive-epic', 'IS_PART_OF'],
  ['live6', 'alive-epic', 'IS_PART_OF'],
  ['adapt4', 'adapt4-design', 'DEPENDS_ON'],
  ['adapt4-design', 'adapt-epic', 'IS_PART_OF'],
  ['adapt8', 'adapt-epic', 'IS_PART_OF'],
  ['resp1', 'resp-epic', 'IS_PART_OF'],
  ['resp2', 'resp-epic', 'IS_PART_OF'],
  ['resp-epic', 'cycle2', 'RELATES_TO'],
  ['tog1', 'alive-epic', 'RELATES_TO']
];

const edgeInput = EDGES.map(([from, to, type]) => ({
  type,
  weight: 0.8,
  source: { connect: { where: { node: { id: idByKey[from] } } } },
  target: { connect: { where: { node: { id: idByKey[to] } } } }
}));

const edges = await gql(
  `mutation CreateEdges($input: [EdgeCreateInput!]!) {
    createEdges(input: $input) { edges { id } }
  }`,
  { input: edgeInput },
  token
);
console.log(`created ${edges.createEdges.edges.length} edges`);
console.log(`\nDemo graph ready: "${GRAPH_NAME}" (${graphId})`);
