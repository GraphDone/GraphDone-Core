import { test as base, expect, Page, TestInfo } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { login, TEST_USERS } from '../../lib/auth';
import { gql } from '../../lib/graphRequest';
import { TEST_GRAPH_PREFIX } from '../../lib/dbHealing';
import { deleteGraphDeep, waitForStarterGraph } from '../../lib/seedGraph';
import { openGraphView } from '../../lib/journeys/workspace';
import { auditEdgeLabels, labelProblems, layoutSpread, problemCount, type LabelProblems } from '../../lib/edgeLabelAudit';
import { EXAMPLE_SHAPES, HARD_SHAPES, type LabelShape } from '../../../packages/web/src/lib/labelClearanceShapes';

/**
 * JOURNEY organize-labels: after "Organize around connections", in the force
 * layout once it has settled, and in the hierarchical layout, every
 * relationship label a person can see must be readable: not under any card,
 * not on another label, reachable at its centre and inside the visible gap of
 * its own edge. Every edge whose two cards are on screen, clear of the graph
 * controls and MiniMap, must show its label.
 *
 * The graphs are the ones a new user gets (Welcome and the example project)
 * and the hard shapes from `labelClearanceShapes.ts`. Each one is created for
 * the test and deleted after it. Organize is pressed with the real control
 * (on a phone, in the View sheet); the layout toggle is the real button where
 * the screen shows it (desktop and iPad). Phones have no layout toggle, so
 * hierarchical mode there goes through the same hook the toggle calls.
 *
 * Labels are drawn from 60% zoom up. Where the camera frames a settled force
 * layout further out (a phone frames at 50%, a large graph further), the test
 * zooms in the way a person would (a wheel notch, a pinch) before reading.
 * "As loaded" is the graph's saved arrangement, which no layout moves: it is
 * recorded for comparison, not checked.
 */

type Owned = { create: (shape: LabelShape, mode: 'placed' | 'unplaced') => Promise<string> };
const test = base.extend<{ owned: Owned }>({
  owned: [async ({ page }, use) => {
    const ids: string[] = [];
    await use({
      async create(shape, mode) {
        const me = (await gql(page, '{ me { id } }')).me.id;
        const created = await gql(page, 'mutation($input:[GraphCreateInput!]!){createGraphs(input:$input){graphs{id}}}', {
          input: [{ name: `${TEST_GRAPH_PREFIX} Labels ${shape.name} ${Date.now()}`, type: 'PROJECT', status: 'ACTIVE', createdBy: me, isShared: true }],
        });
        const graphId = created.createGraphs.graphs[0].id as string;
        ids.push(graphId);
        // "unplaced": every item but the first has no saved position, as when an
        // agent adds them, so the force simulation lays them out.
        const items = await gql(page, 'mutation($input:[WorkItemCreateInput!]!){createWorkItems(input:$input){workItems{id title}}}', {
          input: shape.items.map((item, i) => ({
            type: item.type, title: item.title, status: item.status, priority: 0.5,
            description: item.description ?? null,
            positionX: mode === 'placed' ? item.x ?? 0 : i === 0 ? 1 : 0,
            positionY: mode === 'placed' ? item.y ?? 0 : i === 0 ? 1 : 0,
            positionZ: 0,
            owner: { connect: { where: { node: { id: me } } } },
            graph: { connect: { where: { node: { id: graphId } } } },
          })),
        });
        const idOf = new Map<string, string>();
        shape.items.forEach((item, i) => idOf.set(item.key, items.createWorkItems.workItems[i].id));
        if (shape.edges.length) {
          await gql(page, 'mutation($input:[EdgeCreateInput!]!){createEdges(input:$input){edges{id}}}', {
            input: shape.edges.map(edge => ({
              type: edge.type, weight: 1,
              source: { connect: { where: { node: { id: idOf.get(edge.source) } } } },
              target: { connect: { where: { node: { id: idOf.get(edge.target) } } } },
            })),
          });
        }
        return graphId;
      },
    });
    for (const id of ids) await deleteGraphDeep(page, id, { strict: true });
  }, { timeout: 60_000 }],
});

const touch = (page: Page) => page.evaluate(() => matchMedia('(pointer: coarse)').matches);
const LABEL_MIN_ZOOM = 0.6;
async function press(page: Page, locator: ReturnType<Page['getByRole']>) {
  await expect(locator).toBeEnabled();
  if (await touch(page)) await locator.tap(); else await locator.click();
}

async function evidence(info: TestInfo, name: string, body: string | Buffer, contentType: string) {
  const path = info.outputPath(name);
  await writeFile(path, body);
  await info.attach(name, { path, contentType });
}

type Metrics = { atRest: boolean; cameraReady: boolean; nodeCount: number };
const metrics = (page: Page) => page.evaluate(() => (window as unknown as { __layoutMetrics?: () => Metrics | null }).__layoutMetrics?.() ?? null);

/** Wait for the layout and camera to rest, then for labels to be placed again. */
async function settled(page: Page, cards: number) {
  await expect.poll(async () => {
    const m = await metrics(page);
    return !!m && m.atRest && m.cameraReady && m.nodeCount === cards;
  }, { timeout: 30_000 }).toBe(true);
  await page.waitForTimeout(900);
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
}

async function openGraph(page: Page, graphId: string, cards: number) {
  await page.evaluate(id => {
    localStorage.setItem('currentGraphId', id);
    localStorage.setItem('graphdone:viewMode', 'graph');
    localStorage.setItem('graphdone:layoutMode', 'force');
  }, graphId);
  await page.goto('/');
  await openGraphView(page);
  await expect(page.locator('.graph-container .node')).toHaveCount(cards, { timeout: 20_000 });
  await settled(page, cards);
}

async function organize(page: Page) {
  if (await page.getByRole('button', { name: 'View options', exact: true }).isVisible()) {
    await press(page, page.getByRole('button', { name: 'View options', exact: true }));
  }
  await press(page, page.getByRole('button', { name: /^Organize around connections/ }).first());
}

async function setLayout(page: Page, mode: 'hierarchical' | 'force') {
  const toggle = page.getByRole('button', { name: 'Toggle hierarchical layout' });
  if (await toggle.isVisible()) {
    const current = await page.evaluate(() => (window as unknown as { getLayoutMode?: () => string }).getLayoutMode?.());
    if (current !== mode) await press(page, toggle);
    return 'toggle';
  }
  await page.evaluate(m => (window as unknown as { triggerLayoutMode: (mode: string) => void }).triggerLayoutMode(m), mode);
  return 'hook';
}

/** Zoom in at the graph's centre until labels are drawn (at most eight steps). */
async function zoomToRead(page: Page, cards: number) {
  for (let step = 0; step < 8; step++) {
    const scale = (await auditEdgeLabels(page)).scale;
    if (scale >= LABEL_MIN_ZOOM) return step;
    const box = (await page.locator('.graph-container').boundingBox())!;
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    if (await touch(page)) {
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Input.synthesizePinchGesture', { x, y, scaleFactor: 1.4, gestureSourceType: 'touch' } as never);
      await cdp.detach();
    } else {
      await page.mouse.move(x, y);
      await page.mouse.wheel(0, -240);
    }
    await settled(page, cards);
  }
  return 8;
}

type Stage = { graph: string; stage: string; via?: string; checked: boolean; scale: number; cards: number; drawn: number; inView: number; underControls: number; shown: number; problems: LabelProblems; count: number; spread: Awaited<ReturnType<typeof layoutSpread>> };

async function measure(page: Page, graph: string, stage: string, via?: string, checked = true): Promise<Stage> {
  const audit = await auditEdgeLabels(page);
  const problems = labelProblems(audit);
  return {
    graph, stage, via, checked, scale: Math.round(audit.scale * 1000) / 1000, cards: audit.cards,
    drawn: audit.drawnEdges, inView: audit.inViewEdges, underControls: audit.underControls, shown: audit.shownLabels,
    problems, count: problemCount(problems), spread: await layoutSpread(page),
  };
}

const summary = (stages: Stage[]) => stages.map(s =>
  `${s.graph} / ${s.stage}${s.via ? ` (${s.via})` : ''}${s.checked ? '' : ' [not checked]'}: zoom ${s.scale}, ${s.shown}/${s.drawn} labels shown, ${s.inView} edges in view (${s.underControls} under controls) — hidden ${s.problems.hidden.length}, under a card ${s.problems.covered.length}, on another label ${s.problems.overlapping.length}, centre not reachable ${s.problems.unreachable.length}, outside the gap ${s.problems.outOfGap.length}`
).join('\n');

async function organizeAndCheck(page: Page, owned: Owned, info: TestInfo, shapes: readonly LabelShape[]) {
  const stages: Stage[] = [];
  for (const shape of shapes) {
    const graphId = await owned.create(shape, 'placed');
    await openGraph(page, graphId, shape.items.length);
    stages.push(await measure(page, shape.name, 'as loaded', undefined, false));
    if (shape === shapes[0]) await evidence(info, `${slug(shape.name)}-before.png`, await page.screenshot(), 'image/png');
    await organize(page);
    await settled(page, shape.items.length);
    stages.push(await measure(page, shape.name, 'organized'));
    await evidence(info, `${slug(shape.name)}-organized.png`, await page.screenshot(), 'image/png');
    const via = await setLayout(page, 'hierarchical');
    await settled(page, shape.items.length);
    stages.push(await measure(page, shape.name, 'hierarchical', via));
    await evidence(info, `${slug(shape.name)}-hierarchical.png`, await page.screenshot(), 'image/png');
    await setLayout(page, 'force');
    await settled(page, shape.items.length);
    stages.push(await measure(page, shape.name, 'force after organize', via));
  }
  return stages;
}

async function forceAndCheck(page: Page, owned: Owned, info: TestInfo, shapes: readonly LabelShape[]) {
  const stages: Stage[] = [];
  for (const shape of shapes) {
    if (!shape.edges.length) continue;
    const graphId = await owned.create(shape, 'unplaced');
    await openGraph(page, graphId, shape.items.length);
    const steps = await zoomToRead(page, shape.items.length);
    stages.push(await measure(page, shape.name, 'force settled', steps ? `zoomed in ${steps}×` : undefined));
    await evidence(info, `${slug(shape.name)}-force.png`, await page.screenshot(), 'image/png');
  }
  return stages;
}

const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

async function report(info: TestInfo, stages: Stage[]) {
  await evidence(info, 'label-stages.json', JSON.stringify(stages, null, 2), 'application/json');
  await evidence(info, 'label-summary.txt', summary(stages), 'text/plain');
  const failing = stages.filter(s => s.checked && (s.count > 0 || s.scale < LABEL_MIN_ZOOM));
  expect(failing.map(s => `${s.graph} / ${s.stage}: ${s.count} problems at zoom ${s.scale}\n  ${Object.entries(s.problems).filter(([, list]) => list.length).map(([kind, list]) => `${kind}: ${list.slice(0, 6).join('; ')}`).join('\n  ')}`),
    `labels are not all readable:\n${summary(stages)}`).toEqual([]);
}

test.beforeEach(async ({ page }) => {
  await login(page, TEST_USERS.ADMIN);
  await waitForStarterGraph(page);
});

test('JOURNEY organize-labels: the example graphs keep every relationship label readable', async ({ page, owned }, info) => {
  test.setTimeout(240_000);
  await report(info, await organizeAndCheck(page, owned, info, EXAMPLE_SHAPES));
});

test('JOURNEY organize-labels: hubs, chains, dense clusters and long labels keep every label readable', async ({ page, owned }, info) => {
  test.setTimeout(300_000);
  await report(info, await organizeAndCheck(page, owned, info, HARD_SHAPES));
});

test('JOURNEY organize-labels: the force layout settles with every label readable', async ({ page, owned }, info) => {
  test.setTimeout(300_000);
  await report(info, await forceAndCheck(page, owned, info, [...EXAMPLE_SHAPES, ...HARD_SHAPES]));
});
