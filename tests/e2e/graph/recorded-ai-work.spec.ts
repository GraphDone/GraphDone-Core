import { test, expect } from '@playwright/test';
import { login, TEST_USERS } from '../../lib/auth';
import { gql } from '../../lib/graphRequest';

for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
  test(`API progress reaches the human workspace ${viewport.width} @realwork`, async ({ page }) => {
    test.setTimeout(90000);
    await page.setViewportSize(viewport);
    await login(page, TEST_USERS.ADMIN);
    const { me } = await gql(page, '{ me { id } }');
    const { createGraphs } = await gql(page, 'mutation($input:[GraphCreateInput!]!) { createGraphs(input:$input) { graphs { id } } }', { input: [{ name: `Recorded AI ${Date.now()}`, type: 'PROJECT', status: 'ACTIVE', createdBy: me.id, isShared: true }] });
    const graphId = createGraphs.graphs[0].id;
    let contributorId: string | undefined;
    try {
      const { createContributors } = await gql(page, 'mutation { createContributors(input:[{name:"Build assistant",type:AI_AGENT}]) { contributors { id } } }');
      contributorId = createContributors.contributors[0].id;
      const connect = (id: string) => ({ connect: { where: { node: { id } } } });
      const { createWorkItems } = await gql(page, 'mutation($input:[WorkItemCreateInput!]!) { createWorkItems(input:$input) { workItems { id } } }', { input: [{ title: 'Make progress visible', type: 'TASK', status: 'IN_PROGRESS', priority: .7, positionX: 0, positionY: 0, positionZ: 0, owner: connect(me.id), graph: connect(graphId), contributors: connect(contributorId!) }] });
      const itemId = createWorkItems.workItems[0].id;
      await page.evaluate(id => localStorage.setItem('currentGraphId', id), graphId);
      await page.goto('/agents');
      await expect(page.getByText('1 recorded AI contributors · 1 work items', { exact: true })).toBeVisible();
      await expect(page.getByText('Contributors: Build assistant', { exact: true })).toBeVisible();
      // Simulate an external authenticated API update while the human stays on
      // the page. This is CRUD visibility, not agent execution or a work lease.
      const note = 'Implementation ready. Please review the acceptance checks.';
      await gql(page, 'mutation($id:ID!,$update:WorkItemUpdateInput!) { updateWorkItems(where:{id:$id},update:$update) { workItems { id } } }', { id: itemId, update: { status: 'BLOCKED', metadata: JSON.stringify({ statusNotes: [{ id: 'progress-1', text: note, at: Date.now() }] }) } });
      await expect(page.getByText(note, { exact: true })).toBeVisible({ timeout: 25000 });
      await expect(page.getByText('Blocked', { exact: true })).toBeVisible();
      await page.screenshot({ path: `test-artifacts/recorded-ai-${viewport.width}.png` });
      await page.evaluate(() => localStorage.setItem('graphdone:viewMode', 'activity'));
      await page.goto('/');
      await expect(page.getByText(note, { exact: true })).toBeVisible();
      await page.reload();
      await expect(page.getByText(note, { exact: true })).toBeVisible();
      await expect(page.getByText('Status Changed', { exact: true })).toHaveCount(0);
    } finally {
      if (!page.isClosed()) {
        await gql(page, 'mutation($id:ID!) { deleteWorkItems(where:{graph:{id:$id}}) { nodesDeleted } deleteGraphs(where:{id:$id}) { nodesDeleted } }', { id: graphId });
        if (contributorId) await gql(page, 'mutation($id:ID!) { deleteContributors(where:{id:$id}) { nodesDeleted } }', { id: contributorId });
      }
    }
  });
}
