import { test, expect, Page } from '@playwright/test';
import { login, TEST_USERS } from '../../lib/auth';

/**
 * PR-3 (expand-in-place) + PR-4 (zoom-decoupled legibility floor).
 *
 * PR-3: the ⛶ expand icon on a node card opens a readable peek panel anchored to
 * the node (Card/Contents/Diagram at full size), independent of canvas zoom; it
 * stays glued through zoom and closes on Esc.
 *
 * PR-4: the primary label (title) is counter-scaled so its ON-SCREEN size never
 * drops below a readable floor when zoomed out — reading no longer requires
 * zooming all the way in. The in-card description preview truncates honestly
 * (ellipsis) instead of silently vanishing.
 *
 * Needs the hierarchy demo seeded (System Overview / overview-graph-shared).
 */
const OVERVIEW_ID = 'overview-graph-shared';
const LEGIBLE_FLOOR_PX = 12;

async function openOverview(page: Page) {
  await page.evaluate((gid) => {
    localStorage.setItem('currentGraphId', gid);
    localStorage.setItem('graphdone.quality.override', 'HIGH');
  }, OVERVIEW_ID);
  await page.reload();
  await page.waitForTimeout(6000);
}

// Live camera zoom (k) from the main group's d3 transform.
async function readK(page: Page): Promise<number> {
  return page.evaluate(() => {
    const g = document.querySelector('.graph-container svg .main-graph-group') as SVGGElement | null;
    const t = g?.getAttribute('transform') || '';
    const m = t.match(/scale\(([-\d.]+)/);
    return m ? parseFloat(m[1]) : 1;
  });
}

// Real (trusted) wheel zoom over the svg center. Positive deltaY = zoom out.
async function wheelZoom(page: Page, deltaY: number, steps: number) {
  const c = await page.evaluate(() => {
    const svg = document.querySelector('.graph-container svg') as SVGSVGElement | null;
    const r = (svg || document.body).getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  await page.mouse.move(c.x, c.y);
  for (let i = 0; i < steps; i++) { await page.mouse.wheel(0, deltaY); await page.waitForTimeout(120); }
  await page.waitForTimeout(500);
}

// Zoom out (real wheel) until k drops into the counter-scale band but stays
// above the cull, so a counter-scaled title is on screen to measure.
async function zoomOutInto(page: Page, lo: number, hi: number) {
  for (let i = 0; i < 20; i++) {
    const k = await readK(page);
    if (k <= hi) break;
    await wheelZoom(page, 200, 1);
  }
  return readK(page);
}

test.describe('node expand-in-place + legibility floor @geometry', () => {
  test.describe.configure({ timeout: 120_000 });

  test('PR-3: ⛶ expand icon opens an anchored Card/Contents/Diagram peek', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page, TEST_USERS.ADMIN);
    await page.waitForTimeout(1500);
    await openOverview(page);

    // Zoom in a touch so per-node icons are past their LOD opacity gate, then
    // fire the expand icon's real click handler on a sheet node (has a sub-graph
    // → Diagram is meaningful, and overview sheet nodes carry a description).
    await wheelZoom(page, -240, 3);
    const opened = await page.evaluate(() => {
      const nodes = [...document.querySelectorAll('.graph-container svg .node')];
      const sheet = nodes.find((n) => (n as any).__data__?.subgraphId) || nodes[0];
      const icon = sheet?.querySelector('.node-expand-icon');
      if (!icon) return false;
      icon.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
      return true;
    });
    expect(opened, 'found a node + its expand icon').toBe(true);

    const panel = page.locator('[data-testid="node-expand-panel"]');
    await expect(panel, 'expand panel opens anchored on canvas').toBeVisible({ timeout: 8000 });

    // It fits within the viewport (anchored + clamped, never off-screen).
    const box = await panel.boundingBox();
    expect(box, 'panel has a box').not.toBeNull();
    expect(box!.x, 'panel left on screen').toBeGreaterThanOrEqual(-1);
    expect(box!.y, 'panel top on screen').toBeGreaterThanOrEqual(-1);
    expect(box!.x + box!.width, 'panel right on screen').toBeLessThanOrEqual(1440 + 1);
    expect(box!.y + box!.height, 'panel bottom on screen').toBeLessThanOrEqual(900 + 1);

    // Contents (default for a node with a description) renders readable markdown.
    await expect(panel.locator('[data-testid="node-content-rendered"]'), 'Contents renders in the peek').toBeVisible({ timeout: 8000 });

    // Diagram → static sub-graph preview renders inside the peek.
    await panel.getByRole('button', { name: 'Diagram' }).click();
    await expect(panel.locator('[data-testid="subgraph-preview"]'), 'Diagram renders in the peek').toBeVisible({ timeout: 15000 });

    // Card → summary rows.
    await panel.getByRole('button', { name: 'Card' }).click();
    await expect(panel.getByText('Type', { exact: true }), 'Card shows the summary').toBeVisible({ timeout: 5000 });

    // Stays glued (still on screen) through a zoom-out, i.e. legible regardless
    // of canvas zoom — then Esc dismisses it.
    await wheelZoom(page, 240, 3);
    await expect(panel, 'peek stays anchored through zoom').toBeVisible();
    await page.keyboard.press('Escape');
    await expect(panel, 'Esc closes the peek').toBeHidden({ timeout: 5000 });
  });

  test('PR-4: title stays above the on-screen legibility floor when zoomed out', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page, TEST_USERS.ADMIN);
    await page.waitForTimeout(1500);
    await openOverview(page);

    // Zoom OUT into the band where the native (un-counter-scaled) title would be
    // sub-readable (k < ~0.857) but the label is still on screen.
    const k = await zoomOutInto(page, 0.45, 0.7);
    expect(k, `reached the counter-scale band (k=${k.toFixed(3)} < 0.857)`).toBeLessThan(0.857);

    const probe = await page.evaluate(() => {
      const texts = [...document.querySelectorAll('.graph-container svg .node-title-text')] as SVGTextElement[];
      // A visible title (opacity > 0, has a box).
      const visible = texts
        .map((t) => ({ t, r: t.getBoundingClientRect(), op: parseFloat(getComputedStyle(t).opacity || '1') }))
        .filter((x) => x.op > 0.05 && x.r.width > 1 && x.r.height > 1)
        .sort((a, b) => b.r.height - a.r.height)[0];
      if (!visible) return { found: false } as any;
      const group = visible.t.closest('.node-title-group') as SVGGElement | null;
      const transform = group?.getAttribute('transform') || '';
      const m = transform.match(/scale\(([\d.]+)\)/);
      const groupScale = m ? parseFloat(m[1]) : null;
      return { found: true, screenHeight: visible.r.height, inGroup: !!group, groupScale };
    });

    expect(probe.found, 'a title is visible when zoomed out (label readable across the band)').toBe(true);
    expect(probe.inGroup, 'title is wrapped in the legibility group').toBe(true);
    // The counter-scale keeps the on-screen size at/above the floor (allow a
    // px of glyph/cap-height tolerance). Without PR-4 this collapses with zoom
    // (e.g. 14px * 0.5 = 7px).
    expect(probe.screenHeight, `title on-screen height >= floor (${LEGIBLE_FLOOR_PX}px)`).toBeGreaterThanOrEqual(LEGIBLE_FLOOR_PX - 3);
    // Zoomed into the band, the counter-scale should be actively boosting (> 1).
    expect(probe.groupScale, `legibility counter-scale engaged when zoomed out (h=${Math.round(probe.screenHeight)}px, scale=${probe.groupScale})`).toBeGreaterThan(1);
  });
});
