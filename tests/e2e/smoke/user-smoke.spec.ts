import { test, expect } from '@playwright/test';
import { login, TEST_USERS } from '../../lib/auth';

/**
 * THE GATE. This spec sees the app exactly as a user does — if it fails,
 * the app is broken no matter what unit tests say. Nothing gets called
 * "working" until `npm run test:smoke` is green against the running stack.
 *
 * Born from a real incident (2026-06-11): orphaned Edge records made the
 * edges query 500, the UI showed "Error" with zero edges, and unit tests
 * were green the whole time.
 */
test.describe('user smoke: the app works from a user point of view @smoke', () => {
  test('login → graph renders nodes AND edges → no errors anywhere', async ({ page }) => {
    const pageErrors: string[] = [];
    const gqlErrors: string[] = [];
    const serverErrors: string[] = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));
    page.on('response', async (res) => {
      // Any 5xx from our own origin is a server fault the user shouldn't hit —
      // e.g. /mcp/status used to 503 on every page when MCP was offline (a
      // NORMAL state), logging a console error site-wide.
      const url = res.url();
      if (res.status() >= 500 && (url.includes('localhost:4127') || url.includes('localhost:3127') || url.includes('/api/'))) {
        serverErrors.push(`${res.status()} ${url.replace(/^https?:\/\/[^/]+/, '')}`);
      }
      if (!url.includes('graphql')) return;
      try {
        const body = await res.json();
        if (body?.errors?.length) {
          gqlErrors.push(`${body.errors[0]?.message} (op: ${res.request().postDataJSON()?.operationName ?? '?'})`);
        }
      } catch { /* non-JSON responses are fine */ }
    });

    await login(page, TEST_USERS.ADMIN);
    await page.waitForTimeout(6000); // graph load + simulation settle

    // 1) The canvas exists and has nodes
    const nodes = await page.locator('.graph-container svg .node').count();
    expect(nodes, 'nodes must render').toBeGreaterThan(0);

    // 2) Edges render AND match what the API says this graph has
    const domEdges = await page.locator('.graph-container svg .edge').count();
    const graphId = await page.evaluate(() => {
      const node = document.querySelector('.graph-container svg .node') as (Element & { __data__?: { graph?: { id?: string } } }) | null;
      return node?.__data__?.graph?.id ?? null;
    });
    if (graphId) {
      const apiEdges = await page.evaluate(async (id) => {
        const res = await fetch('/api/graphql', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('authToken') ?? ''}`
          },
          body: JSON.stringify({
            query: `query($where: EdgeWhere) { edges(where: $where) { id } }`,
            variables: { where: { source: { graph: { id } } } }
          })
        });
        const body = await res.json();
        if (body.errors) return { error: body.errors[0].message };
        return { count: body.data.edges.length };
      }, graphId);
      expect((apiEdges as { error?: string }).error, 'edges API must not error').toBeUndefined();
      const expected = (apiEdges as { count: number }).count;
      if (expected > 0) {
        expect(domEdges, `graph has ${expected} edges in the API — they must render`).toBeGreaterThan(0);
      }
    } else {
      // No graph auto-selected is acceptable only if the welcome flow shows
      await expect(page.locator('text=/select graph|create.*graph/i').first()).toBeVisible();
    }

    // 3) No error chrome visible to the user
    const errorBadges = await page
      .locator('.graph-container')
      .locator('text=/^Error$|connection lost|failed to load/i')
      .count();
    expect(errorBadges, 'no error badges in the graph UI').toBe(0);

    // 4) No GraphQL errors flowed to the client during the session
    expect(gqlErrors, `GraphQL errors reached the client: ${gqlErrors[0] ?? ''}`).toEqual([]);

    // 5) No uncaught JS errors
    expect(pageErrors, `uncaught page errors: ${pageErrors[0] ?? ''}`).toEqual([]);

    // 6) Visit the main routes and confirm none of them produce a 5xx from our
    //    own origin (catches optional-subsystem endpoints returning 503 for a
    //    normal "offline" state, which logs a console error site-wide).
    for (const route of ['/settings', '/backend', '/ontology', '/']) {
      await page.goto(route).catch(() => {});
      await page.waitForTimeout(2500);
    }
    expect(serverErrors, `server 5xx responses during the session: ${serverErrors[0] ?? ''}`).toEqual([]);
  });

  test('grow flow stays healthy: + → empty space → connected named node @smoke', async ({ page }) => {
    test.setTimeout(90_000); // fixture build + reload + settle + grow + undo exceed the 30s default
    await login(page, TEST_USERS.ADMIN);
    await page.waitForTimeout(1500);

    // Deterministic fixture: a fresh ADMIN-OWNED graph with ONE regular TASK
    // node. The auto-selected default graph is non-deterministic and a known
    // flake source — the seeded "Development Team" hierarchy uses sheet nodes
    // whose first +-click doesn't enter grow mode, and a Welcome graph owned by
    // a different user disables grow. Owning our own single-node graph removes
    // both. (API truth is used for the +1/-1 deltas below; viewport culling can't
    // skew them.)
    const graphId = await page.evaluate(async () => {
      const token = localStorage.getItem('authToken') ?? '';
      const post = (query: string, variables?: unknown) =>
        fetch('/api/graphql', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ query, variables }),
        }).then((r) => r.json());
      const me = await post('{ me { id } }');
      const userId = me.data.me.id;
      const g = await post(
        `mutation($input: [GraphCreateInput!]!) { createGraphs(input: $input) { graphs { id } } }`,
        { input: [{ name: `Grow Smoke ${Date.now()}`, type: 'PROJECT', status: 'ACTIVE', createdBy: userId, isShared: true }] }
      );
      const gid = g.data.createGraphs.graphs[0].id as string;
      await post(
        `mutation($input: [WorkItemCreateInput!]!) { createWorkItems(input: $input) { workItems { id } } }`,
        { input: [{ type: 'TASK', title: 'Grow Seed', status: 'IN_PROGRESS', priority: 0.5, positionX: 0, positionY: 0, positionZ: 0, owner: { connect: { where: { node: { id: userId } } } }, graph: { connect: { where: { node: { id: gid } } } } }] }
      );
      return gid;
    });
    expect(graphId, 'fixture graph created').toBeTruthy();

    await page.evaluate((gid) => localStorage.setItem('currentGraphId', gid), graphId);
    await page.reload();

    // Wait for the seed node to render, then for the force layout to SETTLE — the
    // "+" grow icon rides on its node, so clicking while the sim is still moving
    // is the historical source of flake. Poll the node's box until it stops.
    await page.locator('.graph-container svg .node').first().waitFor({ timeout: 20000 });
    {
      let last: { x: number; y: number } | null = null;
      let stable = 0;
      for (let i = 0; i < 40 && stable < 2; i++) {
        const pos = await page.evaluate(() => {
          const n = document.querySelector('.graph-container svg .node');
          if (!n) return null;
          const r = n.getBoundingClientRect();
          return { x: Math.round(r.x), y: Math.round(r.y) };
        });
        if (pos && last && Math.abs(pos.x - last.x) < 1 && Math.abs(pos.y - last.y) < 1) stable++;
        else stable = 0;
        last = pos;
        await page.waitForTimeout(300);
      }
    }

    // Count only THIS fixture graph so the +1 node / +1 edge delta is exact.
    const countAll = () => page.evaluate(async (gid) => {
      const token = localStorage.getItem('authToken') ?? '';
      const res = await fetch('/api/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ query: `query($g: ID!) { workItems(where: { graph: { id: $g } }) { id } edges(where: { source: { graph: { id: $g } } }) { id } }`, variables: { g: gid } })
      }).then((r) => r.json());
      return { nodes: res.data?.workItems?.length ?? -1, edges: res.data?.edges?.length ?? -1 };
    }, graphId);
    const before = await countAll();
    expect(before.nodes, 'fixture starts with exactly the seed node').toBe(1);

    // Enter grow mode. Retry the click→hint: a settled layout makes this reliable,
    // but a stray overlap can still swallow one click, so re-click until grow mode
    // activates instead of failing on the first miss.
    await expect(async () => {
      await page.locator('.node-relationship-icon').first().click({ force: true });
      await expect(page.locator('text=Click empty space to grow')).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 20000 });

    // Find a genuinely empty spot of canvas (viewport-relative, verified)
    const spot = await page.evaluate(() => {
      const candidates = [
        [innerWidth / 2, innerHeight - 140],
        [innerWidth - 350, innerHeight / 2],
        [200, innerHeight - 160],
        [innerWidth / 2, 160]
      ];
      for (const [x, y] of candidates) {
        const el = document.elementFromPoint(x, y);
        if (el && el.classList.contains('background')) return { x, y };
      }
      return null;
    });
    test.skip(!spot, 'no empty canvas spot found at this viewport');
    await page.mouse.click(spot!.x, spot!.y);
    const rename = page.locator('[data-testid="inline-rename"]');
    await expect(rename, 'inline rename must open after grow').toBeVisible({ timeout: 10000 });
    const name = `Smoke ${Date.now()}`;
    await page.keyboard.type(name);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(4000);

    const after = await countAll();
    expect(after.nodes, 'a node must be created').toBe(before.nodes + 1);
    expect(after.edges, 'a connecting edge must be created').toBe(before.edges + 1);
    // ...and the user actually sees the newly named node on the canvas.
    await expect(page.locator(`text=${name}`).first()).toBeVisible();

    // Undo must walk it back: Ctrl+Z undoes the rename, then the creation.
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(2500);
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(5000);
    await expect.poll(async () => (await countAll()).nodes, { timeout: 10000 }).toBe(before.nodes);
    expect((await countAll()).edges, 'undo must remove the created edge').toBe(before.edges);

    // Tear down the whole fixture graph (edges FIRST — orphan edges break the
    // edges query), keeping the suite re-runnable and the DB clean.
    await page.evaluate(async (gid) => {
      const token = localStorage.getItem('authToken') ?? '';
      const post = (query: string, variables: unknown) =>
        fetch('/api/graphql', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ query, variables }) });
      await post(`mutation($id: ID!) { deleteEdges(where: { source: { graph: { id: $id } } }) { nodesDeleted } }`, { id: gid });
      await post(`mutation($id: ID!) { deleteWorkItems(where: { graph: { id: $id } }) { nodesDeleted } }`, { id: gid });
      await post(`mutation($id: ID!) { deleteGraphs(where: { id: $id }) { nodesDeleted } }`, { id: gid });
    }, graphId);
  });

  // A brand-new EMPTY graph (the very first thing a user sees after "Create
  // Graph") must render its empty-state invitation, NOT crash or show error
  // chrome. UI counterpart to the get_graph_context "empty graph reported as
  // not found" bug — the empty case is a first-class state.
  test('a brand-new empty graph shows the empty-state, not an error @smoke', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));

    await login(page, TEST_USERS.ADMIN);
    await page.waitForTimeout(2000);

    const graphId = await page.evaluate(async () => {
      const token = localStorage.getItem('authToken') ?? '';
      const post = (query: string, variables?: unknown) =>
        fetch('/api/graphql', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ query, variables }),
        }).then((r) => r.json());
      const me = await post('{ me { id } }');
      const userId = me.data.me.id;
      const g = await post(
        `mutation($input: [GraphCreateInput!]!) { createGraphs(input: $input) { graphs { id } } }`,
        { input: [{ name: `Empty Smoke ${Date.now()}`, type: 'PROJECT', status: 'ACTIVE', createdBy: userId, isShared: true }] }
      );
      return g.data.createGraphs.graphs[0].id as string;
    });
    expect(graphId, 'empty graph created').toBeTruthy();

    try {
      await page.evaluate((gid) => localStorage.setItem('currentGraphId', gid), graphId);
      await page.reload();
      await page.waitForTimeout(6000);

      await expect(
        page.locator('text=/Create Your First Work Item|Transform Your Vision/i').first(),
        'empty graph shows its create-first-item invitation'
      ).toBeVisible({ timeout: 10000 });

      const errorBadges = await page
        .locator('.graph-container')
        .locator('text=/^Error$|not found|failed to load|connection lost/i')
        .count();
      expect(errorBadges, 'no error chrome on an empty graph').toBe(0);
      expect(pageErrors, `uncaught page errors on empty graph: ${pageErrors[0] ?? ''}`).toEqual([]);
    } finally {
      await page.evaluate(async (gid) => {
        const token = localStorage.getItem('authToken') ?? '';
        await fetch('/api/graphql', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ query: `mutation($id: ID!) { deleteGraphs(where: { id: $id }) { nodesDeleted } }`, variables: { id: gid } }),
        });
      }, graphId);
    }
  });

  test('data integrity: no orphan edges in the database @smoke', async ({ page }) => {
    await login(page, TEST_USERS.ADMIN);
    const orphans = await page.evaluate(async () => {
      const token = localStorage.getItem('authToken') ?? '';
      const res = await fetch('/api/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ query: `{ edges { id source { id } target { id } } }` })
      });
      const body = await res.json();
      if (body.errors) return { queryBroken: body.errors[0].message };
      return { count: body.data.edges.filter((e: { source: unknown; target: unknown }) => !e.source || !e.target).length };
    });
    expect((orphans as { queryBroken?: string }).queryBroken, 'edges query must not 500').toBeUndefined();
    expect((orphans as { count: number }).count, 'orphan edges corrupt the whole edges query').toBe(0);
  });

  // Snapshot-authoritative layout: if a user arranges a node and reloads, it
  // must come back where they left it (the force sim must not drift a placed
  // node). Tolerance ≤25px. Regression guard for the position-persistence bug.
  test('layout persistence: an arranged node survives a reload @smoke', async ({ page }) => {
    await login(page, TEST_USERS.ADMIN);
    await page.waitForTimeout(6000);

    const nodeSel = '.graph-container svg .node';
    test.skip((await page.locator(nodeSel).count()) === 0, 'no graph with nodes auto-selected');

    const firstId = await page.evaluate((sel) => (document.querySelector(sel) as any)?.__data__?.id ?? null, nodeSel);
    test.skip(!firstId, 'could not read a node id');

    // Drag the node by a clear offset so it becomes "placed" and is saved
    const box = await page.evaluate((id) => {
      const n = [...document.querySelectorAll('.graph-container svg .node')].find((el: any) => el.__data__?.id === id) as any;
      const r = (n.querySelector('.node-bg') as Element).getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    }, firstId);
    await page.mouse.move(box.x, box.y);
    await page.mouse.down();
    for (let i = 1; i <= 10; i++) await page.mouse.move(box.x + i * 16, box.y + i * 9);
    await page.mouse.up();
    await page.waitForTimeout(4000); // settle + save

    const readPos = (id: string) => page.evaluate((nid) => {
      const n = [...document.querySelectorAll('.graph-container svg .node')].find((el: any) => el.__data__?.id === nid) as any;
      return n ? { x: Math.round(n.__data__.x), y: Math.round(n.__data__.y) } : null;
    }, id);
    const before = await readPos(firstId);
    expect(before, 'node position readable before reload').not.toBeNull();

    await page.reload();
    await page.waitForTimeout(9000);
    const after = await readPos(firstId);
    expect(after, 'node still present after reload').not.toBeNull();

    const drift = Math.round(Math.hypot(before!.x - after!.x, before!.y - after!.y));
    expect(drift, `arranged node drifted ${drift}px across reload (tolerance 25px)`).toBeLessThanOrEqual(25);
  });
});
