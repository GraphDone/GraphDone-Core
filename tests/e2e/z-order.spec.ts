import { test, expect, Page } from '@playwright/test';
import { login, TEST_USERS, getBaseURL } from '../helpers/auth';
import { auditOnTop } from '../helpers/zorder';
import { auditDialog } from '../helpers/mobileAudit';

/**
 * Z-order / stacking gate. Opens every floating overlay in the app (dropdowns,
 * modals, menus, the on-canvas expand peek, the mobile sheet, toasts, and the
 * dropdowns nested INSIDE modals) and asserts each is ACTUALLY the topmost
 * element — `document.elementFromPoint` inside it must return the overlay, not
 * something painted over it. This catches the exact bug class the user reports:
 * a dropdown / modal / alert appearing behind the nav, a panel, or each other,
 * usually because an ancestor (backdrop-blur / transform / opacity) silently
 * traps the overlay's z-index in a local stacking context.
 */

async function signIn(page: Page) {
  await login(page, TEST_USERS.ADMIN);
}

async function openWorkspace(page: Page, viewMode = 'cards') {
  await signIn(page);
  await page.addInitScript((m) => localStorage.setItem('graphdone:viewMode', m), viewMode);
  await page.goto(`${getBaseURL()}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(viewMode === 'graph' ? 4500 : 3000);
}

async function openPage(page: Page, path: string, settleMs = 2500) {
  await signIn(page);
  await page.goto(`${getBaseURL()}${path}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(settleMs);
}

function fmt(coveredBy: any[] | undefined) {
  return (coveredBy || []).map((c) => `${c.tag}.${c.cls}@${c.x},${c.y}`).join(' | ');
}

/**
 * A selector can match several elements (the same control is rendered in the
 * desktop header, the sidebar, AND the mobile bar), and a matched element can be
 * `isVisible()` yet sit OUTSIDE the viewport (an off-canvas sidebar). Return the
 * first match that is genuinely on-screen and clickable, or null — callers skip
 * when null rather than failing on a trigger that isn't part of this chrome.
 */
async function firstInViewport(page: Page, selector: string) {
  const loc = page.locator(selector);
  const vp = page.viewportSize();
  if (!vp) return null;
  const n = await loc.count();
  for (let i = 0; i < n; i++) {
    const el = loc.nth(i);
    if (!(await el.isVisible().catch(() => false))) continue;
    const box = await el.boundingBox().catch(() => null);
    if (box && box.x >= 0 && box.y >= 0 && box.x + box.width <= vp.width + 1 && box.y + box.height <= vp.height + 1) return el;
  }
  return null;
}

/** Assert the overlay PANEL at `selector` is the topmost element across its area. */
async function assertOnTop(page: Page, selector: string, label: string) {
  const r = await auditOnTop(page, selector);
  expect(r.found, `${label}: overlay present (${selector})`).toBe(true);
  expect(r.coveredBy, `${label} is covered by: ${fmt(r.coveredBy)}`).toEqual([]);
  return r;
}

/** Assert a full-screen dialog (matched by visible text) is the topmost layer. */
async function assertDialogOnTop(page: Page, text: string, label: string) {
  const d = await auditDialog(page, text);
  expect(d.found, `${label}: dialog present ("${text}")`).toBe(true);
  expect(d.coveredBy, `${label} is covered by: ${d.coveredBy}`).toBeNull();
  return d;
}

test.describe('z-order: overlays render on top @zorder', () => {
  test.describe.configure({ timeout: 90_000 });

  // ───────────────────────── Per-viewport overlays ─────────────────────────
  for (const vp of [{ name: 'desktop', width: 1440, height: 900 }, { name: 'phone', width: 390, height: 844 }]) {
    test.describe(`${vp.name}`, () => {
      test.use({ viewport: { width: vp.width, height: vp.height } });

      test('global: graph selector dropdown is on top', async ({ page }) => {
        await openWorkspace(page, 'cards');
        const trigger = await firstInViewport(page, '[data-testid="graph-selector"]');
        if (!trigger) test.skip(true, 'no on-screen graph selector in this chrome');
        await trigger!.click();
        await page.waitForTimeout(500);
        await assertOnTop(page, '[data-testid="graph-selector-dropdown"]', 'graph selector dropdown');
      });

      test('global: user menu dropdown is on top', async ({ page }) => {
        await openWorkspace(page, 'cards');
        // On phones the user menu lives in the off-canvas sidebar / More sheet, not the top chrome.
        const trigger = await firstInViewport(page, '[data-testid="user-menu"]');
        if (!trigger) test.skip(true, 'no on-screen user menu in this chrome');
        await trigger!.click();
        await page.waitForTimeout(500);
        await assertOnTop(page, '[data-testid="user-menu-dropdown"]', 'user menu dropdown');
      });

      test('workspace: every filter dropdown is on top', async ({ page }) => {
        await openWorkspace(page, 'cards');
        const filters = ['All Types', 'All Statuses', 'All Priorities', 'All Contributors'];
        let tested = 0;
        for (const label of filters) {
          const btn = page.locator(`button:has-text("${label}")`).first();
          if (!(await btn.isVisible().catch(() => false))) continue;
          await btn.click();
          await page.waitForTimeout(400);
          await assertOnTop(page, '.absolute.top-full.z-50', `filter "${label}" dropdown`);
          await btn.click().catch(() => {}); // toggle closed before the next one
          await page.waitForTimeout(200);
          tested++;
        }
        if (tested === 0) test.skip(true, 'no filter bar in this view/viewport');
      });

      test('workspace: work-item details modal is on top', async ({ page }) => {
        await openWorkspace(page, 'cards');
        await page.locator('[data-testid="view-content"] .grid > div').first().click().catch(() => {});
        await page.waitForTimeout(1200);
        const d = await auditDialog(page, 'Work Item Details');
        if (!d.found) test.skip(true, 'details modal did not open');
        expect(d.coveredBy, 'details modal is on top').toBeNull();
      });

      test('create-work-item modal is on top', async ({ page }) => {
        await openWorkspace(page, 'cards');
        const fab = page.locator('[aria-label="New work item"]');
        if (!(await fab.isVisible().catch(() => false))) test.skip(true, 'no create FAB (guest/role/viewport)');
        await fab.click();
        await page.waitForTimeout(1000);
        await assertDialogOnTop(page, 'Create New Work Item', 'create modal');
      });

      test('alert/toast renders above an open modal', async ({ page }) => {
        await openWorkspace(page, 'cards');
        // Open SOME modal (the create FAB on phone, else a details modal via a card).
        const fab = page.locator('[aria-label="New work item"]');
        if (await fab.isVisible().catch(() => false)) {
          await fab.click();
        } else {
          await page.locator('[data-testid="view-content"] .grid > div').first().click().catch(() => {});
        }
        await page.waitForTimeout(1000);
        const modalOpen = await auditOnTop(page, '.fixed.inset-0');
        if (!modalOpen.found) test.skip(true, 'could not open a modal to test against');
        // Fire a toast WHILE the modal is open — it must appear above the modal.
        await page.evaluate(() => (window as any).__notify?.('error', 'Connection lost', 'Retrying…'));
        await page.waitForTimeout(500);
        await assertOnTop(page, '[data-testid="toast-stack"]', 'toast (over modal)');
      });
    });
  }

  // ───────────────── Dropdowns nested inside a modal (desktop) ─────────────────
  // The highest-risk class: a dropdown at z-[99999] living inside a modal whose
  // backdrop-blur establishes a stacking context — its z-index is local, so it
  // can render behind the modal's own content if the layering is wrong.
  test.describe('modal-internal dropdowns', () => {
    test.use({ viewport: { width: 1440, height: 900 } });

    test('details modal Type + Status dropdowns are on top', async ({ page }) => {
      await openWorkspace(page, 'cards');
      await page.locator('[data-testid="view-content"] .grid > div').first().click().catch(() => {});
      await page.waitForTimeout(1200);
      const typeBadge = page.locator('[data-testid="details-type-badge"]');
      if (!(await typeBadge.isVisible().catch(() => false))) test.skip(true, 'details modal did not open');

      await typeBadge.click();
      await page.waitForTimeout(400);
      await assertOnTop(page, '[data-testid="details-type-dropdown"]', 'details Type dropdown');
      await typeBadge.click().catch(() => {}); // close
      await page.waitForTimeout(200);

      const statusBadge = page.locator('[data-testid="details-status-badge"]');
      await statusBadge.click();
      await page.waitForTimeout(400);
      await assertOnTop(page, '[data-testid="details-status-dropdown"]', 'details Status dropdown');
    });
  });

  // ───────────────────────── Desktop graph overlays ─────────────────────────
  test.describe('desktop graph overlays', () => {
    test.use({ viewport: { width: 1440, height: 900 } });

    test('node expand-in-place peek is on top', async ({ page }) => {
      await openWorkspace(page, 'graph');
      const opened = await page.evaluate(() => {
        const icon = document.querySelector('.graph-container svg .node .node-expand-icon');
        if (!icon) return false;
        icon.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
        return true;
      });
      if (!opened) test.skip(true, 'no expand icon (no nodes)');
      await page.waitForTimeout(1200);
      await assertOnTop(page, '[data-testid="node-expand-panel"]', 'expand panel');
    });

    test('node context menu (right-click) is on top', async ({ page }) => {
      await openWorkspace(page, 'graph');
      // Fire a native contextmenu on a node (the D3-bound handler reads clientX/Y).
      const opened = await page.evaluate(() => {
        const node = document.querySelector('.graph-container svg .node') as SVGGElement | null;
        if (!node) return false;
        const r = node.getBoundingClientRect();
        node.dispatchEvent(new MouseEvent('contextmenu', {
          bubbles: true, cancelable: true, view: window,
          clientX: r.left + r.width / 2, clientY: r.top + r.height / 2,
        }));
        return true;
      });
      if (!opened) test.skip(true, 'no nodes to right-click');
      await page.waitForTimeout(800);
      const menu = page.locator('[data-testid="node-context-menu"]');
      if (!(await menu.isVisible().catch(() => false))) test.skip(true, 'context menu did not open');
      await assertOnTop(page, '[data-testid="node-context-menu"]', 'node context menu');
    });
  });

  // ───────────────────────── Workspace modals (desktop) ─────────────────────────
  test.describe('workspace modals (desktop)', () => {
    test.use({ viewport: { width: 1440, height: 900 } });

    test('create-graph modal is on top', async ({ page }) => {
      await openWorkspace(page, 'cards');
      const trigger = await firstInViewport(page, '[data-testid="graph-selector"]');
      if (!trigger) test.skip(true, 'no on-screen graph selector');
      await trigger!.click();
      await page.waitForTimeout(500);
      const create = page.locator('[title="Create New Graph"]').first();
      if (!(await create.isVisible().catch(() => false))) test.skip(true, 'no create-graph affordance');
      await create.click();
      await page.waitForTimeout(800);
      await assertDialogOnTop(page, 'Create New Graph', 'create-graph modal');
    });
  });

  // ───────────────────────── Other pages ─────────────────────────
  test.describe('other pages (desktop)', () => {
    test.use({ viewport: { width: 1440, height: 900 } });

    test('ontology: type-detail modal is on top', async ({ page }) => {
      await openPage(page, '/ontology');
      const view = page.locator('button[title="View Details"]').first();
      if (!(await view.isVisible().catch(() => false))) test.skip(true, 'ontology has no type cards');
      await view.click();
      await page.waitForTimeout(700);
      const modal = page.locator('[data-testid="ontology-type-modal"]');
      if (!(await modal.isVisible().catch(() => false))) test.skip(true, 'type-detail modal did not open');
      await assertOnTop(page, '[data-testid="ontology-type-modal"]', 'ontology type modal');
    });

    test('settings: visual-quality dropdown is on top', async ({ page }) => {
      await openPage(page, '/settings');
      const trigger = page.locator('[data-testid="settings-quality-dropdown"] button').first();
      if (!(await trigger.isVisible().catch(() => false))) test.skip(true, 'no quality dropdown');
      await trigger.click();
      await page.waitForTimeout(400);
      await assertOnTop(page, '[data-testid="custom-dropdown-menu"]', 'settings quality dropdown');
    });

    test('admin: create-user modal is on top', async ({ page }) => {
      await openPage(page, '/admin');
      const btn = page.locator('button:has-text("Create User")').first();
      if (!(await btn.isVisible().catch(() => false))) test.skip(true, 'admin page unavailable for this user');
      await btn.click();
      await page.waitForTimeout(600);
      const modal = page.locator('[data-testid="admin-create-user-modal"]');
      if (!(await modal.isVisible().catch(() => false))) test.skip(true, 'create-user modal did not open');
      await assertOnTop(page, '[data-testid="admin-create-user-modal"]', 'admin create-user modal');
    });
  });

  // ───────────────────────── Mobile chrome ─────────────────────────
  test.describe('phone chrome', () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test('More sheet is on top (above the bottom nav)', async ({ page }) => {
      await openWorkspace(page, 'cards');
      const more = page.locator('[data-testid="mobile-bottom-nav"] button:has-text("More")');
      if (!(await more.isVisible().catch(() => false))) test.skip(true, 'no bottom nav');
      await more.click();
      await page.waitForTimeout(600);
      await assertOnTop(page, '[data-testid="mobile-more-sheet"]', 'mobile More sheet');
    });
  });
});
