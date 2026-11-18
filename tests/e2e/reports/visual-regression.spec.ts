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
  { route: '/admin', name: 'admin-panel', heading: 'System Administration' },
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

async function waitForGraphPaint(page: Page) {
  await expect.poll(() => page.evaluate(() => {
    const perf = (window as Window & { __graphPerf?: { settled: boolean; graphId: string } }).__graphPerf;
    const canvas = document.querySelector('.graph-container svg');
    if (!canvas || !perf?.settled || perf.graphId !== localStorage.getItem('currentGraphId')) {
      return { settled: false, readableCards: 0, usable: false };
    }

    const viewport = canvas.getBoundingClientRect();
    const visibleFraction = (bounds: DOMRect) => {
      const width = Math.max(0, Math.min(innerWidth, viewport.right, bounds.right) - Math.max(0, viewport.left, bounds.left));
      const height = Math.max(0, Math.min(innerHeight, viewport.bottom, bounds.bottom) - Math.max(0, viewport.top, bounds.top));
      return bounds.width && bounds.height ? (width * height) / (bounds.width * bounds.height) : 0;
    };
    const hasPaint = (element: Element) => {
      const paint = getComputedStyle(element);
      if (paint.fill === 'none') return false;

      let opacity = Number(paint.fillOpacity);
      for (let ancestor: Element | null = element; ancestor; ancestor = ancestor.parentElement) {
        const style = getComputedStyle(ancestor);
        if (style.display === 'none' || style.visibility !== 'visible') return false;
        opacity *= Number(style.opacity);
      }
      return opacity >= 0.5;
    };

    const cards = [...canvas.querySelectorAll('g.node[aria-label^="Visual item "]')];
    const readableCards = cards.filter(node => {
      const background = node.querySelector('.node-bg');
      if (!background || !hasPaint(background) || visibleFraction(background.getBoundingClientRect()) < 0.5) return false;

      const titleLines = [...node.querySelectorAll('.node-title-text')];
      return titleLines.length > 0 && titleLines.every(line => {
        const bounds = line.getBoundingClientRect();
        return Boolean(line.textContent?.trim()) && hasPaint(line) && bounds.height >= 8 && visibleFraction(bounds) >= 0.9;
      });
    }).length;
    return { settled: true, readableCards, usable: readableCards >= 2 };
  }), { message: 'settled graph paints at least two readable fixture cards', timeout: 25_000 })
    .toEqual(expect.objectContaining({ settled: true, usable: true }));
  await expect(page.getByTestId('mini-map-status')).toBeHidden();
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

    test('capture workspace', async ({ page }, info) => {
      await page.addInitScript(() => localStorage.setItem('graphdone:viewMode', 'cards'));
      const firstCard = page.getByTestId('task-list').getByRole('button', { name: 'Edit Visual item 1', exact: true });
      await open(page, '/workspace', firstCard);
      await capture(page, info, name, 'workspace');
    });

    test('capture graph-view', async ({ page }, info) => {
      await page.addInitScript(() => localStorage.setItem('graphdone:viewMode', 'graph'));
      const firstNode = page.locator('.graph-container svg g.node[aria-label^="Visual item 1,"]');
      await open(page, '/workspace', firstNode);
      await waitForGraphPaint(page);
      await capture(page, info, name, 'graph-view');
    });

    for (const { route, name: screen, heading } of PAGES) {
      test(`capture ${screen}`, async ({ page }, info) => {
        await open(page, route, page.getByRole('heading', { name: heading, exact: true }));
        await capture(page, info, name, screen);
      });
    }

    test('capture agents', async ({ page }, info) => {
      await open(page, '/agents', page.getByRole('heading', { name: 'Working with AI', exact: true }));
      await expect(page.getByRole('button', { name: 'Refresh agent work' })).toBeEnabled();
      const activity = page.getByRole('region', { name: 'Recorded agent activity' });
      const empty = activity.getByRole('heading', { name: 'No AI contributions recorded here yet' });
      const populated = activity.getByRole('status').filter({ hasText: /recorded AI contributors/ });
      await expect(empty.or(populated)).toBeVisible();
      const setup = page.getByRole('region', { name: 'Agent setup' });
      await expect(setup.getByRole('button', { name: 'Create agent token' })).toBeEnabled();
      await capture(page, info, name, 'agents');
    });

    test('capture ontology', async ({ page }, info) => {
      await open(page, '/ontology', page.getByRole('heading', { name: 'Ontology', exact: true }));
      await expect(page.getByText(/^[1-9]\d* in this graph$/).first()).toBeVisible();
      await expect(page.getByText('Loading usage…', { exact: true })).toHaveCount(0);
      await capture(page, info, name, 'ontology');
    });

    test('capture admin-system', async ({ page }, info) => {
      await open(page, '/backend', page.getByRole('heading', { name: 'Backend Status', exact: true }));
      await expect(page.getByRole('button', { name: 'Refresh', exact: true })).toBeEnabled();
      await capture(page, info, name, 'admin-system');
    });

    test('capture admin-users', async ({ page }, info) => {
      const usersTab = page.getByRole('button', { name: 'Users', exact: true });
      await open(page, '/admin', usersTab);
      await usersTab.click();
      await expect(page.getByRole('heading', { name: 'User Management', exact: true })).toBeVisible();
      await capture(page, info, name, 'admin-users');
    });
  });
}
