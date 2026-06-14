import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { login, TEST_USERS } from '../helpers/auth';

/**
 * The insecure-connection (HTTP) warning must integrate cleanly: a slim strip
 * at the very top that reserves its own space (never overlaps the app), and is
 * dismissible. Runs over the dev HTTP origin, so the banner is expected.
 * Report-only screenshots + hard assertions on placement.
 */
const OUT = path.resolve(process.cwd(), 'test-artifacts/tls-banner');
const SEL = '[data-testid="insecure-connection-banner"]';

async function measure(page: Page) {
  return page.evaluate((sel) => {
    const b = document.querySelector(sel) as HTMLElement | null;
    if (!b) return { present: false } as const;
    const r = b.getBoundingClientRect();
    // The first app chrome under the banner: the sidebar or the main content.
    const main = document.querySelector('main') as HTMLElement | null;
    const sidebar = document.querySelector('nav')?.closest('div') as HTMLElement | null;
    const topOfApp = Math.min(
      main ? main.getBoundingClientRect().top : Infinity,
      sidebar ? sidebar.getBoundingClientRect().top : Infinity
    );
    return {
      present: true,
      top: Math.round(r.top),
      bottom: Math.round(r.bottom),
      height: Math.round(r.height),
      width: Math.round(r.width),
      topOfApp: Math.round(topOfApp),
      scrollY: Math.round(window.scrollY),
    };
  }, SEL);
}

test.describe('insecure-connection banner @geometry', () => {
  test.describe.configure({ timeout: 120_000 });

  test('renders as a top strip, reserves space (no overlap), dismissible', async ({ page }) => {
    fs.mkdirSync(OUT, { recursive: true });
    await page.setViewportSize({ width: 1440, height: 900 });

    // Auth page (chrome-less): a pinned strip at the very top.
    await page.goto('/signin');
    await page.waitForTimeout(1200);
    const auth = await measure(page);
    await page.screenshot({ path: path.join(OUT, 'auth-signin.png'), clip: { x: 0, y: 0, width: 1440, height: 220 } });
    expect(auth.present, 'banner shown over HTTP on auth page').toBe(true);
    if (auth.present) {
      expect(auth.top, 'auth banner pinned to the very top').toBeLessThanOrEqual(1);
      expect(auth.height, 'auth banner is a slim strip').toBeLessThan(60);
    }

    // In-app: an in-flow strip that pushes the app below it (no overlap, no scroll).
    await login(page, TEST_USERS.ADMIN);
    await page.waitForTimeout(3000);
    const app = await measure(page);
    await page.screenshot({ path: path.join(OUT, 'app-top.png'), clip: { x: 0, y: 0, width: 1440, height: 220 } });
    // eslint-disable-next-line no-console
    console.log('[tls-banner] ' + JSON.stringify(app));
    expect(app.present, 'banner shown in-app over HTTP').toBe(true);
    if (app.present) {
      expect(app.top, 'in-app banner sits at the top').toBeLessThanOrEqual(1);
      expect(app.height, 'in-app banner is a slim strip').toBeLessThan(60);
      expect(app.scrollY, 'banner must not introduce a page scroll').toBeLessThanOrEqual(1);
      expect(app.topOfApp, 'app chrome starts at/below the banner (no overlap)').toBeGreaterThanOrEqual(app.bottom - 1);
    }

    // Dismiss reclaims the space.
    await page.locator(`${SEL} button[aria-label="Dismiss insecure-connection warning"]`).click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(OUT, 'app-after-dismiss.png'), clip: { x: 0, y: 0, width: 1440, height: 220 } });
    expect(await page.locator(SEL).count(), 'banner gone after dismiss').toBe(0);
  });
});
