import { test, expect } from '@playwright/test';
import { login, TEST_USERS, getBaseURL } from '../../lib/auth';
import { auditDialog } from '../../lib/mobileAudit';
import { gql } from '../../lib/graphRequest';

/**
 * Automated dialog sweep — opens the modals a phone user actually hits and
 * verifies each fits the viewport AND is painted on top (not clipped by / under
 * the bottom nav). Catches the stacking-context bug class (a modal trapped in a
 * z-20 ancestor losing to the z-30 nav). Tagged @audit.
 */
test.use({ viewport: { width: 390, height: 844 } });
test.beforeEach(({page}) => { page.setDefaultTimeout(10000); });

async function openListView(page: import('@playwright/test').Page) {
  await login(page, TEST_USERS.ADMIN);
  const owner = (await gql(page, '{me{id}}')).me.id;
  const graphId = (await gql(page, 'mutation($input:[GraphCreateInput!]!){createGraphs(input:$input){graphs{id}}}', {
    input: [{name: `Mobile dialog ${Date.now()}`, type: 'PROJECT', status: 'ACTIVE', createdBy: owner}],
  })).createGraphs.graphs[0].id;
  const cleanup = async () => {
    await gql(page, 'mutation($id:ID!){deleteEdges(where:{OR:[{source:{graph:{id:$id}}},{target:{graph:{id:$id}}}]}){nodesDeleted}}', {id: graphId});
    await gql(page, 'mutation($id:ID!){deleteWorkItems(where:{graph:{id:$id}}){nodesDeleted}}', {id: graphId});
    await gql(page, 'mutation($id:ID!){deleteGraphs(where:{id:$id}){nodesDeleted}}', {id: graphId});
  };
  try {
    await gql(page, 'mutation($input:[WorkItemCreateInput!]!){createWorkItems(input:$input){workItems{id}}}', {
      input: [{title: 'Mobile dialog fixture', type: 'TASK', status: 'PLANNED', positionX: 300, positionY: 300, positionZ: 0, graph: {connect: {where: {node: {id: graphId}}}}}],
    });
    await page.evaluate(id => {
      localStorage.setItem('currentGraphId', id);
      localStorage.setItem('graphdone:viewMode', 'cards');
    }, graphId);
    await page.goto(`${getBaseURL()}/`, {waitUntil: 'domcontentloaded'});
    await expect(page.getByTestId('view-content').getByText('Mobile dialog fixture', {exact: true})).toBeVisible();
    return cleanup;
  } catch (error) {
    await cleanup();
    throw error;
  }
}

test.describe('mobile dialogs fit the screen and sit above the nav @audit', () => {
  test('work-item edit modal (tap a list card)', async ({ page }) => {
    const cleanup = await openListView(page);
    try {
      await page.getByTestId('view-content').getByText('Mobile dialog fixture', {exact: true}).click();
      await expect(page.getByRole('dialog', {name: 'Work item details', exact: true})).toBeVisible();
      const d = await auditDialog(page, 'Edit work');
      expect(d.found, 'edit modal opened').toBe(true);
      expect(d.fitsWidth, 'edit modal fits viewport width').toBe(true);
      expect(d.fitsHeight, 'edit modal fits viewport height').toBe(true);
      expect(d.coveredBy, 'edit modal is on top (nothing painted over it)').toBeNull();
    } finally { await cleanup(); }
  });

  test('create-work-item modal (the + FAB)', async ({ page }) => {
    const cleanup = await openListView(page);
    try {
      const create = page.getByRole('button', {name: 'New work item', exact: true}).and(page.locator(':visible'));
      await expect(create).toHaveCount(1);
      await create.click();
      await expect(page.getByRole('heading', {name: 'New task', exact: true})).toBeVisible();
      const d = await auditDialog(page, 'New task');
      expect(d.found, 'create modal opened').toBe(true);
      expect(d.fitsWidth, 'create modal fits viewport width').toBe(true);
      expect(d.fitsHeight, 'create modal fits viewport height').toBe(true);
      expect(d.coveredBy, 'create modal is on top (nothing painted over it)').toBeNull();
    } finally { await cleanup(); }
  });
});
