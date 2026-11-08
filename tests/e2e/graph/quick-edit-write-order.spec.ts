import { test, expect } from '@playwright/test';
import { login, TEST_USERS } from '../../lib/auth';
import { gql } from '../../lib/graphRequest';

/**
 * Two quick changes to one field must store the second (#254). Quick edit
 * saves each change as it happens; the first save is held back here so it
 * would land after the second one if both were sent at once.
 */
test('two quick priority changes store the last one, even when the first save is slow @quickedit', async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await login(page, TEST_USERS.ADMIN);
  const me = (await gql(page, '{me{id}}')).me.id;
  const graph = (await gql(page, 'mutation($input:[GraphCreateInput!]!){createGraphs(input:$input){graphs{id}}}', { input: [{ name: '[E2E] quick edit write order', type: 'PROJECT', status: 'ACTIVE', createdBy: me }] })).createGraphs.graphs[0].id;
  try {
    const item = (await gql(page, 'mutation($input:[WorkItemCreateInput!]!){createWorkItems(input:$input){workItems{id}}}', { input: [{ title: 'Book the hall', type: 'TASK', status: 'PLANNED', priority: 0.5, positionX: 0, positionY: 0, positionZ: 0, graph: { connect: { where: { node: { id: graph } } } } }] })).createWorkItems.workItems[0].id;
    const sent: number[] = [];
    await page.route('**/graphql', async route => {
      const body = route.request().postData() ?? '';
      const priority = /"update":\{"priority":([\d.]+)\}/.exec(body)?.[1];
      if (priority === undefined) return route.continue();
      sent.push(Number(priority));
      if (Number(priority) === 1) await new Promise(resolve => setTimeout(resolve, 1500));
      return route.continue();
    });
    await page.evaluate(id => { localStorage.setItem('currentGraphId', id); localStorage.setItem('graphdone:viewMode', 'graph'); }, graph);
    await page.goto('/');
    const card = page.locator('.graph-container .node').first();
    await expect(card).toBeVisible();
    await expect.poll(() => page.evaluate(() => (window as any).__layoutMetrics?.()?.atRest), { timeout: 10_000 }).toBe(true);
    await card.locator('.node-bg').dblclick();
    const slider = page.getByTestId('quick-priority');
    await expect(slider).toBeVisible();
    await slider.focus();
    await slider.press('End');
    await slider.press('ArrowLeft');
    await expect(page.getByTestId('quick-priority-value')).toHaveText('95%');
    const stored = async () => (await gql(page, 'query($id:ID!){workItems(where:{id:$id}){priority}}', { id: item })).workItems[0].priority;
    await expect.poll(() => sent, { timeout: 10_000 }).toEqual([1, 0.95]);
    await expect.poll(stored, { timeout: 10_000 }).toBeCloseTo(0.95, 3);
    // And it stays there once the slow first save has long finished.
    await page.waitForTimeout(2500);
    expect(await stored()).toBeCloseTo(0.95, 3);
  } finally {
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await gql(page, 'mutation($id:ID!){deleteWorkItems(where:{graph:{id:$id}}){nodesDeleted}}', { id: graph });
    await gql(page, 'mutation($id:ID!){deleteGraphs(where:{id:$id}){nodesDeleted}}', { id: graph });
  }
});
