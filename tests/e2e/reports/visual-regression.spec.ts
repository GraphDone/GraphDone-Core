import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';
import { join } from 'node:path';

const DEVICES = [
  // Mobile Phones - Portrait
  { name: 'iPhone-SE', width: 375, height: 667, deviceScaleFactor: 2 },
  { name: 'iPhone-12-13-14', width: 390, height: 844, deviceScaleFactor: 3 },
  { name: 'iPhone-14-Pro-Max', width: 430, height: 932, deviceScaleFactor: 3 },
  { name: 'Samsung-Galaxy-S21', width: 360, height: 800, deviceScaleFactor: 3 },
  { name: 'Google-Pixel-7', width: 412, height: 915, deviceScaleFactor: 2.625 },

  // Mobile Phones - Landscape
  { name: 'iPhone-14-Landscape', width: 844, height: 390, deviceScaleFactor: 3 },
  { name: 'Samsung-Galaxy-Landscape', width: 800, height: 360, deviceScaleFactor: 3 },

  // Tablets - Portrait
  { name: 'iPad-Mini', width: 768, height: 1024, deviceScaleFactor: 2 },
  { name: 'iPad-Air', width: 820, height: 1180, deviceScaleFactor: 2 },
  { name: 'iPad-Pro-11', width: 834, height: 1194, deviceScaleFactor: 2 },
  { name: 'iPad-Pro-12.9', width: 1024, height: 1366, deviceScaleFactor: 2 },
  { name: 'Samsung-Galaxy-Tab', width: 800, height: 1280, deviceScaleFactor: 2 },

  // Tablets - Landscape
  { name: 'iPad-Pro-11-Landscape', width: 1194, height: 834, deviceScaleFactor: 2 },
  { name: 'iPad-Pro-12.9-Landscape', width: 1366, height: 1024, deviceScaleFactor: 2 },

  // Desktop - Common resolutions
  { name: 'Desktop-HD', width: 1366, height: 768, deviceScaleFactor: 1 },
  { name: 'Desktop-Full-HD', width: 1920, height: 1080, deviceScaleFactor: 1 },
  { name: 'Desktop-QHD', width: 2560, height: 1440, deviceScaleFactor: 1 },
  { name: 'Desktop-4K', width: 3840, height: 2160, deviceScaleFactor: 1 },

  // Ultrawide
  { name: 'Ultrawide-QHD', width: 3440, height: 1440, deviceScaleFactor: 1 },
  { name: 'Ultrawide-4K', width: 5120, height: 2160, deviceScaleFactor: 1 },
];

const PAGES = [
  { route: '/settings', name: 'settings', heading: 'Settings' },
  { route: '/agents', name: 'agents', heading: 'Working with AI' },
  { route: '/ontology', name: 'ontology', heading: 'Ontology' },
  { route: '/admin', name: 'admin-panel', heading: 'System Administration' },
  { route: '/backend', name: 'admin-system', heading: 'Backend Status' },
];

async function open(page: Page, route: string, ready: Locator) {
  const response = await page.goto(route, { waitUntil: 'domcontentloaded' });
  expect(response?.ok(), `navigation to ${route}`).toBe(true);
  await expect(page).toHaveURL(url => url.pathname === route);
  await expect(ready).toBeVisible({ timeout: 15_000 });
}

async function capture(page: Page, info: TestInfo, device: string, screen: string) {
  const path = join(info.config.metadata.screenshotDir, device, `${screen}.png`);
  await page.screenshot({ path, animations: 'disabled', fullPage: true });
  await info.attach(`${device}-${screen}`, { path, contentType: 'image/png' });
}

for (const { name, width, height, deviceScaleFactor } of DEVICES) {
  test.describe(name, () => {
    test.use({ viewport: { width, height }, deviceScaleFactor });

    test.describe('signed out', () => {
      test.use({ storageState: { cookies: [], origins: [] } });

      for (const { route, screen } of [
        { route: '/', screen: 'landing-page' },
        { route: '/login', screen: 'login' },
      ]) {
        test(`capture ${screen}`, async ({ page }, info) => {
          const guestButton = page.getByRole('button', { name: 'Continue as Guest', exact: true }).filter({ visible: true });
          await open(page, route, guestButton.first());
          await capture(page, info, name, screen);
        });
      }
    });

    for (const { screen, mode, selector } of [
      { screen: 'workspace', mode: 'cards', selector: '[data-testid="view-content"]' },
      { screen: 'graph-view', mode: 'graph', selector: '.graph-container svg g.node' },
    ]) {
      test(`capture ${screen}`, async ({ page }, info) => {
        await page.addInitScript(value => localStorage.setItem('graphdone:viewMode', value), mode);
        await open(page, '/workspace', page.locator(selector).first());
        await capture(page, info, name, screen);
      });
    }

    for (const { route, name: screen, heading } of PAGES) {
      test(`capture ${screen}`, async ({ page }, info) => {
        await open(page, route, page.getByRole('heading', { name: heading, exact: true }));
        await capture(page, info, name, screen);
      });
    }

    test('capture admin-users', async ({ page }, info) => {
      const usersTab = page.getByRole('button', { name: 'Users', exact: true });
      await open(page, '/admin', usersTab);
      await usersTab.click();
      await expect(page.getByRole('heading', { name: 'User Management', exact: true })).toBeVisible();
      await capture(page, info, name, 'admin-users');
    });
  });
}
