import { test, expect, Page } from '@playwright/test';
import { login, TEST_USERS } from '../helpers/auth';

/**
 * The living graph is the product's differentiator (breathing, glow, energy
 * flow, hover illumination, reduced-motion respect) — and until now it had NO
 * rendered/e2e coverage, only unit tests of the helper logic. This spec
 * asserts the effects actually appear in the DOM.
 *
 * It SELF-SEEDS a deterministic fixture graph via the API (a COMPLETED node, an
 * IN_PROGRESS node, a BLOCKED node, and an edge from the completed one) so it's
 * reproducible in a fresh CI database — not dependent on seed/demo data. The
 * graph is selected via the `currentGraphId` localStorage key and cleaned up
 * afterward. Quality is pinned to ULTRA so effects aren't stripped on a
 * low-tier headless runner.
 */

interface Fixture { graphId: string; ids: Record<string, string>; }

async function api(page: Page, query: string, variables?: unknown) {
  return page.evaluate(async ({ query, variables }) => {
    const token = localStorage.getItem('authToken') ?? '';
    const res = await fetch('/api/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ query, variables }),
    });
    return res.json();
  }, { query, variables });
}

async function seedFixture(page: Page): Promise<Fixture> {
  const me = await api(page, '{ me { id } }');
  const userId = me.data.me.id;
  const g = await api(page,
    `mutation($input: [GraphCreateInput!]!) { createGraphs(input: $input) { graphs { id } } }`,
    { input: [{ name: `Living E2E ${Date.now()}`, type: 'PROJECT', status: 'ACTIVE', createdBy: userId, isShared: true }] });
  const graphId = g.data.createGraphs.graphs[0].id;

  const nodeDefs = [
    { key: 'done', title: 'Completed work', status: 'COMPLETED', priority: 0.9, x: -250, y: 0 },
    { key: 'wip', title: 'In progress work', status: 'IN_PROGRESS', priority: 0.85, x: 250, y: 0 },
    { key: 'blocked', title: 'Blocked work', status: 'BLOCKED', priority: 0.7, x: 0, y: 260 },
  ];
  const created = await api(page,
    `mutation($input: [WorkItemCreateInput!]!) { createWorkItems(input: $input) { workItems { id title } } }`,
    { input: nodeDefs.map((n) => ({
        type: 'TASK', title: n.title, status: n.status, priority: n.priority,
        positionX: n.x, positionY: n.y, positionZ: 0,
        owner: { connect: { where: { node: { id: userId } } } },
        graph: { connect: { where: { node: { id: graphId } } } },
      })) });
  const ids: Record<string, string> = {};
  for (const w of created.data.createWorkItems.workItems) {
    ids[nodeDefs.find((n) => n.title === w.title)!.key] = w.id;
  }
  // Edge FROM the completed node → energy should flow forward out of it
  await api(page,
    `mutation($input: [EdgeCreateInput!]!) { createEdges(input: $input) { edges { id } } }`,
    { input: [{ type: 'RELATES_TO', weight: 0.8,
        source: { connect: { where: { node: { id: ids.done } } } },
        target: { connect: { where: { node: { id: ids.wip } } } } }] });
  return { graphId, ids };
}

async function cleanup(page: Page, fx: Fixture) {
  for (const id of Object.values(fx.ids)) {
    await api(page, `mutation($id: ID!) { deleteEdges(where: { OR: [{ source: { id: $id } }, { target: { id: $id } }] }) { nodesDeleted } }`, { id });
  }
  for (const id of Object.values(fx.ids)) {
    await api(page, `mutation($id: ID!) { deleteWorkItems(where: { id: $id }) { nodesDeleted } }`, { id });
  }
  await api(page, `mutation($id: ID!) { deleteGraphs(where: { id: $id }) { nodesDeleted } }`, { id: fx.graphId });
}

async function openFixture(page: Page, fx: Fixture) {
  await page.addInitScript((gid) => {
    try {
      localStorage.setItem('graphdone.quality.override', 'ULTRA');
      localStorage.setItem('currentGraphId', gid);
    } catch { /* private mode */ }
  }, fx.graphId);
  await page.reload();
  await page.waitForTimeout(6000);
}

test.describe('living graph: the effects actually render @living', () => {
  test('breathing / glow / energy-flow render for real statuses (LIVE-1/2/4/5)', async ({ page }) => {
    await login(page, TEST_USERS.ADMIN);
    await page.waitForTimeout(3000);
    const fx = await seedFixture(page);
    try {
      await openFixture(page, fx);

      const tier = await page.evaluate(() => document.querySelector('.graph-container[data-quality]')?.getAttribute('data-quality'));
      expect(tier, 'quality pinned high enough for effects').toMatch(/HIGH|ULTRA/);

      const fxState = await page.evaluate(() => {
        const q = (s: string) => document.querySelectorAll(s).length;
        const glowing = [...document.querySelectorAll('.graph-container svg .node-bg')]
          .filter((n) => ((n as HTMLElement).style.filter || '').includes('drop-shadow(')).length;
        return {
          breathing: q('.graph-container svg .node-breathing'),
          stuck: q('.graph-container svg .node-stuck'),
          settled: q('.graph-container svg .node-settled'),
          flowing: q('.graph-container svg .edge-flowing-forward, .graph-container svg .edge-flowing-reverse'),
          glowing,
        };
      });
      expect(fxState.breathing, 'in-progress node breathes').toBeGreaterThan(0);
      expect(fxState.stuck, 'blocked node aches').toBeGreaterThan(0);
      expect(fxState.settled, 'completed node settles').toBeGreaterThan(0);
      expect(fxState.flowing, 'energy flows on the edge out of completed work').toBeGreaterThan(0);
      expect(fxState.glowing, 'priority nodes carry a glow halo').toBeGreaterThan(0);
    } finally {
      await cleanup(page, fx);
    }
  });

  test('hovering a node illuminates its neighborhood (LIVE-7)', async ({ page }) => {
    await login(page, TEST_USERS.ADMIN);
    await page.waitForTimeout(3000);
    const fx = await seedFixture(page);
    try {
      await openFixture(page, fx);
      await page.waitForTimeout(1500); // let the entrance animation finish so nodes are stable
      // Move to the node's computed center (more robust than locator.hover,
      // which can race the entrance transition's stability check).
      const center = await page.evaluate(() => {
        const el = document.querySelector('.graph-container svg .node .node-bg');
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      });
      expect(center, 'a node card is on screen to hover').not.toBeNull();
      await page.mouse.move(center!.x, center!.y);
      await page.waitForTimeout(600);
      expect(await page.locator('.graph-container svg .dim-for-hover').count(), 'non-neighbors dim on hover').toBeGreaterThan(0);
      await page.mouse.move(2, 2);
      await page.waitForTimeout(500);
      expect(await page.locator('.graph-container svg .dim-for-hover').count(), 'dimming clears on leave').toBe(0);
    } finally {
      await cleanup(page, fx);
    }
  });

  test('prefers-reduced-motion suppresses animation (ADAPT-9 / a11y)', async ({ page }) => {
    await login(page, TEST_USERS.ADMIN);
    await page.waitForTimeout(3000);
    const fx = await seedFixture(page);
    try {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await openFixture(page, fx);
      const animating = await page.evaluate(() => {
        let moving = 0;
        document.querySelectorAll('.graph-container svg .node-breathing, .graph-container svg .edge-flowing-forward, .graph-container svg .edge-flowing-reverse')
          .forEach((el) => { const n = getComputedStyle(el as Element).animationName; if (n && n !== 'none') moving++; });
        return moving;
      });
      expect(animating, 'nothing animates under prefers-reduced-motion').toBe(0);
    } finally {
      await cleanup(page, fx);
    }
  });
});
