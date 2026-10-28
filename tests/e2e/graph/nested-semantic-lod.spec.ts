import {
  test as base,
  expect,
  type CDPSession,
  type Locator,
} from '@playwright/test';
import { login, TEST_USERS } from '../../lib/auth';
import { gql } from '../../lib/graphRequest';
import {
  ownedGraphIdsFixture,
  type OwnedGraphs,
} from '../../lib/ownedGraphIdsFixture';
import type { SeededGraph } from '../../lib/seedGraph';

const test = base.extend<{
  ownedGraphIds: OwnedGraphs;
  nested: { seeded: SeededGraph; touch: CDPSession | null };
}>({
  ownedGraphIds: [ownedGraphIdsFixture, { timeout: 60000 }],
  nested: [
    async ({ page, ownedGraphIds }, use) => {
      const touch =
        page.viewportSize()!.width === 390
          ? await page.context().newCDPSession(page)
          : null;
      try {
        if (touch)
          await touch.send('Emulation.setTouchEmulationEnabled', {
            enabled: true,
            maxTouchPoints: 2,
          });
        await login(page, TEST_USERS.ADMIN);
        const seeded = await ownedGraphIds.seed({
          size: 72,
          spacing: 350,
          edgeFactor: 1.5,
          batchSize: 20,
          namePrefix: 'Nested semantic LOD',
          titleForIndex: (index, type) =>
            index === 3
              ? `${type} 3 — Request delivery through gateway validation, queued retries and settlement reconciliation across every service`
              : `${type} ${index}`,
          metadataForIndex: index => {
            const root = index < 36 ? 'Payments' : 'Inventory';
            return {
              lod: {
                groupPath:
                  index % 36 === 0
                    ? [root]
                    : index % 2 === 0
                      ? [root, 'API', 'Gateway']
                      : [
                          root,
                          'Workers',
                          index % 3 === 0 ? 'Queue' : 'Scheduler',
                        ],
              },
            };
          },
        });
        await gql(
          page,
          `mutation($input:[EdgeCreateInput!]!){createEdges(input:$input){edges{id}}}`,
          {
            input: [
              [0, 36, 'BLOCKS'],
              [36, 0, 'DEPENDS_ON'],
              [0, 36, 'BLOCKS'],
            ].map(([source, target, type]) => ({
              type,
              weight: 1,
              source: {
                connect: {
                  where: { node: { id: seeded.nodeIds[Number(source)] } },
                },
              },
              target: {
                connect: {
                  where: { node: { id: seeded.nodeIds[Number(target)] } },
                },
              },
            })),
          }
        );
        await use({ seeded, touch });
      } finally {
        await touch?.detach();
      }
    },
    { timeout: 180000 },
  ],
});

test.use({ actionTimeout: 10000 });
for (const width of [1440, 390])
  test.describe(`nested LOD ${width}px`, () => {
    test.use({ viewport: { width, height: 900 } });
    test('nested summaries preserve source selection, relationships and layout through zoom and navigation @nested-lod', async ({
      page,
      nested,
    }, info) => {
      test.setTimeout(150000);
      const { seeded, touch } = nested;
      const writes: string[] = [];
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      const snapshot = async () => {
        const result = await gql(
          page,
          'query($id:ID!){workItems(where:{graph:{id:$id}}){id title positionX positionY metadata} edges(where:{source:{graph:{id:$id}}}){id type source{id} target{id}}}',
          { id: seeded.graphId }
        );
        result.workItems.sort((a: { id: string }, b: { id: string }) =>
          a.id.localeCompare(b.id)
        );
        result.edges.sort((a: { id: string }, b: { id: string }) =>
          a.id.localeCompare(b.id)
        );
        return result;
      };
      const before = await snapshot();
      expect(before.workItems).toHaveLength(72);
      expect(before.edges).toHaveLength(seeded.edgeCount + 3);
      await page.route('**/api/graphql', async route => {
        const body = route.request().postDataJSON();
        if (/^\s*mutation\b/.test(body?.query ?? '')) {
          writes.push(body.operationName || 'mutation');
          await route.abort('blockedbyclient');
        } else await route.continue();
      });
      await page.evaluate(id => {
        localStorage.setItem('currentGraphId', id);
        localStorage.setItem('graphdone:viewMode', 'graph');
      }, seeded.graphId);
      await page.goto('/');
      await expect(page.locator('.graph-container .node')).toHaveCount(72);
      const overview = page.locator('.semantic-overview');
      const detail = overview.getByRole('combobox', { name: 'Graph detail' });
      const svg = page.locator('.graph-container > svg');
      const camera = () =>
        svg.evaluate(element => {
          const transform = (
            element as SVGSVGElement & {
              __zoom: { x: number; y: number; k: number };
            }
          ).__zoom;
          return { x: transform.x, y: transform.y, k: transform.k };
        });
      const activate = async (locator: Locator) => {
        await locator.scrollIntoViewIfNeeded();
        if (!touch) {
          await locator.click();
          return;
        }
        const box = await locator.boundingBox();
        expect(box).toBeTruthy();
        const x = box!.x + box!.width / 2,
          y = box!.y + box!.height / 2;
        await touch.send('Input.dispatchTouchEvent', {
          type: 'touchStart',
          touchPoints: [{ x, y, id: 1 }],
        });
        await touch.send('Input.dispatchTouchEvent', {
          type: 'touchEnd',
          touchPoints: [],
        });
      };
      const count = (groups: number) =>
        overview.getByRole('button', {
          name: `${groups} groups · 72 items`,
          exact: true,
        });
      const list = () =>
        page.getByRole('region', { name: 'Graph groups', exact: true });
      await detail.selectOption('overview');
      await expect(count(2)).toBeVisible();
      await activate(count(2));
      await activate(
        list().getByRole('button', { name: /^Payments 36 items/ })
      );
      const payments = page.getByRole('region', {
        name: 'Payments members',
        exact: true,
      });
      await expect(payments).toContainText('36 items');
      await expect(payments).toContainText('BLOCKS');
      await expect(payments).toContainText('DEPENDS_ON');
      await activate(
        payments.getByRole('button', { name: 'Show 2 subgroups', exact: true })
      );
      await expect(count(4)).toBeVisible();
      await activate(
        list().getByRole('button', { name: /^Payments \/ Workers / })
      );
      await activate(
        page
          .getByRole('region', { name: 'Workers members', exact: true })
          .getByRole('button', { name: 'Show 2 subgroups', exact: true })
      );
      await expect(count(5)).toBeVisible();
      await activate(
        list().getByRole('button', { name: /^Payments \/ Workers \/ Queue / })
      );
      const queue = page.getByRole('region', {
        name: 'Queue members',
        exact: true,
      });
      await expect(
        queue.getByRole('navigation', { name: 'Group path' })
      ).toBeVisible();
      await queue
        .getByRole('textbox', { name: 'Find an item' })
        .fill('Request delivery');
      const longItem = queue.getByRole('button', { name: /Request delivery/ });
      await expect(longItem).toBeVisible();
      expect(
        await longItem.evaluate(
          element => element.scrollWidth <= element.clientWidth
        )
      ).toBe(true);
      await page.screenshot({
        path: info.outputPath('nested-member-browser.png'),
      });
      const entryCamera = await camera();
      await activate(longItem);
      await expect(page.getByTestId('node-inspector')).toContainText(
        'Request delivery'
      );
      await activate(
        overview.getByRole('button', { name: 'Back to overview', exact: true })
      );
      await expect(count(5)).toBeVisible();
      await expect.poll(camera).toEqual(entryCamera);
      await expect(overview).toHaveAttribute('data-active', 'true');
      const cards = overview.locator('[data-lod-group]');
      const slots = () =>
        cards.evaluateAll(elements =>
          elements.map(element => {
            const r = element.getBoundingClientRect();
            return {
              id: element.getAttribute('data-lod-group'),
              x: r.x,
              y: r.y,
              width: r.width,
              height: r.height,
            };
          })
        );
      await page.screenshot({
        path: info.outputPath('nested-expanded-cut.png'),
      });
      const fixed = await slots();
      expect(fixed.length).toBeGreaterThan(0);
      for (const slot of fixed) {
        expect(slot.x).toBeGreaterThanOrEqual(0);
        expect(slot.x + slot.width).toBeLessThanOrEqual(width);
      }
      expect(
        await cards
          .first()
          .locator('span')
          .first()
          .evaluate(element => parseFloat(getComputedStyle(element).fontSize))
      ).toBeGreaterThanOrEqual(14);
      const box = (await cards.first().boundingBox())!;
      const x = box.x + box.width / 2,
        y = box.y + box.height / 2;
      const beforePan = await camera();
      if (touch) {
        await touch.send('Input.dispatchTouchEvent', {
          type: 'touchStart',
          touchPoints: [{ x, y, id: 1 }],
        });
        await touch.send('Input.dispatchTouchEvent', {
          type: 'touchMove',
          touchPoints: [{ x: x + 30, y: y + 16, id: 1 }],
        });
        await touch.send('Input.dispatchTouchEvent', {
          type: 'touchEnd',
          touchPoints: [],
        });
      } else {
        await page.mouse.move(x, y);
        await page.mouse.down();
        await page.mouse.move(x + 30, y + 16, { steps: 5 });
        await page.mouse.up();
      }
      await expect.poll(async () => (await camera()).x).not.toBe(beforePan.x);
      expect(await slots()).toEqual(fixed);
      await expect(page.getByRole('region', { name: /members/ })).toHaveCount(
        0
      );
      if (!touch) {
        const beforeWheel = await camera();
        await cards.first().hover();
        await page.mouse.wheel(0, -50);
        await expect
          .poll(async () => (await camera()).k)
          .toBeGreaterThan(beforeWheel.k);
        expect(await slots()).toEqual(fixed);
      }
      await activate(count(5));
      await activate(
        list().getByRole('button', { name: /^Payments \/ Workers \/ Queue / })
      );
      await activate(
        page
          .getByRole('region', { name: 'Queue members', exact: true })
          .getByRole('button', { name: 'Collapse to Payments', exact: true })
      );
      await expect(count(2)).toBeVisible();
      await activate(
        page.getByRole('button', { name: 'Close group browser', exact: true })
      );
      await expect(
        overview.locator('[data-lod-group][aria-current="true"]')
      ).toHaveCount(1);
      await expect(
        overview.locator('[data-lod-group][aria-current="true"]')
      ).toHaveAttribute('title', 'Payments');
      await detail.selectOption('auto');
      await page.evaluate(() => (window as any).miniMapZoom(0, 0, 0.95));
      await expect.poll(async () => (await camera()).k).toBeCloseTo(0.95);
      await expect(overview).toHaveAttribute('data-active', 'true');
      await expect(overview.getByText(/more in group list/)).toHaveCount(0);
      const automaticLabels = await cards.count();
      expect(automaticLabels).toBeGreaterThanOrEqual(2);
      if (width === 1440) expect(automaticLabels).toBeGreaterThan(2);
      await expect(
        overview.getByRole('button', {
          name: `${automaticLabels} groups · 72 items`,
          exact: true,
        })
      ).toBeVisible();
      await page.screenshot({ path: info.outputPath('nested-auto-cut.png') });
      const ids = () =>
        cards.evaluateAll(elements =>
          elements.map(element => element.getAttribute('data-lod-group')).sort()
        );
      await page.evaluate(() => (window as any).miniMapZoom(0, 0, 0.46));
      await expect.poll(async () => (await camera()).k).toBeCloseTo(0.46);
      await expect.poll(ids).not.toEqual([]);
      const thresholdCut = await ids();
      for (const scale of [0.44, 0.46, 0.44, 0.46]) {
        await page.evaluate(
          scale => (window as any).miniMapZoom(0, 0, scale),
          scale
        );
        await expect.poll(async () => (await camera()).k).toBeCloseTo(scale);
        expect(await ids()).toEqual(thresholdCut);
        await expect(overview).toHaveAttribute('data-active', 'true');
      }
      await page.evaluate(() => (window as any).miniMapZoom(0, 0, 0.2));
      await expect.poll(async () => (await camera()).k).toBeCloseTo(0.2);
      await expect(count(2)).toBeVisible();
      await page.evaluate(() => (window as any).miniMapZoom(0, 0, 0.4));
      await expect.poll(async () => (await camera()).k).toBeCloseTo(0.4);
      await expect(count(2)).toBeVisible();
      const autoEntryCamera = await camera();
      const autoEntryCut = await ids();
      await activate(count(2));
      await activate(
        list().getByRole('button', { name: /^Payments 36 items/ })
      );
      await payments
        .getByRole('textbox', { name: 'Find an item' })
        .fill('Request delivery');
      await activate(
        payments.getByRole('button', { name: /Request delivery/ })
      );
      await expect(page.getByTestId('node-inspector')).toContainText(
        'Request delivery'
      );
      await activate(
        overview.getByRole('button', { name: 'Back to overview', exact: true })
      );
      await expect.poll(camera).toEqual(autoEntryCamera);
      await expect(count(2)).toBeVisible();
      expect(await ids()).toEqual(autoEntryCut);
      await cards.filter({ hasText: 'Payments' }).focus();
      await page.evaluate(() => (window as any).miniMapZoom(0, 0, 0.46));
      await expect.poll(async () => (await camera()).k).toBeCloseTo(0.46);
      await expect
        .poll(() =>
          page.evaluate(() =>
            document.activeElement?.hasAttribute('data-lod-group')
          )
        )
        .toBe(true);
      await page.evaluate(() => (window as any).miniMapZoom(0, 0, 0.2));
      await expect(count(2)).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth
        )
      ).toBe(true);
      expect(await snapshot()).toEqual(before);
      expect(writes).toEqual([]);
      expect(errors).toEqual([]);
      await page.screenshot({ path: info.outputPath('nested-overview.png') });
    });
  });
