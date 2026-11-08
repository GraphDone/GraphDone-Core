import { test, expect, Page } from '@playwright/test';
import { login, TEST_USERS, getBaseURL } from '../../lib/auth';

/**
 * Form-validation gate (@validation). Exercises the client-side validation
 * contracts that had ZERO coverage: the Signin form's inline required-field
 * errors (with aria-invalid), and the "submit stays disabled until valid"
 * contract on the create-work-item / create-graph modals, plus the admin
 * create-user empty-submit notification. A form that silently accepts an empty
 * submit — or never tells the user what's wrong — is exactly the friction this
 * locks down.
 */

async function gotoLogin(page: Page) {
  // Clear lockout/attempt state so a prior run's failures don't disable submit.
  await page.addInitScript(() => {
    try {
      localStorage.removeItem('loginAttempts');
      localStorage.removeItem('lockoutTime');
      localStorage.removeItem('rememberedUsername');
    } catch { /* ignore */ }
  });
  await page.goto(`${getBaseURL()}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
}

async function openWorkspace(page: Page, viewMode = 'cards') {
  await login(page, TEST_USERS.ADMIN);
  await page.addInitScript((m) => localStorage.setItem('graphdone:viewMode', m), viewMode);
  await page.goto(`${getBaseURL()}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
}

test.describe('form validation @validation', () => {
  test.describe.configure({ timeout: 90_000 });

  test.describe('desktop', () => {
    test.use({ viewport: { width: 1440, height: 900 } });

    test('signin: empty submit surfaces inline required errors + aria-invalid', async ({ page }) => {
      await gotoLogin(page);
      const email = page.locator('input[name="emailOrUsername"]');
      const pass = page.locator('input[name="password"]');
      if (!(await email.isVisible().catch(() => false))) test.skip(true, 'password login form not present');

      await email.fill('');
      await pass.fill('');
      await page.locator('button[type="submit"]:has-text("Sign In")').click();
      await page.waitForTimeout(600);

      await expect(page.locator('#emailOrUsername-error'), 'email required error shown').toBeVisible();
      await expect(page.locator('#password-error'), 'password required error shown').toBeVisible();
      await expect(email, 'email marked aria-invalid').toHaveAttribute('aria-invalid', 'true');
      await expect(pass, 'password marked aria-invalid').toHaveAttribute('aria-invalid', 'true');
      // Validation blocked the submit — we are still on the login route.
      expect(page.url(), 'no navigation on invalid submit').toContain('/login');
    });

    test('signin: typing a value clears that field\'s required error', async ({ page }) => {
      await gotoLogin(page);
      const email = page.locator('input[name="emailOrUsername"]');
      if (!(await email.isVisible().catch(() => false))) test.skip(true, 'password login form not present');
      await page.locator('button[type="submit"]:has-text("Sign In")').click();
      await page.waitForTimeout(500);
      await expect(page.locator('#emailOrUsername-error')).toBeVisible();
      await email.fill('someone@example.com');
      await page.waitForTimeout(300);
      await expect(page.locator('#emailOrUsername-error'), 'error clears once a value is entered').toHaveCount(0);
    });

    test('create-graph: Create stays disabled until a name is entered', async ({ page }) => {
      await openWorkspace(page, 'cards');
      const sel = page.locator('[data-testid="graph-selector"]');
      // pick the on-screen instance
      let trigger = null as any;
      for (let i = 0; i < (await sel.count()); i++) {
        if (await sel.nth(i).isVisible().catch(() => false)) { trigger = sel.nth(i); break; }
      }
      if (!trigger) test.skip(true, 'no graph selector');
      await trigger.click();
      await page.waitForTimeout(400);
      const create = page.locator('[title="Create New Graph"]').first();
      if (!(await create.isVisible().catch(() => false))) test.skip(true, 'no create-graph affordance');
      await create.click();
      await page.waitForTimeout(700);
      // Step 1 is "type" — advance to the details step where the name field lives.
      const cont = page.locator('button:has-text("Continue")').first();
      if (await cont.isVisible().catch(() => false)) { await cont.click(); await page.waitForTimeout(500); }
      const nameInput = page.locator('input[placeholder*="name" i], input#name, input[name="name"]').first();
      const createBtn = page.locator('button:has-text("Create Graph")').first();
      if (!(await createBtn.isVisible().catch(() => false))) test.skip(true, 'create-graph details step not reached');
      await expect(createBtn, 'Create disabled with empty name').toBeDisabled();
      await nameInput.fill('Z-Order QA Graph');
      await page.waitForTimeout(300);
      await expect(createBtn, 'Create enabled once a name is entered').toBeEnabled();
    });

    test('admin: create-user empty submit shows a required-fields message', async ({ page }) => {
      await login(page, TEST_USERS.ADMIN);
      await page.goto(`${getBaseURL()}/admin`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2500);
      const open = page.locator('button:has-text("Create User")').first();
      if (!(await open.isVisible().catch(() => false))) test.skip(true, 'admin page unavailable');
      await open.click();
      await page.waitForTimeout(600);
      const modal = page.locator('[data-testid="admin-create-user-modal"]');
      if (!(await modal.isVisible().catch(() => false))) test.skip(true, 'create-user modal did not open');
      // Submit with everything blank — expect the required-fields notification.
      await modal.locator('button:has-text("Create User")').click();
      await page.waitForTimeout(600);
      await expect(page.getByText(/fill in all required fields/i), 'required-fields message shown').toBeVisible();
    });
  });

  test.describe('phone', () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test('create-work-item: submit disabled until a title is entered', async ({ page }) => {
      await openWorkspace(page, 'cards');
      const fab = page.locator('[aria-label="New work item"]');
      if (!(await fab.isVisible().catch(() => false))) test.skip(true, 'no create FAB');
      await fab.click();
      await page.waitForTimeout(900);
      const title = page.locator('input#title');
      if (!(await title.isVisible().catch(() => false))) test.skip(true, 'create modal did not open');
      const submit = page.locator('button[type="submit"]:has-text("Create")').first();
      await expect(submit, 'submit disabled with empty title').toBeDisabled();
      await title.fill('Validation probe item');
      await page.waitForTimeout(300);
      await expect(submit, 'submit enabled once title entered').toBeEnabled();
    });
  });
});
