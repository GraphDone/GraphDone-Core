import { test, expect, Page } from '@playwright/test';
import { login, TEST_USERS, getBaseURL } from '../helpers/auth';

/**
 * Camera framing + persistence (@camera).
 *
 * Covers two user-facing promises from the camera work:
 *  1. The graph loads framed (never off-screen, then jumps in) and a "zoom to
 *     fit" (zoom-extents) button re-frames every node on demand.
 *  2. The user's camera is respected within/across a session — panning is saved
 *     to localStorage per-graph and restored on reload, instead of being reset.
 */

async function gotoGraph(page: Page) {
  await page.addInitScript(() => localStorage.setItem('graphdone:viewMode', 'graph'));
  await login(page, TEST_USERS.ADMIN);
  await page.goto(`${getBaseURL()}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.graph-container svg .node', { timeout: 15_000 });
  await page.waitForTimeout(3500); // physics settle + the once-per-graph framing
}

// How many nodes have any part inside the canvas viewport.
async function nodesInView(page: Page): Promise<{ inView: number; total: number }> {
  const canvas = await page.locator('.graph-container').first().boundingBox();
  if (!canvas) return { inView: 0, total: 0 };
  const boxes = await page.locator('.graph-container svg .node').evaluateAll((els) =>
    els.map((el) => (el as SVGGraphicsElement).getBoundingClientRect()).map((r) => ({ x: r.x, y: r.y, w: r.width, h: r.height }))
  );
  const inView = boxes.filter(
    (b) => b.x + b.w > canvas.x && b.x < canvas.x + canvas.width && b.y + b.h > canvas.y && b.y < canvas.y + canvas.height
  ).length;
  return { inView, total: boxes.length };
}

test.describe('camera framing + persistence @camera', () => {
  test.describe.configure({ timeout: 90_000 });

  test('graph loads framed (nodes on-screen, not off in a corner)', async ({ page }) => {
    await gotoGraph(page);
    const { inView, total } = await nodesInView(page);
    expect(total, 'graph has nodes').toBeGreaterThan(0);
    // The framing fit centres the bbox; the bulk of nodes must be on-screen.
    expect(inView, `${inView}/${total} nodes in view on load`).toBeGreaterThan(total * 0.5);
  });

  test('zoom-extents button re-frames nodes after a hard zoom-in', async ({ page }) => {
    await gotoGraph(page);
    const btn = page.locator('[data-testid="graph-zoom-extents"]');
    await expect(btn, 'zoom-extents button is present on graph view').toBeVisible();

    // Zoom IN hard over the canvas centre (wheel, not drag) so peripheral nodes
    // leave the viewport. Wheel avoids the minimap (bottom-right) and never grabs
    // a node the way a drag-pan can. Standard direction: scroll UP (negative
    // deltaY) zooms in.
    const canvas = await page.locator('.graph-container').first().boundingBox();
    if (!canvas) throw new Error('no canvas');
    const cx = canvas.x + canvas.width / 2;
    const cy = canvas.y + canvas.height / 2;
    await page.mouse.move(cx, cy);
    for (let i = 0; i < 7; i++) {
      await page.mouse.wheel(0, -320);
      await page.waitForTimeout(90);
    }
    await page.waitForTimeout(500);
    const zoomed = await nodesInView(page);
    expect(zoomed.total, 'graph has nodes').toBeGreaterThan(0);
    expect(zoomed.inView, `zoom-in pushed some nodes off-screen (${zoomed.inView}/${zoomed.total})`).toBeLessThan(zoomed.total);

    // Zoom-extents brings them all back into frame.
    await btn.click();
    await page.waitForTimeout(900); // the 450ms fit transition + margin
    const reframed = await nodesInView(page);
    expect(
      reframed.inView,
      `zoom-extents reframed ${reframed.inView}/${reframed.total}`
    ).toBeGreaterThanOrEqual(Math.ceil(reframed.total * 0.8));
  });

  test('camera pan is saved per-graph and restored on reload', async ({ page }) => {
    await gotoGraph(page);
    const gid = await page.evaluate(() => {
      const keys = Object.keys(localStorage);
      return keys.find((k) => k.startsWith('graphdone:camera:'))?.replace('graphdone:camera:', '') ?? null;
    });

    // Pan, then wait past the 600ms debounce so it persists.
    const canvas = await page.locator('.graph-container').first().boundingBox();
    if (!canvas) throw new Error('no canvas');
    await page.mouse.move(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2);
    await page.mouse.down();
    await page.mouse.move(canvas.x + canvas.width / 2 - 220, canvas.y + canvas.height / 2 - 160, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(900);

    const saved = await page.evaluate(() => {
      const key = Object.keys(localStorage).find((k) => k.startsWith('graphdone:camera:'));
      return key ? localStorage.getItem(key) : null;
    });
    expect(saved, 'camera persisted to localStorage after pan').toBeTruthy();
    const cam = JSON.parse(saved!);
    expect(typeof cam.x === 'number' && typeof cam.y === 'number' && typeof cam.k === 'number').toBeTruthy();

    // Reload: the saved camera should be restored, not reset to a fresh fit.
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.graph-container svg .node', { timeout: 15_000 });
    await page.waitForTimeout(3000);
    const after = await page.evaluate((k) => localStorage.getItem(k), `graphdone:camera:${gid}`);
    expect(after, 'saved camera survives reload').toBeTruthy();
    const restored = JSON.parse(after!);
    // Restore applies the saved transform; allow drift only from later auto-saves
    // of the same view (no fresh fit, which would change k substantially).
    expect(Math.abs(restored.k - cam.k), 'zoom level preserved across reload').toBeLessThan(0.05);
  });

  // Regression for the live-guest bug: a cold load delivers the graph data AFTER
  // a fixed fit timer would have fired, so the fit no-opped and the graph stayed
  // pinned off-screen. We delay the workItems response past the old 1200ms timer
  // and assert the poll-until-ready framing still centres the graph.
  test('graph still frames when data arrives slowly (cold load)', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('graphdone:viewMode', 'graph'));
    await login(page, TEST_USERS.ADMIN);

    // Delay only the workItems query (not login/me) by ~2s — well past the old
    // fixed fit timer — to mimic a cold Worker/D1 first paint.
    await page.route('**/graphql', async (route) => {
      const body = route.request().postData() || '';
      if (/workItems/i.test(body)) {
        await new Promise((r) => setTimeout(r, 2000));
      }
      await route.continue();
    });

    await page.goto(`${getBaseURL()}/`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.graph-container svg .node', { timeout: 20_000 });
    // Allow the delayed data + the poll-until-ready fit to complete.
    await page.waitForTimeout(5000);

    const { inView, total } = await nodesInView(page);
    expect(total, 'graph has nodes after the delayed load').toBeGreaterThan(0);
    expect(inView, `${inView}/${total} nodes framed despite slow load`).toBeGreaterThan(total * 0.5);
  });
});
