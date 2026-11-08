import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { UI_FIT_FIXTURE } from '../lib/ui-fit/devices.mjs';

// Every screen the device matrix checks. Each entry opens one state of the UI;
// the spec then measures every visible control on it. Add new screens and
// dialogs here so they are checked on every device.
export interface UiFitScreen {
  id: string;
  /** Checked before signing in. */
  signedOut?: boolean;
  open(page: Page): Promise<void>;
}

async function settle(page: Page, ms: number) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(ms);
}

const VIEWS = ['graph', 'dashboard', 'table', 'cards', 'kanban', 'gantt', 'calendar', 'activity'] as const;
const PAGES = ['settings', 'agents', 'analytics', 'ontology', 'admin', 'backend'] as const;

/** The connected graph ui-fit.setup.ts creates (the user's own starter graph has none). */
const connectedGraph = () => (JSON.parse(readFileSync(UI_FIT_FIXTURE, 'utf8')) as { graphId: string }).graphId;

async function openView(page: Page, mode: (typeof VIEWS)[number], graphId?: string) {
  await page.addInitScript(m => localStorage.setItem('graphdone:viewMode', m), mode);
  if (graphId) await page.addInitScript(id => localStorage.setItem('currentGraphId', id), graphId);
  await page.goto('/');
  await expect(page.locator('main').first()).toBeVisible({ timeout: 30_000 });
  if (mode === 'graph') await expect(page.locator('.graph-container svg g.node').first()).toBeVisible({ timeout: 30_000 });
  await settle(page, mode === 'graph' ? 3500 : 2000);
}

/**
 * Zoom the graph so the first card is shown in full (with its header buttons),
 * as a user would before tapping them. Phones open the graph zoomed out, where
 * cards are compact and the header buttons are hidden.
 */
async function zoomToFirstCard(page: Page) {
  await page.evaluate(() => {
    const node = document.querySelector('.graph-container svg g.node') as (Element & { __data__?: { x: number; y: number } }) | null;
    const zoom = (window as unknown as { miniMapZoom?: (x: number, y: number, k: number) => void }).miniMapZoom;
    if (node?.__data__ && zoom) zoom(node.__data__.x, node.__data__.y, 1.25);
  });
  await expect(page.locator('.graph-container svg g.node .node-relationship-icon').first()).toBeVisible();
  await settle(page, 1200);
}

/** Activate a graph card header control with the keyboard (they are buttons). */
async function useCardControl(page: Page, selector: string, graphId?: string) {
  await openView(page, 'graph', graphId);
  await zoomToFirstCard(page);
  const control = page.locator(`.graph-container svg g.node ${selector}`).first();
  await control.focus();
  await control.press('Enter');
}

/**
 * Open the connected fixture graph zoomed to a connection. The graph labels
 * only the connections its "Links" level shows (the rest are display:none once
 * the layout settles): zoom to a shown label, or, where none is shown
 * (phones), to the first connection's midpoint. Returns whether a label shows.
 */
async function openConnections(page: Page): Promise<boolean> {
  await openView(page, 'graph', connectedGraph());
  await expect(page.locator('.graph-container svg .edge-clickable').first()).toBeAttached({ timeout: 30_000 });
  await settle(page, 1500);
  const target = await page.evaluate(() => {
    const label = document.querySelector('.graph-container svg .edge-label-group:not([style*="display: none"])');
    const match = label?.getAttribute('transform')?.match(/translate\(\s*([-\d.e]+)[\s,]+([-\d.e]+)/);
    if (match) return { x: Number(match[1]), y: Number(match[2]), label: true };
    const edge = (document.querySelector('.graph-container svg .edge-clickable') as (Element & { __data__?: { source: { x: number; y: number }; target: { x: number; y: number } } }) | null)?.__data__;
    return edge ? { x: (edge.source.x + edge.target.x) / 2, y: (edge.source.y + edge.target.y) / 2, label: false } : null;
  });
  expect(target, 'the fixture graph has connections').not.toBeNull();
  await page.evaluate(({ x, y }) => {
    (window as unknown as { miniMapZoom?: (x: number, y: number, k: number) => void }).miniMapZoom?.(x, y, 1.1);
  }, target!);
  if (target!.label) await expect(page.locator('.graph-container svg .edge-label-group:not([style*="display: none"])').first()).toBeVisible();
  await settle(page, 1200);
  return target!.label;
}

export const UI_FIT_SCREENS: UiFitScreen[] = [
  {
    id: 'sign-in',
    signedOut: true,
    async open(page) {
      await page.goto('/');
      await expect(page.getByRole('button', { name: /Continue as Guest/i }).first()).toBeVisible({ timeout: 30_000 });
      await settle(page, 1500);
    },
  },
  ...VIEWS.map(mode => ({ id: `view-${mode}`, open: (page: Page) => openView(page, mode) })),
  ...PAGES.map(name => ({
    id: `page-${name}`,
    async open(page: Page) {
      await page.goto(`/${name}`);
      await expect(page.locator('main').first()).toBeVisible({ timeout: 30_000 });
      await settle(page, 2000);
    },
  })),
  {
    // Connections and their labels are click targets too (they open the
    // connection editor), so check them where they are readable.
    id: 'graph-connections',
    open: async page => { await openConnections(page); },
  },
  {
    // The connection editor, opened from the keyboard on a connection label
    // (or from "Browse" where the device shows no labels).
    id: 'graph-connection-edit',
    async open(page) {
      if (await openConnections(page)) {
        const label = page.locator('.graph-container svg .edge-label-group:not([style*="display: none"])').first();
        await label.focus();
        await label.press('Enter');
      } else {
        await page.getByRole('button', { name: /Browse all relationships/ }).click();
        await page.getByRole('button', { name: /^Edit/ }).first().click();
      }
      await expect(page.getByRole('dialog', { name: 'Edit relationship' })).toBeVisible();
      await settle(page, 800);
    },
  },
  {
    id: 'graph-card',
    async open(page) {
      await openView(page, 'graph');
      await zoomToFirstCard(page);
    },
  },
  {
    // Tapping (or clicking) a card selects it and previews it: a peek sheet on
    // a phone, the docked inspector elsewhere. Editing is one more tap.
    id: 'graph-card-peek',
    async open(page) {
      // On the connected graph, so the bottom bar's connections button is there too.
      await openView(page, 'graph', connectedGraph());
      // A card wholly on screen (phones open zoomed in, so some are off it).
      const index = await page.locator('.graph-container svg g.node .node-bg').evaluateAll(cards => cards.findIndex(card => {
        const r = card.getBoundingClientRect();
        return r.width > 0 && r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight;
      }));
      expect(index, 'a card is on screen').toBeGreaterThanOrEqual(0);
      const card = page.locator('.graph-container svg g.node .node-bg').nth(index);
      if ((test.info().project.metadata.device as { touch?: boolean }).touch) await card.tap();
      else await card.click();
      await expect(page.getByTestId('node-inspector')).toBeVisible();
      await settle(page, 800);
    },
  },
  {
    // Phones keep "which connections to draw" and Organize in a View sheet;
    // larger screens show those controls on the canvas (graph-connections).
    id: 'graph-view-options',
    async open(page) {
      await openConnections(page);
      const view = page.getByRole('button', { name: 'View options', exact: true });
      if (await view.isVisible()) {
        await view.click();
        await expect(page.getByTestId('graph-view-sheet')).toBeVisible();
        await settle(page, 800);
      }
    },
  },
  {
    id: 'graph-grow',
    async open(page) {
      await useCardControl(page, '.node-relationship-icon', connectedGraph());
      await expect(page.getByText(/Click empty space to grow|Tap empty space for a new item/i)).toBeVisible();
      await settle(page, 800);
    },
  },
  {
    id: 'graph-quick-edit',
    async open(page) {
      await useCardControl(page, '.node-edit-icon');
      await expect(page.getByTestId('quick-edit-surface')).toBeVisible();
      await settle(page, 800);
    },
  },
  {
    id: 'graph-expand',
    async open(page) {
      await useCardControl(page, '.node-expand-icon');
      await expect(page.locator('[id^="node-expand-panel-"]').first()).toBeVisible();
      await settle(page, 800);
    },
  },
  {
    id: 'create-item',
    async open(page) {
      await openView(page, 'cards');
      await page.locator('[aria-label="New work item"]:visible').first().click();
      await expect(page.getByRole('dialog').first()).toBeVisible();
      await settle(page, 800);
    },
  },
];
