import { test, expect } from '@playwright/test';
import { login, TEST_USERS, getBaseURL } from '../lib/auth';
import { auditLayout, auditContrast } from '../lib/mobileAudit';

/**
 * Automated mobile sweep — runs the layout + contrast auditors against EVERY
 * screen at phone width so regressions (sideways scroll, squeezed labels,
 * black-on-dark text) are caught here instead of by hand. Tagged @audit.
 */
test.use({ viewport: { width: 390, height: 844 } });

const VIEWS = ['cards', 'dashboard', 'table', 'kanban', 'gantt', 'calendar', 'activity'];
const PAGES = [
  { path: '/ontology', name: 'Ontology' },
  { path: '/settings', name: 'Settings' },
  { path: '/admin', name: 'Admin' },
  { path: '/backend', name: 'System' },
  { path: '/agents', name: 'Agents' },
  { path: '/analytics', name: 'Analytics' },
];

async function assertClean(page: import('@playwright/test').Page, scope: string, label: string, errs: string[]) {
  const layout = await auditLayout(page, scope);
  const contrast = await auditContrast(page, scope);
  expect(layout.pageOverflowPx, `${label}: page overflows sideways`).toBeLessThanOrEqual(1);
  expect(layout.sideScroll, `${label}: content needs sideways scrolling`).toEqual([]);
  expect(layout.squeezed, `${label}: labels squeezed unreadable`).toEqual([]);
  expect(contrast, `${label}: invisible / low-contrast text`).toEqual([]);
  expect(errs, `${label}: uncaught JS errors`).toEqual([]);
}

test.describe('mobile audit: every screen is usable on a phone @audit', () => {
  for (const mode of VIEWS) {
    test(`workspace ${mode} view`, async ({ page }) => {
      const errs: string[] = [];
      page.on('pageerror', (e) => errs.push(e.message));
      await login(page, TEST_USERS.ADMIN);
      await page.evaluate((m) => localStorage.setItem('graphdone:viewMode', m), mode);
      await page.goto(`${getBaseURL()}/`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(3000);
      // The graph view is a canvas; only its chrome (page overflow + errors) is
      // auditable. Every other view is real DOM and gets the full sweep.
      if (mode === 'graph') {
        const layout = await auditLayout(page, 'body');
        expect(layout.pageOverflowPx, 'graph: page overflows sideways').toBeLessThanOrEqual(1);
        expect(errs, 'graph: uncaught JS errors').toEqual([]);
        return;
      }
      await assertClean(page, '[data-testid="view-content"]', `view:${mode}`, errs);
    });
  }

  for (const pg of PAGES) {
    test(`page ${pg.name}`, async ({ page }) => {
      const errs: string[] = [];
      page.on('pageerror', (e) => errs.push(e.message));
      await login(page, TEST_USERS.ADMIN);
      await page.goto(`${getBaseURL()}${pg.path}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2500);
      await assertClean(page, 'main', `page:${pg.name}`, errs);
    });
  }

  test('signin (logged out)', async ({ page }) => {
    const errs: string[] = [];
    page.on('pageerror', (e) => errs.push(e.message));
    await page.goto(`${getBaseURL()}/login`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await assertClean(page, 'body', 'signin', errs);
  });
});
