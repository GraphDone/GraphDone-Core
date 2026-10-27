import { test, expect, type Page } from '@playwright/test';
import { login, TEST_USERS, getBaseURL, getAuthState } from '../../lib/auth';
import { gql } from '../../lib/graphRequest';

test('auth state recognizes an empty authenticated workspace and rejects a login form @router', async ({ page }) => {
  await page.setContent('<main data-testid="workspace-content"><h1>No Graphs Available</h1></main>');
  expect((await getAuthState(page)).isLoggedIn).toBe(true);
  await page.setContent('<main data-testid="workspace-content"><h1>No Graphs Available</h1></main><input type="password">');
  await expect(page.getByTestId('workspace-content')).toBeVisible();
  await expect(page.locator('input[type="password"]')).toBeVisible();
  expect((await getAuthState(page)).isLoggedIn).toBe(false);
  await page.setContent('<main>Loading</main>');
  expect((await getAuthState(page)).isLoggedIn).toBe(false);
});

for (const width of [1440, 390]) {
  test.describe(`application route compatibility at ${width}px @router`, () => {
    test.use({ viewport: { width, height: 900 }, isMobile: width === 390, hasTouch: width === 390 });
    test.describe.configure({ timeout: 90_000, retries: 0 });
    const errors = new WeakMap<Page, string[]>();
    test.beforeEach(async ({ page }) => {
      errors.set(page, []);
      page.on('pageerror', error => errors.get(page)!.push(error.message));
      await page.addInitScript(() => localStorage.setItem('graphdone:viewMode', 'cards'));
    });
    test.afterEach(async ({ page }) => expect(errors.get(page)).toEqual([]));

    test('public deep links, callback errors and unknown paths preserve route behavior', async ({ page }) => {
      await page.goto(`${getBaseURL()}/forgot-password`);
      await expect(page.getByRole('heading', { name: 'Reset Password', exact: true })).toBeVisible();
      await page.reload();
      await expect(page.getByRole('heading', { name: 'Reset Password', exact: true })).toBeVisible();
      await page.goto(`${getBaseURL()}/reset-password?token=owned-invalid-router-fixture`);
      await expect(page.getByRole('heading', { name: 'Set New Password' })).toBeVisible();
      await page.goto(`${getBaseURL()}/login?error=invalid_magic_link`);
      await expect(page.getByText('This magic link is not valid or has already been used.', { exact: true })).toBeVisible();
      await page.goto(`${getBaseURL()}/owned-unknown-route/nested`);
      await expect(page).toHaveURL(new URL('/', getBaseURL()).href);
      await page.getByRole('tab', { name: 'Password', exact: true }).click();
      await expect(page.locator('input[name="emailOrUsername"]')).toBeVisible();
    });

    test('deep routes, lazy page navigation and back/forward history remain usable', async ({ page }) => {
      await login(page, TEST_USERS.ADMIN, { retries: 1 });
      await page.goto(`${getBaseURL()}/settings?tab=profile#account`);
      await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
      await page.reload();
      await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
      if (width === 390) {
        await page.getByTestId('mobile-bottom-nav').getByText('More', { exact: true }).tap();
        await page.getByTestId('mobile-more-sheet').getByText('Analytics', { exact: true }).tap();
      } else {
        await page.getByRole('link', { name: 'Analytics', exact: true }).click();
      }
      await expect(page.getByRole('heading', { name: 'Your graph, in motion' })).toBeVisible();
      await expect(page).toHaveURL(new URL('/analytics', getBaseURL()).href);
      await page.goBack();
      await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
      await expect(page).toHaveURL(new URL('/settings?tab=profile#account', getBaseURL()).href);
      await page.goForward();
      await expect(page.getByRole('heading', { name: 'Your graph, in motion' })).toBeVisible();
      await page.goto(`${getBaseURL()}/admin`);
      await expect(page).toHaveURL(new URL('/admin', getBaseURL()).href);
      await expect(page.getByRole('heading', { name: 'System Administration', exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Users', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Create User', exact: true })).toBeVisible();
    });

    test('viewer route guards and a fresh-context login callback preserve authorization', async ({ page, browser }) => {
      await login(page, TEST_USERS.VIEWER, { retries: 1 });
      expect((await gql(page, '{ me { role } }')).me.role).toBe('VIEWER');
      for (const route of ['/admin', '/backend']) {
        await page.goto(`${getBaseURL()}${route}`);
        await expect(page).toHaveURL(new URL('/', getBaseURL()).href);
        await expect(page.getByTestId('workspace-content')).toBeVisible();
        await expect(page.getByRole('heading', { name: 'System Administration', exact: true })).toHaveCount(0);
      }
      const token = await page.evaluate(() => localStorage.getItem('authToken') || sessionStorage.getItem('authToken'));
      expect(Boolean(token)).toBe(true);
      const callbackContext = await browser.newContext({ viewport: { width, height: 900 }, isMobile: width === 390, hasTouch: width === 390, ignoreHTTPSErrors: true });
      try {
        const callback = await callbackContext.newPage();
        const callbackErrors: string[] = [];
        callback.on('pageerror', error => callbackErrors.push(error.message));
        await callback.addInitScript(() => localStorage.setItem('graphdone:viewMode', 'cards'));
        await callback.goto(`${getBaseURL()}/login?token=${encodeURIComponent(token!)}`);
        await expect(callback).toHaveURL(new URL('/', getBaseURL()).href);
        await expect(callback.getByTestId('workspace-content')).toBeVisible();
        expect((await gql(callback, '{ me { role } }')).me.role).toBe('VIEWER');
        expect(await callback.evaluate(() => !window.location.search.includes('token='))).toBe(true);
        await callback.goto(`${getBaseURL()}/admin`);
        await expect(callback).toHaveURL(new URL('/', getBaseURL()).href);
        expect(callbackErrors).toEqual([]);
      } finally {
        await callbackContext.close();
      }
    });
  });
}
