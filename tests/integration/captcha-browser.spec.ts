import { test, expect, type Page } from '@playwright/test';

test.beforeAll(async ({ request }) => {
  if (process.env.CAPTCHA_OWNED_TARGET !== '1' || !process.env.CAPTCHA_TEST_PASSWORD) {
    throw new Error('Use an owned production-mode Core fixture and provide CAPTCHA_OWNED_TARGET=1 and CAPTCHA_TEST_PASSWORD.');
  }
  const config = await (await request.get('/config')).json();
  expect(config.captcha.provider).toBe('altcha');
  expect(config.captcha.requiredActions).toEqual(expect.arrayContaining(['login', 'signup', 'magic-link', 'forgot-password', 'reset-password']));
});

async function verify(page: Page) {
  const verification = page.getByTestId('server-captcha');
  await verification.getByRole('checkbox').click();
  await expect(verification.getByRole('status')).toHaveText('Verification complete.', { timeout: 20000 });
  await expect(verification.getByRole('checkbox')).toBeChecked();
}

test('direct REST and GraphQL reject absent and forged proof', async ({ request }) => {
  for (const captchaPayload of [undefined, 'ABC123']) {
    for (const [path, body] of [
      ['/auth/magic-link/request', { email: 'owned-captcha-negative@example.invalid' }],
      ['/auth/forgot-password', { email: 'owned-captcha-negative@example.invalid' }],
      ['/auth/reset-password', { token: 'owned-invalid-token', newPassword: 'OwnedNegativePassword!94' }],
    ] as const) {
      const response = await request.post(path, { data: { ...body, captchaPayload } });
      expect(response.status()).toBe(400);
      expect((await response.json()).error).toMatch(/CAPTCHA verification failed/);
    }
    const response = await request.post('/api/graphql', { data: {
      query: 'mutation($input:LoginInput!){renamed:login(input:$input){token}}',
      variables: { input: { emailOrUsername: 'owned-captcha-negative@example.invalid', password: 'invalid', captchaPayload } },
    } });
    const result = await response.json();
    expect(result.errors[0].extensions.code).toBe('CAPTCHA_FAILED');
    expect(result.data).toBeNull();
  }
});

for (const width of [390, 1440]) test(`real proof, failed password and accessible retry at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await page.goto('/login-form');
  await page.getByRole('tab', { name: 'Password', exact: true }).click();
  await page.getByLabel('Email address or username', { exact: true }).fill('admin');
  await page.getByLabel('Password', { exact: true }).fill('wrong-owned-password');
  await verify(page);
  const loginResponse = () => page.waitForResponse(response => {
    try { return response.url().endsWith('/api/graphql') && response.request().postDataJSON()?.operationName === 'Login'; }
    catch { return false; }
  });
  const failed = loginResponse();
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  expect((await (await failed).json()).errors[0].extensions.code).toBe('UNAUTHENTICATED');
  await expect(page.getByTestId('server-captcha').getByRole('status')).toHaveText('Complete verification before continuing.');
  const retry = page.getByRole('button', { name: 'Retry verification', exact: true });
  await retry.focus();
  await page.keyboard.press('Enter');
  await page.getByLabel('Password', { exact: true }).fill(process.env.CAPTCHA_TEST_PASSWORD!);
  await verify(page);
  const accepted = loginResponse();
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  const result = await (await accepted).json();
  expect(result.errors).toBeUndefined();
  expect(result.data.login.user.username).toBe('admin');
  await expect(page).toHaveURL(/\/$/);
});

test('pending, failed and expired verification cannot submit a password; keyboard retry recovers', async ({ page }) => {
  let logins = 0;
  page.on('request', request => {
    try { if (request.postDataJSON()?.operationName === 'Login') logins++; } catch { /* non-JSON requests */ }
  });
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/config', async route => { await pending; await route.abort().catch(() => {}); });
  await page.goto('/login-form');
  await page.getByRole('tab', { name: 'Password', exact: true }).click();
  await page.getByLabel('Email address or username', { exact: true }).fill('admin');
  await page.getByLabel('Password', { exact: true }).fill(process.env.CAPTCHA_TEST_PASSWORD!);
  const submit = page.getByRole('button', { name: 'Sign In', exact: true });
  await expect(submit).toBeDisabled();
  await page.locator('form').dispatchEvent('submit');
  expect(logins).toBe(0);
  release();
  await expect(page.getByRole('alert').filter({ hasText: 'Verification is unavailable' })).toBeVisible();
  await expect(submit).toBeDisabled();
  await page.locator('form').dispatchEvent('submit');
  expect(logins).toBe(0);
  await page.unroute('**/config');
  await page.getByRole('button', { name: 'Retry verification' }).focus();
  await page.keyboard.press('Enter');
  await verify(page);
  await expect(submit).toBeEnabled();
  // Isolate the UI's expiry-event contract; actual server expiry is covered by
  // the clock-controlled helper negative, without a five-minute browser sleep.
  await page.locator('altcha-widget').evaluate(element => element.dispatchEvent(new CustomEvent('statechange', { detail: { state: 'expired' } })));
  await expect(submit).toBeDisabled();
  await page.locator('form').dispatchEvent('submit');
  expect(logins).toBe(0);
});
