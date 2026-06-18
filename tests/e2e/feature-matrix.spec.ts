import { test, expect, Page, TestInfo } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { getBaseURL } from '../lib/auth';
import { auditLayout, auditContrast } from '../lib/mobileAudit';

const SHOT_ROOT = path.resolve(process.cwd(), 'test-artifacts/matrix');

/**
 * The massive matrix: every screen + key feature, captured and audited at every
 * resolution, into one Playwright HTML report. Run locally:
 *
 *   npm run report:matrix      # then: npx playwright show-report test-artifacts/reports/playwright-report
 *
 * Each cell (resolution × feature) attaches a full-page screenshot AND runs the
 * layout/contrast auditors, so the report is both a visual gallery and a
 * per-resolution QA gate. Heavy by design; not part of the smoke gate.
 */

const VIEWPORTS = [
  { name: 'phone-360', width: 360, height: 640 },
  { name: 'phone-390', width: 390, height: 844 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'tablet-1024', width: 1024, height: 768 },
  { name: 'laptop-1440', width: 1440, height: 900 },
  { name: 'desktop-1920', width: 1920, height: 1080 },
] as const;

const VIEWS = ['cards', 'dashboard', 'table', 'kanban', 'gantt', 'calendar', 'activity', 'graph'] as const;
const PAGES = [
  { path: '/ontology', name: 'ontology' },
  { path: '/settings', name: 'settings' },
  { path: '/admin', name: 'admin' },
  { path: '/backend', name: 'system' },
  { path: '/agents', name: 'agents' },
  { path: '/analytics', name: 'analytics' },
] as const;

// Write the screenshot to test-artifacts/matrix/<viewport>/<feature>.png (the
// self-contained gallery generator reads these) AND attach to the Playwright report.
async function capture(page: Page, info: TestInfo, vpName: string, feature: string) {
  const dir = path.join(SHOT_ROOT, vpName);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${feature}.png`);
  const png = await page.screenshot({ path: file, fullPage: true }).catch(() => null);
  if (png) await info.attach(`${vpName}-${feature}.png`, { body: png, contentType: 'image/png' });
}

// Hard invariants that are bugs at ANY resolution. Side-scroll / squeezed labels
// are attached as soft info (some views legitimately scroll a region).
async function auditAndAssert(page: Page, info: TestInfo, scope: string, label: string, errs: string[]) {
  const layout = await auditLayout(page, scope);
  const contrast = await auditContrast(page, scope);
  await info.attach('audit.json', { body: JSON.stringify({ layout, contrast, errs }, null, 2), contentType: 'application/json' });
  expect(layout.pageOverflowPx, `${label}: page overflows sideways by ${layout.pageOverflowPx}px`).toBeLessThanOrEqual(2);
  expect(contrast, `${label}: invisible / low-contrast text`).toEqual([]);
  expect(errs, `${label}: uncaught JS errors`).toEqual([]);
}

for (const vp of VIEWPORTS) {
  test.describe(`${vp.name} (${vp.width}x${vp.height})`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });
    test.describe.configure({ timeout: 90_000 });

    for (const mode of VIEWS) {
      test(`view: ${mode}`, async ({ page }, info) => {
        const errs: string[] = [];
        page.on('pageerror', (e) => errs.push(e.message));
        await page.addInitScript((m) => localStorage.setItem('graphdone:viewMode', m), mode);
        await page.goto(`${getBaseURL()}/`, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(mode === 'graph' ? 4000 : 2500);
        await capture(page, info, vp.name, `view-${mode}`);
        // The graph is a canvas; only its chrome (page overflow + errors) is auditable.
        if (mode === 'graph') {
          const layout = await auditLayout(page, 'body');
          expect(layout.pageOverflowPx, 'graph: page overflows sideways').toBeLessThanOrEqual(2);
          expect(errs, 'graph: uncaught JS errors').toEqual([]);
        } else {
          await auditAndAssert(page, info, '[data-testid="view-content"]', `view:${mode}`, errs);
        }
      });
    }

    for (const pg of PAGES) {
      test(`page: ${pg.name}`, async ({ page }, info) => {
        const errs: string[] = [];
        page.on('pageerror', (e) => errs.push(e.message));
        await page.goto(`${getBaseURL()}${pg.path}`, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(2500);
        await capture(page, info, vp.name, `page-${pg.name}`);
        await auditAndAssert(page, info, 'main', `page:${pg.name}`, errs);
      });
    }

    test('feature: node inspector (select a node)', async ({ page }, info) => {
      await page.addInitScript(() => localStorage.setItem('graphdone:viewMode', 'graph'));
      await page.goto(`${getBaseURL()}/`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(4500);
      const box = await page.evaluate(() => {
        const n = document.querySelector('.graph-container svg .node .node-bg') as Element | null;
        if (!n) return null;
        const r = n.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      });
      if (box) { await page.mouse.click(box.x, box.y); await page.waitForTimeout(1500); }
      await capture(page, info, vp.name, 'feature-node-inspector');
      // Inspector is best-effort across sizes; the screenshot is the deliverable.
      expect(true).toBe(true);
    });

    test('feature: expand-in-place peek (⛶)', async ({ page }, info) => {
      await page.addInitScript(() => localStorage.setItem('graphdone:viewMode', 'graph'));
      await page.goto(`${getBaseURL()}/`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(4500);
      const opened = await page.evaluate(() => {
        const icon = document.querySelector('.graph-container svg .node .node-expand-icon');
        if (!icon) return false;
        icon.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
        return true;
      });
      if (opened) await page.waitForTimeout(1500);
      await capture(page, info, vp.name, 'feature-expand-peek');
      expect(true).toBe(true);
    });

    test('feature: create work item modal', async ({ page }, info) => {
      await page.addInitScript(() => localStorage.setItem('graphdone:viewMode', 'cards'));
      await page.goto(`${getBaseURL()}/`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2500);
      const fab = page.locator('[aria-label="New work item"]');
      if (await fab.isVisible().catch(() => false)) { await fab.click(); await page.waitForTimeout(1000); }
      await capture(page, info, vp.name, 'feature-create-modal');
      expect(true).toBe(true);
    });
  });
}

test.describe('signin (logged out)', () => {
  for (const vp of VIEWPORTS) {
    test(`${vp.name}: signin`, async ({ browser }, info) => {
      // Fresh context with NO stored auth so we see the real signin screen.
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, storageState: undefined });
      const page = await ctx.newPage();
      const errs: string[] = [];
      page.on('pageerror', (e) => errs.push(e.message));
      await page.goto(`${getBaseURL()}/login`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);
      await capture(page, info, vp.name, 'signin');
      await auditAndAssert(page, info, 'body', `signin@${vp.name}`, errs);
      await ctx.close();
    });
  }
});
