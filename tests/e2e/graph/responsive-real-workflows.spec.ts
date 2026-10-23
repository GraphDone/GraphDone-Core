import { test, expect } from '@playwright/test';
import { login, TEST_USERS } from '../../lib/auth';

import { gql } from '../../lib/graphRequest';

// Each case owns its data. No mutations to the shared welcome graph.
for (const [width, height] of [[320,568], [390,844], [844,390], [768,1024], [1024,768], [1280,720], [1920,1080]]) {
  test.describe(`${width}×${height}`, () => {
  test.use({ hasTouch: width < 900 });
  test(`live analytics and editing fit ${width}×${height} @responsive @realwork`, async ({ page }) => {
    test.setTimeout(90000);
    page.setDefaultTimeout(10000);
    await page.setViewportSize({ width, height });
    await login(page, TEST_USERS.ADMIN);
    const me = await gql(page, '{ me { id } }');
    const result = await gql(page, 'mutation($input: [GraphCreateInput!]!) { createGraphs(input: $input) { graphs { id } } }', { input: [{ name: `Responsive ${width} ${Date.now()}`, type: 'PROJECT', status: 'ACTIVE', createdBy: me.me.id, isShared: true }] });
    const graphId = result.createGraphs.graphs[0].id;
    try {
      const created = await gql(page, 'mutation($input: [WorkItemCreateInput!]!) { createWorkItems(input: $input) { workItems { id title } } }', { input: [
        { title: 'Ship the first idea', type: 'TASK', status: 'IN_PROGRESS', priority: .8 },
        { title: 'Celebrate progress', type: 'TASK', status: 'COMPLETED', priority: .3 },
      ].map(item => ({ ...item, positionX: 0, positionY: 0, positionZ: 0, owner: { connect: { where: { node: { id: me.me.id } } } }, graph: { connect: { where: { node: { id: graphId } } } } })) });
      const editedItemId = created.createWorkItems.workItems.find((item: { id: string; title: string }) => item.title === 'Ship the first idea').id;
      await page.evaluate(id => { localStorage.setItem('currentGraphId', id); localStorage.setItem('graphdone:viewMode', 'graph'); }, graphId);
      await page.goto('/analytics');
      await expect(page.getByTestId('metric-work-items')).toHaveText('2');
      await expect(page.getByTestId('metric-completed')).toHaveText('1');
      await page.getByRole('button', { name: /^work$/i }).click();
      await page.getByLabel('Search work items').fill('Celebrate');
      await expect(page.getByTestId('live-analytics').getByRole('status')).toHaveText('1 matching work items');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: `test-artifacts/responsive-analytics-${width}x${height}.png` });
      await page.goto('/');
      const node = page.locator('.graph-container svg .node').filter({ hasText: 'Ship the first idea' }).first();
      await expect(node).toBeVisible({ timeout: 15000 });
      // Visibility alone includes SVG nodes outside the clipped viewport.
      await expect.poll(async () => {
        const box = await node.boundingBox();
        return !!box && box.x >= 0 && box.y >= 0 && box.x + box.width <= width && box.y + box.height <= height;
      }, { timeout: 15000 }).toBe(true);
      // Exactly one opening action; retries would hide a broken first tap.
      if (width < 900) {
          const box = await node.boundingBox();
          await page.touchscreen.tap(box!.x + box!.width / 2, box!.y + box!.height / 2);
        } else {
          await node.locator('.node-edit-icon').click();
        }
        await expect(page.getByTestId('quick-edit-surface')).toBeVisible({ timeout: 5000 });
      const surface = page.getByTestId('quick-edit-surface');
      if (width === 390) {
        // Rotate with the editor open, then return to portrait.
        for (const viewport of [{ width: 844, height: 390 }, { width, height }]) {
          await page.setViewportSize(viewport);
          await expect.poll(async () => {
            const bounds = await surface.boundingBox();
            return !!bounds && bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= viewport.width + 1 && bounds.y + bounds.height <= viewport.height + 1;
          }).toBe(true);
        }
      }
      const box = await surface.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.y).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(width + 1);
      expect(box!.y + box!.height).toBeLessThanOrEqual(height + 1);
      await page.getByTestId('quick-title').fill(`A real idea at ${width}`);
      await page.getByTestId('quick-title').blur();
      await expect.poll(async () => (await gql(page, 'query($id: ID!) { workItems(where: { graph: { id: $id } }) { title } }', { id: graphId })).workItems.some((i: {title: string}) => i.title === `A real idea at ${width}`)).toBe(true);
      const complete = page.getByTestId('quick-status').getByRole('button', { name: 'Completed', exact: true });
      if (width === 320) await page.route('**/graphql', async route => {
        const body = route.request().postDataJSON();
        if (body?.variables?.update?.status === 'COMPLETED') await new Promise(resolve => setTimeout(resolve, 750));
        await route.continue();
      });
      await complete.scrollIntoViewIfNeeded();
      expect((await complete.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      const savedStatus = page.waitForResponse(response => {
        if (!response.url().endsWith('/graphql') || response.request().method() !== 'POST') return false;
        const body = response.request().postDataJSON();
        return body?.variables?.where?.id === editedItemId && body?.variables?.update?.status === 'COMPLETED';
      });
      await complete.click();
      const response = await savedStatus;
      expect(response.ok()).toBe(true);
      const saved = await response.json();
      expect(saved.errors).toBeUndefined();
      expect(saved.data.updateWorkItems.workItems).toEqual(expect.arrayContaining([expect.objectContaining({ id: editedItemId, status: 'COMPLETED' })]));
      await expect(complete).toHaveAttribute('aria-pressed', 'true');
      const persisted = await gql(page, 'query($id: ID!) { workItems(where: { id: $id }) { id status } }', { id: editedItemId });
      expect(persisted.workItems).toEqual([{ id: editedItemId, status: 'COMPLETED' }]);
      await page.screenshot({ path: `test-artifacts/responsive-editor-${width}x${height}.png` });
      await page.keyboard.press('Escape');
      await expect(surface).toHaveCount(0);
      await page.goto('/analytics');
      await expect(page.getByTestId('metric-completed')).toHaveText('2');
    } finally {
      if (!page.isClosed()) {
      await gql(page, 'mutation($id: ID!) { deleteEdges(where: { source: { graph: { id: $id } } }) { nodesDeleted } }', { id: graphId });
      await gql(page, 'mutation($id: ID!) { deleteWorkItems(where: { graph: { id: $id } }) { nodesDeleted } }', { id: graphId });
      await gql(page, 'mutation($id: ID!) { deleteGraphs(where: { id: $id }) { nodesDeleted } }', { id: graphId });
      }
    }
  });
  });
}
