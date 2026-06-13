import { test, expect, Page } from '@playwright/test';
import { login, TEST_USERS } from '../helpers/auth';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Showcase tour — documents every mode of operation as web-friendly .webm
 * video (recorded automatically by the 'showcase' Playwright project) plus a
 * labelled full-page screenshot per step, across the responsive viewport
 * matrix. Output feeds `npm run report:showcase`, which stitches a single
 * gallery: mode × resolution.
 *
 * This is DOCUMENTATION, not a gate — every step is best-effort so the tour
 * always completes and produces artifacts even where a mode isn't available
 * at a given size (e.g. touch-only interactions on a phone).
 */

const VIEWPORTS = [
  { name: 'iphone-se', width: 375, height: 667 },
  { name: 'iphone-15', width: 393, height: 852 },
  { name: 'ipad', width: 820, height: 1180 },
  { name: 'laptop-1080p', width: 1920, height: 1080 },
  { name: 'desktop-4k', width: 3840, height: 2160 },
] as const;

const SHOT_ROOT = path.resolve(process.cwd(), 'test-artifacts/showcase');

async function selectRichGraph(page: Page) {
  const sel = page.locator('[data-testid="graph-selector"]');
  if (!(await sel.isVisible().catch(() => false))) return;
  await sel.click();
  await page.waitForTimeout(800);
  const target = page.locator('text=Cycle 2: The Living Graph').first();
  if (await target.isVisible().catch(() => false)) {
    await target.click();
    await page.waitForTimeout(6000);
  }
  await page.keyboard.press('Escape').catch(() => {});
}

async function nodeCenter(page: Page, index = 0) {
  return page.evaluate((i) => {
    const cards = [...document.querySelectorAll('.graph-container svg .node .node-bg')];
    const el = cards[i];
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, index);
}

function runTourAt(vp: (typeof VIEWPORTS)[number]) {
  test.describe(`showcase @ ${vp.name} (${vp.width}x${vp.height})`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test(`tour of all modes @ ${vp.name}`, async ({ page }) => {
      test.setTimeout(180_000); // the full multi-mode tour is long by design
      const dir = path.join(SHOT_ROOT, vp.name);
      fs.mkdirSync(dir, { recursive: true });
      const safeMove = async (x: number, y: number) => { try { await page.mouse.move(x, y); } catch { /* page may be busy */ } };
      let step = 0;
      const captured: string[] = [];
      const shot = async (label: string) => {
        step += 1;
        const file = `${String(step).padStart(2, '0')}-${label}.png`;
        await page.screenshot({ path: path.join(dir, file), fullPage: false }).catch(() => {});
        captured.push(file);
      };
      const tryStep = async (label: string, fn: () => Promise<void>) => {
        try { await fn(); await page.waitForTimeout(500); await shot(label); }
        catch { await shot(`${label}-unavailable`); }
      };

      // 1. Login screen (before auth)
      await page.goto('/');
      await page.waitForTimeout(2000);
      await shot('login-screen');

      // 2. Authenticated workspace
      await login(page, TEST_USERS.ADMIN);
      await page.waitForTimeout(5000);
      await selectRichGraph(page);
      await page.waitForTimeout(2000);
      await shot('graph-overview');

      // 3. Node menu
      await tryStep('node-menu', async () => {
        const c = await nodeCenter(page, 0);
        if (!c) throw new Error('no node');
        await page.mouse.click(c.x, c.y);
        await page.waitForTimeout(800);
      });
      await page.keyboard.press('Escape').catch(() => {});
      await page.waitForTimeout(300);

      // 4. Grow mode (ghost preview from the + icon)
      await tryStep('grow-mode', async () => {
        const plus = await page.evaluate(() => {
          const r = document.querySelector('.node-relationship-icon')?.getBoundingClientRect();
          return r ? { x: r.x + r.width / 2, y: r.y + r.height / 2 } : null;
        });
        if (!plus) throw new Error('no + icon');
        await page.mouse.click(plus.x, plus.y);
        await page.waitForTimeout(400);
        await page.mouse.move(vp.width / 2, vp.height * 0.7, { steps: 6 });
        await page.waitForTimeout(400);
      });
      await page.keyboard.press('Escape').catch(() => {});
      await page.waitForTimeout(300);

      // 5. Hover neighborhood illumination
      await tryStep('hover-illumination', async () => {
        const c = await nodeCenter(page, 1);
        if (!c) throw new Error('no node');
        await page.mouse.move(c.x, c.y);
        await page.waitForTimeout(700);
      });
      await safeMove(5, 5);
      await page.waitForTimeout(300);

      // 6. Edge editor (glows + opens beside the edge)
      await tryStep('edge-editor', async () => {
        const label = await page.evaluate(() => {
          const r = document.querySelector('.edge-label-group')?.getBoundingClientRect();
          return r && r.width ? { x: r.x + r.width / 2, y: r.y + r.height / 2 } : null;
        });
        if (!label) throw new Error('no edge label');
        await page.mouse.click(label.x, label.y);
        await page.waitForTimeout(900);
      });
      await page.keyboard.press('Escape').catch(() => {});
      await page.waitForTimeout(300);

      // 7. Minimap (persistent, bottom-right) — capture full view
      await shot('minimap-and-graph');

      // 8. Settings → adaptive Visual Quality
      await tryStep('settings-quality', async () => {
        await page.goto('/settings');
        await page.waitForTimeout(1500);
      });

      // Always leave at least the core captures
      expect(captured.length, 'showcase produced screenshots').toBeGreaterThan(2);
      console.log(`[showcase ${vp.name}] captured ${captured.length} steps: ${captured.join(', ')}`);
    });
  });
}

for (const vp of VIEWPORTS) runTourAt(vp);
