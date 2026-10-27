import { expect, type Page } from '@playwright/test';

/** Exercise the backend's advertised UI, without manufacturing a proof. */
export async function completeAuthCaptcha(page: Page) {
  const server = page.getByTestId('server-captcha');
  const legacy = page.getByLabel('Verification answer');
  await expect(server.or(legacy)).toBeVisible();
  if (await server.isVisible()) {
    await server.getByRole('checkbox').click();
    await expect(server.getByRole('status')).toHaveText('Verification complete.', { timeout: 20000 });
    await expect(server.getByRole('checkbox')).toBeChecked();
  } else {
    const match = (await page.locator('body').innerText()).match(/(\d+)\s*([+−-])\s*(\d+)\s*=/);
    expect(match).toBeTruthy();
    await legacy.fill(String(match![2] === '+' ? +match![1] + +match![3] : +match![1] - +match![3]));
    await page.getByTestId('captcha-verify-btn').click();
  }
}
