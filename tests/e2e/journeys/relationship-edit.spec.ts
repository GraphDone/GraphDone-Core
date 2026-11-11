import { test, expect, Page } from '@playwright/test';
import { backend, createItem, enterWorkspace, Item, linked, openGraphView, SetupError, storedEdges, StoredEdge } from '../../lib/journeys/workspace';
import { LINK_PATHS } from '../../lib/journeys/linkPaths';
import { drawnRelationship, editorOf, expectEditor, expectListed, openEditor, press, watchProblems } from '../../lib/journeys/relationshipEditor';
import { RELATIONSHIP_OPTIONS } from '../../../packages/web/src/constants/workItemConstants';

/**
 * BASIC JOURNEY — edit a relationship (#262). Each path starts from the real
 * landing page in a fresh browser, makes two items, connects them with the
 * inspector's Connect, and opens the relationship editor the way this device's
 * person reaches it (the connection's label or wire on desktop and iPad,
 * "Browse all relationships" on a phone). After every change it checks three
 * things a person relies on: the editor (still "Edit relationship", the
 * direction line, the pressed type), the saved data (exactly one relationship
 * between the pair, with the expected direction, type and weight) and the
 * canvas (one wire, its colour, label text and icon for the type, the arrow at
 * the target), plus the relationship list's entry. Run with --repeat-each=N for
 * a success rate per path and device.
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
async function expectDrawn(page: Page, t: Trial, want: Want, step: string, timeout = 10000) {
  const expected = typeInfo(want.type);
  await expect.poll(async () => drawnRelationship(page, t.a.id, t.b.id, want.type), {
    message: `${step}: the canvas must draw exactly one ${expected.label} wire ${want.source.title} → ${want.target.title} in ${expected.color}, with its label, icon and arrow`,
    timeout,
  }).toEqual({
    wires: 1, arrows: 1, labels: 1, hitAreas: 1,
    source: want.source.id, target: want.target.id,
    stroke: expected.color, arrowFill: expected.color, arrowAt: 'target',
    labelText: expected.label, labelIcon: 'matches the type',
  });
}

async function expectAll(page: Page, t: Trial, want: Want, step: string) {
  await expectEditor(page, want.source.title, want.target.title, typeInfo(want.type).label, step);
  const saved = await expectSaved(page, t, want, step);
  await expectDrawn(page, t, want, step);
  await expectListed(page, saved.id, want.source.title, want.target.title, want.type, step);
  return saved;
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
  await expectEditor(page, t.from.title, t.to.title, typeInfo(t.edge.type).label, 'opened');
  const walk = [...TYPES.map(x => x.type).filter(type => type !== t.edge.type), t.edge.type];
  for (const type of walk) {
    await press(page, editorOf(page).getByRole('button', { name: typeInfo(type).label, exact: true }));
    await expectAll(page, t, { source: t.from, target: t.to, type, weight: t.edge.weight }, `changed to ${type}`);
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
  await press(page, editorOf(page).getByRole('button', { name: typeInfo(type).label, exact: true }));
  await expectAll(page, t, { source: t.from, target: t.to, type, weight }, 'type changed');
  await press(page, editorOf(page).getByRole('button', { name: 'Flip Direction', exact: true }));
  await expectAll(page, t, { source: t.to, target: t.from, type, weight }, 'flipped');
  await press(page, editorOf(page).getByRole('button', { name: 'Flip Direction', exact: true }));
  await expectAll(page, t, { source: t.from, target: t.to, type, weight }, 'flipped back');
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
  await expectEditor(page, want.source.title, want.target.title, typeInfo(want.type).label, 'flipped');
  await expectSaved(page, t, want, 'flipped');
  await page.reload();
  await openGraphView(page);
  const saved = await expectSaved(page, t, want, 'after reload');
  await expectDrawn(page, t, want, 'after reload', 15000);
  opened.push(await openEditor(page, saved.id));
  await expectAll(page, t, want, 'after reload');
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
  await expect(page.getByRole('dialog', { name: 'Create relationship', exact: true }), 'delete must not leave a "Create relationship" window').toHaveCount(0);
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
  await expectDrawn(other, t, { source: t.from, target: t.to, type: t.edge.type, weight: t.edge.weight }, 'second tab before', 20000);
  const want = { source: t.to, target: t.from, type: t.edge.type === 'CONFLICTS_WITH' ? 'FOLLOWS' : 'CONFLICTS_WITH', weight: t.edge.weight };
  await page.bringToFront();
  await openEditor(page, t.edge.id);
  await press(page, editorOf(page).getByRole('button', { name: typeInfo(want.type).label, exact: true }));
  await expectSaved(page, t, { ...want, source: t.from, target: t.to }, 'type changed');
  await press(page, editorOf(page).getByRole('button', { name: 'Flip Direction', exact: true }));
  await expectSaved(page, t, want, 'flipped');
  await other.bringToFront();
  const started = Date.now();
  // The graph refetches every minute while visible; allow one full cycle.
  await expectDrawn(other, t, want, 'second tab after its refetch', 75000);
  info.annotations.push({ type: 'second-tab-ms', description: String(Date.now() - started) });
  expectNoProblems([...problems, ...otherWatch.problems], [...toasts, ...otherWatch.toasts]);
});
