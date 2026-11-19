import { devices, expect, test } from '@playwright/test';
import { openGraphView } from '../../lib/journeys/workspace';
import { touchGesture, type TouchPoint } from '../../lib/journeys/touchContacts';

test.use({ ...devices['iPhone 14'], browserName: 'chromium' });

test('a selected mobile Graph view can finish loading without clicking the tab again @mobile', async ({ page }) => {
  await page.setContent(`
    <nav data-testid="mobile-bottom-nav"><button aria-pressed="true">Graph</button></nav>
    <script>
      document.querySelector('button').onclick = () => document.body.dataset.reselected = 'true';
    </script>
  `);
  await page.evaluate(() => setTimeout(() => {
    const graph = document.createElement('div');
    graph.className = 'graph-container';
    graph.textContent = 'Welcome';
    document.body.appendChild(graph);
  }, 400));
  await openGraphView(page);
  await expect(page.locator('.graph-container')).toHaveText('Welcome');
  await expect(page.locator('body')).not.toHaveAttribute('data-reselected', 'true');
});

for (const state of ['aria-pressed="false"', '']) {
  test(`Graph opens from List using the ${state ? 'current' : 'legacy'} mobile tab @mobile`, async ({ page }) => {
    await page.setContent(`
      <nav data-testid="mobile-bottom-nav"><button ${state}>Graph</button></nav>
      <script>
        document.querySelector('button').onclick = event => {
          event.currentTarget.setAttribute('aria-pressed', 'true');
          const graph = document.createElement('div');
          graph.className = 'graph-container';
          graph.textContent = 'Welcome';
          document.body.appendChild(graph);
        };
      </script>
    `);
    await openGraphView(page);
    await expect(page.getByRole('button', { name: 'Graph', pressed: true })).toBeVisible();
    await expect(page.locator('.graph-container')).toHaveText('Welcome');
  });
}

test('a failed check during a phone pinch releases both contacts @mobile', async ({ page }) => {
  await page.setContent(`
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <style>body { margin: 0; height: 100vh; touch-action: none }</style>
    <script>
      for (const type of ['touchstart', 'touchend', 'touchcancel']) {
        document.addEventListener(type, event => {
          document.body.dataset.contacts = String(event.touches.length);
        });
      }
    </script>
  `);
  const frames: [TouchPoint, TouchPoint][] = [
    [{ x: 100, y: 120 }, { x: 140, y: 120 }],
    [{ x: 90, y: 120 }, { x: 150, y: 120 }],
  ];
  const failure = new Error('interrupted phone gesture');
  await expect(touchGesture(page, frames, async () => {
    await expect(page.locator('body')).toHaveAttribute('data-contacts', '2');
    throw failure;
  })).rejects.toBe(failure);
  await expect(page.locator('body')).toHaveAttribute('data-contacts', '0');
  await touchGesture(page, frames);
  await expect(page.locator('body')).toHaveAttribute('data-contacts', '0');
});
