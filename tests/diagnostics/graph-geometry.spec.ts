import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { login, TEST_USERS } from '../helpers/auth';
import { sweepTestData, TEST_GRAPH_PREFIX } from '../helpers/dbHealing';

/**
 * Graph-geometry diagnostic — measures node/edge/label geometry from the REAL
 * rendered DOM so layout problems are visible quantitatively + visually before
 * (and after) any fix. Report-only; it never changes app behaviour.
 *
 * It checks the three things called out for the layout overhaul:
 *   1. EDGE ATTACHMENT — do edge line endpoints sit at the node CENTER (buried
 *      under the card) or on the node BORDER? Measured as the gap between the
 *      edge endpoint and the node center (≈0 today = center-attached) and how
 *      far the endpoint is INSIDE the card.
 *   2. LABEL FIT — is the edge long enough for its label? i.e. is the label's
 *      rendered box wider than the clear span between the two cards, and does
 *      it OVERLAP either card?
 *   3. MIN LENGTH — does the actual edge length respect a label-width minimum?
 *
 * Output: test-artifacts/geometry/{report.json, *.png}. The screenshots feed
 * the eye (and the VLM suite). A FRESH controlled scenario is seeded so the
 * problems are reproducible regardless of demo data; healing cleans it up.
 */

const OUT = path.resolve(process.cwd(), 'test-artifacts/geometry');

interface EdgeGeom {
  type: string;
  centerLen: number;        // node-center to node-center distance (what the sim uses)
  endpointAtSourceCenterPx: number; // |edge (x1,y1) - source center|  (≈0 => center-attached)
  endpointAtTargetCenterPx: number;
  sourceInsetPx: number;    // how far the edge endpoint is INSIDE the source card border, along the edge
  targetInsetPx: number;
  labelW: number;
  labelH: number;
  clearSpanPx: number;      // straight-line gap between the two card borders along the edge
  labelOverflowPx: number;  // labelW - clearSpan (>0 => label can't fit between cards)
  labelOverlapsCard: boolean; // label box intersects either node card rect
}

async function readGeometry(page: Page): Promise<{ edges: EdgeGeom[] }> {
  return page.evaluate(() => {
    const rectFor = (nodeG: Element) => {
      const bg = nodeG.querySelector('.node-bg') as Element | null;
      const r = (bg ?? nodeG).getBoundingClientRect();
      return { cx: r.x + r.width / 2, cy: r.y + r.height / 2, w: r.width, h: r.height };
    };
    // node id -> screen rect/center
    const nodeById: Record<string, { cx: number; cy: number; w: number; h: number }> = {};
    document.querySelectorAll('.graph-container svg .node').forEach((n) => {
      const id = (n as any).__data__?.id;
      if (id) nodeById[id] = rectFor(n);
    });

    const boxesOverlap = (a: any, b: any) =>
      Math.abs(a.cx - b.cx) * 2 < a.w + b.w && Math.abs(a.cy - b.cy) * 2 < a.h + b.h;

    // straight gap between two axis-aligned card borders along the connecting line
    const clearSpan = (s: any, t: any) => {
      const dx = t.cx - s.cx, dy = t.cy - s.cy;
      const len = Math.hypot(dx, dy) || 1;
      const ux = Math.abs(dx) / len, uy = Math.abs(dy) / len;
      const proj = (n: any) => (n.w / 2) * ux + (n.h / 2) * uy;
      return Math.max(0, len - proj(s) - proj(t));
    };

    const edges: any[] = [];
    document.querySelectorAll('.graph-container svg .edge').forEach((e) => {
      const d = (e as any).__data__;
      if (!d?.source || !d?.target) return;
      const sId = typeof d.source === 'object' ? d.source.id : d.source;
      const tId = typeof d.target === 'object' ? d.target.id : d.target;
      const s = nodeById[sId], t = nodeById[tId];
      if (!s || !t) return;

      // The rendered edge endpoints (screen coords)
      const le = e as SVGLineElement;
      const r = le.getBoundingClientRect();
      // endpoints from attributes mapped to screen via the line's CTM is messy;
      // instead compare the edge's own bbox extremes to the node centers.
      const x1 = le.x1.baseVal.value, y1 = le.y1.baseVal.value, x2 = le.x2.baseVal.value, y2 = le.y2.baseVal.value;
      // map svg-userspace endpoint to screen using the element CTM
      const m = le.getScreenCTM();
      const p1 = m ? new DOMPoint(x1, y1).matrixTransform(m) : { x: r.left, y: r.top };
      const p2 = m ? new DOMPoint(x2, y2).matrixTransform(m) : { x: r.right, y: r.bottom };

      const len = Math.hypot(t.cx - s.cx, t.cy - s.cy);
      const ux = (t.cx - s.cx) / (len || 1), uy = (t.cy - s.cy) / (len || 1);
      const proj = (n: any) => (n.w / 2) * Math.abs(ux) + (n.h / 2) * Math.abs(uy);

      // label box for this edge
      const labelG = document.querySelector(`.edge-label-group`);
      let labelW = 0, labelH = 0, labelBox: any = null;
      const allLabels = [...document.querySelectorAll('.graph-container svg .edge-label-group')];
      // match label to edge by id when possible
      const lg = allLabels.find((g) => (g as any).__data__?.id === d.id) as Element | undefined;
      if (lg) {
        const lr = lg.getBoundingClientRect();
        labelW = lr.width; labelH = lr.height;
        labelBox = { cx: lr.x + lr.width / 2, cy: lr.y + lr.height / 2, w: lr.width, h: lr.height };
      }

      edges.push({
        type: d.type,
        centerLen: Math.round(len),
        endpointAtSourceCenterPx: Math.round(Math.hypot(p1.x - s.cx, p1.y - s.cy)),
        endpointAtTargetCenterPx: Math.round(Math.hypot(p2.x - t.cx, p2.y - t.cy)),
        sourceInsetPx: Math.round(proj(s)),
        targetInsetPx: Math.round(proj(t)),
        labelW: Math.round(labelW),
        labelH: Math.round(labelH),
        clearSpanPx: Math.round(clearSpan(s, t)),
        labelOverflowPx: Math.round(labelW - clearSpan(s, t)),
        labelOverlapsCard: labelBox ? (boxesOverlap(labelBox, s) || boxesOverlap(labelBox, t)) : false,
      });
    });
    return { edges };
  });
}

async function gql(page: Page, query: string, variables?: unknown) {
  return page.evaluate(async ({ query, variables }) => {
    const token = localStorage.getItem('authToken') ?? '';
    const res = await fetch('/api/graphql', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ query, variables }) });
    return res.json();
  }, { query, variables });
}

test.describe('graph geometry diagnostic @geometry', () => {
  test.describe.configure({ timeout: 180_000 });
  test.beforeAll(async () => { await sweepTestData('geometry:before'); });
  test.afterAll(async () => { await sweepTestData('geometry:after'); });

  test('measure edge attachment, label fit and overlaps', async ({ page }) => {
    fs.mkdirSync(OUT, { recursive: true });
    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page, TEST_USERS.ADMIN);
    await page.waitForTimeout(1500);

    // Seed a controlled scenario: two PINNED pairs sharing the widest edge
    // label. One pair is close (label can't fit), one is far (control).
    const me = await gql(page, '{ me { id } }');
    const userId = me.data.me.id;
    const g = await gql(page, `mutation($i:[GraphCreateInput!]!){createGraphs(input:$i){graphs{id}}}`,
      { i: [{ name: `${TEST_GRAPH_PREFIX} Geometry ${Date.now()}`, type: 'PROJECT', status: 'ACTIVE', createdBy: userId, isShared: true }] });
    const graphId = g.data.createGraphs.graphs[0].id;

    // positions are pinned (snapshot-authoritative) so the edges stay the
    // length we choose. Close pair: 200px apart (cards ~170 wide => ~30px clear,
    // far short of a "Depends On"/"Is Part Of" label). Far pair: 470px apart.
    const nodeDefs = [
      { key: 'closeA', x: -100, y: -120 }, { key: 'closeB', x: 100, y: -120 },
      { key: 'farA', x: -235, y: 140 }, { key: 'farB', x: 235, y: 140 },
    ];
    const created = await gql(page, `mutation($i:[WorkItemCreateInput!]!){createWorkItems(input:$i){workItems{id title}}}`,
      { i: nodeDefs.map((n) => ({ type: 'TASK', title: n.key, status: 'IN_PROGRESS', priority: 0.5, positionX: n.x, positionY: n.y, positionZ: 0, owner: { connect: { where: { node: { id: userId } } } }, graph: { connect: { where: { node: { id: graphId } } } } })) });
    const ids: Record<string, string> = {};
    for (const w of created.data.createWorkItems.workItems) ids[w.title] = w.id;

    const mkEdge = (a: string, b: string, type: string) => ({ type, weight: 0.6, source: { connect: { where: { node: { id: ids[a] } } } }, target: { connect: { where: { node: { id: ids[b] } } } } });
    await gql(page, `mutation($i:[EdgeCreateInput!]!){createEdges(input:$i){edges{id}}}`,
      { i: [mkEdge('closeA', 'closeB', 'DEPENDS_ON'), mkEdge('farA', 'farB', 'DEPENDS_ON')] });

    // Open the scenario graph.
    await page.evaluate((gid) => { localStorage.setItem('currentGraphId', gid); localStorage.setItem('graphdone.quality.override', 'HIGH'); }, graphId);
    await page.reload();
    await page.waitForTimeout(7000); // load + settle (pinned nodes barely move)

    await page.screenshot({ path: path.join(OUT, 'scenario-full.png') });

    // Center the view on the close pair (graph midpoint (0,-120)) so the label
    // overflow is clearly visible, not tucked under the toolbar.
    await page.evaluate(() => (window as any).miniMapNavigate?.(0, -120));
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(OUT, 'close-pair-centered.png') });

    const geom = await readGeometry(page);

    // Clipped close-up around the CLOSE pair so the label overflow is obvious,
    // using the measured on-screen rects (independent of the app's framing).
    const closeRects = await page.evaluate(() => {
      const out: Array<{ x: number; y: number; w: number; h: number }> = [];
      document.querySelectorAll('.graph-container svg .node').forEach((n) => {
        const t = (n as any).__data__?.title;
        if (t === 'closeA' || t === 'closeB') {
          const r = ((n.querySelector('.node-bg') as Element) ?? n).getBoundingClientRect();
          out.push({ x: r.x, y: r.y, w: r.width, h: r.height });
        }
      });
      return out;
    });
    if (closeRects.length === 2) {
      const margin = 90;
      const minX = Math.max(0, Math.min(...closeRects.map((r) => r.x)) - margin);
      const minY = Math.max(0, Math.min(...closeRects.map((r) => r.y)) - margin);
      const maxX = Math.min(1440, Math.max(...closeRects.map((r) => r.x + r.w)) + margin);
      const maxY = Math.min(900, Math.max(...closeRects.map((r) => r.y + r.h)) + margin);
      await page.screenshot({ path: path.join(OUT, 'close-pair.png'), clip: { x: minX, y: minY, width: Math.max(50, maxX - minX), height: Math.max(50, maxY - minY) } }).catch(() => {});
    }

    const report = {
      generatedAt: new Date().toISOString(),
      viewport: '1440x900',
      edges: geom.edges,
      summary: {
        edgeCount: geom.edges.length,
        centerAttached: geom.edges.filter((e) => e.endpointAtSourceCenterPx <= 3 && e.endpointAtTargetCenterPx <= 3).length,
        labelsOverflowing: geom.edges.filter((e) => e.labelOverflowPx > 0).length,
        labelsOverlappingCards: geom.edges.filter((e) => e.labelOverlapsCard).length,
      },
    };
    fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));

    // eslint-disable-next-line no-console
    console.log('[geometry] ' + JSON.stringify(report.summary));
    for (const e of geom.edges) {
      // eslint-disable-next-line no-console
      console.log(`[geometry] ${e.type}: centerLen=${e.centerLen} clearSpan=${e.clearSpanPx} labelW=${e.labelW} overflow=${e.labelOverflowPx} overlapsCard=${e.labelOverlapsCard} endpoint@srcCenter=${e.endpointAtSourceCenterPx}px endpoint@tgtCenter=${e.endpointAtTargetCenterPx}px`);
    }

    // Diagnostic, not a gate: just assert we measured something real.
    expect(geom.edges.length, 'measured at least one edge').toBeGreaterThan(0);

    await gql(page, `mutation($id:ID!){deleteEdges(where:{source:{graph:{id:$id}}}){nodesDeleted}}`, { id: graphId });
    await gql(page, `mutation($id:ID!){deleteWorkItems(where:{graph:{id:$id}}){nodesDeleted}}`, { id: graphId });
    await gql(page, `mutation($id:ID!){deleteGraphs(where:{id:$id}){nodesDeleted}}`, { id: graphId });

    // ── Scenario 2: an UNPINNED cluster the sim lays out (positionX/Y=0 =>
    // unplaced). This exercises the physics floor: every auto-laid edge should
    // settle long enough for its label (clearSpan >= labelW). Pinned scenario
    // above can't test this (user-placed nodes aren't moved by the sim).
    const g2 = await gql(page, `mutation($i:[GraphCreateInput!]!){createGraphs(input:$i){graphs{id}}}`,
      { i: [{ name: `${TEST_GRAPH_PREFIX} GeometryFlow ${Date.now()}`, type: 'PROJECT', status: 'ACTIVE', createdBy: userId, isShared: true }] });
    const flowId = g2.data.createGraphs.graphs[0].id;
    const flowNodes = ['hub', 's1', 's2', 's3', 's4', 's5'];
    const c2 = await gql(page, `mutation($i:[WorkItemCreateInput!]!){createWorkItems(input:$i){workItems{id title}}}`,
      { i: flowNodes.map((t) => ({ type: 'TASK', title: t, status: 'IN_PROGRESS', priority: 0.5, positionX: 0, positionY: 0, positionZ: 0, owner: { connect: { where: { node: { id: userId } } } }, graph: { connect: { where: { node: { id: flowId } } } } })) });
    const fids: Record<string, string> = {};
    for (const w of c2.data.createWorkItems.workItems) fids[w.title] = w.id;
    const fEdge = (a: string, b: string, type: string) => ({ type, weight: 0.6, source: { connect: { where: { node: { id: fids[a] } } } }, target: { connect: { where: { node: { id: fids[b] } } } } });
    await gql(page, `mutation($i:[EdgeCreateInput!]!){createEdges(input:$i){edges{id}}}`,
      { i: ['s1', 's2', 's3', 's4', 's5'].map((s, idx) => fEdge('hub', s, ['DEPENDS_ON', 'IS_PART_OF', 'RELATES_TO', 'BLOCKS', 'DEPENDS_ON'][idx])) });

    await page.evaluate((gid) => { localStorage.setItem('currentGraphId', gid); localStorage.setItem('graphdone.quality.override', 'HIGH'); }, flowId);
    await page.reload();
    await page.waitForTimeout(9000); // unplaced nodes flow + settle
    await page.evaluate(() => (window as any).miniMapNavigate?.(0, 0));
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(OUT, 'flow-cluster.png') });
    const flow = await readGeometry(page);
    const flowSummary = {
      edgeCount: flow.edges.length,
      labelsOverflowing: flow.edges.filter((e) => e.labelOverflowPx > 0).length,
      labelsOverlappingCards: flow.edges.filter((e) => e.labelOverlapsCard).length,
      minClearSpan: Math.min(...flow.edges.map((e) => e.clearSpanPx)),
      maxLabelW: Math.max(...flow.edges.map((e) => e.labelW)),
    };
    fs.writeFileSync(path.join(OUT, 'report-flow.json'), JSON.stringify({ summary: flowSummary, edges: flow.edges }, null, 2));
    // eslint-disable-next-line no-console
    console.log('[geometry:flow] ' + JSON.stringify(flowSummary));

    await gql(page, `mutation($id:ID!){deleteEdges(where:{source:{graph:{id:$id}}}){nodesDeleted}}`, { id: flowId });
    await gql(page, `mutation($id:ID!){deleteWorkItems(where:{graph:{id:$id}}){nodesDeleted}}`, { id: flowId });
    await gql(page, `mutation($id:ID!){deleteGraphs(where:{id:$id}){nodesDeleted}}`, { id: flowId });
  });

  test('drag-time clamp: a node cannot be dragged closer than the label minimum', async ({ page }) => {
    fs.mkdirSync(OUT, { recursive: true });
    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page, TEST_USERS.ADMIN);
    await page.waitForTimeout(1500);

    const me = await gql(page, '{ me { id } }');
    const userId = me.data.me.id;
    const g = await gql(page, `mutation($i:[GraphCreateInput!]!){createGraphs(input:$i){graphs{id}}}`,
      { i: [{ name: `${TEST_GRAPH_PREFIX} DragClamp ${Date.now()}`, type: 'PROJECT', status: 'ACTIVE', createdBy: userId, isShared: true }] });
    const graphId = g.data.createGraphs.graphs[0].id;
    // Two placed nodes, far apart, joined by a wide-label edge.
    const created = await gql(page, `mutation($i:[WorkItemCreateInput!]!){createWorkItems(input:$i){workItems{id title}}}`,
      { i: [
        { type: 'TASK', title: 'anchor', status: 'IN_PROGRESS', priority: 0.5, positionX: -260, positionY: 0, positionZ: 0, owner: { connect: { where: { node: { id: userId } } } }, graph: { connect: { where: { node: { id: graphId } } } } },
        { type: 'TASK', title: 'dragme', status: 'IN_PROGRESS', priority: 0.5, positionX: 260, positionY: 0, positionZ: 0, owner: { connect: { where: { node: { id: userId } } } }, graph: { connect: { where: { node: { id: graphId } } } } },
      ] });
    const ids: Record<string, string> = {};
    for (const w of created.data.createWorkItems.workItems) ids[w.title] = w.id;
    await gql(page, `mutation($i:[EdgeCreateInput!]!){createEdges(input:$i){edges{id}}}`,
      { i: [{ type: 'IS_PART_OF', weight: 0.6, source: { connect: { where: { node: { id: ids.dragme } } } }, target: { connect: { where: { node: { id: ids.anchor } } } } }] });

    await page.evaluate((gid) => { localStorage.setItem('currentGraphId', gid); localStorage.setItem('graphdone.quality.override', 'HIGH'); }, graphId);
    await page.reload();
    await page.waitForTimeout(6000);
    await page.evaluate(() => (window as any).miniMapNavigate?.(0, 0));
    await page.waitForTimeout(1000);

    const centerOf = (title: string) => page.evaluate((t) => {
      const n = [...document.querySelectorAll('.graph-container svg .node')].find((el: any) => el.__data__?.title === t) as any;
      if (!n) return null;
      const r = (n.querySelector('.node-bg') as Element).getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    }, title);

    const anchor = await centerOf('anchor');
    const drag = await centerOf('dragme');
    expect(anchor && drag, 'both nodes on screen').toBeTruthy();

    // Drag "dragme" right onto "anchor" (and past it) — the clamp must stop it.
    await page.mouse.move(drag!.x, drag!.y);
    await page.mouse.down();
    const steps = 24;
    for (let i = 1; i <= steps; i++) {
      await page.mouse.move(drag!.x + (anchor!.x - drag!.x) * (i / steps), drag!.y + (anchor!.y - drag!.y) * (i / steps), { steps: 1 });
      await page.waitForTimeout(15);
    }
    await page.mouse.up();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(OUT, 'drag-clamp.png') });

    // Final graph-space center distance + the edge's enforced minimum.
    const result = await page.evaluate(() => {
      const node = (t: string) => [...document.querySelectorAll('.graph-container svg .node')].find((el: any) => el.__data__?.title === t) as any;
      const a = node('anchor')?.__data__, b = node('dragme')?.__data__;
      const edge = [...document.querySelectorAll('.graph-container svg .edge')].map((e: any) => e.__data__).find((d: any) => d && d._minLen);
      return { dist: a && b ? Math.hypot(a.x - b.x, a.y - b.y) : -1, minLen: edge?._minLen ?? -1 };
    });
    // eslint-disable-next-line no-console
    console.log(`[geometry:drag] after dragging onto the anchor: centerDist=${Math.round(result.dist)} minLen=${Math.round(result.minLen)}`);

    expect(result.minLen, 'edge has a computed minimum length').toBeGreaterThan(0);
    // The clamp must keep them apart — allow a small tolerance for the iterative
    // projection + a tick of settling.
    expect(result.dist, 'dragged node was held at the label minimum, not on top of the anchor').toBeGreaterThanOrEqual(result.minLen - 25);

    await gql(page, `mutation($id:ID!){deleteEdges(where:{source:{graph:{id:$id}}}){nodesDeleted}}`, { id: graphId });
    await gql(page, `mutation($id:ID!){deleteWorkItems(where:{graph:{id:$id}}){nodesDeleted}}`, { id: graphId });
    await gql(page, `mutation($id:ID!){deleteGraphs(where:{id:$id}){nodesDeleted}}`, { id: graphId });
  });
});
