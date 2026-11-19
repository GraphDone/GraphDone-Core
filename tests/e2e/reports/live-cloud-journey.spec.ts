import { test, expect, Page, TestInfo } from '@playwright/test';

/**
 * LIVE Cloudflare user journey — drives the real production SPA
 * (https://graphdone.com) exactly as a guest user would, on both
 * desktop and a phone, recording web-friendly .webm video (the 'live-journey'
 * Playwright project sets video:'on') plus a labelled screenshot per step.
 *
 * This is DOCUMENTATION + a live health check, not the smoke gate: every UI
 * interaction is best-effort (tryStep) so the tour always completes and
 * produces media, but the load-bearing invariant — a guest sees a graph render
 * with real nodes on the live site — is asserted hard.
 *
 * Output feeds the unified report (npm run test:unified) and the live dashboard.
 */

const LIVE = process.env.TEST_URL || 'https://graphdone.com';
const NODE_SEL = '.graph-container svg .node';
const EDGE_SEL = '.graph-container svg .edge';

async function countNodes(page: Page): Promise<number> {
  return page.locator(NODE_SEL).count().catch(() => 0);
}

async function waitForGraph(page: Page, secs = 30): Promise<number> {
  let n = 0;
  for (let i = 0; i < secs; i++) {
    n = await countNodes(page);
    if (n > 0) break;
    await page.waitForTimeout(1000);
  }
  return n;
}

function makeShooter(page: Page, testInfo: TestInfo) {
  let step = 0;
  const shots: string[] = [];
  const shot = async (label: string) => {
    step += 1;
    const name = `${String(step).padStart(2, '0')}-${label}`;
    const p = testInfo.outputPath(`${name}.png`);
    try {
      await page.screenshot({ path: p, fullPage: false });
      await testInfo.attach(name, { path: p, contentType: 'image/png' });
      shots.push(name);
    } catch { /* page busy — skip this frame */ }
  };
  const tryStep = async (label: string, fn: () => Promise<void>) => {
    try { await fn(); await page.waitForTimeout(600); await shot(label); }
    catch { await shot(`${label}-unavailable`); }
  };
  return { shot, tryStep, shots: () => shots };
}

async function enterAsGuest(page: Page, shot: (l: string) => Promise<void>) {
  await page.goto(LIVE, { waitUntil: 'domcontentloaded' });
  const guest = { name: 'Continue as Guest', exact: true };
  const start = page.getByRole('button', guest);
  await expect(start).toBeVisible();
  await shot('signin-landing');
  await start.click();
  const confirm = page.getByRole('dialog').getByRole('button', guest);
  await expect(confirm).toBeVisible();
  await shot('guest-dialog');
  await confirm.click();
  await expect(page.getByRole('button', { name: 'New work item', exact: true })).toBeVisible();
}

// ─────────────────────────────────────────────────────────────────────────────
// DESKTOP journey (1440×900)
// ─────────────────────────────────────────────────────────────────────────────
test.describe('live cloud user journey — desktop @live', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('a guest explores the live graph on desktop', async ({ page }, testInfo) => {
    test.setTimeout(150_000);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const { shot, tryStep } = makeShooter(page, testInfo);

    await enterAsGuest(page, shot);

    const nodes = await waitForGraph(page, 30);
    await page.waitForTimeout(4000); // let the force layout settle for a clean frame
    await shot('graph-overview');
    expect(nodes, 'live guest graph renders nodes').toBeGreaterThan(0);

    const edges = await page.locator(EDGE_SEL).count().catch(() => 0);
    console.log(`[live-journey desktop] nodes=${nodes} edges=${edges} errors=${errors.length}`);

    // Open a node's expand panel (PR-3 feature) — the core "drill into work" gesture.
    await tryStep('open-node-card', async () => {
      const opened = await page.evaluate(() => {
        const n = document.querySelector('.graph-container svg .node');
        const icon = n?.querySelector('.node-expand-icon') as HTMLElement | null;
        if (icon) { icon.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window })); return true; }
        return false;
      });
      if (!opened) throw new Error('no expand icon');
      await page.waitForTimeout(1500);
    });
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(400);

    // Zoom out / re-fit to show the whole graph composition.
    await tryStep('zoom-to-fit', async () => {
      await page.mouse.move(720, 450);
      await page.mouse.wheel(0, -300);
      await page.waitForTimeout(800);
    });

    // Tour the main pages a guest can reach.
    for (const [label, route] of [
      ['ontology-page', '/ontology'],
      ['analytics-page', '/analytics'],
      ['settings-page', '/settings'],
    ] as const) {
      await tryStep(label, async () => {
        await page.goto(LIVE + route, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(2500);
      });
    }

    // Admin is role-guarded — a guest should NOT get in. Capture the guard.
    await tryStep('admin-guarded-for-guest', async () => {
      await page.goto(LIVE + '/admin', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2500);
    });

    expect(errors, `no uncaught JS errors (saw: ${errors.slice(0, 2).join(' | ')})`).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// MOBILE journey (390×844)
// ─────────────────────────────────────────────────────────────────────────────
test.describe('live cloud user journey — mobile @live', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test('a guest explores the live graph on a phone', async ({ page }, testInfo) => {
    test.setTimeout(150_000);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const { shot, tryStep } = makeShooter(page, testInfo);

    await enterAsGuest(page, shot);

    // Phones default to the list/cards view, not the graph.
    await page.waitForTimeout(4000);
    await shot('mobile-default-view');

    // No horizontal overflow is a hard mobile invariant.
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    console.log(`[live-journey mobile] horizontal-overflow=${overflow}px errors=${errors.length}`);

    // Drive the bottom nav: Graph, then the "More" sheet.
    await page.getByTestId('mobile-bottom-nav').getByRole('button', { name: 'Graph', exact: true }).click();
    await expect(page.locator(NODE_SEL).first()).toBeVisible();
    await shot('mobile-graph-view');

    await tryStep('mobile-more-sheet', async () => {
      const nav = page.getByTestId('mobile-bottom-nav');
      const moreBtn = nav.getByText('More', { exact: true });
      if (await moreBtn.isVisible({ timeout: 3000 })) await moreBtn.click();
      else throw new Error('no bottom-nav More button');
      await page.waitForTimeout(1200);
    });
    await page.keyboard.press('Escape').catch(() => {});

    await tryStep('mobile-settings', async () => {
      await page.goto(LIVE + '/settings', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2500);
    });

    expect(overflow, 'no horizontal overflow on phone').toBeLessThanOrEqual(2);
  });
});
