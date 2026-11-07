import { test as base, expect, type Page } from '@playwright/test';
import { login, TEST_USERS } from '../../lib/auth';
import {
  ownedGraphIdsFixture,
  type OwnedGraphs,
} from '../../lib/ownedGraphIdsFixture';

/**
 * Zoom to fit must settle on one camera, and keyboard focus must follow the
 * card's quick-edit control when its detail level changes. Below 100% a card
 * is compact: its header icons are hidden and the card itself is the control.
 *
 * Regression: fitting with the geometry of the current zoom alternated between
 * a full card at ~0.9 and a compact card at ~1.08 every framing pass on phones,
 * and focus returned to a hidden header icon fell back to <body>.
 */
const test = base.extend<{ ownedGraphIds: OwnedGraphs }>({
  ownedGraphIds: [ownedGraphIdsFixture, { timeout: 60000 }],
});
test.use({ actionTimeout: 10000 });

const zoomOf = (page: Page) =>
  page.locator('.graph-container > svg').evaluate(element => (element as any).__zoom.k as number);

for (const { width, height, title, detail } of [
  // A full card (at most 320px wide) fits a 390px phone at 100%.
  { width: 390, height: 844, title: 'Prepare the school presentation', detail: 'full' },
  // A maximum-width card cannot fit a 320px phone at 100%, so it is compact.
  { width: 320, height: 568, title: 'Prepare the school presentation for the regional science fair', detail: 'compact' },
] as const)
  test(`zoom to fit settles and quick edit returns focus ${width}x${height} @mobile`, async ({ page, ownedGraphIds }) => {
    test.setTimeout(120000);
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewportSize({ width, height });
    await login(page, TEST_USERS.ADMIN);
    const seeded = await ownedGraphIds.seed({ size: 1, edgeFactor: 0, namePrefix: 'Fit focus', titleForIndex: () => title });
    await page.evaluate(id => {
      localStorage.setItem('currentGraphId', id);
      localStorage.setItem('graphdone:viewMode', 'graph');
    }, seeded.graphId);
    await page.goto('/');
    const graph = page.locator('.graph-container');
    const card = graph.locator('.node');
    await expect(card).toHaveCount(1);
    await expect.poll(() => page.evaluate(() => (window as any).__layoutMetrics?.()?.cameraReady)).toBe(true);

    await page.getByRole('button', { name: 'Zoom to fit — frame all nodes' }).click();
    await expect(card).toHaveAttribute('data-detail', detail);
    // Framing retries refit every 250ms while the layout settles: the camera
    // and the card's detail must not alternate between them.
    const samples: string[] = [];
    for (let sample = 0; sample < 8; sample += 1) {
      samples.push(`${(await zoomOf(page)).toFixed(3)} ${await card.getAttribute('data-detail')}`);
      await page.waitForTimeout(250);
    }
    expect(new Set(samples.slice(2)).size, samples.join(', ')).toBe(1);
    expect(samples.at(-1)).toContain(detail);
    expect((await zoomOf(page)) < 1).toBe(detail === 'compact');

    const gear = card.locator('.node-edit-icon');
    const control = detail === 'full' ? gear : card;
    await control.focus();
    await expect(control).toBeFocused();
    await control.press(' ');
    const editor = page.getByTestId('quick-edit-surface');
    await expect(editor).toBeVisible();
    await page.getByRole('button', { name: 'Close quick edit', exact: true }).click();
    await expect(editor).toBeHidden();
    await expect(control).toBeFocused();

    // Changing detail swaps which control exists; keyboard focus moves with it
    // (a mouse-focused card is left alone). Re-focus from the keyboard.
    await control.blur();
    await page.keyboard.press('Shift');
    await control.focus();
    await expect(control).toBeFocused();
    expect(await control.evaluate(element => element.matches(':focus-visible'))).toBe(true);
    const center = await card.evaluate(element => {
      const data = (element as any).__data__;
      return { x: data.x as number, y: data.y as number };
    });
    if (detail === 'compact') {
      await page.evaluate(({ x, y }) => (window as any).miniMapZoom(x, y, 1.2), center);
      await expect(card).toHaveAttribute('data-detail', 'full');
    }
    await expect(gear).toBeFocused();
    await page.evaluate(({ x, y }) => (window as any).miniMapZoom(x, y, 0.6), center);
    await expect(card).toHaveAttribute('data-detail', 'compact');
    await expect(card).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(editor).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(editor).toBeHidden();
    await expect(card).toBeFocused();
    await page.evaluate(({ x, y }) => (window as any).miniMapZoom(x, y, 1.2), center);
    await expect(card).toHaveAttribute('data-detail', 'full');
    await expect(gear).toBeFocused();
    // The card remembers which header icon it stood in for.
    const expand = card.locator('.node-expand-icon');
    await expand.focus();
    await page.evaluate(({ x, y }) => (window as any).miniMapZoom(x, y, 0.6), center);
    await expect(card).toBeFocused();
    await page.evaluate(({ x, y }) => (window as any).miniMapZoom(x, y, 1.2), center);
    await expect(expand).toBeFocused();
    expect(errors).toEqual([]);
  });
