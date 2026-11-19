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
      const graph = await ownedGraphIds.seed({ size: 3, spacing: 210, namePrefix: 'Connection permissions' });
      const owner = (await gql(page, '{me{id}}')).me.id;
      const [source, , target] = graph.nodeIds;
      const setEditable = (editable: boolean) => gql(page, 'mutation($id:ID!,$acl:String!){updateGraphs(where:{id:$id},update:{permissions:$acl}){graphs{id}}}', {
        id: graph.graphId,
        acl: JSON.stringify({ owner: editable ? owner : 'connection-fixture-owner', admins: [], editors: [], viewers: [owner], teamPermission: 'VIEW' }),
      });
      const openGraph = async () => {
        await page.evaluate(id => {
          localStorage.setItem('currentGraphId', id);
          localStorage.setItem('graphdone:viewMode', 'graph');
        }, graph.graphId);
        await page.reload();
        await expect(page.locator('.graph-container svg .node')).toHaveCount(3);
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
      await openGraph();
      const readEdges = async () => (await storedEdges(page, graph.graphId)).sort((left, right) => left.id.localeCompare(right.id));
      const before = await readEdges();
      expect(before.length).toBeGreaterThan(0);
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
        expect(await readEdges()).toEqual(before);
        expect(writes).toBe(0);
      } finally {
        await setEditable(true);
      }

      await openGraph();
      await pressCard(source);
      const connect = page.getByRole('button', { name: /^Connect .* to another item$/ });
      if (phone) await connect.tap();
      else await connect.click();
      await pressCard(target);
      await expect.poll(async () => (await readEdges()).filter(edge =>
        edge.source === source && edge.target === target,
      )).toHaveLength(1);
      expect(writes).toBe(1);
    });
  });
}
