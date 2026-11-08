import { test, expect } from '@playwright/test';

for (const [width, height] of [[320,568], [390,844], [844,390], [768,1024], [1440,900]]) {
  test(`guest dialog avoids unnecessary scrolling ${width}x${height} @responsive`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/login');
    await page.getByRole('button', { name: 'Continue as Guest', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Continue as Guest?' });
    const content = page.getByTestId('guest-dialog-content');
    await expect(dialog).toBeVisible();
    expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden');
    const checkFit = async () => {
      const bounds = (await dialog.boundingBox())!;
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.y).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(height);
      const overflow = await content.evaluate(el => ({ x: el.scrollWidth - el.clientWidth, y: el.scrollHeight - el.clientHeight }));
      expect(overflow.x).toBeLessThanOrEqual(1);
      if (height >= 568) expect(overflow.y).toBeLessThanOrEqual(1);
      const footer = (await dialog.getByRole('button', { name: 'Continue as Guest', exact: true }).boundingBox())!;
      expect(footer.y + footer.height).toBeLessThanOrEqual(height);
    };
    await checkFit();
    const confirm = dialog.getByRole('button', { name: 'Continue as Guest', exact: true });
    await expect(confirm).toBeDisabled();
    const problem = await dialog.getByText(/^\d+ [+-] \d+ = \?$/).textContent();
    const [, a, op, b] = problem!.match(/(\d+) ([+-]) (\d+)/)!;
    await dialog.getByLabel('Verification answer').fill(String(op === '+' ? Number(a) + Number(b) : Number(a) - Number(b)));
    await dialog.getByTestId('captcha-verify-btn').click();
    await expect(confirm).toBeEnabled();
    await checkFit();
    await page.screenshot({ path: `test-artifacts/guest-dialog-${width}x${height}.png` });
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    expect(await page.evaluate(() => document.body.style.overflow)).not.toBe('hidden');
  });
}
