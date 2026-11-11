import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import { testAdminCredentials } from '../../lib/auth-credentials.mjs';
import { buildStarterWorkspace, EXAMPLE_PENDING_TAG } from '../../../packages/web/src/lib/starterWorkspace';
import { missingStarterGraphs } from '../../../packages/web/src/lib/workspaceRules';

type OwnGraph = { id: string; name: string; type: string; parentGraphId: string | null; nodeCount: number | null; tags: string[] | null };

async function api<T = any>(request: APIRequestContext, query: string, variables: unknown, token?: string): Promise<T> {
  const response = await request.post('/api/graphql', {
    data: { query, variables },
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
  });
  const body = await response.json();
  if (body.errors) throw new Error(body.errors.map((e: { message: string }) => e.message).join('; '));
  return body.data;
}

const LOGIN = 'mutation($input: LoginInput!) { login(input: $input) { token user { id email username name avatar role isActive isEmailVerified } } }';

/** Opens the app signed in with a session from the API: a user made by an admin has no verified email for the sign-in form. */
async function signIn(page: Page, session: { token: string; user: unknown }) {
  await page.goto('/login');
  await page.evaluate(({ token, user }) => {
    localStorage.setItem('authToken', token);
    localStorage.setItem('currentUser', JSON.stringify(user));
  }, session);
  await page.goto('/');
  await expect(page.getByTestId('workspace-content')).toBeVisible({ timeout: 30_000 });
}
const OWN = 'query($id: String!) { graphs(where: { createdBy: $id }) { id name type parentGraphId nodeCount tags } }';
const CONTENT = 'query($id: ID!) { workItems(where: { graph: { id: $id } }) { id title } edges(where: { source: { graph: { id: $id } } }) { id } }';

/**
 * A first sign-in writes the example project in the background (#277). The
 * browser can close before it is done, and the user can come back in another
 * one, with no trace of the first in its storage: the unfinished parts are
 * marked on the server, so the next sign-in finishes them, once each.
 */
test('an example left unfinished by a closed browser is finished at the next sign-in, once @newuser', async ({ browser, request }) => {
  test.setTimeout(180_000);
  const admin = testAdminCredentials();
  const adminToken = (await api(request, LOGIN, { input: { emailOrUsername: admin.username, password: admin.password } })).login.token;
  const username = `example-resume-${Date.now()}`;
  const password = 'example-resume-password';
  await api(request, 'mutation($input: CreateUserInput!) { createUser(input: $input) { id } }', {
    input: { email: `${username}@example.test`, username, name: 'Example resume', password, role: 'USER' },
  }, adminToken);
  const session = await api(request, LOGIN, { input: { emailOrUsername: username, password } });
  const token: string = session.login.token;
  const own = async () => (await api<{ graphs: OwnGraph[] }>(request, OWN, { id: session.login.user.id }, token)).graphs;

  try {
    // 1. The first browser starts the example and closes with an item write still in flight.
    const first = await browser.newContext();
    const page = await first.newPage();
    let itemWrites = 0;
    let inFlight!: () => void;
    const closing = new Promise<void>(resolve => { inFlight = resolve; });
    await page.route('**/graphql', async route => {
      if (route.request().postDataJSON()?.operationName === 'CreateStarterItems' && ++itemWrites > 6) {
        inFlight();
        return;
      }
      await route.continue();
    });
    await signIn(page, session.login);
    await Promise.race([closing, page.waitForTimeout(60_000)]);
    expect(itemWrites, 'the first browser was writing the example when it closed').toBeGreaterThan(6);
    await first.close();
    const left = await own();
    expect(left.filter(graph => graph.tags?.includes(EXAMPLE_PENDING_TAG)).length, 'unfinished parts are marked on the server').toBeGreaterThan(0);

    // 2. A fresh browser signs in and finishes it, without writing anything twice.
    const second = await browser.newContext();
    const again = await second.newPage();
    await signIn(again, session.login);
    let last: OwnGraph[] = [];
    await expect.poll(async () => {
      last = await own();
      return missingStarterGraphs(last).length === 0 && !last.some(graph => graph.tags?.includes(EXAMPLE_PENDING_TAG));
    }, { timeout: 120_000, intervals: [2000], message: 'the example is finished with nothing left pending' }).toBe(true);
    await second.close();

    const plan = buildStarterWorkspace({ hierarchy: true });
    expect(last.map(graph => graph.name).sort(), 'each example graph exactly once').toEqual([...plan.projects, ...plan.graphs].map(graph => graph.name).sort());
    for (const graph of plan.graphs) {
      const id = last.find(g => g.name === graph.name)!.id;
      const content = await api<{ workItems: { title: string }[]; edges: unknown[] }>(request, CONTENT, { id }, token);
      expect(content.workItems.map(item => item.title).sort(), `${graph.name}: each item once`).toEqual(graph.items.map(item => item.title).sort());
      expect(content.edges, `${graph.name}: each connection once`).toHaveLength(graph.edges.length);
    }
  } finally {
    const graphs = await own().catch(() => [] as OwnGraph[]);
    for (const graph of [...graphs].sort((a, b) => Number(!a.parentGraphId) - Number(!b.parentGraphId))) {
      await api(request, 'mutation($id: ID!) { deleteEdges(where: { source: { graph: { id: $id } } }) { nodesDeleted } }', { id: graph.id }, token).catch(() => undefined);
      await api(request, 'mutation($id: ID!) { deleteWorkItems(where: { graph: { id: $id } }) { nodesDeleted } }', { id: graph.id }, token).catch(() => undefined);
      await api(request, 'mutation($id: ID!) { deleteGraphs(where: { id: $id }) { nodesDeleted } }', { id: graph.id }, token).catch(() => undefined);
    }
    await api(request, 'mutation($id: String!) { deleteUser(userId: $id) { message } }', { id: session.login.user.id }, adminToken).catch(() => undefined);
  }
});
