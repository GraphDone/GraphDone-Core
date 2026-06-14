import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { login, TEST_USERS } from '../helpers/auth';
import { sweepTestData, TEST_GRAPH_PREFIX } from '../helpers/dbHealing';

/**
 * Basic-interaction audit — walks the everyday graph interactions a user does
 * and asserts the CORRECT outcome from the real rendered DOM. It exists to make
 * "basic" regressions impossible to miss: each check is named after the user
 * action it guards, and a failure prints exactly what went wrong.
 *
 * Covered here (the relationship-editing basics that were visibly broken):
 *   - changing an edge's relationship TYPE updates its label immediately, with
 *     no reload (the label used to stay on the old type);
 *   - flipping an edge's DIRECTION leaves EXACTLY ONE edge for the pair (it
 *     used to leave a stale duplicate because the delete+recreate kept the same
 *     edge count and the DOM was never reconciled).
 *
 * Output: test-artifacts/interaction-audit/report.json + screenshots. Seeds a
 * controlled [E2E] graph; healing cleans up even if a run is killed.
 */

const OUT = path.resolve(process.cwd(), 'test-artifacts/interaction-audit');

async function gql(page: Page, query: string, variables?: unknown) {
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

async function readEdges(page: Page) {
  return page.evaluate(() => {
    const edges: Array<{ id: string; rtype: string; label: string; sId: string; tId: string }> = [];
    document.querySelectorAll('.graph-container svg .edge').forEach((e) => {
      const d = (e as any).__data__;
      if (!d) return;
      const sId = typeof d.source === 'object' ? d.source?.id : d.source;
      const tId = typeof d.target === 'object' ? d.target?.id : d.target;
      edges.push({ id: d.id, rtype: (e as Element).getAttribute('data-rtype') ?? d.type, label: '', sId, tId });
    });
    // labels live in a sibling group, keyed by the same datum id
    const labelById: Record<string, string> = {};
    document.querySelectorAll('.graph-container svg .edge-label-group').forEach((g) => {
      const d = (g as any).__data__;
      const txt = (g.querySelector('.edge-label') as Element | null)?.textContent ?? '';
      if (d?.id) labelById[d.id] = txt;
    });
    for (const e of edges) e.label = labelById[e.id] ?? '';
    return edges;
  });
}

test.describe('interaction audit @geometry', () => {
  test.describe.configure({ timeout: 180_000 });
  test.beforeAll(async () => { await sweepTestData('audit:before'); });
  test.afterAll(async () => { await sweepTestData('audit:after'); });

  test('relationship type change + flip direction', async ({ page }) => {
    fs.mkdirSync(OUT, { recursive: true });
    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page, TEST_USERS.ADMIN);
    await page.waitForTimeout(1500);

    // Seed one PINNED horizontal edge so the label is on-screen and clickable.
    const me = await gql(page, '{ me { id } }');
    const userId = me.data.me.id;
    const g = await gql(page, `mutation($i:[GraphCreateInput!]!){createGraphs(input:$i){graphs{id}}}`,
      { i: [{ name: `${TEST_GRAPH_PREFIX} Audit ${Date.now()}`, type: 'PROJECT', status: 'ACTIVE', createdBy: userId, isShared: true }] });
    const graphId = g.data.createGraphs.graphs[0].id;

    const nodeDefs = [{ key: 'A', x: -190, y: 0 }, { key: 'B', x: 190, y: 0 }];
    const created = await gql(page, `mutation($i:[WorkItemCreateInput!]!){createWorkItems(input:$i){workItems{id title}}}`,
      { i: nodeDefs.map((n) => ({ type: 'TASK', title: n.key, status: 'IN_PROGRESS', priority: 0.5, positionX: n.x, positionY: n.y, positionZ: 0, owner: { connect: { where: { node: { id: userId } } } }, graph: { connect: { where: { node: { id: graphId } } } } })) });
    const ids: Record<string, string> = {};
    for (const w of created.data.createWorkItems.workItems) ids[w.title] = w.id;

    await gql(page, `mutation($i:[EdgeCreateInput!]!){createEdges(input:$i){edges{id}}}`,
      { i: [{ type: 'DEPENDS_ON', weight: 0.6, source: { connect: { where: { node: { id: ids.A } } } }, target: { connect: { where: { node: { id: ids.B } } } } }] });

    await page.evaluate((gid) => { localStorage.setItem('currentGraphId', gid); localStorage.setItem('graphdone.quality.override', 'HIGH'); }, graphId);
    await page.reload();
    await page.waitForTimeout(7000);
    await page.evaluate(() => (window as any).miniMapNavigate?.(0, 0));
    await page.waitForTimeout(1000);

    const results: Record<string, any> = {};

    // ── Baseline ─────────────────────────────────────────────────────────
    let edges = await readEdges(page);
    results.baseline = { edgeCount: edges.length, label: edges[0]?.label, rtype: edges[0]?.rtype };
    await page.screenshot({ path: path.join(OUT, '1-baseline.png') });
    expect(edges.length, 'one edge rendered at baseline').toBe(1);
    expect(edges[0].label, 'baseline label is the DEPENDS_ON label').toBe('Depends On');

    // ── Interaction 1: change relationship type → label updates immediately ─
    await page.locator('.graph-container svg .edge-label-group').first().click({ force: true });
    await page.waitForTimeout(800);
    await page.locator('button', { hasText: /^Blocks$/ }).first().click();
    await page.waitForTimeout(2500); // mutation + refetch + re-render (no reload)
    await page.screenshot({ path: path.join(OUT, '2-after-type-change.png') });
    edges = await readEdges(page);
    results.afterTypeChange = { edgeCount: edges.length, label: edges[0]?.label, rtype: edges[0]?.rtype };
    expect(edges.length, 'still exactly one edge after type change').toBe(1);
    expect(edges[0].label, 'label updates to Blocks immediately, no reload').toBe('Blocks');

    // ── Interaction 2: flip direction → exactly one edge remains ────────────
    const beforeFlip = edges[0];
    await page.locator('.graph-container svg .edge-label-group').first().click({ force: true });
    await page.waitForTimeout(800);
    await page.getByRole('button', { name: /Flip Direction/ }).click();
    await page.waitForTimeout(3000); // delete + create + refetch + re-render
    await page.screenshot({ path: path.join(OUT, '3-after-flip.png') });
    edges = await readEdges(page);
    results.afterFlip = {
      edgeCount: edges.length,
      label: edges[0]?.label,
      directionSwapped: edges[0] ? (edges[0].sId === beforeFlip.tId && edges[0].tId === beforeFlip.sId) : false,
    };
    expect(edges.length, 'flip leaves EXACTLY ONE edge (no duplicate)').toBe(1);
    expect(edges[0].label, 'flipped edge keeps its Blocks label').toBe('Blocks');

    fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(results, null, 2));
    // eslint-disable-next-line no-console
    console.log('[interaction-audit] ' + JSON.stringify(results));

    // Cleanup (edges before work items — orphan edges break the edges query).
    await gql(page, `mutation($id:ID!){deleteEdges(where:{source:{graph:{id:$id}}}){nodesDeleted}}`, { id: graphId });
    await gql(page, `mutation($id:ID!){deleteWorkItems(where:{graph:{id:$id}}){nodesDeleted}}`, { id: graphId });
    await gql(page, `mutation($id:ID!){deleteGraphs(where:{id:$id}){nodesDeleted}}`, { id: graphId });
  });
});
