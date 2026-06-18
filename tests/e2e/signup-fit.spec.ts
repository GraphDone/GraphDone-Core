import { test, expect } from '@playwright/test';
import { getBaseURL } from '../lib/auth';

/**
 * Responsive "fit the window" religion (@signup-fit): on a large screen the
 * /signup (magic-link) branding sits BESIDE the form (wider, 2-column) so the
 * auth flow fits without vertical scrolling; on a phone it stacks with no
 * horizontal overflow.
 *
 * The absolute "documentElement has no vertical scroll" assertion lives in the
 * live cloud audit (production has no dev-only chrome — the HTTP "insecure
 * connection" banner and the "Default Accounts" box only render in dev and
 * would inflate a dev-server measurement). Here we verify the structural fix:
 * the 2-column layout is active and the form itself fits the viewport height.
 */
test.describe('auth page fits the window @signup-fit', () => {
  test('large screen: branding sits beside the form (2-column) @1600x1000', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto(`${getBaseURL()}/signup`, { waitUntil: 'networkidle' });
    const form = page.locator('form').first();
    const header = page.getByRole('heading', { name: /welcome back/i }).first();
    await form.waitFor({ timeout: 10_000 });
    const fb = await form.boundingBox();
    const hb = await header.boundingBox();
    if (!fb || !hb) throw new Error('missing form/header');
    // Side-by-side: the heading sits to the LEFT of the form (separate columns),
    // and they share the same row (vertical overlap) rather than stacking.
    expect(hb.x + hb.width, `header right (${Math.round(hb.x + hb.width)}) left of form (${Math.round(fb.x)})`).toBeLessThanOrEqual(fb.x + 8);
    const verticalOverlap = Math.min(hb.y + hb.height, fb.y + fb.height) - Math.max(hb.y, fb.y);
    expect(verticalOverlap, 'header and form share the row').toBeGreaterThan(0);
    // The form alone fits comfortably within a 1000px-tall window.
    expect(fb.height, `form height ${Math.round(fb.height)} fits the window`).toBeLessThanOrEqual(940);
  });

  test('phone: stacks with no horizontal overflow @360x740', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto(`${getBaseURL()}/signup`, { waitUntil: 'networkidle' });
    await page.waitForSelector('form', { timeout: 10_000 });
    const m = await page.evaluate(() => ({
      scrollW: document.documentElement.scrollWidth,
      clientW: document.documentElement.clientWidth,
    }));
    expect(m.scrollW, `scrollW ${m.scrollW} should not exceed clientW ${m.clientW}`).toBeLessThanOrEqual(m.clientW + 1);
  });
});
