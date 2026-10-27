import { test as base, expect, type CDPSession } from '@playwright/test';
import { login, TEST_USERS } from '../../lib/auth';
import { gql } from '../../lib/graphRequest';
import { seedLargeGraph } from '../../lib/seedGraph';
import {
  ownedGraphIdsFixture,
  type OwnedGraphs,
} from '../../lib/ownedGraphIdsFixture';

// Cold Neo4j query planning belongs to fixture setup, not the interaction
// budget. Both budgets are bounded; slow clicks and assertions still fail.
const test = base.extend<{
  ownedGraphIds: OwnedGraphs;
  lodFixture: {
    seeded: Awaited<ReturnType<typeof seedLargeGraph>>;
    otherGraph?: Awaited<ReturnType<typeof seedLargeGraph>>;
    touch: CDPSession | null;
  };
}>({
  ownedGraphIds: [ownedGraphIdsFixture, { timeout: 60000 }],
  lodFixture: [
    async ({ page, ownedGraphIds }, use) => {
      const width = page.viewportSize()!.width;
      const touch =
        width === 390 ? await page.context().newCDPSession(page) : null;
      try {
        if (touch)
          await touch.send('Emulation.setTouchEmulationEnabled', {
            enabled: true,
            maxTouchPoints: 2,
          });
        await login(page, TEST_USERS.ADMIN);
        const seeded = await ownedGraphIds.seed({
          size: 301,
          spacing: 300,
          edgeFactor: 370 / 301,
          namePrefix: 'Semantic LOD',
          batchSize: 20,
          titleForIndex: (index, type) =>
            index === 8
              ? `${type} 8 — Follow a request through gateway validation, event delivery, retries, settlement and reconciliation across the entire system`
              : `${type} ${index}`,
          metadataForIndex: index => ({
            lod: { groupPath: [`Subsystem ${index % 8}`, 'Worker'] },
          }),
        });
        const otherGraph =
          width === 1440
            ? await ownedGraphIds.seed({
                size: 40,
                spacing: 300,
                batchSize: 20,
                namePrefix: 'LOD switch target',
              })
            : undefined;
        await use({ seeded, otherGraph, touch });
      } finally {
        await touch?.detach();
      }
    },
    { timeout: 180000 },
  ],
});

test.use({ actionTimeout: 10000 });

for (const width of [1440, 390])
  test.describe(`${width}px LOD`, () => {
    test.use({ viewport: { width, height: 900 } });
    test(`semantic overview preserves 301 items and layout at ${width}px @lod`, async ({
      page,
      lodFixture,
    }, info) => {
      test.setTimeout(120000);
      const { seeded, otherGraph, touch } = lodFixture;
      const attemptedWrites: string[] = [];
      const pageErrors: string[] = [];
      page.on('pageerror', error => pageErrors.push(error.message));
      const snapshot = async () =>
        (
          await gql(
            page,
            `query($id:ID!){workItems(where:{graph:{id:$id}}){id positionX positionY}}`,
            { id: seeded.graphId }
          )
        ).workItems.sort((a: { id: string }, b: { id: string }) =>
          a.id.localeCompare(b.id)
        );
      const graphNames = (await gql(page, 'query{graphs{id name}}')).graphs as {
        id: string;
        name: string;
      }[];
      const switchGraph = async (id: string) => {
        await page
          .getByTestId(
            width === 390 ? 'graph-selector-mobile' : 'graph-selector'
          )
          .click();
        await page
          .getByTestId('graph-selector-dropdown')
          .getByText(graphNames.find(graph => graph.id === id)!.name, {
            exact: true,
          })
          .click();
        // This selector intentionally stays open after changing graphs.
        await page.keyboard.press('Escape');
        await expect(page.getByTestId('graph-selector-dropdown')).toHaveCount(
          0
        );
      };
      // (0,0) means unplaced in the existing renderer. This fixture uses only
      // deliberately pinned positions so navigation must perform zero writes.
      await gql(
        page,
        `mutation($id:ID!){updateWorkItems(where:{graph:{id:$id},positionX:0,positionY:0},update:{positionX:1}){workItems{id}}}`,
        { id: seeded.graphId }
      );
      const before = await snapshot();
      await page.route('**/api/graphql', async route => {
        const body = route.request().postDataJSON();
        if (/^\s*mutation\b/.test(body?.query ?? '')) {
          attemptedWrites.push(body.operationName ?? 'unnamed mutation');
          await route.abort('blockedbyclient');
        } else await route.continue();
      });
      await page.evaluate(id => {
        localStorage.setItem('currentGraphId', id);
        localStorage.setItem('graphdone:viewMode', 'graph');
      }, seeded.graphId);
      await page.clock.install();
      await page.clock.pauseAt(new Date(Date.now() + 100));
      await page.goto('/');
      await expect(page.locator('.graph-container .node')).toHaveCount(301, {
        timeout: 30000,
      });
      await page.clock.runFor(350);
      const overview = page.locator('.semantic-overview');
      await expect(overview).toHaveAttribute('data-active', 'true');
      const cards = page.locator('[data-lod-group]');
      const svg = page.locator('.graph-container > svg');
      await svg.evaluate(element => {
        element.setAttribute('data-lod-identity', 'retained');
      });
      expect(await cards.count()).toBeGreaterThan(0);
      const longTitleItem = before.find(
        (item: { id: string }) => item.id === seeded.nodeIds[8]
      );
      const zoomToTitle = async (scale: number, advanceClock = false) => {
        await page.evaluate(
          ({ x, y, scale }) =>
            (
              window as unknown as {
                miniMapZoom: (x: number, y: number, k: number) => void;
              }
            ).miniMapZoom(x, y, scale),
          { x: longTitleItem.positionX, y: longTitleItem.positionY, scale }
        );
        if (advanceClock) await page.clock.runFor(150);
        await expect
          .poll(() =>
            svg.evaluate(
              element =>
                (element as SVGSVGElement & { __zoom: { k: number } }).__zoom.k
            )
          )
          .toBeCloseTo(scale);
      };
      await zoomToTitle(0.5, true);
      for (let sample = 0; sample < 6; sample++) {
        await page.clock.runFor(250);
        expect(await svg.evaluate(element =>
          (element as SVGSVGElement & { __zoom: { k: number } }).__zoom.k
        )).toBeCloseTo(0.5);
      }
      await page.clock.resume();
      const geometry = await cards.evaluateAll(elements =>
        elements.map(element => {
          const rect = element.getBoundingClientRect();
          return {
            x: rect.x,
            y: rect.y,
            right: rect.right,
            bottom: rect.bottom,
            font: parseFloat(
              getComputedStyle(element.querySelector('span')!).fontSize
            ),
          };
        })
      );
      for (const a of geometry) {
        expect(a.font).toBeGreaterThanOrEqual(14);
        expect(a.x).toBeGreaterThanOrEqual(0);
        expect(a.right).toBeLessThanOrEqual(width);
        for (const b of geometry.filter(b => b !== a))
          expect(
            a.x < b.right && a.right > b.x && a.y < b.bottom && a.bottom > b.y
          ).toBe(false);
      }
      await info.attach('overview-geometry.json', {
        body: JSON.stringify({
          width,
          nodes: before.length,
          edges: seeded.edgeCount,
          geometry,
        }),
        contentType: 'application/json',
      });
      await page.screenshot({
        path: `test-artifacts/quality/semantic-lod-${width}.png`,
      });
      for (const scale of [0.5, 0.9, 0.99, 1.1]) {
        await zoomToTitle(scale);
        await expect(overview).toHaveAttribute('data-active', 'true');
      }
      for (const scale of [1.2, 1.14, 1.01]) {
        await zoomToTitle(scale);
        await expect(overview).toHaveAttribute('data-active', 'false');
        const titleSizes = await svg.locator('.node-title-text').evaluateAll(
          (elements, id) =>
            elements
              .filter(
                element =>
                  (
                    element.closest('.node') as Element & {
                      __data__?: { id: string };
                    }
                  )?.__data__?.id === id
              )
              .map(element => {
                const matrix = (element as SVGGraphicsElement).getScreenCTM()!;
                return (
                  parseFloat(getComputedStyle(element).fontSize) *
                  Math.hypot(matrix.a, matrix.b)
                );
              }),
          seeded.nodeIds[8]
        );
        expect(titleSizes.length).toBeGreaterThan(0);
        expect(Math.min(...titleSizes)).toBeGreaterThanOrEqual(12);
      }
      await zoomToTitle(0.99);
      await expect(overview).toHaveAttribute('data-active', 'true');
      await zoomToTitle(0.23);
      await expect(overview).toHaveAttribute('data-active', 'true');
      await overview
        .getByRole('button', { name: '8 groups · 301 items' })
        .click();
      await expect(
        page
          .getByRole('region', { name: 'Graph groups' })
          .getByRole('button', { name: /Subsystem/ })
      ).toHaveCount(8);
      await page
        .getByRole('region', { name: 'Graph groups' })
        .getByRole('button', { name: /Subsystem 0/ })
        .click();
      const members = page.getByRole('region', { name: 'Subsystem 0 members' });
      await expect(
        members.getByRole('button', {
          name: /TASK|BUG|FEATURE|MILESTONE|OUTCOME/,
        })
      ).toHaveCount(38);
      await members
        .getByRole('textbox', { name: 'Find an item' })
        .fill('TASK 0');
      await members
        .getByRole('button', { name: 'TASK 0 TASK · PROPOSED', exact: true })
        .click();
      await expect(page.getByTestId('node-inspector')).toBeVisible();
      await expect(page.getByTestId('node-inspector')).toContainText('TASK 0');
      await expect(overview).toHaveAttribute('data-active', 'false');
      await expect(page.locator('.graph-container')).not.toHaveAttribute(
        'data-overview',
        'true'
      );
      await expect(
        overview.getByRole('button', { name: 'Back to overview' })
      ).toBeVisible();
      await expect(
        overview.getByRole('button', { name: 'Back to overview' })
      ).toBeFocused();
      await overview.getByRole('button', { name: 'Back to overview' }).click();
      await expect(overview).toHaveAttribute('data-active', 'true');
      await expect(page.getByTestId('node-inspector')).toHaveCount(0);
      // Real wheel input over a summary must use the retained D3 camera.
      const initialScale = await svg.evaluate(
        element =>
          (element as SVGSVGElement & { __zoom: { k: number } }).__zoom.k
      );
      await cards.first().hover();
      await page.mouse.wheel(0, -180);
      await expect
        .poll(() =>
          svg.evaluate(
            element =>
              (element as SVGSVGElement & { __zoom: { k: number } }).__zoom.k
          )
        )
        .toBeGreaterThan(initialScale);
      const transform = () =>
        svg.evaluate(element => {
          const { x, y, k } = (
            element as SVGSVGElement & {
              __zoom: { x: number; y: number; k: number };
            }
          ).__zoom;
          return { x, y, k };
        });
      const beforePan = await transform();
      const cardBounds = (await cards.first().boundingBox())!;
      const x = cardBounds.x + cardBounds.width / 2,
        y = cardBounds.y + cardBounds.height / 2;
      if (touch) {
        await touch.send('Input.dispatchTouchEvent', {
          type: 'touchStart',
          touchPoints: [{ x, y, id: 1 }],
        });
        await touch.send('Input.dispatchTouchEvent', {
          type: 'touchMove',
          touchPoints: [{ x: x + 35, y: y + 15, id: 1 }],
        });
        await touch.send('Input.dispatchTouchEvent', {
          type: 'touchEnd',
          touchPoints: [],
        });
        await expect
          .poll(async () => (await transform()).x)
          .not.toBe(beforePan.x);
        const beforePinch = await transform();
        await touch.send('Input.dispatchTouchEvent', {
          type: 'touchStart',
          touchPoints: [
            { x: x - 20, y, id: 1 },
            { x: x + 20, y, id: 2 },
          ],
        });
        await touch.send('Input.dispatchTouchEvent', {
          type: 'touchMove',
          touchPoints: [
            { x: x - 40, y, id: 1 },
            { x: x + 40, y, id: 2 },
          ],
        });
        await touch.send('Input.dispatchTouchEvent', {
          type: 'touchEnd',
          touchPoints: [],
        });
        await expect
          .poll(async () => (await transform()).k)
          .toBeGreaterThan(beforePinch.k);
      } else {
        await page.mouse.move(x, y);
        await page.mouse.down();
        await page.mouse.move(x + 35, y + 15, { steps: 5 });
        await page.mouse.up();
        await expect
          .poll(async () => (await transform()).x)
          .not.toBe(beforePan.x);
      }
      await expect(page.getByRole('region', { name: /members/ })).toHaveCount(
        0
      );
      // Keyboard opening/escape returns focus to the summary, including touch devices.
      await cards.first().focus();
      await page.keyboard.press('Enter');
      await expect(
        page.getByRole('button', { name: 'Close group browser' })
      ).toBeFocused();
      await page.keyboard.press('Escape');
      await expect(cards.first()).toBeFocused();
      await page.keyboard.press('Enter');
      const directMembers = page.getByRole('region', { name: /members/ });
      await directMembers
        .locator('ul')
        .first()
        .getByRole('button')
        .first()
        .focus();
      await page.keyboard.press('Enter');
      await expect(page.getByTestId('node-inspector')).toBeVisible();
      await expect(
        overview.getByRole('button', { name: 'Back to overview' })
      ).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(
        overview.getByRole('button', { name: '8 groups · 301 items' })
      ).toBeFocused();

      await page.evaluate(() =>
        (
          window as unknown as {
            miniMapZoom: (x: number, y: number, k: number) => void;
          }
        ).miniMapZoom(0, 0, 1.2)
      );
      await expect.poll(async () => (await transform()).k).toBeCloseTo(1.2);
      await overview
        .getByRole('combobox', { name: 'Graph detail' })
        .selectOption('overview');
      await expect(
        page.locator('.graph-container > svg .nodes-group')
      ).toBeHidden();
      await expect(
        page.locator('.graph-container > svg .arrows-group')
      ).toBeHidden();
      expect(await svg.locator(':scope > defs #node-drop-shadow').count()).toBe(
        1
      );
      expect(await overview.locator('defs filter').count()).toBe(0);
      const inspectFirst = async () => {
        await overview
          .getByRole('button', { name: '8 groups · 301 items' })
          .click();
        await page
          .getByRole('region', { name: 'Graph groups' })
          .getByRole('button', { name: /Subsystem 0/ })
          .click();
        const region = page.getByRole('region', {
          name: 'Subsystem 0 members',
        });
        await region
          .getByRole('textbox', { name: 'Find an item' })
          .fill('TASK 0');
        await region
          .getByRole('button', { name: 'TASK 0 TASK · PROPOSED', exact: true })
          .focus();
        await page.keyboard.press('Enter');
        await expect(page.getByTestId('node-inspector')).toContainText(
          'TASK 0'
        );
        await expect(
          overview.getByRole('button', { name: 'Back to overview' })
        ).toBeFocused();
      };
      await inspectFirst();
      await page.keyboard.press('Enter');
      await expect(
        overview.getByRole('combobox', { name: 'Graph detail' })
      ).toHaveValue('overview');
      await expect(overview).toHaveAttribute('data-active', 'true');
      // Representation changes retain the SVG within a graph scope. The existing
      // app may replace it when changing to a different graph.
      await expect(svg).toHaveAttribute('data-lod-identity', 'retained');
      if (otherGraph) {
        await inspectFirst(); // leave a saved A camera before switching A → B → A
        await switchGraph(otherGraph.graphId);
        await expect(page.locator('.graph-container .node')).toHaveCount(40);
        await switchGraph(seeded.graphId);
        await expect(page.locator('.graph-container .node')).toHaveCount(301);
        await page.evaluate(() =>
          (
            window as unknown as {
              miniMapZoom: (x: number, y: number, k: number) => void;
            }
          ).miniMapZoom(0, 0, 0.23)
        );
        await expect.poll(async () => (await transform()).k).toBeCloseTo(0.23);
        const returnCamera = await transform();
        await svg.evaluate(element =>
          element.setAttribute('data-lod-identity', 'returned-graph')
        );
        await inspectFirst();
        await page.keyboard.press('Enter');
        await expect.poll(transform).toEqual(returnCamera);
        await expect(svg).toHaveAttribute(
          'data-lod-identity',
          'returned-graph'
        );
      }
      await page.waitForTimeout(1000); // let debounced persistence attempts surface
      expect(await snapshot()).toEqual(before);
      expect(attemptedWrites).toEqual([]);
      expect(pageErrors).toEqual([]);
      await page.reload();
      await expect(page.locator('.graph-container .node')).toHaveCount(301);
      expect(await snapshot()).toEqual(before);
      expect(attemptedWrites).toEqual([]);
    });
  });
