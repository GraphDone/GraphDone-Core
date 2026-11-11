import { expect, Page } from '@playwright/test';
import { login, TEST_USERS } from '../auth';
import { gql } from '../graphRequest';

/**
 * Basic-journey workspace: one way to enter the app, make items and read the
 * saved truth, whichever backend serves it. Journeys never seed through an API:
 * they start where a real person starts and use the same controls.
 *
 *   JOURNEY_BACKEND=selfhost      sign in as the admin test user, new graph (default;
 *                                 phones, which cannot create a graph, get it from the API)
 *   JOURNEY_BACKEND=hosted-guest  "Continue as Guest" on the hosted build; work is
 *                                 saved in the browser's local workspace
 */
export type Backend = 'selfhost' | 'hosted-guest';
export const backend = (process.env.JOURNEY_BACKEND || 'selfhost') as Backend;

export type StoredEdge = { id: string; source: string; target: string; type: string; weight: number };
export type Item = { id: string; title: string };

/** Failures before the journey's own action are setup failures; reports keep them apart. */
export class SetupError extends Error {
  constructor(message: string) { super(`SETUP: ${message}`); }
}

export async function enterWorkspace(page: Page): Promise<{ graphId?: string }> {
  await page.goto('/');
  if (backend === 'hosted-guest') {
    await page.getByRole('button', { name: /Continue as Guest/i }).first().click();
    await page.getByRole('dialog').getByRole('button', { name: /Continue as Guest/i }).click();
    await openGraphView(page);
    return {};
  }
  await login(page, TEST_USERS.ADMIN);
  await page.locator('[data-testid="graph-selector"]:visible, [data-testid="graph-selector-mobile"]:visible').first().click();
  await page.getByRole('button', { name: 'Create New Graph', exact: true }).click();
  const create = page.getByRole('dialog', { name: 'Create new graph' });
  await create.getByRole('button', { name: 'Continue', exact: true }).click();
  await create.getByPlaceholder('Enter a descriptive name for your graph').fill(`Journey ${Date.now()}`);
  const created = page.waitForResponse(r => r.url().includes('graphql') && !!r.request().postData()?.includes('mutation CreateGraph('));
  await create.getByRole('button', { name: 'Create Graph', exact: true }).click();
  const graphId = (await (await created).json()).data.createGraphs.graphs[0].id;
  await openGraphView(page);
  return { graphId };
}

/** Phones open on the List view; a person taps "Graph" in the bottom bar. */
export async function openGraphView(page: Page) {
  const graph = page.locator('.graph-container');
  const nav = page.getByTestId('mobile-bottom-nav');
  await graph.or(nav).first().waitFor({ timeout: 20000 });
  if (!(await graph.isVisible()) && (await nav.isVisible())) {
    await nav.getByRole('button', { name: 'Graph', exact: true }).click();
  }
  await expect(graph).toBeVisible({ timeout: 20000 });
}

/** Create an item with the toolbar's "New work item" control, as a person would. */
export async function createItem(page: Page, title: string): Promise<Item> {
  const inline = page.getByTestId('inline-rename');
  const modal = page.getByPlaceholder('Enter a descriptive title for your work item');
  // Exact: the Welcome graph has a card titled "Create your first work item" too.
  const first = page.getByRole('button', { name: 'Create Your First Work Item', exact: true });
  // The empty-graph button can vanish between seeing and clicking it (the
  // Welcome items arrive); then the toolbar's "New work item" is the way.
  const usedFirst = await first.isVisible().catch(() => false) && await first.click({ timeout: 3000 }).then(() => true, () => false);
  if (!usedFirst) await page.locator('button[aria-label="New work item"]:visible').first().click();
  const opened = await inline.or(modal).first().waitFor({ timeout: 8000 }).then(() => true, () => false);
  if (!opened) throw new SetupError('"New work item" did not open a title field within 8 s');
  if (await inline.isVisible().catch(() => false)) { await inline.fill(title); await inline.press('Enter'); }
  else { await modal.fill(title); await page.getByRole('button', { name: 'Create Work Item', exact: true }).click(); }
  // Let the naming field or form close before the next action (journeys measure
  // one thing at a time; the create journey measures acting while it closes).
  await expect(inline).toBeHidden({ timeout: 8000 }).catch(() => { throw new SetupError('the naming field did not close'); });
  await expect(modal).toBeHidden({ timeout: 8000 }).catch(() => { throw new SetupError('the new-item form did not close'); });
  for (const deadline = Date.now() + 10000; Date.now() < deadline; await page.waitForTimeout(250)) {
    const id = await nodeId(page, title);
    if (id) return { id, title };
  }
  throw new SetupError(`"${title}" was not drawn within 10 s of creating it`);
}

export function nodeId(page: Page, title: string): Promise<string | undefined> {
  return page.evaluate(t => (Array.from(document.querySelectorAll('.graph-container g.node')) as any[])
    .find(e => e.__data__?.title === t)?.__data__?.id, title);
}

/** Saved connections, read from where this backend keeps them. */
export async function storedEdges(page: Page, graphId?: string): Promise<StoredEdge[]> {
  if (backend === 'hosted-guest') {
    return page.evaluate(() => new Promise<StoredEdge[]>((resolve, reject) => {
      const open = indexedDB.open('graphdone-offline', 1);
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const all = open.result.transaction('accounts').objectStore('accounts').getAll();
        all.onsuccess = () => resolve(all.result.flatMap((a: any) => Object.values(a.projects || {})
          .flatMap((p: any) => (p.local?.edges || []).map((e: any) => ({ id: e.id, source: e.source_id, target: e.target_id, type: e.type, weight: e.weight })))));
      };
    }));
  }
  const data = await gql(page, 'query($id:ID!){edges(where:{source:{graph:{id:$id}}}){id type weight source{id} target{id}}}', { id: graphId });
  return data.edges.map((e: any) => ({ id: e.id, source: e.source.id, target: e.target.id, type: e.type, weight: e.weight }));
}

/** Connections the canvas actually draws, by endpoint id. */
export function drawnEdges(page: Page): Promise<{ source: string; target: string }[]> {
  return page.evaluate(() => (Array.from(document.querySelectorAll('.graph-container svg .edge')) as any[])
    .filter(e => getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().width + e.getBoundingClientRect().height > 0)
    .map(e => ({ source: e.__data__?.source?.id ?? e.__data__?.source, target: e.__data__?.target?.id ?? e.__data__?.target })));
}

export const linked = (edges: { source: string; target: string }[], a: string, b: string) =>
  edges.some(e => (e.source === a && e.target === b) || (e.source === b && e.target === a));

/** The on-screen box of an item's card (the visible layer only). */
export async function cardBox(page: Page, id: string) {
  return page.evaluate(nodeId => {
    for (const e of Array.from(document.querySelectorAll('.graph-container g.node')) as any[]) {
      if (e.__data__?.id !== nodeId) continue;
      const r = (e.querySelector('.node-bg') || e).getBoundingClientRect();
      if (r.width > 0) return { x: r.x, y: r.y, width: r.width, height: r.height, cx: r.x + r.width / 2, cy: r.y + r.height / 2 };
    }
    return null;
  }, id);
}

/** True when the point is on screen and the card itself receives a click there. */
export async function clickable(page: Page, id: string, x: number, y: number) {
  return page.evaluate(({ id, x, y }) => {
    const hit = document.elementFromPoint(x, y) as any;
    return !!hit?.closest?.('g.node') && hit.closest('g.node').__data__?.id === id;
  }, { id, x, y });
}
