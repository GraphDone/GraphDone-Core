import { test as base, expect, type Page } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { login, TEST_USERS } from '../../lib/auth';
import { gql } from '../../lib/graphRequest';
import { inspectLocalItemNeighborhood } from '../../lib/localItemNeighborhood';
import {
  ownedGraphIdsFixture,
  type OwnedGraphs,
} from '../../lib/ownedGraphIdsFixture';

type Item = {
  id: string;
  title: string;
  positionX: number;
  positionY: number;
  metadata: unknown;
};
type Edge = {
  id: string;
  type: string;
  source: { id: string };
  target: { id: string };
};
type GraphSnapshot = { workItems: Item[]; edges: Edge[] };
type Seed = {
  graphId: string;
  nodeIds: string[];
  before: GraphSnapshot;
  scope: string;
};
const test = base.extend<{ ownedGraphIds: OwnedGraphs; localFixture: Seed }>({
  ownedGraphIds: [ownedGraphIdsFixture, { timeout: 60000 }],
  localFixture: [
    async ({ page, ownedGraphIds }, use) => {
      await login(page, TEST_USERS.ADMIN);
      const seeded = await ownedGraphIds.seed({
        size: 108,
        spacing: 600,
        edgeFactor: 0,
        batchSize: 20,
        namePrefix: 'Local item LOD',
        titleForIndex: index =>
          index === 0
            ? '#2215 EPIC · Factory session loops, tooling and automation hygiene'
            : index === 107
              ? 'Parent epic'
              : `Component ${index} — reliable system workflow`,
        metadataForIndex: index => ({
          lod: {
            groupPath: [['Factory', 'Execution', 'Leadership'][index % 3]],
          },
        }),
      });
      await gql(
        page,
        'mutation($id:ID!){deleteEdges(where:{source:{graph:{id:$id}}}){nodesDeleted}}',
        { id: seeded.graphId }
      );
      for (let offset = 1; offset < seeded.nodeIds.length; offset += 20) {
        const input = seeded.nodeIds
          .slice(offset, offset + 20)
          .map((id, index) => {
            const incoming = offset + index === 107;
            return {
              type: 'DEPENDS_ON',
              weight: 1,
              source: {
                connect: {
                  where: { node: { id: incoming ? id : seeded.nodeIds[0] } },
                },
              },
              target: {
                connect: {
                  where: { node: { id: incoming ? seeded.nodeIds[0] : id } },
                },
              },
            };
          });
        await gql(
          page,
          'mutation($input:[EdgeCreateInput!]!){createEdges(input:$input){edges{id}}}',
          { input }
        );
      }
      await gql(
        page,
        'mutation($ids:[ID!]!){updateWorkItems(where:{id_IN:$ids},update:{type:EPIC}){workItems{id}}}',
        { ids: [seeded.nodeIds[0], seeded.nodeIds[107]] }
      );
      const before = await snapshot(page, seeded.graphId);
      expect(before.workItems).toHaveLength(108);
      expect(before.edges).toHaveLength(107);
      expect(
        before.workItems.every(
          item => item.positionX !== 0 && item.positionY !== 0
        )
      ).toBe(true);
      const user = await gql(page, '{me{id}}');
      await use({
        ...seeded,
        before,
        scope: JSON.stringify([user.me.id, seeded.graphId]),
      });
    },
    { timeout: 180000 },
  ],
});
test.use({ actionTimeout: 10000 });

async function snapshot(page: Page, graphId: string): Promise<GraphSnapshot> {
  const data = await gql(
    page,
    'query($id:ID!){workItems(where:{graph:{id:$id}}){id title positionX positionY metadata}edges(where:{source:{graph:{id:$id}}}){id type source{id}target{id}}}',
    { id: graphId }
  );
  data.workItems.sort((a: Item, b: Item) => a.id.localeCompare(b.id));
  data.edges.sort((a: Edge, b: Edge) => a.id.localeCompare(b.id));
  return data;
}
const camera = (page: Page) =>
  page.locator('.graph-container > svg').evaluate(svg => {
    const value = (
      svg as SVGSVGElement & { __zoom: { x: number; y: number; k: number } }
    ).__zoom;
    return { x: value.x, y: value.y, k: value.k };
  });
const originalCards = (page: Page) =>
  page
    .locator(
      '.local-item-neighborhood[data-active="true"] [data-original-item]'
    )
    .evaluateAll(cards =>
      cards.map(card => card.getAttribute('data-original-item')!)
    );

for (const [width, height] of [
  [1440, 900],
  [390, 844],
]) {
  test.describe(`${width}px focused LOD`, () => {
    test.use({ viewport: { width, height } });
    test(`high-degree items keep readable original neighbors and clean navigation at ${width}px @lod`, async ({
      page,
      localFixture,
    }, info) => {
      test.setTimeout(150000);
      const { graphId, nodeIds, before, scope } = localFixture;
      const root = before.workItems.find(item => item.id === nodeIds[0])!;
      const errors: string[] = [];
      const blockedWrites: unknown[] = [];
      const allowedWrites: unknown[] = [];
      let allowedEdit: { id: string; title: string } | undefined;
      page.on('pageerror', error => errors.push(error.message));
      await page.route('**/api/graphql', async route => {
        const body = route.request().postDataJSON();
        if (!/^\s*mutation\b/.test(body?.query ?? '')) return route.continue();
        const variables = body.variables;
        if (
          allowedEdit &&
          body.operationName === 'UpdateWorkItems' &&
          JSON.stringify(variables?.where) ===
            JSON.stringify({ id: allowedEdit.id }) &&
          JSON.stringify(variables?.update) ===
            JSON.stringify({ title: allowedEdit.title }) &&
          allowedWrites.length === 0
        ) {
          allowedWrites.push(body);
          return route.continue();
        }
        blockedWrites.push(body);
        await route.abort('blockedbyclient');
      });
      await page.evaluate(
        ({ graphId, scope }) => {
          localStorage.setItem('currentGraphId', graphId);
          localStorage.setItem('graphdone:viewMode', 'graph');
          localStorage.setItem('graphdone:layoutMode', 'force');
          localStorage.setItem('graphdone:relationship-priority', 'essential');
          localStorage.setItem(`graphdone:detail:${scope}`, 'items');
        },
        { graphId, scope }
      );
      await page.goto('/');
      await expect(page.locator('.graph-container .node')).toHaveCount(108, {
        timeout: 30000,
      });
      await expect
        .poll(() =>
          page.evaluate(
            () =>
              typeof (window as unknown as { miniMapZoom?: unknown })
                .miniMapZoom
          )
        )
        .toBe('function');
      await page.evaluate(
        ({ x, y }) =>
          (
            window as unknown as {
              miniMapZoom: (x: number, y: number, k: number) => void;
            }
          ).miniMapZoom(x, y, 1.2),
        { x: root.positionX, y: root.positionY }
      );
      const layer = page.locator(
        '.local-item-neighborhood[data-active="true"]'
      );
      await expect(layer).toHaveAttribute('data-local-focus', root.id);
      await expect.poll(async () => (await camera(page)).k).toBeCloseTo(1.2);
      const first = await inspectLocalItemNeighborhood(
        page,
        info,
        before.edges,
        `local-${width}-initial`,
        width === 390 ? 1 : 2
      );
      expect(first.snapshot.counts.incident).toBe(107);
      expect(first.snapshot.counts.loadedNeighbors).toBe(107);
      expect(
        first.snapshot.routes.flatMap(route => route.edgeIds).length
      ).toBeGreaterThan(0);
      await expect(page.locator('[data-local-item-status]')).toContainText(
        '107 connections'
      );
      expect(await snapshot(page, graphId)).toEqual(before);
      expect(blockedWrites).toEqual([]);

      const hiddenWire = layer.locator('[data-lod-bundle]').first();
      await hiddenWire.evaluate(
        path => ((path as SVGElement).style.opacity = '0')
      );
      await expect(
        inspectLocalItemNeighborhood(
          page,
          info,
          before.edges,
          `local-${width}-hidden-negative`
        )
      ).rejects.toThrow('Local wire must actually be painted');
      await hiddenWire.evaluate(path =>
        (path as SVGElement).style.removeProperty('opacity')
      );

      const target = layer.locator('[data-lod-bus-hit]').first();
      const targetId = (await target.getAttribute('data-lod-bus-hit'))!;
      const [source, destination] = JSON.parse(targetId) as string[];
      const expectedIds = first.snapshot.routes
        .find(route => route.source === source && route.target === destination)!
        .edgeIds.slice()
        .sort();
      const pointer = await target.evaluate(path => {
        const wire = path as SVGPathElement;
        for (const fraction of [0.5, 0.35, 0.65, 0.2, 0.8]) {
          const point = wire.getPointAtLength(wire.getTotalLength() * fraction);
          const screen = new DOMPoint(point.x, point.y).matrixTransform(
            wire.getScreenCTM()!
          );
          if (document.elementFromPoint(screen.x, screen.y) === wire)
            return { x: screen.x, y: screen.y };
        }
        return null;
      });
      expect(
        pointer,
        'A painted local wire must offer a usable pointer target'
      ).not.toBeNull();
      await page.mouse.move(pointer!.x, pointer!.y);
      await expect(page.getByRole('tooltip')).toBeVisible();
      const outlined = await layer
        .locator('[data-local-item-card]')
        .evaluateAll(cards =>
          cards
            .filter(card => getComputedStyle(card).outlineStyle !== 'none')
            .map(card => card.getAttribute('data-local-item-card'))
            .sort()
        );
      expect(outlined).toEqual([source, destination].sort());
      await target.focus();
      await page.keyboard.press('Enter');
      const relationships = page.getByRole('region', {
        name: 'Graph relationships',
        exact: true,
      });
      await expect(relationships).toBeVisible();
      expect(
        await relationships
          .locator('[data-lod-edge-id]')
          .evaluateAll(rows =>
            rows.map(row => row.getAttribute('data-lod-edge-id')!).sort()
          )
      ).toEqual(expectedIds);
      await relationships
        .getByRole('button', { name: 'Back to graph', exact: true })
        .click();
      await expect(target).toBeFocused();
      await page.keyboard.press('Escape');
      await page.mouse.move(0, 0);

      const initialIds = await originalCards(page);
      await page
        .getByRole('button', { name: 'Next linked items', exact: true })
        .click();
      await expect.poll(() => originalCards(page)).not.toEqual(initialIds);
      const pagedIds = await originalCards(page);
      const previousCamera = await camera(page);
      const neighborId = pagedIds.find(id => id !== root.id)!;
      const neighbor = before.workItems.find(item => item.id === neighborId)!;
      await layer
        .getByRole('button', {
          name: `Focus on ${neighbor.title}`,
          exact: true,
        })
        .click();
      await expect(layer).toHaveAttribute('data-local-focus', neighbor.id);
      await expect(
        page.getByRole('button', { name: 'Back to previous item', exact: true })
      ).toBeEnabled();
      await page
        .getByRole('button', { name: 'Back to previous item', exact: true })
        .click();
      await expect(layer).toHaveAttribute('data-local-focus', root.id);
      await expect.poll(() => originalCards(page)).toEqual(pagedIds);
      await expect.poll(() => camera(page)).toEqual(previousCamera);

      const group = page.getByRole('combobox', {
        name: 'Linked item group',
        exact: true,
      });
      await expect(group).toBeVisible();
      const option = await group.locator('option').nth(1).getAttribute('value');
      await group.selectOption(option!);
      await expect.poll(() => group.inputValue()).toBe(option);
      await group.selectOption('');
      await expect.poll(() => group.inputValue()).toBe('');
      const retainedIds = await originalCards(page);
      const frame = await page.locator('.graph-container').boundingBox();
      const panBefore = await camera(page);
      await page.mouse.move(
        frame!.x + frame!.width - 4,
        frame!.y + frame!.height / 2
      );
      await page.mouse.down();
      await page.mouse.move(
        frame!.x + frame!.width - 10,
        frame!.y + frame!.height / 2 - 6,
        { steps: 3 }
      );
      await page.mouse.up();
      await expect.poll(() => camera(page)).not.toEqual(panBefore);
      expect(await originalCards(page)).toEqual(retainedIds);
      await inspectLocalItemNeighborhood(
        page,
        info,
        before.edges,
        `local-${width}-panned`
      );
      const retainedCamera = await camera(page);
      await expect
        .poll(() =>
          page.evaluate(graphId => {
            const saved = JSON.parse(
              localStorage.getItem(`graphdone:camera:${graphId}`) ?? 'null'
            );
            return saved && { x: saved.x, y: saved.y, k: saved.k };
          }, graphId)
        )
        .toEqual(retainedCamera);
      expect(await snapshot(page, graphId)).toEqual(before);
      expect(blockedWrites).toEqual([]);
      await page.reload();
      await expect(layer).toHaveAttribute('data-local-focus', root.id);
      await expect.poll(() => originalCards(page)).toEqual(retainedIds);
      await expect.poll(() => camera(page)).toEqual(retainedCamera);
      await inspectLocalItemNeighborhood(
        page,
        info,
        before.edges,
        `local-${width}-reload`
      );

      const editableId = (await originalCards(page)).find(
        id => id !== root.id
      )!;
      const editable = before.workItems.find(item => item.id === editableId)!;
      const trigger = layer.locator(`[data-local-open="${editable.id}"]`);
      await trigger.click();
      const inspector = page.getByTestId('node-inspector');
      await expect(inspector).toBeVisible();
      await expect(inspector.getByTestId('copyable-id')).toHaveAttribute(
        'title',
        `Copy ID: ${editable.id}`
      );
      await expect(inspector).toContainText(editable.title);
      await inspector
        .getByRole('button', { name: 'Close', exact: true })
        .click();
      await expect(trigger).toBeFocused();
      await trigger.click();
      await inspector
        .getByRole('button', { name: 'Edit', exact: true })
        .click();
      const editor = page.getByTestId('quick-edit-surface');
      await expect(editor).toBeVisible();
      const editorBounds = await editor.boundingBox();
      expect(editorBounds!.x).toBeGreaterThanOrEqual(0);
      expect(editorBounds!.y).toBeGreaterThanOrEqual(0);
      expect(editorBounds!.x + editorBounds!.width).toBeLessThanOrEqual(width);
      allowedEdit = { id: editable.id, title: `${editable.title} — verified` };
      await page.getByTestId('quick-title').fill(allowedEdit.title);
      await page.getByTestId('quick-title').press('Enter');
      await expect
        .poll(
          async () =>
            (await snapshot(page, graphId)).workItems.find(
              item => item.id === editable.id
            )!.title
        )
        .toBe(allowedEdit.title);
      await editor
        .getByRole('button', { name: 'Close quick edit', exact: true })
        .click();
      const editedTrigger = layer.locator(`[data-local-open="${editable.id}"]`);
      await expect(editedTrigger).toHaveAttribute('title', allowedEdit.title);
      await expect(editedTrigger).toBeFocused();
      const after = await snapshot(page, graphId);
      expect(after.edges).toEqual(before.edges);
      expect(after.workItems).toEqual(
        before.workItems.map(item =>
          item.id === editable.id
            ? { ...item, title: allowedEdit!.title }
            : item
        )
      );
      expect(allowedWrites).toHaveLength(1);
      expect(blockedWrites).toEqual([]);
      const final = await inspectLocalItemNeighborhood(
        page,
        info,
        before.edges,
        `local-${width}-edited`
      );
      let footerGeometry: unknown;
      if (width === 390) {
        footerGeometry = await page
          .getByTestId('mobile-bottom-nav')
          .evaluate(nav => {
            const box = nav.getBoundingClientRect();
            const tabs = [
              ...nav.querySelectorAll(':scope > button,:scope > a'),
            ].map(tab => {
              const r = tab.getBoundingClientRect();
              return {
                x: r.x,
                width: r.width,
                height: r.height,
                overflow: tab.scrollWidth - tab.clientWidth,
              };
            });
            const dock = document
              .querySelector('[data-graph-status-dock]')!
              .getBoundingClientRect();
            return {
              x: box.x,
              right: box.right,
              bottom: box.bottom,
              tabs,
              dock: { x: dock.x, right: dock.right, bottom: dock.bottom },
              canvasBottom: document
                .querySelector('.graph-container')!
                .getBoundingClientRect().bottom,
            };
          });
        const footer = footerGeometry as {
          x: number;
          right: number;
          bottom: number;
          tabs: {
            x: number;
            width: number;
            height: number;
            overflow: number;
          }[];
          dock: { x: number; right: number; bottom: number };
          canvasBottom: number;
        };
        expect(footer.x).toBe(0);
        expect(footer.right).toBe(width);
        expect(footer.bottom).toBe(height);
        expect(footer.tabs.length).toBeGreaterThanOrEqual(3);
        for (const [index, tab] of footer.tabs.entries()) {
          expect(tab.width).toBeCloseTo(width / footer.tabs.length, 0);
          expect(tab.x).toBeCloseTo((index * width) / footer.tabs.length, 0);
          expect(tab.height).toBeGreaterThanOrEqual(48);
          expect(tab.overflow).toBeLessThanOrEqual(1);
        }
        expect(footer.dock.x).toBe(0);
        expect(footer.dock.right).toBe(width);
        expect(footer.dock.bottom).toBeCloseTo(footer.canvasBottom, 0);
      }
      expect(errors).toEqual([]);
      const receipt = info.outputPath(`local-${width}-identity.json`);
      await writeFile(
        receipt,
        JSON.stringify(
          {
            graphId,
            rootId: root.id,
            before,
            after,
            initialIds,
            pagedIds,
            retainedIds,
            retainedCamera,
            allowedWrites,
            blockedWrites,
            errors,
            footerGeometry,
            finalCounts: final.snapshot.counts,
          },
          null,
          2
        )
      );
      await info.attach(`local-${width}-identity`, {
        path: receipt,
        contentType: 'application/json',
      });
    });
  });
}
