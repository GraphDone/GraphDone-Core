import { writeFile } from 'node:fs/promises';
import { test as base, expect } from '@playwright/test';
import { login, TEST_USERS } from '../../lib/auth';
import { gql } from '../../lib/graphRequest';
import {
  ownedGraphIdsFixture,
  type OwnedGraphs,
} from '../../lib/ownedGraphIdsFixture';
import type { SeededGraph } from '../../lib/seedGraph';
import { measureGraphZoom } from '../../lib/graphZoomReady';
import {
  inspectLocalItemNeighborhood,
  readCanonicalItemPositions,
} from '../../lib/localItemNeighborhood';
import { inspectItemSymbols } from '../../lib/itemSymbolVisual';
import { inspectOverviewBus } from '../../lib/overviewBusInspection';
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
          sourceIndex: index < 500 ? index + 1 : index < 607 ? 1900 : index,
          targetIndex:
            index < 500 ? index : index < 607 ? index : (index + 17) % SIZE,
          type: index < 500 ? 'BLOCKS' : index % 2 ? 'BLOCKS' : 'ENABLES',
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
  test.setTimeout(240000);
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
    localStorage.removeItem('graphdone:relationship-priority');
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
  const canonicalBefore = await readCanonicalItemPositions(page);
  expect(canonicalBefore).toHaveLength(SIZE);
  const overview = page.locator('.semantic-overview');
  await expect(overview).toHaveAttribute('data-active', 'true');
  await inspectSchematicOverview(overview, info, 5000, '2000-items-fit', 8);
  await inspectOverviewBus(
    page,
    info,
    before.edges,
    Object.fromEntries(
      largeGraph.nodeIds.map((id, index) => [
        id,
        `Subsystem ${Math.floor(index / 250)}`,
      ])
    )
  );
  const priority = page.getByRole('combobox', {
    name: 'Relationship priority',
  });
  const camera = () =>
    page.locator('.graph-container > svg').evaluate(svg => {
      const { x, y, k } = (svg as any).__zoom;
      return { x, y, k };
    });
  const priorityStages: unknown[] = [];
  const fitCamera = await camera();
  for (const level of ['all', 'essential']) {
    await priority.selectOption(level);
    await expect(page.locator('.graph-container')).toHaveAttribute(
      'data-relationship-priority',
      level
    );
    await inspectSchematicOverview(
      overview,
      info,
      5000,
      `2000-overview-${level}`,
      8
    );
    const counts = await overview.evaluate(host => ({
      drawn: Array.from(host.querySelectorAll('[data-lod-bundle]')).reduce(
        (sum, path) => sum + Number(path.getAttribute('data-count')),
        0
      ),
      summarized: Number(host.getAttribute('data-priority-summarized')),
      deferred: Number(host.getAttribute('data-geometry-deferred')),
      internal: Number(host.getAttribute('data-internal-relationships')),
      pending: Number(host.getAttribute('data-pending-relationships')),
    }));
    expect(Object.values(counts).reduce((sum, count) => sum + count, 0)).toBe(
      5000
    );
    expect(counts.pending).toBe(0);
    if (level === 'all') expect(counts.summarized).toBe(0);
    else expect(counts.summarized).toBeGreaterThan(0);
    expect(await camera()).toEqual(fitCamera);
    priorityStages.push({ mode: 'overview', level, counts });
  }

  const target = before.workItems.find(
    (item: { id: string }) => item.id === largeGraph.nodeIds[1008]
  );
  const timings: {
    scale: number;
    ms: number;
    wallMs: number;
    paintedCards?: number;
    labels?: number;
  }[] = [];
  const presentation = () =>
    page.locator('.main-graph-group').evaluate(element => ({
      kind: element.getAttribute('data-presentation-kind'),
      itemScale: Number(element.getAttribute('data-item-presentation-scale')),
      passes: Number(element.getAttribute('data-item-presentation-passes')),
    }));
  for (const scale of [1.2, 0.1, 1.2]) {
    const priorPresentation = await presentation();
    const start = Date.now();
    const elapsed = await page.evaluate(measureGraphZoom, {
      x: target.positionX,
      y: target.positionY,
      scale,
    });
    const wallMs = Date.now() - start;
    const settledPresentation = await presentation();
    const timingPath = info.outputPath(`zoom-${timings.length}-timing.json`);
    await writeFile(
      timingPath,
      JSON.stringify({
        nodes: SIZE,
        edges: 5000,
        loadedMs,
        scale,
        elapsed,
        wallMs,
        priorPresentation,
        settledPresentation,
      })
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
      expect(settledPresentation.kind).toBe('items');
      expect(settledPresentation.itemScale).toBe(scale);
      expect(settledPresentation.passes).toBeGreaterThan(
        priorPresentation.passes
      );
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
          name: new RegExp(
            `^5000 relationships, ${geometry.labels.length} labels shown, [0-9]+ summarized by priority. Browse all relationships$`
          ),
          exact: true,
        })
      ).toBeVisible();
      timings.push({
        scale,
        ms: elapsed,
        wallMs,
        paintedCards: geometry.cards.length,
        labels: geometry.labels.length,
      });
    } else {
      expect(settledPresentation.kind).toBe('overview');
      expect(settledPresentation.itemScale).toBe(priorPresentation.itemScale);
      expect(settledPresentation.passes).toBe(priorPresentation.passes);
      await inspectSchematicOverview(
        overview,
        info,
        5000,
        '2000-items-zoomed-out',
        8
      );
      timings.push({ scale, ms: elapsed, wallMs });
    }
  }
  type OriginalEdge = {
    id: string;
    type: string;
    source: { id: string };
    target: { id: string };
  };
  const originalEdges = before.edges as OriginalEdge[];
  const pairKey = (edge: OriginalEdge) =>
    JSON.stringify([edge.source.id, edge.target.id].sort());
  const originalPairs = [...new Set(originalEdges.map(pairKey))].sort();
  const requiredBlockers = originalEdges.filter(
    edge =>
      edge.type === 'BLOCKS' &&
      largeGraph.nodeIds
        .slice(0, 500)
        .some(
          (id, index) =>
            edge.target.id === id &&
            edge.source.id === largeGraph.nodeIds[index + 1]
        )
  );
  expect(requiredBlockers).toHaveLength(500);
  const detailCamera = await camera();
  let previousIds: string[] = [];
  let essentialIds: string[] = [];
  for (const level of ['essential', 'dependencies', 'all', 'essential']) {
    await priority.selectOption(level);
    await expect(page.locator('.graph-container')).toHaveAttribute(
      'data-relationship-priority',
      level
    );
    await expect
      .poll(() =>
        page
          .locator('.edges-group .edge')
          .evaluateAll(
            paths =>
              paths.filter(
                path => path.getAttribute('data-priority-visible') === 'true'
              ).length
          )
      )
      .toBe(
        Number(
          await page
            .locator('.graph-container')
            .getAttribute('data-priority-represented')
        )
      );
    const ids = await page.locator('.edges-group .edge').evaluateAll(paths =>
      paths
        .filter(path => path.getAttribute('data-priority-visible') === 'true')
        .map(path => path.getAttribute('data-edge-id')!)
        .sort()
    );
    const representedIds = new Set(ids);
    const represented = originalEdges.filter(edge =>
      representedIds.has(edge.id)
    );
    expect(represented).toHaveLength(ids.length);
    expect([...new Set(represented.map(pairKey))].sort()).toEqual(
      originalPairs
    );
    for (const blocker of requiredBlockers)
      expect(representedIds.has(blocker.id)).toBe(true);
    if (level === 'essential') {
      expect(ids.length).toBeLessThanOrEqual(4500);
      if (essentialIds.length) expect(ids).toEqual(essentialIds);
      else essentialIds = ids;
      const dependency = originalEdges.find(
        edge =>
          edge.type === 'DEPENDS_ON' &&
          edge.source.id === largeGraph.nodeIds[0] &&
          edge.target.id === largeGraph.nodeIds[1]
      )!;
      expect(representedIds.has(dependency.id)).toBe(false);
    } else {
      expect(previousIds.every(id => representedIds.has(id))).toBe(true);
    }
    if (level === 'all')
      expect(ids).toEqual(originalEdges.map(edge => edge.id));
    await expect(page.locator('.graph-container')).toHaveAttribute(
      'data-priority-summarized',
      String(5000 - ids.length)
    );
    await expect(page.locator('.graph-container')).toHaveAttribute(
      'data-priority-pending',
      '0'
    );
    const geometry = await inspectItemSymbols(
      page,
      info,
      `2000-priority-${priorityStages.length}-${level}`
    );
    expect(geometry.labels.length).toBeGreaterThan(0);
    expect(geometry.labels.length).toBeLessThanOrEqual(32);
    expect(await camera()).toEqual(detailCamera);
    priorityStages.push({
      mode: 'items',
      level,
      ids,
      labels: geometry.labels.length,
      pairs: originalPairs.length,
    });
    previousIds = ids;
  }
  const priorityPath = info.outputPath('two-thousand-priority.json');
  await writeFile(priorityPath, JSON.stringify(priorityStages));
  await info.attach('two-thousand-priority.json', {
    path: priorityPath,
    contentType: 'application/json',
  });
  const revealId = largeGraph.nodeIds[1011];
  const reveal = page.locator('.node').filter({
    has: page.locator(`.node-edit-icon[data-node-id="${revealId}"]`),
  });
  await expect(reveal).toBeHidden();
  const panStart = await page.evaluate(() =>
    [
      [1200, 300],
      [1200, 250],
      [1200, 600],
    ]
      .map(([x, y]) => ({ x, y }))
      .find(point =>
        document
          .elementFromPoint(point.x, point.y)
          ?.classList.contains('background')
      )
  );
  expect(panStart).toBeTruthy();
  await page.mouse.move(panStart!.x, panStart!.y);
  await page.mouse.down();
  try {
    await page.mouse.move(panStart!.x - 1512, panStart!.y, { steps: 4 });
    await expect(reveal).toBeVisible();
    await expect(reveal).toHaveAttribute('data-detail', 'full');
    const held = await reveal.evaluate(node => {
      const card = node.querySelector('.node-bg')!.getBoundingClientRect();
      const title = node
        .querySelector('.node-title-group')!
        .getBoundingClientRect();
      return {
        card: card.toJSON(),
        title: title.toJSON(),
        fit:
          title.left >= card.left &&
          title.right <= card.right &&
          title.top >= card.top &&
          title.bottom <= card.bottom,
      };
    });
    expect(held.fit).toBe(true);
    const heldPath = info.outputPath('2000-held-pan-reveal.json');
    await writeFile(heldPath, JSON.stringify(held));
    await info.attach('2000-held-pan-reveal.json', {
      path: heldPath,
      contentType: 'application/json',
    });
    const heldImage = info.outputPath('2000-held-pan-reveal.png');
    await page.screenshot({ path: heldImage });
    await info.attach('2000-held-pan-reveal.png', {
      path: heldImage,
      contentType: 'image/png',
    });
  } finally {
    await page.mouse.up();
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
  const denseTarget = before.workItems.find(
    (item: { id: string }) => item.id === largeGraph.nodeIds[1900]
  );
  const denseIncident = originalEdges.filter(
    edge =>
      edge.source.id === denseTarget.id || edge.target.id === denseTarget.id
  );
  expect(
    new Set(
      denseIncident
        .flatMap(edge => [edge.source.id, edge.target.id])
        .filter(id => id !== denseTarget.id)
    ).size
  ).toBeGreaterThanOrEqual(107);
  const denseTimings: { scale: number; ms: number; wallMs: number }[] = [];
  let denseOriginals: string[] = [];
  for (const scale of [1.2, 0.1, 1.2]) {
    const started = Date.now();
    const ms = await page.evaluate(measureGraphZoom, {
      x: denseTarget.positionX,
      y: denseTarget.positionY,
      scale,
    });
    denseTimings.push({ scale, ms, wallMs: Date.now() - started });
    expect(
      ms,
      'Dense local zoom must finish within the unchanged five-second CI budget'
    ).toBeLessThan(5000);
    if (scale > 1) {
      const local = await inspectLocalItemNeighborhood(
        page,
        info,
        originalEdges,
        `2000-dense-local-${denseTimings.length}`,
        2
      );
      expect(local.snapshot.focusId).toBe(denseTarget.id);
      expect(local.snapshot.counts.incident).toBe(denseIncident.length);
      const ids = local.snapshot.cards.flatMap(card =>
        card.originalId ? [card.originalId] : []
      );
      if (denseOriginals.length) expect(ids).toEqual(denseOriginals);
      else denseOriginals = ids;
    } else
      await inspectSchematicOverview(
        overview,
        info,
        5000,
        '2000-dense-return-overview',
        8
      );
  }
  const canonicalAfter = await readCanonicalItemPositions(page);
  expect(canonicalAfter).toEqual(canonicalBefore);
  const densePath = info.outputPath('two-thousand-dense-local-timings.json');
  await writeFile(
    densePath,
    JSON.stringify({
      nodes: SIZE,
      edges: 5000,
      denseIncident: denseIncident.length,
      timings: denseTimings,
      originalIds: denseOriginals,
      canonicalBefore,
      canonicalAfter,
    })
  );
  await info.attach('two-thousand-dense-local-timings.json', {
    path: densePath,
    contentType: 'application/json',
  });
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
      denseTimings,
      writes,
      errors,
    })
  );
  await info.attach('two-thousand-node-performance.json', {
    path: performancePath,
    contentType: 'application/json',
  });
});
