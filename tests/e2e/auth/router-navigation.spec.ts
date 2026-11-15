import { test, expect, type Page } from '@playwright/test';
import { randomBytes, randomUUID } from 'node:crypto';
import { join } from 'node:path';
import sqlite3 from 'sqlite3';
import { login, TEST_USERS, getBaseURL, getAuthState } from '../../lib/auth';
import { gql } from '../../lib/graphRequest';

async function ownedLoginLink(username: string) {
  const database = new sqlite3.Database(join(process.cwd(), 'packages/server/data/auth.db'));
  const run = (sql: string, values: unknown[]) => new Promise<void>((resolve, reject) => database.run(sql, values, error => error ? reject(error) : resolve()));
  try {
    const account = await new Promise<{ id: string; email: string; authVersion: number }>((resolve, reject) => database.get(
      'SELECT id, email, authVersion FROM users WHERE username = ? AND isActive = 1', [username],
      (error, row: { id: string; email: string; authVersion: number }) => error ? reject(error) : row ? resolve(row) : reject(new Error(`No active ${username} account`))));
    const token = randomBytes(32).toString('hex');
    const now = Date.now();
    await run('INSERT INTO magic_links (id, email, token, expiresAt, createdAt, purpose, userId, authVersion) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [randomUUID(), account.email.toLowerCase(), token, new Date(now + 15 * 60 * 1000).toISOString(), new Date(now).toISOString(), 'login', account.id, account.authVersion]);
    return { token, email: account.email };
  } finally {
    await new Promise<void>(resolve => database.close(() => resolve()));
  }
}

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

    test('viewer route guards hold and a token in the sign-in address never signs a fresh browser in', async ({ page, browser }) => {
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
        await callback.getByRole('tab', { name: 'Password', exact: true }).click();
        await expect(callback.locator('input[name="emailOrUsername"]')).toBeVisible();
        await expect(callback.getByTestId('workspace-content')).toHaveCount(0);
        expect(await callback.evaluate(() => localStorage.getItem('authToken') ?? sessionStorage.getItem('authToken'))).toBeNull();
        await callback.goto(`${getBaseURL()}/admin`);
        await expect(callback).toHaveURL(new URL('/', getBaseURL()).href);
        await expect(callback.getByRole('heading', { name: 'System Administration', exact: true })).toHaveCount(0);
        await callback.getByRole('tab', { name: 'Password', exact: true }).click();
        await expect(callback.locator('input[name="emailOrUsername"]')).toBeVisible();
        expect(callbackErrors).toEqual([]);
      } finally {
        await callbackContext.close();
      }
    });

    test('an emailed sign-in link asks for confirmation and never puts the session in an address', async ({ browser }) => {
      const link = await ownedLoginLink(TEST_USERS.VIEWER.username);
      const context = await browser.newContext({ viewport: { width, height: 900 }, isMobile: width === 390, hasTouch: width === 390, ignoreHTTPSErrors: true });
      try {
        const page = await context.newPage();
        const pageErrors: string[] = [];
        const addresses: string[] = [];
        page.on('pageerror', error => pageErrors.push(error.message));
        page.on('request', request => addresses.push(request.url()));
        page.on('framenavigated', frame => addresses.push(frame.url()));
        await page.addInitScript(() => localStorage.setItem('graphdone:viewMode', 'cards'));
        await page.goto(`${getBaseURL()}/auth/magic-link/verify?token=${link.token}`);
        await expect(page.getByRole('heading', { name: `Finish signing in as ${link.email}?`, exact: true })).toBeVisible();
        expect(page.url()).toBe(new URL('/login', getBaseURL()).href);
        expect(addresses.some(address => address.includes('/login#handover='))).toBe(true);
        expect(await page.evaluate(() => localStorage.getItem('authToken') ?? sessionStorage.getItem('authToken'))).toBeNull();
        await page.getByRole('button', { name: 'Continue', exact: true }).click();
        await expect(page).toHaveURL(new URL('/', getBaseURL()).href);
        await expect(page.getByTestId('workspace-content')).toBeVisible();
        expect((await gql(page, '{ me { role } }')).me.role).toBe('VIEWER');
        const session = await page.evaluate(() => localStorage.getItem('authToken'));
        expect(session).toMatch(/^eyJ/);
        for (const address of addresses) {
          expect(address).not.toContain(session!);
          if (!address.includes('/auth/magic-link/verify?token=')) expect(address).not.toContain('token=');
        }
        expect(pageErrors).toEqual([]);
      } finally {
        await context.close();
      }
    });
  });
}
