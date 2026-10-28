import { test as base, expect } from '@playwright/test';
import { login, TEST_USERS } from '../../lib/auth';
import { gql } from '../../lib/graphRequest';
import {
  ownedGraphIdsFixture,
  type OwnedGraphs,
} from '../../lib/ownedGraphIdsFixture';
import {
  inspectItemSymbols,
  readItemSymbols,
} from '../../lib/itemSymbolVisual';

const test = base.extend<{ ownedGraphIds: OwnedGraphs }>({
  ownedGraphIds: [ownedGraphIdsFixture, { timeout: 60000 }],
});
test.use({ actionTimeout: 10000 });

for (const width of [1440, 390])
  test.describe(`${width}px symbols`, () => {
    test.use({ viewport: { width, height: 900 } });
    test('cards and labels reserve readable content through zoom @item-symbols', async ({
      page,
      ownedGraphIds,
    }, info) => {
      test.setTimeout(120000);
      await login(page, TEST_USERS.ADMIN);
      const seeded = await ownedGraphIds.seed({
        size: 2,
        spacing: 600,
        edgeFactor: 0,
        namePrefix: 'Readable symbols',
        titleForIndex: index =>
          index
            ? 'PaymentGatewayRetryReconciliationHandler with settlement validation and WWW identifiers'
            : 'Review',
        additionalEdges: [{ sourceIndex: 1, targetIndex: 0, type: 'BLOCKS' }],
      });
      const snapshot = async () => {
        const data = await gql(
          page,
          'query($id:ID!){workItems(where:{graph:{id:$id}}){id title positionX positionY} edges(where:{source:{graph:{id:$id}}}){id type source{id} target{id}}}',
          { id: seeded.graphId }
        );
        data.workItems.sort((a: { id: string }, b: { id: string }) =>
          a.id.localeCompare(b.id)
        );
        data.edges.sort((a: { id: string }, b: { id: string }) =>
          a.id.localeCompare(b.id)
        );
        return data;
      };
      const before = await snapshot(),
        writes: string[] = [],
        errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route('**/api/graphql', async route => {
        if (
          /^\s*mutation\b/.test(route.request().postDataJSON()?.query ?? '')
        ) {
          writes.push(
            route.request().postDataJSON().operationName ?? 'mutation'
          );
          await route.abort();
        } else await route.continue();
      });
      await page.evaluate(id => {
        localStorage.setItem('currentGraphId', id);
        localStorage.setItem('graphdone:viewMode', 'graph');
      }, seeded.graphId);
      await page.goto('/');
      await expect(page.locator('.graph-container .node')).toHaveCount(2);
      await expect
        .poll(() =>
          page.evaluate(() => (window as any).__layoutMetrics?.()?.cameraReady)
        )
        .toBe(true);
      const target = before.workItems.find(
        (item: { id: string }) => item.id === seeded.nodeIds[1]
      );
      for (const scale of [0.6, 0.9, 1.2, 0.6]) {
        await page.evaluate(
          ({ x, y, scale }) => (window as any).miniMapZoom(x, y, scale),
          {
            x: width === 390 ? target.positionX : -300,
            y: target.positionY,
            scale,
          }
        );
        await expect
          .poll(() =>
            page
              .locator('.graph-container > svg')
              .evaluate(element => (element as any).__zoom.k)
          )
          .toBeCloseTo(scale);
        await expect
          .poll(() => page.locator('.node').first().getAttribute('data-detail'))
          .toBe(scale < 1 ? 'compact' : 'full');
        await expect(page.locator('.main-graph-group')).toHaveAttribute(
          'data-presentation-scale',
          String(scale)
        );
        const geometry = await inspectItemSymbols(
          page,
          info,
          `symbols-${width}-${scale}`
        );
        if (width === 1440) expect(geometry.labels.length).toBe(2);
      }
      const targetNode = page
        .locator('.node')
        .filter({
          has: page.locator('.node-title-group > title', {
            hasText: target.title,
          }),
        });
      await targetNode.focus();
      await page.keyboard.press('Enter');
      await expect(
        page.getByRole('dialog', { name: 'Edit work item', exact: true })
      ).toBeVisible();
      await page.keyboard.press('Escape');
      await page
        .getByRole('button', {
          name: /2 relationships, .*Browse all relationships/,
        })
        .click();
      await expect(
        page.getByRole('region', { name: 'Graph relationships' })
      ).toBeVisible();
      await expect(
        page.getByRole('button', { name: /^Edit relationship / })
      ).toHaveCount(2);
      await page
        .getByRole('button', { name: 'Back to graph', exact: true })
        .click();
      if (width === 1440) {
        const saved = await page
          .locator('.edge-label-group:visible')
          .first()
          .getAttribute('transform');
        await page
          .locator('.edge-label-group:visible')
          .first()
          .evaluate(label => {
            const node = document.querySelector('.node') as any;
            label.setAttribute(
              'transform',
              `translate(${node.__data__.x},${node.__data__.y})`
            );
          });
        const negative = await readItemSymbols(page);
        expect(
          negative.violations.some(value => value.startsWith('label-overlap:'))
        ).toBe(true);
        await info.attach('deliberate-overlap.json', {
          body: JSON.stringify(negative),
          contentType: 'application/json',
        });
        await page
          .locator('.edge-label-group:visible')
          .first()
          .evaluate(
            (label, transform) => label.setAttribute('transform', transform!),
            saved
          );
        const original = await targetNode
          .locator('.node-bg')
          .getAttribute('width');
        await targetNode
          .locator('.node-bg')
          .evaluate(element => element.setAttribute('width', '20'));
        expect(
          (await readItemSymbols(page)).violations.some(value =>
            value.startsWith('title-clipped:')
          )
        ).toBe(true);
        await targetNode
          .locator('.node-bg')
          .evaluate(
            (element, value) => element.setAttribute('width', value!),
            original
          );
        await inspectItemSymbols(page, info, 'restored-after-negatives');
      }
      expect(await snapshot()).toEqual(before);
      expect(writes).toEqual([]);
      expect(errors).toEqual([]);
    });
  });
