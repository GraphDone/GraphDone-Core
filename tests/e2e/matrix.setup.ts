import { test as setup } from '@playwright/test';
import { login, TEST_USERS } from '../lib/auth';

// One real login for the whole matrix run; every feature-matrix test reuses this
// storage state so the ~100-cell resolution×feature sweep doesn't re-login each
// time. (Wired via the `matrix` project's dependencies + storageState.)
const AUTH_FILE = 'test-artifacts/matrix-auth.json';

setup('authenticate for the matrix', async ({ page }) => {
  await login(page, TEST_USERS.ADMIN);
  await page.context().storageState({ path: AUTH_FILE });
});
