import { test, expect } from '@playwright/test';
import { login, TEST_USERS } from '../helpers/auth';

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
    await login(page, TEST_USERS.ADMIN);
    await page.waitForTimeout(6000);

    const before = {
      nodes: await page.locator('.graph-container svg .node').count(),
      edges: await page.locator('.graph-container svg .edge').count()
    };
    test.skip(before.nodes === 0, 'no graph with nodes auto-selected');

    const plus = page.locator('.node-relationship-icon').first();
    await plus.click({ force: true });
    await expect(page.locator('text=Click empty space to grow')).toBeVisible();

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

    expect(await page.locator('.graph-container svg .node').count(), 'node count must grow').toBe(before.nodes + 1);
    expect(await page.locator('.graph-container svg .edge').count(), 'edge count must grow').toBe(before.edges + 1);
    await expect(page.locator(`text=${name}`).first()).toBeVisible();

    // Undo must walk it back: Ctrl+Z undoes the rename, then the creation
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(2500);
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(5000);
    expect(await page.locator('.graph-container svg .node').count(), 'undo must remove the created node').toBe(before.nodes);
    expect(await page.locator('.graph-container svg .edge').count(), 'undo must remove the created edge').toBe(before.edges);

    // Belt-and-braces cleanup in case undo half-failed (keeps re-runnable)
    await page.evaluate(async (title) => {
      const token = localStorage.getItem('authToken') ?? '';
      const find = await fetch('/api/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ query: `query($t: String!) { workItems(where: { title: $t }) { id } }`, variables: { t: title } })
      }).then((r) => r.json());
      const id = find.data?.workItems?.[0]?.id;
      if (!id) return;
      // Detach edges FIRST — orphan edges break the whole edges query
      await fetch('/api/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          query: `mutation($id: ID!) { deleteEdges(where: { OR: [{ source: { id: $id } }, { target: { id: $id } }] }) { nodesDeleted } }`,
          variables: { id }
        })
      });
      await fetch('/api/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ query: `mutation($id: ID!) { deleteWorkItems(where: { id: $id }) { nodesDeleted } }`, variables: { id } })
      });
    }, name);
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
