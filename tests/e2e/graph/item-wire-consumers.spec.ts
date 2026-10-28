import { test as base, expect } from '@playwright/test';
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
test.use({ viewport: { width: 1440, height: 900 }, actionTimeout: 10000 });

test('item wire paths, hitboxes, arrows and dragged labels retain original relationships @item-wires', async ({
  page,
  ownedGraphIds,
}, info) => {
  test.setTimeout(90000);
  await login(page, TEST_USERS.ADMIN);
  const seeded = await ownedGraphIds.seed({
    size: 2,
    spacing: 600,
    edgeFactor: 0,
    namePrefix: 'Item wire consumers',
    additionalEdges: [{ sourceIndex: 1, targetIndex: 0, type: 'BLOCKS' }],
  });
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
  expect(before.edges).toHaveLength(2);
  const writes: string[] = [],
    errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
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
  const loaded = page.waitForResponse(response => {
    if (!response.url().endsWith('/api/graphql')) return false;
    const body = response.request().postDataJSON();
    return (
      body?.operationName === 'GetEdges' &&
      body.variables?.where?.OR?.some(
        (part: { source?: { graph?: { id?: string } } }) =>
          part.source?.graph?.id === seeded.graphId
      )
    );
  });
  const [, response] = await Promise.all([page.goto('/'), loaded]);
  expect(response.ok()).toBe(true);
  expect((await response.json()).errors).toBeUndefined();
  await expect(page.locator('.graph-container .node')).toHaveCount(2);
  await page
    .getByRole('button', { name: 'Zoom to fit — frame all nodes', exact: true })
    .click();
  const labels = page.locator('.graph-container .edge-label-group:visible');
  await expect(labels).toHaveCount(2);
  await expect
    .poll(() =>
      page.evaluate(() => (window as any).__layoutMetrics?.()?.atRest)
    )
    .toBe(true);

  const capture = async (name: string) => {
    const geometry = await page.locator('.graph-container').evaluate(host => {
      const rows = Array.from(
        host.querySelectorAll<SVGPathElement>('.edges-group .edge')
      ).map(path => {
        const id = path.getAttribute('data-edge-id')!;
        const hitbox = Array.from(
          host.querySelectorAll<SVGPathElement>('.edge-clickable')
        ).find(el => el.getAttribute('data-edge-id') === id)!;
        const arrow = Array.from(
          host.querySelectorAll<SVGPathElement>('.arrows-group .arrow')
        ).find(el => el.getAttribute('data-edge-id') === id)!;
        const length = path.getTotalLength();
        const end = path.getPointAtLength(length),
          near = path.getPointAtLength(Math.max(0, length - 0.1));
        const matrix = arrow.transform.baseVal.consolidate()?.matrix;
        const style = getComputedStyle(path),
          hitStyle = getComputedStyle(hitbox);
        const arrowStyle = getComputedStyle(arrow);
        return {
          id,
          tag: path.tagName,
          path: path.getAttribute('d'),
          hitPath: hitbox.getAttribute('d'),
          length,
          painted:
            style.display !== 'none' &&
            style.visibility !== 'hidden' &&
            Number(style.opacity) > 0 &&
            Number(style.strokeOpacity) > 0 &&
            parseFloat(style.strokeWidth) > 0,
          hit:
            hitStyle.display !== 'none' && hitStyle.pointerEvents === 'stroke',
          arrowVisible:
            arrowStyle.display !== 'none' && Number(arrowStyle.opacity) > 0,
          end: { x: end.x, y: end.y },
          tangent: Math.atan2(end.y - near.y, end.x - near.x),
          arrow: matrix
            ? {
                x: matrix.e,
                y: matrix.f,
                angle: Math.atan2(matrix.b, matrix.a),
              }
            : null,
        };
      });
      return rows.sort((a, b) => a.id.localeCompare(b.id));
    });
    expect(geometry.map(row => row.id)).toEqual(
      before.edges.map((edge: { id: string }) => edge.id)
    );
    for (const row of geometry) {
      expect(row.tag).toBe('path');
      expect(row.path).toBeTruthy();
      expect(row.hitPath).toBe(row.path);
      expect(row.length).toBeGreaterThan(1);
      expect(row.painted).toBe(true);
      expect(row.hit).toBe(true);
      expect(row.arrowVisible).toBe(true);
      expect(row.arrow).toBeTruthy();
      expect(row.arrow!.x).toBeCloseTo(row.end.x, 2);
      expect(row.arrow!.y).toBeCloseTo(row.end.y, 2);
      expect(Math.cos(row.arrow!.angle - row.tangent)).toBeCloseTo(1, 4);
    }
    const json = info.outputPath(`${name}.json`),
      png = info.outputPath(`${name}.png`);
    await writeFile(json, JSON.stringify(geometry, null, 2));
    await page.screenshot({ path: png });
    await info.attach(`${name}-geometry`, {
      path: json,
      contentType: 'application/json',
    });
    await info.attach(name, { path: png, contentType: 'image/png' });
  };
  await capture('initial-item-wires');
  const label = labels.first();
  const edgeId = await label.getAttribute('data-edge-id');
  const initialT = await label.evaluate(el => (el as any).__data__.labelT);
  const box = await label.boundingBox();
  expect(box).toBeTruthy();
  await page.mouse.move(
    box!.x + box!.width / 2 + 4,
    box!.y + box!.height / 2 + 3
  );
  await page.mouse.down();
  await page.mouse.move(
    box!.x + box!.width / 2 + 74,
    box!.y + box!.height / 2 + 3,
    { steps: 8 }
  );
  await page.mouse.up();
  await expect
    .poll(() =>
      label.evaluate(
        (el, prior) => Math.abs((el as any).__data__.labelT - prior),
        initialT
      )
    )
    .toBeGreaterThan(0.02);
  await expect(label).toBeVisible();
  await expect(
    page.getByRole('dialog', { name: 'Edit relationship', exact: true })
  ).toHaveCount(0);
  await capture('dragged-item-label');
  const click = await page
    .locator('.graph-container .edge-clickable')
    .evaluateAll((elements, id) => {
      const path = elements.find(
        el => el.getAttribute('data-edge-id') === id
      )! as SVGPathElement;
      const point = path.getPointAtLength(path.getTotalLength() * 0.35);
      const screen = new DOMPoint(point.x, point.y).matrixTransform(
        path.getScreenCTM()!
      );
      const hit = document.elementFromPoint(screen.x, screen.y);
      return {
        x: screen.x,
        y: screen.y,
        id: hit?.getAttribute('data-edge-id'),
        clickable: hit?.classList.contains('edge-clickable'),
      };
    }, edgeId);
  expect(click.id).toBe(edgeId);
  expect(click.clickable).toBe(true);
  await page.mouse.click(click.x, click.y);
  const editor = page.getByRole('dialog', {
    name: 'Edit relationship',
    exact: true,
  });
  await expect(
    editor.getByRole('button', { name: 'Flip Direction', exact: true })
  ).toBeVisible();
  await editor
    .getByRole('button', { name: 'Close relationship editor', exact: true })
    .click();
  await expect(editor).toHaveCount(0);
  await label.click();
  await expect(editor).toBeVisible();
  await editor
    .getByRole('button', { name: 'Close relationship editor', exact: true })
    .click();
  expect(await snapshot()).toEqual(before);
  expect(writes).toEqual([]);
  expect(errors).toEqual([]);
});

test('initially hidden item labels retain full conservative sizing @item-wires', async ({
  page,
  ownedGraphIds,
}, info) => {
  test.setTimeout(90000);
  await login(page, TEST_USERS.ADMIN);
  const seeded = await ownedGraphIds.seed({
    size: 2,
    spacing: 240,
    edgeFactor: 0,
    namePrefix: 'Hidden item labels',
  });
  const read = async () => {
    const data = await gql(
      page,
      'query($id:ID!){workItems(where:{graph:{id:$id}}){id positionX positionY} edges(where:{source:{graph:{id:$id}}}){id}}',
      { id: seeded.graphId }
    );
    data.workItems.sort((a: { id: string }, b: { id: string }) =>
      a.id.localeCompare(b.id)
    );
    return data;
  };
  const before = await read(),
    writes: string[] = [];
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
  await expect(page.locator('.graph-container .node')).toHaveCount(2);
  const label = page.locator('.graph-container .edge-label-group');
  await expect(label).toHaveCount(1);
  await expect(label).toBeHidden();
  await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 250)));
  const sizing = await label.evaluate(el => {
    const text = el.querySelector('.edge-label')!.textContent!;
    return {
      text,
      width: (el as any).__data__._labelDims.width,
      backgroundWidth: Number(
        el.querySelector('.edge-label-bg')!.getAttribute('width')
      ),
      display: getComputedStyle(el).display,
    };
  });
  expect(sizing.width).toBeGreaterThanOrEqual(sizing.text.length * 7 + 34);
  expect(sizing.backgroundWidth).toBe(sizing.width);
  expect(sizing.display).toBe('none');
  const json = info.outputPath('hidden-label-sizing.json'),
    png = info.outputPath('hidden-label-sizing.png');
  await writeFile(json, JSON.stringify(sizing, null, 2));
  await page.screenshot({ path: png });
  await info.attach('hidden-label-sizing', {
    path: json,
    contentType: 'application/json',
  });
  await info.attach('hidden-label-sizing', {
    path: png,
    contentType: 'image/png',
  });
  expect(await read()).toEqual(before);
  expect(writes).toEqual([]);
});
