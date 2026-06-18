import { test, expect, Page } from '@playwright/test';
import { login, TEST_USERS, getBaseURL } from '../lib/auth';

/**
 * Modal accessibility / keyboard-focus gate (@a11y). Asserts the contract added
 * by useModalA11y: a modal is exposed as role="dialog" aria-modal with an
 * accessible name, keyboard focus MOVES INTO it on open, Tab/Shift+Tab is
 * TRAPPED within it (never leaks to the page behind), and focus is RESTORED to
 * the trigger on close. These were entirely untested and mostly unimplemented;
 * a modal you can Tab out of (into the graph behind it) is real keyboard friction.
 */

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

async function openWorkspace(page: Page, viewMode = 'cards') {
  await login(page, TEST_USERS.ADMIN);
  await page.addInitScript((m) => localStorage.setItem('graphdone:viewMode', m), viewMode);
  await page.goto(`${getBaseURL()}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
}

const focusWithinDialog = (page: Page) =>
  page.evaluate(() => {
    const d = document.querySelector('[role="dialog"][aria-modal="true"]');
    return !!d && !!document.activeElement && d.contains(document.activeElement);
  });

async function focusEdge(page: Page, which: 'first' | 'last') {
  await page.evaluate(({ sel, which }) => {
    const d = document.querySelector('[role="dialog"][aria-modal="true"]');
    if (!d) return;
    const items = Array.from(d.querySelectorAll(sel)).filter(
      (e) => (e as HTMLElement).getClientRects().length > 0
    ) as HTMLElement[];
    (which === 'first' ? items[0] : items[items.length - 1])?.focus();
  }, { sel: FOCUSABLE, which });
}

/**
 * Prove the trap AT THE BOUNDARY: Tab from the last focusable must wrap back
 * inside the dialog, and Shift+Tab from the first must wrap to the last. This
 * is the case that fails without the trap — pressing Tab a fixed number of
 * times never reaches the edge on a modal with many focusables, so it would
 * pass even with the trap removed.
 */
async function tabStaysTrapped(page: Page): Promise<boolean> {
  await focusEdge(page, 'last');
  await page.keyboard.press('Tab');
  if (!(await focusWithinDialog(page))) return false;
  await focusEdge(page, 'first');
  await page.keyboard.press('Shift+Tab');
  return focusWithinDialog(page);
}

test.describe('modal a11y: role + focus trap + restore @a11y', () => {
  test.describe.configure({ timeout: 90_000 });

  test.describe('desktop', () => {
    test.use({ viewport: { width: 1440, height: 900 } });

    test('work-item details modal: role=dialog, accessible name, focus trapped', async ({ page }) => {
      await openWorkspace(page, 'cards');
      await page.locator('[data-testid="view-content"] .grid > div').first().click().catch(() => {});
      await page.waitForTimeout(1200);
      const badge = page.locator('[data-testid="details-type-badge"]');
      if (!(await badge.isVisible().catch(() => false))) test.skip(true, 'details modal did not open');

      const dialog = page.locator('[role="dialog"][aria-modal="true"]');
      await expect(dialog, 'exposed as a modal dialog').toBeVisible();
      await expect(dialog, 'has an accessible name').toHaveAttribute('aria-label', /.+/);
      expect(await tabStaysTrapped(page), 'Tab focus stays within the details modal').toBe(true);
    });

    test('create-graph modal: role=dialog and focus trapped', async ({ page }) => {
      await openWorkspace(page, 'cards');
      const sel = page.locator('[data-testid="graph-selector"]');
      let trigger = null as any;
      for (let i = 0; i < (await sel.count()); i++) {
        if (await sel.nth(i).isVisible().catch(() => false)) { trigger = sel.nth(i); break; }
      }
      if (!trigger) test.skip(true, 'no graph selector');
      await trigger.click();
      await page.waitForTimeout(400);
      const create = page.locator('[title="Create New Graph"]').first();
      if (!(await create.isVisible().catch(() => false))) test.skip(true, 'no create-graph affordance');
      await create.click();
      await page.waitForTimeout(700);

      const dialog = page.locator('[role="dialog"][aria-modal="true"]');
      await expect(dialog, 'create-graph exposed as a modal dialog').toBeVisible();
      expect(await tabStaysTrapped(page), 'Tab focus stays within the create-graph modal').toBe(true);
    });
  });

  test.describe('phone', () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test('create-work-item modal: focus enters, is trapped, and restores to the trigger', async ({ page }) => {
      await openWorkspace(page, 'cards');
      const fab = page.locator('[aria-label="New work item"]');
      if (!(await fab.isVisible().catch(() => false))) test.skip(true, 'no create FAB');
      // Focus the trigger first so the "restore to trigger" expectation is deterministic.
      await fab.focus();
      await fab.click();
      await page.waitForTimeout(1000);

      const dialog = page.locator('[role="dialog"][aria-modal="true"]');
      await expect(dialog, 'create-work-item exposed as a modal dialog').toBeVisible();
      // Focus moved INTO the modal (and off the trigger) on open.
      expect(await focusWithinDialog(page), 'focus moved into the modal on open').toBe(true);
      const onFabWhileOpen = await page.evaluate(
        () => document.activeElement?.getAttribute('aria-label') === 'New work item'
      );
      expect(onFabWhileOpen, 'focus left the trigger while the modal is open').toBe(false);
      // Tab is trapped within it.
      expect(await tabStaysTrapped(page), 'Tab focus stays within the create modal').toBe(true);

      // Close via the backdrop (the dialog-manager defers Escape while a text field
      // is focused, by design). Focus-restore fires regardless of how it closes.
      await page.mouse.click(5, 5);
      await page.waitForTimeout(600);
      await expect(dialog, 'modal closed').toHaveCount(0);
      const restored = await page.evaluate(
        () => document.activeElement?.getAttribute('aria-label') === 'New work item'
      );
      expect(restored, 'focus restored to the New-work-item trigger').toBe(true);
    });
  });
});
