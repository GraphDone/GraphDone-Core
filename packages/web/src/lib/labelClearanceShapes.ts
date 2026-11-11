/**
 * Graphs whose relationship labels must all stay readable after the automatic
 * layouts. The unit tests (`labelClearance.test.ts`) and the browser journey
 * (`tests/e2e/journeys/organize-labels.spec.ts`) use the same shapes, so both
 * measure the same thing.
 *
 * The example graphs copy what a new workspace gets: the Welcome tutorial and
 * the example project's graphs (#277). The other shapes are the hard cases: a
 * hub with many spokes, two connected hubs, a long chain, a dense cluster and
 * relationship types with long labels. Items without `x`/`y` are unplaced, as
 * items made by an agent or an import are.
 */

export interface ShapeItem {
  key: string;
  title: string;
  type: string;
  status: string;
  description?: string;
  x?: number;
  y?: number;
}

export interface ShapeEdge {
  source: string;
  target: string;
  type: string;
}

export interface LabelShape {
  name: string;
  items: ShapeItem[];
  edges: ShapeEdge[];
}

const item = (
  key: string,
  title: string,
  type: string,
  status: string,
  x?: number,
  y?: number,
  description?: string
): ShapeItem => ({ key, title, type, status, x, y, description });

const dependsOn = (source: string, target: string): ShapeEdge => ({
  source,
  target,
  type: 'DEPENDS_ON',
});

export const WELCOME_SHAPE: LabelShape = {
  name: 'Welcome',
  items: [
    item('welcome', 'Welcome to GraphDone', 'MILESTONE', 'IN_PROGRESS', 0, -100,
      'GraphDone helps you organize work through natural dependencies instead of rigid hierarchies. Start by exploring this tutorial graph.'),
    item('first-item', 'Create your first work item', 'TASK', 'COMPLETED', -150, 50,
      'Use the + button at the top to create a new work item. Try it now!'),
    item('connect', 'Connect work items together', 'TASK', 'PLANNED', 150, 50,
      'Drag from one work item to another to create connections. This shows dependencies and relationships.'),
    item('views', 'Explore different views', 'TASK', 'PLANNED', 0, 200,
      'Switch between Graph, Table, Kanban, Gantt, Calendar, and Card views using the buttons at the top.'),
  ],
  edges: [dependsOn('welcome', 'first-item'), dependsOn('first-item', 'connect'), dependsOn('connect', 'views')],
};

export const PLAN_A_LAUNCH_SHAPE: LabelShape = {
  name: 'Plan a launch',
  items: [
    item('launch-day', 'Launch day', 'MILESTONE', 'PLANNED', 0, -300, 'The day the product opens to everyone.'),
    item('publish-terms', 'Publish terms of service', 'TASK', 'PLANNED', -680, -120, 'Put the reviewed terms on the website before launch.'),
    item('test-phones', 'Test sign-up on phones', 'TASK', 'PLANNED', -340, -120, 'Sign up on a small phone and a tablet, and fix anything that does not fit.'),
    item('pricing-page', 'Pricing page', 'FEATURE', 'PLANNED', 0, -120, 'One page that shows each plan and what it costs.'),
    item('announcement', 'Write the announcement', 'TASK', 'IN_PROGRESS', 340, -120, 'A short post that says what the product does and who it is for.'),
    item('analytics', 'Set up analytics', 'TASK', 'COMPLETED', 680, -120, 'Count sign-ups so you can see how the launch goes.'),
    item('legal-review', 'Legal review of the terms', 'TASK', 'BLOCKED', -680, 60, 'Blocked: waiting for the lawyer to reply. The terms cannot be published until this is done.'),
    item('signup-page', 'Sign-up page', 'FEATURE', 'IN_PROGRESS', -340, 60, 'A page where new people create an account.'),
    item('beta-users', 'Invite beta users', 'TASK', 'PLANNED', 0, 60, 'Ask a few friendly people to try the product before launch.'),
    item('launch-date', 'Pick a launch date', 'TASK', 'COMPLETED', 340, 60, 'Choose a day and tell everyone who is helping.'),
    item('draft-terms', 'Draft terms of service', 'TASK', 'COMPLETED', -680, 240, 'A first version of the terms, ready for review.'),
    item('welcome-email', 'Welcome email', 'FEATURE', 'PROPOSED', -340, 240, 'An email that new people get right after they sign up.'),
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

export const FIX_BUGS_SHAPE: LabelShape = {
  name: 'Fix bugs',
  items: [
    item('signin-link', 'Sign-in link expires too soon', 'BUG', 'IN_PROGRESS', -340, -90, 'People who open the email a few minutes late have to ask for a new link.'),
    item('release-fixes', 'Release the bug fixes', 'TASK', 'PLANNED', 0, -90, 'Ship the fixes together once they are done.'),
    item('safari-export', 'Export button does nothing in Safari', 'BUG', 'COMPLETED', 340, -90, 'Fixed: the download now starts in Safari too.'),
    item('signin-test', 'Add a test for sign-in links', 'TASK', 'PLANNED', -340, 90, 'A test that fails if a sign-in link expires early again.'),
    item('accent-search', 'Search misses accented words', 'BUG', 'PLANNED', 0, 90, 'Searching for "cafe" does not find "café".'),
    item('dark-mode-text', 'Dark mode text is hard to read', 'BUG', 'PROPOSED', 340, 90, 'Grey text on the dark background has too little contrast.'),
  ],
  edges: [
    dependsOn('release-fixes', 'signin-link'),
    dependsOn('release-fixes', 'safari-export'),
    dependsOn('signin-test', 'signin-link'),
  ],
};

export const MOVE_HOUSE_SHAPE: LabelShape = {
  name: 'Move house',
  items: [
    item('movers', 'Book the movers', 'TASK', 'COMPLETED', -340, -90, 'Booked for the morning of moving day.'),
    item('moving-day', 'Moving day', 'MILESTONE', 'PLANNED', 0, -90, 'Everything leaves the old home and arrives at the new one.'),
    item('clean-old', 'Clean the old apartment', 'TASK', 'PLANNED', 340, -90, 'Clean once it is empty, then hand back the keys.'),
    item('pack-kitchen', 'Pack the kitchen', 'TASK', 'IN_PROGRESS', -340, 90, 'Keep out one pan, plates and cups for the last few days.'),
    item('bank-address', 'Change address with the bank', 'TASK', 'PLANNED', 0, 90, 'Update the address so letters go to the new home.'),
    item('internet', 'Set up internet at the new place', 'TASK', 'PLANNED', 340, 90, 'Book the installation for the week you move in.'),
  ],
  edges: [
    dependsOn('moving-day', 'movers'),
    dependsOn('moving-day', 'pack-kitchen'),
    dependsOn('clean-old', 'moving-day'),
  ],
};

const SPOKES = [
  'Sign-in screen', 'Push notifications', 'Offline mode', 'App store listing',
  'Crash reporting', 'Dark theme', 'Payments', 'Accessibility review',
  'Tablet layout', 'Onboarding tour', 'Privacy policy', 'Beta testers',
];
const MIXED = ['DEPENDS_ON', 'BLOCKS', 'ENABLES', 'VALIDATES'];

export const HUB_SHAPE: LabelShape = {
  name: 'Hub with 12 spokes',
  items: [
    item('hub', 'Ship the mobile app', 'MILESTONE', 'IN_PROGRESS'),
    ...SPOKES.map((title, i) => item(`spoke-${i}`, title, i % 3 ? 'TASK' : 'FEATURE', 'PLANNED')),
  ],
  edges: SPOKES.map((_, i) => ({ source: 'hub', target: `spoke-${i}`, type: MIXED[i % MIXED.length] })),
};

export const TWO_HUBS_SHAPE: LabelShape = {
  name: 'Two connected hubs',
  items: [
    item('server', 'Server release', 'MILESTONE', 'PLANNED'),
    item('client', 'Client release', 'MILESTONE', 'PLANNED'),
    ...Array.from({ length: 7 }, (_, i) => item(`server-${i}`, `Server task ${i + 1}`, 'TASK', 'PLANNED')),
    ...Array.from({ length: 7 }, (_, i) => item(`client-${i}`, `Client task ${i + 1}`, 'TASK', 'PLANNED')),
  ],
  edges: [
    { source: 'client', target: 'server', type: 'DEPENDS_ON' },
    ...Array.from({ length: 7 }, (_, i) => ({ source: 'server', target: `server-${i}`, type: MIXED[i % MIXED.length] })),
    ...Array.from({ length: 7 }, (_, i) => ({ source: 'client', target: `client-${i}`, type: MIXED[(i + 1) % MIXED.length] })),
  ],
};

const STEPS = [
  'Write the brief', 'Collect quotes', 'Choose a supplier', 'Sign the contract',
  'Order materials', 'Prepare the site', 'Build the frame', 'Fit the windows',
  'Wire the electrics', 'Paint the walls', 'Final inspection', 'Hand over the keys',
];

export const CHAIN_SHAPE: LabelShape = {
  name: 'Long chain',
  items: STEPS.map((title, i) => item(`step-${i}`, title, 'TASK', i < 4 ? 'COMPLETED' : 'PLANNED')),
  edges: STEPS.slice(1).map((_, i) => ({ source: `step-${i + 1}`, target: `step-${i}`, type: 'FOLLOWS' })),
};

const DENSE_TYPES = ['DEPENDS_ON', 'RELATES_TO', 'BLOCKS', 'ENABLES', 'REFERENCES'];
const denseEdges: ShapeEdge[] = [];
for (let i = 0; i + 1 < 30; i++) denseEdges.push({ source: `n-${i}`, target: `n-${i + 1}`, type: DENSE_TYPES[i % 5] });
for (let i = 0; i + 3 < 30; i += 2) denseEdges.push({ source: `n-${i}`, target: `n-${i + 3}`, type: DENSE_TYPES[(i + 2) % 5] });
for (let i = 0; i + 11 < 30; i += 5) denseEdges.push({ source: `n-${i}`, target: `n-${i + 11}`, type: DENSE_TYPES[(i + 4) % 5] });

export const DENSE_SHAPE: LabelShape = {
  name: 'Dense cluster of 30',
  items: Array.from({ length: 30 }, (_, i) => item(`n-${i}`, `Service ${String(i + 1).padStart(2, '0')}`, ['TASK', 'FEATURE', 'BUG'][i % 3], 'PLANNED')),
  edges: denseEdges,
};

export const LONG_LABELS_SHAPE: LabelShape = {
  name: 'Long relationship labels',
  items: [
    item('spec', 'Payment provider requirements', 'REQUIREMENT', 'PLANNED'),
    item('card', 'Card checkout', 'FEATURE', 'IN_PROGRESS'),
    item('wallet', 'Wallet checkout', 'FEATURE', 'PLANNED'),
    item('old', 'Old checkout page', 'FEATURE', 'COMPLETED'),
    item('copy', 'Copy of the checkout page', 'FEATURE', 'PROPOSED'),
    item('tests', 'Checkout test plan', 'TASK', 'PLANNED'),
    item('audit', 'Security audit', 'TASK', 'PLANNED'),
    item('epic', 'Payments epic', 'EPIC', 'IN_PROGRESS'),
    item('docs', 'Payment API documentation', 'RESEARCH', 'PLANNED'),
  ],
  edges: [
    { source: 'card', target: 'wallet', type: 'PARALLEL_WITH' },
    { source: 'card', target: 'old', type: 'CONFLICTS_WITH' },
    { source: 'copy', target: 'old', type: 'DUPLICATES' },
    { source: 'card', target: 'spec', type: 'SATISFIES' },
    { source: 'tests', target: 'card', type: 'VALIDATES' },
    { source: 'audit', target: 'card', type: 'VALIDATES' },
    { source: 'card', target: 'epic', type: 'IS_PART_OF' },
    { source: 'wallet', target: 'epic', type: 'IS_PART_OF' },
    { source: 'docs', target: 'spec', type: 'REFERENCES' },
    { source: 'wallet', target: 'spec', type: 'DEPENDS_ON' },
    { source: 'wallet', target: 'spec', type: 'RELATES_TO' },
  ],
};

/** Twelve items and fifteen relationships of mixed types around one hub: the
 * graph a person imported when labels went missing after Organize. */
export const LAUNCH_CHECKLIST_SHAPE: LabelShape = {
  name: 'Launch checklist',
  items: [
    item('launch-plan', 'Launch plan', 'MILESTONE', 'PROPOSED', -570, -260),
    item('design-mockups', 'Design mockups', 'TASK', 'PLANNED', -190, -260),
    item('write-copy', 'Write copy', 'TASK', 'IN_PROGRESS', 190, -260),
    item('build-landing-page', 'Build landing page', 'TASK', 'COMPLETED', 570, -260),
    item('set-up-analytics', 'Set up analytics', 'TASK', 'PROPOSED', -570, 0),
    item('legal-review', 'Legal review', 'TASK', 'PLANNED', -190, 0),
    item('pricing-decision', 'Pricing decision', 'TASK', 'IN_PROGRESS', 190, 0),
    item('email-campaign', 'Email campaign', 'TASK', 'COMPLETED', 570, 0),
    item('qa-pass', 'QA pass', 'TASK', 'PROPOSED', -570, 260),
    item('press-kit', 'Press kit', 'TASK', 'PLANNED', -190, 260),
    item('beta-feedback', 'Beta feedback', 'TASK', 'IN_PROGRESS', 190, 260),
    item('retrospective', 'Retrospective', 'TASK', 'COMPLETED', 570, 260),
  ],
  edges: [
    { source: 'launch-plan', target: 'design-mockups', type: 'DEPENDS_ON' },
    { source: 'launch-plan', target: 'write-copy', type: 'DEPENDS_ON' },
    { source: 'launch-plan', target: 'build-landing-page', type: 'BLOCKS' },
    { source: 'launch-plan', target: 'set-up-analytics', type: 'ENABLES' },
    { source: 'launch-plan', target: 'legal-review', type: 'RELATES_TO' },
    { source: 'launch-plan', target: 'pricing-decision', type: 'IS_PART_OF' },
    { source: 'launch-plan', target: 'email-campaign', type: 'FOLLOWS' },
    { source: 'design-mockups', target: 'build-landing-page', type: 'DEPENDS_ON' },
    { source: 'write-copy', target: 'build-landing-page', type: 'DEPENDS_ON' },
    { source: 'build-landing-page', target: 'qa-pass', type: 'BLOCKS' },
    { source: 'set-up-analytics', target: 'qa-pass', type: 'VALIDATES' },
    { source: 'pricing-decision', target: 'email-campaign', type: 'ENABLES' },
    { source: 'email-campaign', target: 'press-kit', type: 'REFERENCES' },
    { source: 'qa-pass', target: 'beta-feedback', type: 'FOLLOWS' },
    { source: 'beta-feedback', target: 'retrospective', type: 'CONTAINS' },
  ],
};

/** The graphs a new user gets, in the order the example project lists them. */
export const EXAMPLE_SHAPES: readonly LabelShape[] = [
  WELCOME_SHAPE,
  PLAN_A_LAUNCH_SHAPE,
  FIX_BUGS_SHAPE,
  MOVE_HOUSE_SHAPE,
];

export const HARD_SHAPES: readonly LabelShape[] = [
  HUB_SHAPE,
  TWO_HUBS_SHAPE,
  CHAIN_SHAPE,
  DENSE_SHAPE,
  LONG_LABELS_SHAPE,
];

export const LABEL_SHAPES: readonly LabelShape[] = [...EXAMPLE_SHAPES, LAUNCH_CHECKLIST_SHAPE, ...HARD_SHAPES];
