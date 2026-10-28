import { test as base, expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { login, TEST_USERS } from '../../lib/auth';
import { gql } from '../../lib/graphRequest';
import { inspectItemSymbols } from '../../lib/itemSymbolVisual';
import {
  ownedGraphIdsFixture,
  type OwnedGraphs,
} from '../../lib/ownedGraphIdsFixture';

const test = base.extend<{ ownedGraphIds: OwnedGraphs }>({
  ownedGraphIds: [ownedGraphIdsFixture, { timeout: 60000 }],
});
test.use({ actionTimeout: 10000 });

for (const width of [1440, 390]) {
  test(`relationship priority retains connected pairs and exact editing at ${width} @item-wires`, async ({
    page,
    ownedGraphIds,
  }, info) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width, height: 900 });
    await login(page, TEST_USERS.ADMIN);
    const seeded = await ownedGraphIds.seed({
      size: 4,
      spacing: 600,
      edgeFactor: 0,
      namePrefix: 'Relationship priority',
      titleForIndex: index => ['Gateway', 'Worker', 'Queue', 'Store'][index],
      additionalEdges: [
        { sourceIndex: 1, targetIndex: 0, type: 'BLOCKS' },
        { sourceIndex: 0, targetIndex: 1, type: 'REFERENCES' },
      ],
    });
    await gql(
      page,
      'mutation($id:ID!){updateWorkItems(where:{id:$id},update:{positionX:1,positionY:1}){workItems{id}}}',
      { id: seeded.nodeIds[3] }
    );
    await gql(
      page,
      'mutation($source:ID!,$target:ID!){updateEdges(where:{source:{id:$source},target:{id:$target}},update:{type:REFERENCES}){edges{id}}}',
      { source: seeded.nodeIds[2], target: seeded.nodeIds[3] }
    );
    if (width === 390)
      await gql(
        page,
        'mutation($worker:ID!,$queue:ID!){worker:updateWorkItems(where:{id:$worker},update:{positionX:-600,positionY:0}){workItems{id}} queue:updateWorkItems(where:{id:$queue},update:{positionX:0,positionY:-600}){workItems{id}}}',
        { worker: seeded.nodeIds[1], queue: seeded.nodeIds[2] }
      );
    const framing = { x: width === 390 ? -600 : -300, y: -300 };
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
    const before = await snapshot();
    const blocker = before.edges.find(
      (edge: { type: string }) => edge.type === 'BLOCKS'
    );
    const primaryIds = before.edges
      .filter(
        (edge: {
          id: string;
          type: string;
          source: { id: string };
          target: { id: string };
        }) =>
          edge.id === blocker.id ||
          (edge.source.id === seeded.nodeIds[1] &&
            edge.target.id === seeded.nodeIds[2]) ||
          (edge.source.id === seeded.nodeIds[2] &&
            edge.target.id === seeded.nodeIds[3])
      )
      .map((edge: { id: string }) => edge.id)
      .sort();
    expect(before.edges).toHaveLength(5);
    expect(primaryIds).toHaveLength(3);
    const writes: unknown[] = [],
      errors: string[] = [];
    let allowDelete = false;
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/api/graphql', async route => {
      const body = route.request().postDataJSON();
      if (/^\s*mutation\b/.test(body?.query ?? '')) {
        writes.push({
          operation: body.operationName,
          variables: body.variables,
        });
        if (
          allowDelete &&
          body.operationName === 'DeleteEdges' &&
          body.variables?.where?.id === blocker.id
        )
          await route.continue();
        else await route.abort();
      } else await route.continue();
    });
    await page.evaluate(id => {
      localStorage.setItem('currentGraphId', id);
      localStorage.setItem('graphdone:viewMode', 'graph');
      localStorage.removeItem('graphdone:relationship-priority');
    }, seeded.graphId);
    await page.goto('/');
    const graph = page.locator('.graph-container');
    const priority = page.getByRole('combobox', {
      name: 'Relationship priority',
    });
    await expect(graph.locator('.node')).toHaveCount(4);
    await expect
      .poll(() =>
        page.evaluate(() => (window as any).__layoutMetrics?.()?.cameraReady)
      )
      .toBe(true);
    await expect(priority).toHaveValue('essential');
    const graphSelector = page
      .locator(
        '[data-testid="graph-selector"]:visible, [data-testid="graph-selector-mobile"]:visible, [data-testid="graph-selector-sidebar"]:visible'
      )
      .first();
    const summary = graphSelector.locator('.text-xs');
    const dockCount = graph
      .getByRole('button', { name: /Browse all relationships/ })
      .locator('span')
      .first();
    await expect(summary).toContainText('4 nodes, 5 connections');
    const typographySamples = [
      {
        name: 'graph title',
        element: graphSelector.getByTestId('graph-selector-name'),
        minSize: 14,
        minWeight: 600,
        requireVisible: true,
      },
      {
        name: 'graph counts',
        element: summary,
        minSize: 14,
        minWeight: 500,
        requireVisible: width === 1440,
      },
      {
        name: 'connection dock',
        element: dockCount,
        minSize: 14,
        minWeight: 500,
        requireVisible: true,
      },
      {
        name: 'relationship priority',
        element: priority,
        minSize: 16,
        minWeight: 600,
        requireVisible: true,
      },
    ];
    const readTypography = () =>
      Promise.all(
        typographySamples.map(async ({ element, ...sample }) => ({
          ...sample,
          visible: await element.isVisible(),
          ...(await element.evaluate(element => {
            const style = getComputedStyle(element);
            return {
              text: element.textContent?.trim(),
              fontSize: parseFloat(style.fontSize),
              fontWeight: Number(style.fontWeight),
            };
          })),
        }))
      );
    const typographyViolations = (
      samples: Awaited<ReturnType<typeof readTypography>>
    ) =>
      samples.filter(
        sample =>
          sample.fontSize < sample.minSize ||
          sample.fontWeight < sample.minWeight ||
          (sample.requireVisible && !sample.visible)
      );
    const initialTypography = await readTypography();
    expect(typographyViolations(initialTypography)).toEqual([]);
    const negativeTarget = width === 390 ? dockCount : summary;
    const originalStyle = await negativeTarget.getAttribute('style');
    let staleTypography: Awaited<ReturnType<typeof readTypography>>;
    try {
      await negativeTarget.evaluate(element => {
        (element as HTMLElement).style.fontSize = '12px';
        (element as HTMLElement).style.fontWeight = '400';
      });
      staleTypography = await readTypography();
      expect(
        typographyViolations(staleTypography).map(sample => sample.name)
      ).toEqual([width === 390 ? 'connection dock' : 'graph counts']);
    } finally {
      await negativeTarget.evaluate((element, style) => {
        if (style === null) element.removeAttribute('style');
        else element.setAttribute('style', style);
      }, originalStyle);
    }
    expect(typographyViolations(await readTypography())).toEqual([]);
    await page.evaluate(
      ({ x, y }) => (window as any).miniMapZoom(x, y, 0.75),
      framing
    );
    await expect(graph.locator('.main-graph-group')).toHaveAttribute(
      'data-presentation-scale',
      '0.75'
    );
    const camera = () =>
      graph.locator(':scope > svg').evaluate(svg => {
        const { x, y, k } = (svg as any).__zoom;
        return { x, y, k };
      });
    const represented = () =>
      graph.locator('.edges-group .edge').evaluateAll(paths =>
        paths
          .filter(path => path.getAttribute('data-priority-visible') === 'true')
          .map(path => path.getAttribute('data-edge-id'))
          .sort()
      );
    const savedCamera = await camera();
    await expect.poll(represented).toEqual(primaryIds);
    await expect(graph).toHaveAttribute('data-priority-summarized', '2');
    const label = graph.locator(
      `.edge-label-group[data-edge-id="${blocker.id}"]`
    );
    await expect(label).toBeVisible();
    await expect(label.locator('.edge-label')).toHaveText('Blocks +2');
    expect(
      await label.locator('.edge-label').evaluate(element => {
        const matrix = (element as SVGGraphicsElement).getScreenCTM()!;
        return (
          parseFloat(getComputedStyle(element).fontSize) *
          Math.hypot(matrix.a, matrix.b)
        );
      })
    ).toBeGreaterThanOrEqual(14);
    await label.focus();
    await page.keyboard.press('Enter');
    const browser = page.getByRole('region', { name: 'Graph relationships' });
    await expect(browser).toBeVisible();
    const pairIds = before.edges
      .filter((edge: { source: { id: string }; target: { id: string } }) =>
        [edge.source.id, edge.target.id].every(id =>
          [seeded.nodeIds[0], seeded.nodeIds[1]].includes(id)
        )
      )
      .map((edge: { id: string }) => edge.id)
      .sort();
    expect(
      await browser
        .locator('[data-lod-edge-id]')
        .evaluateAll(rows =>
          rows.map(row => row.getAttribute('data-lod-edge-id')).sort()
        )
    ).toEqual(pairIds);
    await expect(browser).toContainText('All 3 originals are listed below.');
    if (width === 390) {
      await priority.selectOption('all');
      await expect(graph).toHaveAttribute('data-relationship-priority', 'all');
      await priority.selectOption('essential');
      await expect(graph).toHaveAttribute(
        'data-relationship-priority',
        'essential'
      );
      await expect(label).toBeHidden();
      await browser.getByRole('button').first().focus();
    }
    await page.keyboard.press('Escape');
    await expect(browser).toHaveCount(0);
    await expect(label).toBeVisible();
    await expect(label).toBeFocused();
    expect(await camera()).toEqual(savedCamera);
    await page.keyboard.press('Enter');
    await expect(browser).toBeVisible();
    await priority.focus();
    await page.keyboard.press('End');
    await expect(priority).toHaveValue('all');
    await expect(label).not.toHaveAttribute('tabindex');
    await browser
      .getByRole('button', { name: 'Back to graph', exact: true })
      .focus();
    await page.keyboard.press('Enter');
    await expect(browser).toHaveCount(0);
    await expect(
      graph.getByRole('button', { name: /Browse all relationships/ })
    ).toBeFocused();
    expect(await camera()).toEqual(savedCamera);
    const stages: unknown[] = [];
    for (const [level, count] of [
      ['dependencies', 4],
      ['all', 5],
      ['essential', 3],
    ] as const) {
      await priority.focus();
      await page.keyboard.press(level === 'all' ? 'End' : 'Home');
      if (level === 'dependencies') await page.keyboard.press('ArrowDown');
      await expect(priority).toHaveValue(level);
      await expect(graph).toHaveAttribute('data-relationship-priority', level);
      await expect.poll(async () => (await represented()).length).toBe(count);
      expect(await camera()).toEqual(savedCamera);
      stages.push({ level, ids: await represented(), camera: await camera() });
    }
    await graph
      .getByRole('button', { name: /Browse all relationships/ })
      .click();
    await browser
      .getByRole('button', { name: 'Inspect Gateway', exact: true })
      .first()
      .click();
    const inspector = page.getByTestId('node-inspector');
    await expect(inspector).toContainText('Gateway');
    const inspectionCamera = await camera();
    await priority.click();
    await page.keyboard.press('End');
    await page.keyboard.press('Enter');
    await expect(priority).toHaveValue('all');
    await expect(inspector).toContainText('Gateway');
    expect(await camera()).toEqual(inspectionCamera);
    await priority.click();
    await page.keyboard.press('Home');
    await page.keyboard.press('Enter');
    await expect(priority).toHaveValue('essential');
    await expect(inspector).toContainText('Gateway');
    await inspector.getByRole('button', { name: 'Close', exact: true }).click();
    expect(await snapshot()).toEqual(before);
    expect(writes).toEqual([]);
    await page.reload();
    await expect(priority).toHaveValue('essential');
    await expect.poll(represented).toEqual(primaryIds);
    await expect
      .poll(() =>
        page.evaluate(() => (window as any).__layoutMetrics?.()?.cameraReady)
      )
      .toBe(true);
    await page.evaluate(
      ({ x, y }) => (window as any).miniMapZoom(x, y, 0.75),
      framing
    );
    await expect(graph.locator('.main-graph-group')).toHaveAttribute(
      'data-presentation-scale',
      '0.75'
    );
    await expect(label).toBeVisible();
    await graph
      .getByRole('button', { name: /Browse all relationships/ })
      .click();
    await browser
      .getByRole('button', {
        name: `Edit relationship ${blocker.id}`,
        exact: true,
      })
      .click();
    const editor = page.getByRole('dialog', {
      name: 'Edit relationship',
      exact: true,
    });
    await expect(editor).toBeVisible();
    allowDelete = true;
    await editor
      .getByRole('button', { name: 'Delete Relationship', exact: true })
      .click();
    await expect(editor).toHaveCount(0);
    await expect(graph.locator('.edges-group .edge')).toHaveCount(4);
    await expect.poll(async () => (await represented()).length).toBe(3);
    const dependency = before.edges.find(
      (edge: {
        type: string;
        source: { id: string };
        target: { id: string };
      }) =>
        edge.type === 'DEPENDS_ON' &&
        edge.source.id === seeded.nodeIds[0] &&
        edge.target.id === seeded.nodeIds[1]
    );
    expect(await represented()).toContain(dependency.id);
    expect(await represented()).not.toContain(blocker.id);
    await expect(graph).toHaveAttribute('data-priority-summarized', '1');
    const after = await snapshot();
    expect(after.workItems).toEqual(before.workItems);
    expect(after.edges).toEqual(
      before.edges.filter((edge: { id: string }) => edge.id !== blocker.id)
    );
    expect(writes).toEqual([
      { operation: 'DeleteEdges', variables: { where: { id: blocker.id } } },
    ]);
    expect(errors).toEqual([]);
    await expect
      .poll(() =>
        page.evaluate(() => (window as any).__layoutMetrics?.()?.cameraReady)
      )
      .toBe(true);
    await page.evaluate(
      ({ x, y }) => (window as any).miniMapZoom(x, y, 0.75),
      framing
    );
    await expect(graph.locator('.main-graph-group')).toHaveAttribute(
      'data-presentation-scale',
      '0.75'
    );
    const fallbackLabel = graph.locator(
      `.edge-label-group[data-edge-id="${dependency.id}"]`
    );
    await expect
      .poll(() =>
        graph
          .locator(`.edges-group .edge[data-edge-id="${dependency.id}"]`)
          .evaluate(element => {
            for (
              let current: Element | null = element;
              current;
              current = current.parentElement
            ) {
              const style = getComputedStyle(current);
              if (
                style.display === 'none' ||
                style.visibility !== 'visible' ||
                Number(style.opacity) === 0
              )
                return false;
            }
            const path = element as SVGPathElement;
            const style = getComputedStyle(path);
            const box = path.getBoundingClientRect();
            const viewport = path
              .closest('.graph-container')!
              .getBoundingClientRect();
            return (
              style.stroke !== 'none' &&
              Number(style.strokeOpacity) > 0 &&
              parseFloat(style.strokeWidth) >= 3 &&
              path.getTotalLength() > 0 &&
              box.right >= viewport.left &&
              box.left <= viewport.right &&
              box.bottom >= viewport.top &&
              box.top <= viewport.bottom
            );
          })
      )
      .toBe(true);
    await expect(fallbackLabel).toBeVisible();
    await expect(fallbackLabel.locator('.edge-label')).toHaveText(
      'Depends On +1'
    );
    const geometry = await inspectItemSymbols(page, info, 'priority-fallback');
    expect(geometry.labels.some(item => item.id === dependency.id)).toBe(true);
    await expect(summary).toContainText('4 nodes, 4 connections');
    await expect(dockCount).toHaveText('4 connections · Browse');
    const finalTypography = await readTypography();
    expect(typographyViolations(finalTypography)).toEqual([]);
    const typographyPath = info.outputPath('priority-typography.json');
    await writeFile(
      typographyPath,
      JSON.stringify(
        {
          width,
          initial: initialTypography,
          negative: staleTypography!,
          final: finalTypography,
        },
        null,
        2
      )
    );
    await info.attach('priority-typography.json', {
      path: typographyPath,
      contentType: 'application/json',
    });
    expect(writes).toEqual([
      { operation: 'DeleteEdges', variables: { where: { id: blocker.id } } },
    ]);
    expect(errors).toEqual([]);
    const accountingPath = info.outputPath('priority-accounting.json');
    await writeFile(
      accountingPath,
      JSON.stringify({ stages, before, after, writes, errors })
    );
    await info.attach('priority-accounting.json', {
      path: accountingPath,
      contentType: 'application/json',
    });
  });
}
