import { test, expect, Page } from '@playwright/test';
import { login, TEST_USERS, getBaseURL } from '../helpers/auth';

/**
 * Overlay dismissal gate (@dismissal). Verifies the dialog-manager "friction
 * contract" documented in hooks/useDialogManager.ts:
 *   - Escape always closes the top-most dialog.
 *   - Click-outside closes the overlay (modals via their backdrop; dropdowns
 *     via their click-outside listener).
 *   - Users never have to hunt for an X button.
 * A dropdown or modal that won't dismiss is exactly the kind of friction the
 * user reports — this suite keeps every overlay honest about closing.
 */

async function openWorkspace(page: Page, viewMode = 'cards') {
  await login(page, TEST_USERS.ADMIN);
  await page.addInitScript((m) => localStorage.setItem('graphdone:viewMode', m), viewMode);
  await page.goto(`${getBaseURL()}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(viewMode === 'graph' ? 4500 : 3000);
}

async function firstInViewport(page: Page, selector: string) {
  const loc = page.locator(selector);
  const vp = page.viewportSize();
  if (!vp) return null;
  const n = await loc.count();
  for (let i = 0; i < n; i++) {
    const el = loc.nth(i);
    if (!(await el.isVisible().catch(() => false))) continue;
    const box = await el.boundingBox().catch(() => null);
    // A few px of slack so sub-pixel/CI-rendering overflow doesn't silently skip a real trigger.
    if (box && box.x >= -4 && box.y >= -4 && box.x + box.width <= vp.width + 4 && box.y + box.height <= vp.height + 4) return el;
  }
  return null;
}

/** Press Escape with focus OUTSIDE any input (the manager defers Escape to inputs by design). */
async function pressEscapeOnBody(page: Page) {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur?.());
  await page.keyboard.press('Escape');
}

/** Close any overlay whose own listeners watch document for an outside mousedown/click. */
async function clickOutsideViaBody(page: Page) {
  await page.evaluate(() => {
    for (const type of ['mousedown', 'mouseup', 'click']) {
      document.body.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
    }
  });
}

const isGone = async (page: Page, selector: string) =>
  !(await page.locator(selector).first().isVisible().catch(() => false));

test.describe('overlay dismissal: Esc + click-outside @dismissal', () => {
  test.describe.configure({ timeout: 90_000 });
  test.use({ viewport: { width: 1440, height: 900 } });

  test('work-item details modal closes on Escape', async ({ page }) => {
    await openWorkspace(page, 'cards');
    await page.locator('[data-testid="view-content"] .grid > div').first().click().catch(() => {});
    await page.waitForTimeout(1000);
    const badge = page.locator('[data-testid="details-type-badge"]');
    if (!(await badge.isVisible().catch(() => false))) test.skip(true, 'details modal did not open');
    await pressEscapeOnBody(page);
    await page.waitForTimeout(500);
    expect(await isGone(page, '[data-testid="details-type-badge"]'), 'details modal closed on Escape').toBe(true);
  });

  test('work-item details modal closes on backdrop click', async ({ page }) => {
    await openWorkspace(page, 'cards');
    await page.locator('[data-testid="view-content"] .grid > div').first().click().catch(() => {});
    await page.waitForTimeout(1000);
    const badge = page.locator('[data-testid="details-type-badge"]');
    if (!(await badge.isVisible().catch(() => false))) test.skip(true, 'details modal did not open');
    await page.mouse.click(5, 5); // the full-screen backdrop sits behind the centered card
    await page.waitForTimeout(500);
    expect(await isGone(page, '[data-testid="details-type-badge"]'), 'details modal closed on backdrop click').toBe(true);
  });

  test('create-work-item modal closes on Escape', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 }); // FAB is mobile-only
    await openWorkspace(page, 'cards');
    const fab = page.locator('[aria-label="New work item"]');
    if (!(await fab.isVisible().catch(() => false))) test.skip(true, 'no create FAB');
    await fab.click();
    await page.waitForTimeout(800);
    const heading = page.getByText('Create New Work Item');
    if (!(await heading.isVisible().catch(() => false))) test.skip(true, 'create modal did not open');
    await pressEscapeOnBody(page);
    await page.waitForTimeout(500);
    expect(await heading.isVisible().catch(() => false), 'create modal closed on Escape').toBe(false);
  });

  test('create-graph modal closes on Escape', async ({ page }) => {
    await openWorkspace(page, 'cards');
    const trigger = await firstInViewport(page, '[data-testid="graph-selector"]');
    if (!trigger) test.skip(true, 'no on-screen graph selector');
    await trigger!.click();
    await page.waitForTimeout(400);
    const create = page.locator('[title="Create New Graph"]').first();
    if (!(await create.isVisible().catch(() => false))) test.skip(true, 'no create-graph affordance');
    await create.click();
    await page.waitForTimeout(700);
    const heading = page.getByText('Create New Graph');
    if (!(await heading.isVisible().catch(() => false))) test.skip(true, 'create-graph modal did not open');
    await pressEscapeOnBody(page);
    await page.waitForTimeout(500);
    expect(await heading.isVisible().catch(() => false), 'create-graph modal closed on Escape').toBe(false);
  });

  test('graph selector dropdown closes on click-outside', async ({ page }) => {
    await openWorkspace(page, 'cards');
    const trigger = await firstInViewport(page, '[data-testid="graph-selector"]');
    if (!trigger) test.skip(true, 'no on-screen graph selector');
    await trigger!.click();
    await page.waitForTimeout(400);
    expect(await isGone(page, '[data-testid="graph-selector-dropdown"]'), 'dropdown opened').toBe(false);
    await clickOutsideViaBody(page);
    await page.waitForTimeout(500);
    expect(await isGone(page, '[data-testid="graph-selector-dropdown"]'), 'graph selector dropdown closed on click-outside').toBe(true);
  });

  test('user menu dropdown closes on click-outside', async ({ page }) => {
    await openWorkspace(page, 'cards');
    const trigger = await firstInViewport(page, '[data-testid="user-menu"]');
    if (!trigger) test.skip(true, 'no on-screen user menu');
    await trigger!.click();
    await page.waitForTimeout(400);
    expect(await isGone(page, '[data-testid="user-menu-dropdown"]'), 'dropdown opened').toBe(false);
    await clickOutsideViaBody(page);
    await page.waitForTimeout(500);
    expect(await isGone(page, '[data-testid="user-menu-dropdown"]'), 'user menu dropdown closed on click-outside').toBe(true);
  });

  test('settings visual-quality dropdown closes on click-outside', async ({ page }) => {
    await login(page, TEST_USERS.ADMIN);
    await page.goto(`${getBaseURL()}/settings`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    const trigger = page.locator('[data-testid="settings-quality-dropdown"] button').first();
    if (!(await trigger.isVisible().catch(() => false))) test.skip(true, 'no quality dropdown');
    await trigger.click();
    await page.waitForTimeout(400);
    expect(await isGone(page, '[data-testid="custom-dropdown-menu"]'), 'dropdown opened').toBe(false);
    await clickOutsideViaBody(page);
    await page.waitForTimeout(500);
    expect(await isGone(page, '[data-testid="custom-dropdown-menu"]'), 'settings dropdown closed on click-outside').toBe(true);
  });
});
