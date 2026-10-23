import { test, expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { login, TEST_USERS } from '../../lib/auth';
import { gql } from '../../lib/graphRequest';

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

test.describe('mobile graph touch @mobile @touch', () => {
  test('a locked-node touch opens its editor and persists the edited task', async ({ page }, info) => {
    test.setTimeout(90000);
    await login(page, TEST_USERS.ADMIN);
    const owner = (await gql(page, '{me{id}}')).me.id;
    const graphId = (await gql(page,
      'mutation($input:[GraphCreateInput!]!){createGraphs(input:$input){graphs{id}}}',
      { input: [{ name: `Mobile touch ${Date.now()}`, type: 'PROJECT', status: 'ACTIVE', createdBy: owner }] },
    )).createGraphs.graphs[0].id;
    let nodeCount = 0;
    try {
      const title = 'Owned touch task';
      const savedTitle = 'Saved by a locked touch';
      const created = (await gql(page,
        'mutation($input:[WorkItemCreateInput!]!){createWorkItems(input:$input){workItems{id}}}',
        { input: [{ title, type: 'TASK', status: 'PLANNED', positionX: 400, positionY: 300, positionZ: 0,
          graph: { connect: { where: { node: { id: graphId } } } },
        }] },
      )).createWorkItems.workItems;
      nodeCount = created.length;
      expect(nodeCount).toBe(1);
      const id = created[0].id;
      const readSaved = async () => (await gql(page,
        'query($id:ID!,$graph:ID!){workItems(where:{id:$id,graph:{id:$graph}}){id title status positionX positionY positionZ}}',
        { id, graph: graphId },
      )).workItems;
      const expectedSaved = { id, title: savedTitle, status: 'PLANNED', positionX: 400, positionY: 300, positionZ: 0 };
      await page.evaluate(graph => {
        localStorage.setItem('currentGraphId', graph);
        localStorage.setItem('graphdone:viewMode', 'graph');
      }, graphId);
      await page.reload({ waitUntil: 'domcontentloaded' });
      const node = page.locator('.graph-container .node');
      await node.locator('.node-bg').waitFor({ state: 'visible', timeout: 30000 });
      await expect(node).toHaveCount(1);
      await expect(node).toContainText(title);
      expect(await node.evaluate(element => (element as any).__data__.id)).toBe(id);
      await page.waitForTimeout(4000);

      const lock = page.getByTestId('graph-lock-toggle');
      await expect(lock).toBeVisible();
      await expect(lock).toHaveText('Locked');
      const touchPoints = await page.evaluate(() => navigator.maxTouchPoints);
      expect(touchPoints, 'the browser context supports touch events').toBeGreaterThan(0);
      const editor = page.getByRole('dialog', { name: 'Edit work item', exact: true });
      await expect(editor).toHaveCount(0);
      await node.locator('.node-bg').tap();
      await expect(editor).toBeVisible({ timeout: 8000 });
      await expect(editor.getByTestId('quick-title')).toHaveValue(title);
      await expect(editor.getByRole('button', { name: 'Details & connections', exact: true })).toBeVisible();
      await expect(lock).toHaveText('Locked');

      await editor.getByTestId('quick-title').fill(savedTitle);
      const acknowledgement = page.waitForResponse(response => {
        const request = response.request();
        if (request.method() !== 'POST' || !new URL(response.url()).pathname.endsWith('/graphql')) return false;
        try {
          const payload = request.postDataJSON();
          return payload?.query?.includes('updateWorkItems') && payload.variables?.where?.id === id
            && payload.variables?.update?.title === savedTitle;
        } catch { return false; }
      }, { timeout: 8000 });
      await editor.getByTestId('quick-description').tap();
      const response = await acknowledgement;
      expect(response.ok(), 'the owned title update succeeds over HTTP').toBe(true);
      const body = await response.json();
      expect(body.errors, 'the owned title update has no GraphQL errors').toBeUndefined();
      expect(body.data.updateWorkItems.workItems).toEqual([expect.objectContaining({ id, title: savedTitle })]);
      expect(await readSaved()).toEqual([expectedSaved]);
      await editor.getByRole('button', { name: 'Close quick edit', exact: true }).tap();
      await expect(editor).toHaveCount(0);
      await expect(lock).toHaveText('Locked');

      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(node).toHaveCount(1);
      await expect.poll(async () => (await node.locator('.node-title-text').allTextContents()).join(' ')).toBe(savedTitle);
      expect(await node.evaluate(element => (element as any).__data__.id)).toBe(id);
      await expect(lock).toHaveText('Locked');
      await node.locator('.node-bg').tap();
      await expect(editor).toBeVisible({ timeout: 8000 });
      await expect(editor.getByTestId('quick-title')).toHaveValue(savedTitle);
      const persisted = await readSaved();
      expect(persisted).toEqual([expectedSaved]);
      const evidencePath = info.outputPath('touch-edit-readback.json');
      await writeFile(evidencePath, JSON.stringify({ graphId, touchPoints, locked: true, persisted }, null, 2));
      await info.attach('touch-edit-readback.json', { path: evidencePath, contentType: 'application/json' });
      await editor.getByRole('button', { name: 'Close quick edit', exact: true }).tap();
      await expect(editor).toHaveCount(0);
    } finally {
      const edges = await gql(page,
        'mutation($id:ID!){deleteEdges(where:{OR:[{source:{graph:{id:$id}}},{target:{graph:{id:$id}}}]}){nodesDeleted}}', { id: graphId });
      expect(edges.deleteEdges.nodesDeleted).toBe(0);
      const nodes = await gql(page, 'mutation($id:ID!){deleteWorkItems(where:{graph:{id:$id}}){nodesDeleted}}', { id: graphId });
      expect(nodes.deleteWorkItems.nodesDeleted).toBe(nodeCount);
      const graph = await gql(page, 'mutation($id:ID!){deleteGraphs(where:{id:$id}){nodesDeleted}}', { id: graphId });
      expect(graph.deleteGraphs.nodesDeleted).toBe(1);
    }
  });
});
