import { writeFile } from 'node:fs/promises';
import { test as base, expect } from '@playwright/test';
import { login, TEST_USERS } from '../../lib/auth';
import { measureGraphZoom } from '../../lib/graphZoomReady';
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

for (const { width, diagonal } of [
  { width: 1440, diagonal: false },
  { width: 390, diagonal: false },
  { width: 1440, diagonal: true },
])
  test.describe(`${width}px ${diagonal ? 'diagonal ' : ''}symbols`, () => {
    test.use({ viewport: { width, height: 900 } });
    test('cards and labels reserve readable content through zoom @item-symbols', async ({
      page,
      ownedGraphIds,
    }, info) => {
      test.setTimeout(120000);
      await login(page, TEST_USERS.ADMIN);
      const seeded = await ownedGraphIds.seed({
        size: 2,
        spacing: diagonal ? 400 : 600,
        edgeFactor: 0,
        namePrefix: 'Readable symbols',
        titleForIndex: index =>
          index
            ? 'PaymentGatewayRetryReconciliationHandler with settlement validation and WWW identifiers'
            : 'Review',
        additionalEdges: [{ sourceIndex: 1, targetIndex: 0, type: 'BLOCKS' }],
      });
      if (diagonal)
        await gql(
          page,
          'mutation($id:ID!){updateWorkItems(where:{id:$id},update:{positionX:1,positionY:1}){workItems{id}}}',
          { id: seeded.nodeIds[1] }
        );
      const cameraX = diagonal ? -200 : -300;
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
      if (width === 1440 && !diagonal) {
        const navigation = page.getByRole('group', {
          name: 'Workspace views',
          exact: true,
        });
        await expect(navigation.getByRole('button')).toHaveCount(8);
        for (const name of [
          'Graph',
          'Dashboard',
          'Table',
          'Card',
          'Kanban',
          'Gantt',
          'Calendar',
          'Activity',
        ]) {
          const button = navigation.getByRole('button', { name, exact: true });
          const size = await button.boundingBox();
          expect(size!.width).toBeGreaterThanOrEqual(44);
          expect(size!.height).toBeGreaterThanOrEqual(44);
          await expect(button.locator('svg')).toBeVisible();
          expect(
            (await button.locator('svg').boundingBox())!.width
          ).toBeGreaterThanOrEqual(24);
          await button.hover();
          await expect(
            page.getByRole('tooltip', { name, exact: true })
          ).toBeVisible();
        }
        const graph = navigation.getByRole('button', {
          name: 'Graph',
          exact: true,
        });
        await graph.focus();
        await expect(
          page.getByRole('tooltip', { name: 'Graph', exact: true })
        ).toBeVisible();
        await navigation
          .getByRole('button', { name: 'Dashboard', exact: true })
          .hover();
        await expect(
          page.getByRole('tooltip', { name: 'Dashboard', exact: true })
        ).toBeVisible();
        await page.mouse.move(8, 8);
        await expect(
          page.getByRole('tooltip', { name: 'Graph', exact: true })
        ).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(page.getByRole('tooltip')).toHaveCount(0);
        await expect(graph).toBeFocused();
        await graph.evaluate(element => element.blur());
        await page.mouse.move(8, 8);
        expect(
          await page
            .locator('.workspace-surface')
            .evaluate(element => Number(getComputedStyle(element).fontWeight))
        ).toBeGreaterThanOrEqual(500);
      }
      const target = before.workItems.find(
        (item: { id: string }) => item.id === seeded.nodeIds[1]
      );
      const cameraY = diagonal ? -200 : target.positionY;
      for (const scale of [0.6, 0.9, 1.2, 0.6]) {
        await page.evaluate(
          ({ x, y, scale }) => (window as any).miniMapZoom(x, y, scale),
          {
            x: width === 390 ? target.positionX : cameraX,
            y: cameraY,
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
        if (width === 1440 && !diagonal) expect(geometry.labels.length).toBe(2);
        if (diagonal) expect(geometry.labels.length).toBeGreaterThan(0);
      }
      const targetNode = page.locator('.node').filter({
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
      await expect(targetNode).toBeFocused();
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
      const browse = page.getByRole('button', {
        name: /2 relationships, .*Browse all relationships/,
      });
      await expect(browse).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(
        page.getByRole('button', { name: 'Back to graph', exact: true })
      ).toBeFocused();
      await page.keyboard.press('Escape');
      await expect(browse).toBeFocused();
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
        if (diagonal) {
          const path = page.locator('.edges-group .edge').first();
          const savedPath = await path.getAttribute('d');
          await path.evaluate(element => {
            const label = document.querySelector<SVGGElement>(
              '.edge-label-group:not([style*="display: none"])'
            )!;
            const point = new DOMPoint(0, 0).matrixTransform(label.getCTM()!);
            const local = point.matrixTransform(
              (element.parentElement as unknown as SVGGraphicsElement)
                .getCTM()!
                .inverse()
            );
            element.setAttribute(
              'd',
              `M${local.x - 100},${local.y} L${local.x + 100},${local.y}`
            );
          });
          expect(
            (await readItemSymbols(page)).violations.some(value =>
              value.startsWith('label-wire-overlap:')
            )
          ).toBe(true);
          await path.evaluate(
            (element, value) => element.setAttribute('d', value!),
            savedPath
          );
        }
        await inspectItemSymbols(page, info, 'restored-after-negatives');
        await page.evaluate(() => {
          const zoom = (window as any).miniMapZoom;
          (window as any).miniMapZoom = (...args: unknown[]) => {
            (window as any).miniMapZoom = zoom;
            const mask = document.createElement('style');
            mask.id = 'timing-visibility-negative';
            mask.textContent =
              '.nodes-group { visibility: hidden !important; }';
            document.head.append(mask);
            (window as any).__visibilityNegativeStarted = performance.now();
            setTimeout(() => mask.remove(), 1200);
            zoom(...args);
          };
        });
        const visibleMs = await page.evaluate(measureGraphZoom, {
          x: cameraX,
          y: cameraY,
          scale: 1.2,
        });
        const totalMs = await page.evaluate(
          () => performance.now() - (window as any).__visibilityNegativeStarted
        );
        expect(totalMs).toBeGreaterThanOrEqual(1200);
        expect(visibleMs).toBeGreaterThanOrEqual(1200);
        await expect(page.locator('#timing-visibility-negative')).toHaveCount(
          0
        );
        const timingPath = info.outputPath('delayed-visible-content.json');
        await writeFile(
          timingPath,
          JSON.stringify({ hiddenForMs: 1200, visibleMs, totalMs })
        );
        await info.attach('delayed-visible-content.json', {
          path: timingPath,
          contentType: 'application/json',
        });
      }
      expect(await snapshot()).toEqual(before);
      expect(writes).toEqual([]);
      expect(errors).toEqual([]);
    });
  });
