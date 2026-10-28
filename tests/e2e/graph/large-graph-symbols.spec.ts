import { writeFile } from 'node:fs/promises';
import { test as base, expect } from '@playwright/test';
import { login, TEST_USERS } from '../../lib/auth';
import { gql } from '../../lib/graphRequest';
import {
  ownedGraphIdsFixture,
  type OwnedGraphs,
} from '../../lib/ownedGraphIdsFixture';
import type { SeededGraph } from '../../lib/seedGraph';
import { inspectItemSymbols } from '../../lib/itemSymbolVisual';
import { inspectSchematicOverview } from '../../lib/schematicOverview';

const SIZE = 2000;
const test = base.extend<{
  ownedGraphIds: OwnedGraphs;
  largeGraph: SeededGraph;
}>({
  ownedGraphIds: [ownedGraphIdsFixture, { timeout: 180000 }],
  largeGraph: [
    async ({ page, ownedGraphIds }, use) => {
      await login(page, TEST_USERS.ADMIN);
      const seeded = await ownedGraphIds.seed({
        size: SIZE,
        spacing: 420,
        edgeFactor: 1.5,
        batchSize: 20,
        namePrefix: 'Two thousand item zoom',
        titleForIndex: (index, type) =>
          `${type} ${index} ${index % 7 === 0 ? 'PaymentGatewayRetryReconciliationHandler' : 'worker'}`,
        metadataForIndex: index => ({
          lod: {
            groupPath: [
              `Subsystem ${Math.floor(index / 250)}`,
              `Service ${Math.floor(index / 50) % 5}`,
            ],
          },
        }),
        additionalEdges: Array.from({ length: 2000 }, (_, index) => ({
          sourceIndex: index,
          targetIndex: (index + 17) % SIZE,
          type: index % 2 ? 'BLOCKS' : 'ENABLES',
        })),
      });
      await gql(
        page,
        'mutation($id:ID!){updateWorkItems(where:{graph:{id:$id},positionX:0,positionY:0},update:{positionX:1}){workItems{id}}}',
        { id: seeded.graphId }
      );
      await use(seeded);
    },
    { timeout: 600000 },
  ],
});
test.use({
  viewport: { width: 1440, height: 900 },
  headless: true,
  actionTimeout: 10000,
  video: 'on',
});

test('2000 loaded items and 5000 relationships survive overview and detail zoom @large-symbols', async ({
  page,
  largeGraph,
}, info) => {
  test.setTimeout(180000);
  const snapshot = async () => {
    const data = await gql(
      page,
      'query($id:ID!){workItems(where:{graph:{id:$id}}){id title positionX positionY metadata} edges(where:{source:{graph:{id:$id}}}){id type source{id} target{id}}}',
      { id: largeGraph.graphId }
    );
    data.workItems.sort((a: { id: string }, b: { id: string }) =>
      a.id.localeCompare(b.id)
    );
    data.edges.sort((a: { id: string }, b: { id: string }) =>
      a.id.localeCompare(b.id)
    );
    return data;
  };
  const before = await snapshot();
  expect(before.workItems).toHaveLength(SIZE);
  expect(before.edges).toHaveLength(5000);
  const writes: string[] = [],
    errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/graphql', async route => {
    if (/^\s*mutation\b/.test(route.request().postDataJSON()?.query ?? '')) {
      writes.push(route.request().postDataJSON().operationName ?? 'mutation');
      await route.abort();
    } else await route.continue();
  });
  await page.evaluate(id => {
    localStorage.setItem('currentGraphId', id);
    localStorage.setItem('graphdone:viewMode', 'graph');
  }, largeGraph.graphId);
  const loadStart = Date.now();
  await page.goto('/');
  await expect(page.locator('.graph-container .node')).toHaveCount(SIZE, {
    timeout: 45000,
  });
  await expect
    .poll(
      () =>
        page.evaluate(() => (window as any).__layoutMetrics?.()?.cameraReady),
      { timeout: 15000 }
    )
    .toBe(true);
  const loadedMs = Date.now() - loadStart;
  expect(loadedMs).toBeLessThan(45000);
  const allIds = await page
    .locator('.node')
    .evaluateAll(nodes => nodes.map(node => (node as any).__data__.id).sort());
  expect(allIds).toEqual([...largeGraph.nodeIds].sort());
  expect(
    await page
      .locator('.edges-group .edge')
      .evaluateAll(edges =>
        edges.map(edge => edge.getAttribute('data-edge-id')).sort()
      )
  ).toEqual(before.edges.map((edge: { id: string }) => edge.id));
  const overview = page.locator('.semantic-overview');
  await expect(overview).toHaveAttribute('data-active', 'true');
  await inspectSchematicOverview(overview, info, 5000, '2000-items-fit', 8);
  const target = before.workItems.find(
    (item: { id: string }) => item.id === largeGraph.nodeIds[1008]
  );
  const timings: {
    scale: number;
    ms: number;
    paintedCards?: number;
    labels?: number;
  }[] = [];
  for (const scale of [1.2, 0.1, 1.2]) {
    const start = Date.now();
    await page.evaluate(
      ({ x, y, scale }) => (window as any).miniMapZoom(x, y, scale),
      { x: target.positionX, y: target.positionY, scale }
    );
    await expect
      .poll(() =>
        page
          .locator('.graph-container > svg')
          .evaluate(element => (element as any).__zoom.k)
      )
      .toBeCloseTo(scale);
    await expect(overview).toHaveAttribute(
      'data-active',
      scale < 1 ? 'true' : 'false'
    );
    await expect(page.locator('.main-graph-group')).toHaveAttribute(
      'data-presentation-scale',
      String(scale)
    );
    const elapsed = Date.now() - start;
    const timingPath = info.outputPath(`zoom-${timings.length}-timing.json`);
    await writeFile(
      timingPath,
      JSON.stringify({ nodes: SIZE, edges: 5000, loadedMs, scale, elapsed })
    );
    await info.attach(`zoom-${timings.length}-timing.json`, {
      path: timingPath,
      contentType: 'application/json',
    });
    expect(
      elapsed,
      'Zoom must finish within five seconds on the CI runner'
    ).toBeLessThan(5000);
    if (scale > 1) {
      const geometry = await inspectItemSymbols(
        page,
        info,
        `2000-detail-${timings.length}`
      );
      expect(geometry.cards.length).toBeLessThan(100);
      expect(geometry.labels.length).toBeGreaterThan(0);
      expect(geometry.labels.length).toBeLessThanOrEqual(32);
      const work = await page
        .locator('.main-graph-group')
        .evaluate(element => ({
          attempts: Number(element.getAttribute('data-label-attempts')),
          checks: Number(element.getAttribute('data-label-checks')),
        }));
      expect(work.attempts).toBeLessThanOrEqual(128);
      expect(work.checks).toBeLessThanOrEqual(200000);
      await expect(
        page.getByRole('button', {
          name: `5000 relationships, ${geometry.labels.length} labels shown. Browse all relationships`,
          exact: true,
        })
      ).toBeVisible();
      timings.push({
        scale,
        ms: elapsed,
        paintedCards: geometry.cards.length,
        labels: geometry.labels.length,
      });
    } else {
      await inspectSchematicOverview(
        overview,
        info,
        5000,
        '2000-items-zoomed-out',
        8
      );
      timings.push({ scale, ms: elapsed });
    }
  }
  await page
    .getByRole('button', {
      name: /5000 relationships, .*Browse all relationships/,
    })
    .click();
  const relationships = page.getByRole('region', {
    name: 'Graph relationships',
  });
  await expect(relationships).toBeVisible();
  await expect(relationships.locator('[data-lod-edge-id]')).toHaveCount(250);
  await relationships
    .getByRole('button', { name: 'Next relationships' })
    .click();
  await expect(
    relationships.locator('[data-lod-edge-id]').first()
  ).toHaveAttribute('data-lod-edge-id', before.edges[250].id);
  await relationships.getByRole('textbox').fill(before.edges[0].id);
  await expect(
    relationships.getByRole('button', {
      name: `Edit relationship ${before.edges[0].id}`,
      exact: true,
    })
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Back to graph', exact: true })
    .click();
  expect(await snapshot()).toEqual(before);
  expect(writes).toEqual([]);
  expect(errors).toEqual([]);
  const performancePath = info.outputPath('two-thousand-node-performance.json');
  await writeFile(
    performancePath,
    JSON.stringify({
      nodes: SIZE,
      edges: 5000,
      loadedMs,
      timings,
      writes,
      errors,
    })
  );
  await info.attach('two-thousand-node-performance.json', {
    path: performancePath,
    contentType: 'application/json',
  });
});
