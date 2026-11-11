import { test, expect, Page } from '@playwright/test';
import { isDeepStrictEqual } from 'node:util';
import { backend, createItem, enterWorkspace, Item, linked, openGraphView, SetupError, storedEdges, StoredEdge } from '../../lib/journeys/workspace';
import { LINK_PATHS } from '../../lib/journeys/linkPaths';
import { closeEditor, drawnRelationship, editorOf, editorShows, expectListed, openEditor, press, showPair, watchProblems } from '../../lib/journeys/relationshipEditor';
import { RELATIONSHIP_OPTIONS } from '../../../packages/web/src/constants/workItemConstants';

/**
 * BASIC JOURNEY — edit a relationship (#262). Each path starts from the real
 * landing page in a fresh browser, makes two items, connects them with the
 * inspector's Connect, and opens the relationship editor the way this device's
 * person reaches it (the connection's label or wire on desktop and iPad,
 * "Browse all relationships" on a phone). After every change it checks, with
 * the editor still open, the saved data (exactly one relationship between the
 * pair, with the expected direction, type and weight), the editor (still "Edit
 * relationship", the direction line, the pressed type) and the canvas (one
 * wire, its colour, label text and icon for the type, the arrow at the
 * target); then it closes the editor, zooms in if the arrow is not drawn at
 * this zoom, and checks that a person sees the wire in the type's colour and
 * the arrow at the target; then the relationship list's entry. Everything a
 * step shows is compared at once, so a failure lists all that is wrong. Run
 * with --repeat-each=N for a success rate per path and device.
 */
const TYPES = RELATIONSHIP_OPTIONS.map(o => ({ type: o.type as string, label: o.label, color: o.hexColor }));
const typeInfo = (type: string) => {
  const found = TYPES.find(t => t.type === type);
  if (!found) throw new Error(`unknown relationship type ${type}`);
  return found;
};

type Want = { source: Item; target: Item; type: string; weight: number };
type Trial = { graphId?: string; a: Item; b: Item; edge: StoredEdge; from: Item; to: Item };

async function setup(page: Page, run: string): Promise<Trial> {
  const { graphId } = await enterWorkspace(page);
  const a = await createItem(page, `Plan ${run}`);
  const b = await createItem(page, `Do ${run}`);
  try {
    await LINK_PATHS.find(p => p.id === 'inspector-connect')!.run(page, a, b);
    await expect.poll(async () => (await storedEdges(page, graphId)).filter(e => linked([e], a.id, b.id)).length, { timeout: 20000 }).toBe(1);
  } catch (error) {
    throw new SetupError(`connecting the two items failed: ${(error as Error).message.split('\n')[0]}`);
  }
  const edge = (await storedEdges(page, graphId)).find(e => linked([e], a.id, b.id))!;
  const [from, to] = edge.source === a.id ? [a, b] : [b, a];
  return { graphId, a, b, edge, from, to };
}

/** Exactly one saved relationship joins the pair, as wanted. */
async function expectSaved(page: Page, t: Trial, want: Want, step: string): Promise<StoredEdge> {
  let pair: StoredEdge[] = [];
  const expected = { source: want.source.id, target: want.target.id, type: want.type, weight: want.weight };
  await expect.poll(async () => {
    pair = (await storedEdges(page, t.graphId)).filter(e => linked([e], t.a.id, t.b.id));
    return pair.map(({ source, target, type, weight }) => ({ source, target, type, weight }));
  }, { message: `${step}: exactly one relationship must be saved between the pair, ${want.source.title} → ${want.target.title} ${want.type} weight ${want.weight}`, timeout: 15000 }).toEqual([expected]);
  return pair[0];
}

/** The canvas draws that one relationship: one wire, arrow and label, in the type's colour, label and icon, pointing at the target. */
const drawnAs = (want: Want) => {
  const expected = typeInfo(want.type);
  return {
    wires: 1, arrows: 1, labels: 1, hitAreas: 1,
    source: want.source.id, target: want.target.id,
    stroke: expected.color, arrowFill: expected.color, arrowAt: 'target',
    labelText: expected.label, labelIcon: 'matches the type',
  };
};
/** ...and a person sees the wire and the arrow. */
const seenAs = (want: Want) => ({ ...drawnAs(want), seen: { wire: true, arrow: true } });

/** Read until it is as wanted or the time is up; the caller compares the last reading. */
async function settle<T>(page: Page, read: () => Promise<T>, wanted: unknown, timeout: number): Promise<T> {
  const end = Date.now() + timeout;
  let last = await read();
  while (!isDeepStrictEqual(last, wanted) && Date.now() < end) {
    await page.waitForTimeout(250);
    last = await read();
  }
  return last;
}

/** With the editor closed: a person sees the wire in the type's colour and the arrow at the target (zooming in first if needed). */
async function expectSeen(page: Page, t: Trial, want: Want, step: string, timeout = 10000) {
  await showPair(page, t.a.id, t.b.id, want.type);
  const seen = await settle(page, () => drawnRelationship(page, t.a.id, t.b.id, want.type, { seen: true }), seenAs(want), timeout);
  expect(seen, `${step}: a person must see one ${typeInfo(want.type).label} wire ${want.source.title} → ${want.target.title} in ${typeInfo(want.type).color}, with its label, icon and arrow`).toEqual(seenAs(want));
}

/**
 * After a change: the saved data, the editor and the canvas while the editor
 * is open, then the canvas as a person sees it once the editor is closed,
 * compared in one go so a failure lists everything that is wrong; then the
 * relationship list, which reopens the editor.
 */
async function expectStep(page: Page, t: Trial, want: Want, step: string): Promise<StoredEdge> {
  const label = typeInfo(want.type).label;
  let pair: StoredEdge[] = [];
  const wantOpen = {
    saved: [{ source: want.source.id, target: want.target.id, type: want.type, weight: want.weight }],
    editor: { line: `Editing relationship: ${want.source.title} → ${want.target.title}`, pressed: [label], editWindows: 1 },
    canvas: drawnAs(want),
  };
  const open = await settle(page, async () => {
    pair = (await storedEdges(page, t.graphId)).filter(e => linked([e], t.a.id, t.b.id));
    return {
      saved: pair.map(({ source, target, type, weight }) => ({ source, target, type, weight })),
      editor: await editorShows(page),
      canvas: await drawnRelationship(page, t.a.id, t.b.id, want.type),
    };
  }, wantOpen, 15000);
  const wantClosed = { editWindows: 0, canvas: seenAs(want) };
  let closed: unknown = 'not checked: the editor was not open to close';
  if (open.editor.editWindows === 1) {
    await closeEditor(page, step);
    await showPair(page, t.a.id, t.b.id, want.type);
    closed = await settle(page, async () => {
      const { editWindows } = await editorShows(page);
      return { editWindows, canvas: await drawnRelationship(page, t.a.id, t.b.id, want.type, { seen: true }) };
    }, wantClosed, 10000);
  }
  expect({ open, closed }, `${step}: with the editor open, one ${want.type} relationship ${want.source.title} → ${want.target.title} weight ${want.weight} saved, the editor reading it with ${label} pressed, and the canvas drawing it; with the editor closed, a person seeing it`)
    .toEqual({ open: wantOpen, closed: wantClosed });
  await expectListed(page, pair[0].id, want.source.title, want.target.title, want.type, step);
  return pair[0];
}

/** Problems seen anywhere in the trial; checked at the end of every path. */
function expectNoProblems(problems: string[], toasts: string[]) {
  expect(toasts.filter(t => /fail/i.test(t)), 'no "Failed" toasts').toEqual([]);
  expect(problems, 'no page or GraphQL errors').toEqual([]);
}

const run = (index: number) => `${index}-${Date.now().toString(36)}`;

test('JOURNEY relationship-edit type: change through every type and back @journey', async ({ page }, info) => {
  test.setTimeout(300000);
  const { problems, toasts } = await watchProblems(page);
  const t = await setup(page, run(info.repeatEachIndex));
  const opened = [await openEditor(page, t.edge.id)];
  const walk = [...TYPES.map(x => x.type).filter(type => type !== t.edge.type), t.edge.type];
  for (const type of walk) {
    await press(page, editorOf(page).getByRole('button', { name: typeInfo(type).label, exact: true }));
    await expectStep(page, t, { source: t.from, target: t.to, type, weight: t.edge.weight }, `changed to ${type}`);
  }
  info.annotations.push({ type: 'journey', description: JSON.stringify({ backend, opened, steps: walk.length }) });
  expectNoProblems(problems, toasts);
});

test('JOURNEY relationship-edit flip: change type, flip, flip back @journey', async ({ page }, info) => {
  test.setTimeout(180000);
  const { problems, toasts } = await watchProblems(page);
  const t = await setup(page, run(info.repeatEachIndex));
  const type = t.edge.type === 'BLOCKS' ? 'ENABLES' : 'BLOCKS';
  const weight = t.edge.weight;
  const opened = [await openEditor(page, t.edge.id)];
  // Change the type, then flip at once, without reopening the editor: the flip
  // must keep the new type and the weight.
  await press(page, editorOf(page).getByRole('button', { name: typeInfo(type).label, exact: true }));
  await expectSaved(page, t, { source: t.from, target: t.to, type, weight }, 'type changed');
  await press(page, editorOf(page).getByRole('button', { name: 'Flip Direction', exact: true }));
  await expectStep(page, t, { source: t.to, target: t.from, type, weight }, 'flipped');
  await press(page, editorOf(page).getByRole('button', { name: 'Flip Direction', exact: true }));
  await expectStep(page, t, { source: t.from, target: t.to, type, weight }, 'flipped back');
  info.annotations.push({ type: 'journey', description: JSON.stringify({ backend, opened }) });
  expectNoProblems(problems, toasts);
});

test('JOURNEY relationship-edit reload: a changed, flipped relationship survives reload @journey', async ({ page }, info) => {
  test.setTimeout(180000);
  const { problems, toasts } = await watchProblems(page);
  const t = await setup(page, run(info.repeatEachIndex));
  const want = { source: t.to, target: t.from, type: t.edge.type === 'ENABLES' ? 'VALIDATES' : 'ENABLES', weight: t.edge.weight };
  const opened = [await openEditor(page, t.edge.id)];
  await press(page, editorOf(page).getByRole('button', { name: typeInfo(want.type).label, exact: true }));
  await expectSaved(page, t, { ...want, source: t.from, target: t.to }, 'type changed');
  await press(page, editorOf(page).getByRole('button', { name: 'Flip Direction', exact: true }));
  await expectStep(page, t, want, 'flipped');
  await page.reload();
  await openGraphView(page);
  const saved = await expectSaved(page, t, want, 'after reload');
  await expectSeen(page, t, want, 'after reload', 15000);
  opened.push(await openEditor(page, saved.id));
  await expectStep(page, t, want, 'after reload, reopened');
  info.annotations.push({ type: 'journey', description: JSON.stringify({ backend, opened }) });
  expectNoProblems(problems, toasts);
});

test('JOURNEY relationship-edit delete: delete removes it and closes the editor @journey', async ({ page }, info) => {
  test.setTimeout(150000);
  const { problems, toasts } = await watchProblems(page);
  const t = await setup(page, run(info.repeatEachIndex));
  const opened = [await openEditor(page, t.edge.id)];
  await press(page, editorOf(page).getByRole('button', { name: 'Delete Relationship', exact: true }));
  await expect(editorOf(page), 'delete must close the editor').toHaveCount(0);
  await expect.poll(async () => (await storedEdges(page, t.graphId)).filter(e => linked([e], t.a.id, t.b.id)).length,
    { message: 'delete must remove the saved relationship', timeout: 15000 }).toBe(0);
  await expect.poll(async () => (await drawnRelationship(page, t.a.id, t.b.id, t.edge.type)).wires,
    { message: 'delete must remove the drawn wire', timeout: 10000 }).toBe(0);
  const browse = page.getByRole('button', { name: /Browse all relationships$/ });
  if (await browse.isVisible()) {
    await press(page, browse);
    const list = page.getByRole('region', { name: 'Graph relationships' });
    await expect(list.locator(`li[data-lod-edge-id="${t.edge.id}"]`), 'the list must not show the deleted relationship').toHaveCount(0);
  }
  info.annotations.push({ type: 'journey', description: JSON.stringify({ backend, opened }) });
  expectNoProblems(problems, toasts);
});

test('JOURNEY relationship-edit second-tab: another tab shows the change after its refetch @journey', async ({ page, context }, info) => {
  test.skip(backend === 'hosted-guest', 'a guest\'s work lives in this browser; the second-tab refetch is from a self-hosted server');
  test.setTimeout(240000);
  const { problems, toasts } = await watchProblems(page);
  const t = await setup(page, run(info.repeatEachIndex));
  const other = await context.newPage();
  const otherWatch = await watchProblems(other);
  await other.goto('/');
  await openGraphView(other);
  await expectSeen(other, t, { source: t.from, target: t.to, type: t.edge.type, weight: t.edge.weight }, 'second tab before', 20000);
  const want = { source: t.to, target: t.from, type: t.edge.type === 'CONFLICTS_WITH' ? 'FOLLOWS' : 'CONFLICTS_WITH', weight: t.edge.weight };
  await page.bringToFront();
  await openEditor(page, t.edge.id);
  await press(page, editorOf(page).getByRole('button', { name: typeInfo(want.type).label, exact: true }));
  await expectSaved(page, t, { ...want, source: t.from, target: t.to }, 'type changed');
  await press(page, editorOf(page).getByRole('button', { name: 'Flip Direction', exact: true }));
  await expectSaved(page, t, want, 'flipped');
  await other.bringToFront();
  // A person coming back moves the pointer. The graph refetches every minute
  // while the tab is visible and in use (an idle tab skips the poll), so
  // allow one full cycle.
  const box = other.viewportSize() ?? { width: 800, height: 600 };
  await other.mouse.move(box.width / 2, box.height / 2);
  await other.mouse.move(box.width / 2 + 20, box.height / 2 + 20);
  const started = Date.now();
  await expectSeen(other, t, want, 'second tab after its refetch', 90000);
  info.annotations.push({ type: 'second-tab-ms', description: String(Date.now() - started) });
  expectNoProblems([...problems, ...otherWatch.problems], [...toasts, ...otherWatch.toasts]);
});
