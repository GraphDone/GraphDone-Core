import { test as base, expect, type Locator } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { login, TEST_USERS } from '../../lib/auth';
import { gql } from '../../lib/graphRequest';
import {
  ownedGraphIdsFixture,
  type OwnedGraphs,
} from '../../lib/ownedGraphIdsFixture';

const test = base.extend<{ ownedGraphIds: OwnedGraphs }>({
  ownedGraphIds: [ownedGraphIdsFixture, { timeout: 60000 }],
});
test.use({ actionTimeout: 10000 });
const parentTitle =
  'Readable inspector — AI subsystem coordination and reliability '.repeat(6);

const inspectText = async (root: Locator) => {
  const samples = await root.evaluate(host => {
    const result: Array<{
      tag: string;
      size: number;
      weight: number;
      text: string;
    }> = [];
    const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT);
    let node: Node | null;
    while ((node = walker.nextNode())) {
      if (!node.textContent?.trim()) continue;
      const element = node.parentElement!;
      if (element.closest('[aria-hidden="true"],.sr-only')) continue;
      const rect = element.getBoundingClientRect(),
        style = getComputedStyle(element);
      if (!rect.width || !rect.height || style.visibility !== 'visible')
        continue;
      result.push({
        tag: element.tagName,
        size: parseFloat(style.fontSize),
        weight: Number(style.fontWeight),
        text: node.textContent.trim().slice(0, 60),
      });
    }
    return result;
  });
  expect(samples.length).toBeGreaterThan(5);
  expect(
    samples.filter(sample => sample.size < 14 || sample.weight < 500),
    'Inspector text needs readable size and weight'
  ).toEqual([]);
  return samples;
};

for (const width of [1440, 390]) {
  test(`inspector code and nested preview remain readable at ${width} @inspector-readability`, async ({
    page,
    ownedGraphIds,
  }, info) => {
    test.setTimeout(180000);
    await page.setViewportSize({ width, height: 900 });
    await login(page, TEST_USERS.ADMIN);
    const child = await ownedGraphIds.seed({
      size: width === 1440 ? 301 : 72,
      spacing: 600,
      edgeFactor: 2,
      batchSize: 20,
      namePrefix: 'Readable child preview',
      metadataForIndex: index => ({
        lod: {
          groupPath: [
            ['Payments', 'Inventory', 'Operations'][index % 3],
            'Components',
          ],
        },
      }),
      titleForIndex: index =>
        index % 9 === 1
          ? `AAA 配送サービス ${'UnbrokenComponentName'.repeat(7)}`
          : `Service component ${index}`,
    });
    await gql(
      page,
      'mutation($id:ID!){updateWorkItems(where:{graph:{id:$id},positionX:0,positionY:0},update:{positionX:1,positionY:1}){workItems{id}}}',
      { id: child.graphId }
    );
    const parent = await ownedGraphIds.seed({
      size: 1,
      spacing: 600,
      edgeFactor: 0,
      namePrefix: 'Readable inspector',
      titleForIndex: () => parentTitle,
    });
    const markdown = [
      '# Service contract',
      'Readable inline `request_id` and **strong text**.',
      '',
      '```typescript',
      '// Preserve readable comments',
      `const endpoint = "${'long_endpoint_'.repeat(25)}";`,
      '```',
      '',
      '| Service | Contract |',
      '| --- | --- |',
      `| Gateway | ${'LongContract'.repeat(20)} |`,
      '',
      '- First item',
      '- Second item',
      '',
      '[Reference](https://example.com/reference)',
    ].join('\n');
    await gql(
      page,
      'mutation($id:ID!,$description:String!,$child:String!,$target:ID!){updateWorkItems(where:{id:$id},update:{description:$description,subgraphId:$child,subgraph:{connect:{where:{node:{id:$target}}}}}){workItems{id}}}',
      {
        id: parent.nodeIds[0],
        description: markdown,
        child: child.graphId,
        target: child.graphId,
      }
    );
    const snapshot = async () => {
      const result = await gql(
        page,
        'query($ids:[ID!]!){workItems(where:{graph:{id_IN:$ids}}){id title description subgraphId subgraph{id} positionX positionY}edges(where:{source:{graph:{id_IN:$ids}}}){id type source{id}target{id}}}',
        { ids: [parent.graphId, child.graphId] }
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
    const writes: unknown[] = [],
      errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/api/graphql', async route => {
      const body = route.request().postDataJSON();
      if (/^\s*mutation\b/.test(body?.query ?? '')) {
        writes.push(body.operationName ?? 'mutation');
        await route.abort('blockedbyclient');
      } else await route.continue();
    });
    try {
      await page.evaluate(id => {
        localStorage.setItem('currentGraphId', id);
        localStorage.setItem('graphdone:viewMode', 'graph');
      }, parent.graphId);
      await page.goto('/');
      await expect
        .poll(() =>
          page.evaluate(() => (window as any).__layoutMetrics?.()?.cameraReady)
        )
        .toBe(true);
      await page.locator('.graph-container g.node').click();
      const inspector = page.getByTestId('node-inspector');
      await expect(
        inspector.getByTestId('node-content-rendered')
      ).toContainText('request_id');
      const inspectTitle = async (root: Locator) => {
        const title = root.locator('[title]').filter({ hasText: parentTitle });
        await expect(title).toHaveText(parentTitle);
        const bounds = await title.evaluate(element => ({
          height: element.clientHeight,
          scroll: element.scrollHeight,
          overflow: getComputedStyle(element).overflowY,
        }));
        expect(bounds.height).toBeLessThanOrEqual(96);
        expect(bounds.scroll).toBeGreaterThan(bounds.height);
        expect(bounds.overflow).toBe('auto');
        await title.focus();
        await title.press('End');
        await expect
          .poll(() =>
            title.evaluate(
              element =>
                element.scrollTop + element.clientHeight - element.scrollHeight
            )
          )
          .toBeGreaterThanOrEqual(-1);
        await title.press('Home');
        await expect
          .poll(() => title.evaluate(element => element.scrollTop))
          .toBe(0);
        await expect(
          root.getByRole('button', { name: 'Contents', exact: true })
        ).toBeInViewport();
        await expect(
          root.getByTestId('node-content-rendered')
        ).toBeInViewport();
        return bounds;
      };
      const regularTitle = await inspectTitle(inspector);
      await inspector.locator('pre').first().scrollIntoViewIfNeeded();
      const regular = await inspectText(inspector);
      const tiny = inspector.locator('pre code').first();
      await expect(tiny).toBeVisible();
      const originalStyle = await tiny.getAttribute('style');
      await tiny.evaluate(element => {
        element.style.fontSize = '8px';
        element.style.fontWeight = '400';
      });
      try {
        await expect(inspectText(inspector)).rejects.toThrow(
          'Inspector text needs readable size and weight'
        );
      } finally {
        await tiny.evaluate(
          (element, style) =>
            style === null
              ? element.removeAttribute('style')
              : element.setAttribute('style', style),
          originalStyle
        );
      }
      const code = inspector.locator('pre').first();
      await expect(code).toHaveCount(1);
      const overflow = await code.evaluate(element => ({
        width: element.clientWidth,
        scroll: element.scrollWidth,
        overflow: getComputedStyle(element).overflowX,
      }));
      expect(overflow.scroll).toBeGreaterThan(overflow.width);
      expect(overflow.overflow).toBe('auto');
      const bounds = await inspector.boundingBox();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width + 1);
      if (width === 1440) {
        const minimap = await page.getByTestId('mini-map-panel').boundingBox();
        expect(minimap).not.toBeNull();
        expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(minimap!.y - 8);
      }
      expect(
        await inspector
          .locator('th')
          .first()
          .evaluate(element => element.getBoundingClientRect().width)
      ).toBeGreaterThanOrEqual(96);
      await expect
        .poll(() =>
          inspector.evaluate(
            element => element.scrollWidth - element.clientWidth
          )
        )
        .toBeLessThanOrEqual(1);
      await page.screenshot({ path: info.outputPath('inspector-code.png') });
      await info.attach('inspector-code', {
        path: info.outputPath('inspector-code.png'),
        contentType: 'image/png',
      });
      await page.setViewportSize({ width, height: 560 });
      await code.evaluate(element =>
        element.scrollIntoView({ block: 'center', behavior: 'instant' })
      );
      await expect(code).toBeInViewport({ ratio: 0.9 });
      await page.screenshot({
        path: info.outputPath('inspector-short-window.png'),
      });
      await info.attach('inspector-short-window', {
        path: info.outputPath('inspector-short-window.png'),
        contentType: 'image/png',
      });
      await page.setViewportSize({ width, height: 900 });
      await inspector
        .getByRole('button', { name: 'Close', exact: true })
        .click();
      const scale = await page
        .locator('.graph-container > svg')
        .evaluate(element => (element as any).__zoom.k);
      if (scale < 1) {
        const item = await page
          .locator('.graph-container g.node .node-bg')
          .boundingBox();
        await page.mouse.move(
          item!.x + item!.width / 2,
          item!.y + item!.height / 2
        );
        await page.mouse.wheel(0, -Math.log2(1.05 / scale) / 0.002);
        await expect(page.locator('.graph-container g.node')).toHaveAttribute(
          'data-detail',
          'full'
        );
      }
      await page
        .getByRole('button', { name: `Expand ${parentTitle}`, exact: true })
        .click();
      const compact = page.getByTestId('node-expand-inspector');
      await expect(compact.getByTestId('node-content-rendered')).toContainText(
        'request_id'
      );
      const compactTitle = await inspectTitle(compact);
      await compact.locator('pre').first().scrollIntoViewIfNeeded();
      const compactText = await inspectText(compact);
      await compact
        .getByRole('button', { name: 'Diagram', exact: true })
        .click();
      const preview = compact.getByTestId('subgraph-preview');
      await expect(preview.locator('[data-preview-group]')).toHaveCount(3);
      await expect(preview.locator('[data-preview-counts]')).not.toContainText(
        'loading'
      );
      await expect(preview).toContainText('AAA 配送サービス');
      expect(
        await preview.locator('[data-preview-item]').count()
      ).toBeLessThanOrEqual(8);
      expect(
        await preview.locator('[data-preview-connection]').count()
      ).toBeLessThanOrEqual(3);
      if (width === 1440) {
        await expect(preview).toContainText('300+ items');
        await expect(preview).toContainText('Partial preview.');
      } else await expect(preview).toContainText('72 items');
      const previewText = await inspectText(preview);
      await preview
        .getByRole('button', { name: 'Open graph', exact: true })
        .scrollIntoViewIfNeeded();
      await page.screenshot({ path: info.outputPath('inspector-diagram.png') });
      await info.attach('inspector-diagram', {
        path: info.outputPath('inspector-diagram.png'),
        contentType: 'image/png',
      });
      expect(await snapshot()).toEqual(before);
      expect(writes).toEqual([]);
      await preview
        .getByRole('button', { name: 'Open graph', exact: true })
        .click();
      await expect
        .poll(() => page.evaluate(() => localStorage.getItem('currentGraphId')))
        .toBe(child.graphId);
      await expect
        .poll(() => page.locator('.graph-container g.node').count())
        .toBe(child.nodeIds.length);
      expect(await snapshot()).toEqual(before);
      expect(writes).toEqual([]);
      expect(errors).toEqual([]);
      const record = {
        width,
        childItems: child.nodeIds.length,
        childEdges: child.edgeCount,
        regularTitle,
        compactTitle,
        regular,
        compact: compactText,
        preview: previewText,
        overflow,
        writes,
        errors,
      };
      await writeFile(
        info.outputPath('inspector-readability.json'),
        JSON.stringify(record, null, 2)
      );
      await info.attach('inspector-readability', {
        path: info.outputPath('inspector-readability.json'),
        contentType: 'application/json',
      });
    } finally {
      await page.unroute('**/api/graphql');
    }
  });
}
