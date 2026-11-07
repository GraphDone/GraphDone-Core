import { test, expect } from '@playwright/test';

/**
 * Agent enrollment approval on the smallest supported phone. After approval the
 * result and the next action must fit 320x568 without scrolling. Pre-decision
 * verification guidance (matching the fingerprint, who supplied the agent name)
 * is shown only while the request is pending, and the decision is shown above
 * the requester-supplied details so a long purpose cannot push it off screen.
 *
 * The enrollment API and the human check are local route fixtures: this
 * verifies layout and state presentation, not the hosted enrollment service.
 */
const request = {
  agentName: 'School project helper',
  projectName: 'A family science project',
  purpose: 'Keep the experiment plan and progress notes together.',
  scope: 'collaborate',
  fingerprint: 'd7a00d61a186',
  state: 'PENDING',
};
const guidance = 'Match this to your agent’s message.';

test.use({ viewport: { width: 320, height: 568 } });

const longPurpose = 'Keep the experiment plan, the shopping list, the weekly measurements and every progress note together so the whole family can see what is left to do before the science fair. '.repeat(3);

for (const purpose of [request.purpose, longPurpose])
test(`approved agent connection fits a 320x568 phone (${purpose.length} character purpose) @mobile`, async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('https://challenges.cloudflare.com/**', route => route.abort());
  let state = 'PENDING';
  await page.route('**/api/enrollment/**', async route => {
    const action = new URL(route.request().url()).pathname.split('/').pop();
    if (action === 'config') return route.fulfill({ json: { siteKey: 'local-fixture' } });
    if (action === 'review') return route.fulfill({ json: { ...request, purpose, state } });
    if (action === 'approve') {
      state = 'APPROVED';
      return route.fulfill({ json: { state } });
    }
    return route.fulfill({ status: 404, json: { error: 'Unexpected enrollment call' } });
  });
  await page.addInitScript(() => {
    (window as any).turnstile = {
      render: (element: HTMLElement, options: { callback: (token: string) => void }) => {
        const button = document.createElement('button');
        button.textContent = 'Complete local human check';
        button.style.minHeight = '44px';
        button.onclick = () => options.callback('human-proof');
        element.append(button);
        return 'fixture';
      },
      remove: () => {},
    };
  });

  await page.goto('/agent-approval#fixture-id.fixture-proof');
  await expect(page.getByRole('heading', { name: 'Your agent. Your permission.' })).toBeVisible();
  await expect(page.getByText(request.fingerprint, { exact: true })).toBeVisible();
  await expect(page.getByText(guidance, { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Complete local human check' }).click();
  await page.getByRole('button', { name: 'Approve connection' }).click();

  await expect(page.getByRole('status')).toContainText('Connection approved');
  await expect(page.getByText(request.fingerprint, { exact: true })).toBeVisible();
  const next = page.getByRole('link', { name: 'Review work and access', exact: true });
  await expect(next).toBeInViewport({ ratio: 1 });
  const size = await page.evaluate(() => ({
    scrollHeight: document.documentElement.scrollHeight,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  await expect(page.getByRole('status')).toBeInViewport({ ratio: 1 });
  // The requester-written purpose may scroll; the standard request must not.
  if (purpose === request.purpose)
    expect(size.scrollHeight, 'approved page needs no vertical scrolling').toBeLessThanOrEqual(568);
  expect(size.scrollWidth).toBeLessThanOrEqual(320);
  await expect(page.getByText(guidance, { exact: false })).toHaveCount(0);
  // Reopening the decided request shows its result first, without scrolling.
  await page.goto('about:blank');
  await page.goto('/agent-approval#fixture-id.fixture-proof');
  await expect(page.getByRole('status')).toContainText('Connection approved');
  await expect(next).toBeInViewport({ ratio: 1 });
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  expect(errors).toEqual([]);
});
