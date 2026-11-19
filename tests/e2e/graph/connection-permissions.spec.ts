import { devices, expect, test as base } from '@playwright/test';
import { login, TEST_USERS } from '../../lib/auth';
import { gql } from '../../lib/graphRequest';
import { ownedGraphIdsFixture, type OwnedGraphs } from '../../lib/ownedGraphIdsFixture';
import { cardBox, clickable, storedEdges } from '../../lib/journeys/workspace';

const test = base.extend<{ ownedGraphIds: OwnedGraphs }>({ ownedGraphIds: [ownedGraphIdsFixture, { timeout: 60000 }] });

for (const scope of ['desktop', 'phone'] as const) {
  const phone = scope === 'phone';
  test.describe(scope, () => {
    const { viewport, deviceScaleFactor, userAgent } = devices['iPhone 13'];
    test.use(phone ? { viewport, deviceScaleFactor, userAgent, isMobile: true, hasTouch: true } : { viewport: { width: 1440, height: 900 } });

    test('only an editor can connect items from the inspector', async ({ page, ownedGraphIds }) => {
      test.setTimeout(90000);
      await login(page, TEST_USERS.ADMIN);
      const graph = await ownedGraphIds.seed({ size: 3, spacing: 210, edgeFactor: 0.5, namePrefix: 'Connection permissions', titleForIndex: index => ['Source item', 'Middle item', 'Target item'][index] });
      const owner = (await gql(page, '{me{id}}')).me.id;
      const [source, , target] = graph.nodeIds;
      const setEditable = (editable: boolean) => gql(page, 'mutation($id:ID!,$acl:String!){updateGraphs(where:{id:$id},update:{permissions:$acl}){graphs{id}}}', {
        id: graph.graphId,
        acl: JSON.stringify({ owner: editable ? owner : 'connection-fixture-owner', admins: [], editors: [], viewers: [owner], teamPermission: 'VIEW' }),
      });
      const openView = async (view: 'graph' | 'cards') => {
        await page.evaluate(({ id, view }) => {
          localStorage.setItem('currentGraphId', id);
          localStorage.setItem('graphdone:viewMode', view);
        }, { id: graph.graphId, view });
        await page.reload();
        if (view === 'graph') await expect(page.locator('.graph-container svg .node')).toHaveCount(3);
        else await expect(page.getByTestId('task-list')).toBeVisible();
      };
      const openDetails = async () => {
        await openView('cards');
        const edit = page.getByTestId('task-list').getByRole('button', { name: 'Edit Source item', exact: true });
        if (phone) await edit.tap();
        else await edit.click();
        const dialog = page.getByRole('dialog');
        await expect(dialog.getByRole('heading', { name: /^Connections/ })).toBeVisible();
        return dialog;
      };
      const pressCard = async (id: string, shift = false) => {
        await expect.poll(async () => {
          const box = await cardBox(page, id);
          return !!box && await clickable(page, id, box.cx, box.cy);
        }).toBe(true);
        const { cx, cy } = (await cardBox(page, id))!;
        if (phone) await page.touchscreen.tap(cx, cy);
        else {
          if (shift) await page.keyboard.down('Shift');
          try { await page.mouse.click(cx, cy); }
          finally { if (shift) await page.keyboard.up('Shift'); }
        }
      };
      await setEditable(false);
      await openView('graph');
      const readEdges = async () => (await storedEdges(page, graph.graphId)).sort((left, right) => left.id.localeCompare(right.id));
      const before = await readEdges();
      const isPair = (edge: { source: string; target: string }) =>
        (edge.source === source && edge.target === target) || (edge.source === target && edge.target === source);
      expect(before.length).toBeGreaterThan(0);
      expect(before.some(isPair)).toBe(false);
      let writes = 0;
      page.on('request', request => {
        if (request.method() !== 'POST' || !new URL(request.url()).pathname.endsWith('/graphql')) return;
        const body = request.postDataJSON();
        if (body?.operationName === 'CreateEdges' && body.variables?.input?.some((edge: { source: { connect: { where: { node: { id: string } } } } }) =>
          graph.nodeIds.includes(edge.source?.connect?.where?.node?.id),
        )) writes++;
      });
      try {
        if (!phone) await expect(page.getByRole('button', { name: 'Organize around connections' })).toBeDisabled();
        await pressCard(source);
        const inspector = page.getByTestId('node-inspector');
        await expect(inspector).toBeVisible();
        await expect(inspector.getByRole('button', { name: /^Connect .* to another item$/ })).toHaveCount(0);
        await expect(page.getByRole('button', { name: /^Add a connection from / })).toHaveCount(0);
        await inspector.getByRole('button', { name: /Close/i }).click();
        if (!phone) {
          await pressCard(source, true);
          await pressCard(target, true);
        }
        const details = await openDetails();
        await expect(details.getByRole('button', { name: /^Connect to other work items/ })).toHaveCount(0);
        await expect(details.getByRole('button', { name: /^Disconnect from work items/ })).toHaveCount(0);
        expect(await readEdges()).toEqual(before);
        expect(writes).toBe(0);
      } finally {
        await setEditable(true);
      }

      await openView('graph');
      await pressCard(source);
      const connect = page.getByRole('button', { name: /^Connect .* to another item$/ });
      if (phone) await connect.tap();
      else await connect.click();
      await pressCard(target);
      await expect.poll(async () => (await readEdges()).filter(isPair)).toEqual([
        expect.objectContaining({ source, target }),
      ]);
      expect(writes).toBe(1);

      const details = await openDetails();
      const disconnect = details.getByRole('button', { name: /^Disconnect from work items/ });
      if (phone) await disconnect.tap();
      else await disconnect.click();
      await details.getByRole('checkbox', { name: 'Select Target item to disconnect' }).check();
      await details.getByRole('button', { name: 'Remove Selected (1)', exact: true }).click();
      await expect.poll(async () => (await readEdges()).filter(isPair)).toHaveLength(0);
    });
  });
}
