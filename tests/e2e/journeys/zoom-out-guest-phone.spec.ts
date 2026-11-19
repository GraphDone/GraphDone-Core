import { test, expect, Page, TestInfo } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { backend, openGraphView, SetupError } from '../../lib/journeys/workspace';
import { readableLabels } from '../../lib/journeys/readableLabels';

async function evidence(info: TestInfo, name: string, body: string | Buffer, contentType: string) {
  const path = info.outputPath(name);
  await writeFile(path, body);
  await info.attach(name, { path, contentType });
}

const selector = (page: Page) => page.locator('[data-testid="graph-selector-mobile"]:visible').first();

async function enterWelcome(page: Page) {
  if (backend !== 'hosted-guest') throw new SetupError('phone pinch acceptance requires the hosted offline guest build');
  await page.goto('/');
  await page.getByRole('button', { name: /Continue as Guest/i }).first().click();
  await page.getByRole('dialog').getByRole('button', { name: /Continue as Guest/i }).click();
  await openGraphView(page);
  await expect(selector(page)).toContainText('Welcome', { timeout: 20_000 })
    .catch(() => { throw new SetupError('the Welcome graph did not open'); });
  await expect.poll(async () => (await readableLabels(page)).join(' '), { timeout: 20_000 }).toContain('Welcome to');
}

async function camera(page: Page) {
  return page.evaluate(() => {
    const transform = document.querySelector('svg g.main-graph-group')?.getAttribute('transform') ?? '';
    return Number(/scale\(([^)]+)\)/.exec(transform)?.[1] ?? 1);
  });
}

type TouchPoint = { x: number; y: number };

async function touchGesture(page: Page, frames: [TouchPoint, TouchPoint][]) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  const points = ([a, b]: [TouchPoint, TouchPoint]) => [a, b].map((point, index) =>
    ({ x: Math.round(point.x), y: Math.round(point.y), id: index + 1, radiusX: 2, radiusY: 2, force: 1 }));
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points(frames[0]) });
  for (const frame of frames.slice(1)) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: points(frame) });
    await page.waitForTimeout(30);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
  await page.waitForTimeout(400);
}

async function pinch(page: Page, center: TouchPoint, from: number, to: number) {
  await touchGesture(page, Array.from({ length: 9 }, (_, step) => {
    const distance = from + (to - from) * step / 8;
    return [{ x: center.x - distance, y: center.y }, { x: center.x + distance, y: center.y }];
  }));
}

async function cancelledThreeFingerPinch(page: Page, center: TouchPoint) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  const point = (x: number, y: number, id: number) => ({ x: Math.round(x), y: Math.round(y), id, radiusX: 2, radiusY: 2, force: 1 });
  const two = [point(center.x - 20, center.y, 1), point(center.x + 20, center.y, 2)];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: two });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [...two, point(center.x, center.y + 30, 3)] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [
    point(center.x - 65, center.y, 1), point(center.x + 65, center.y, 2), point(center.x, center.y + 30, 3),
  ] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
  await page.waitForTimeout(400);
}

async function localSourcePositions(page: Page) {
  return page.evaluate(() => new Promise<Record<string, { x?: number; y?: number }>>((resolve, reject) => {
    const open = indexedDB.open('graphdone-offline', 1);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const request = open.result.transaction('accounts').objectStore('accounts').getAll();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(Object.fromEntries(request.result.flatMap((account: any) =>
        Object.values(account.projects || {}).flatMap((project: any) =>
          (project.local?.nodes || []).map((node: any) => [node.id, { x: node.position_x, y: node.position_y }])))));
    };
  }));
}

test('JOURNEY zoom-out: pinching into a sibling opens that graph on a phone', async ({ page }, info) => {
  test.setTimeout(240_000);
  await enterWelcome(page);
  const originalGraphId = await page.evaluate(() => localStorage.getItem('currentGraphId'));
  const welcomeStaysSelected = async () => {
    await expect(selector(page)).toContainText('Welcome');
    expect(await page.evaluate(() => localStorage.getItem('currentGraphId'))).toBe(originalGraphId);
  };
  const resetOverview = async () => {
    await page.evaluate(id => localStorage.removeItem(`graphdone:camera:${id}`), originalGraphId);
    await page.reload();
    await openGraphView(page);
    await expect(selector(page)).toContainText('Welcome');
    const area = (await page.locator('.graph-container').boundingBox())!;
    const canvasCenter = { x: area.x + area.width / 2, y: area.y + area.height / 2 };
    await pinch(page, canvasCenter, 120, 40);
    if (await page.locator('.graph-container').getAttribute('data-zoom-level') !== '2') {
      const scale = await camera(page);
      await pinch(page, canvasCenter, 50, 50 * 0.16 / scale);
    }
    await expect(page.locator('.graph-container')).toHaveAttribute('data-zoom-level', '2');
    return area;
  };
  await resetOverview();
  const fixTile = () => page.getByRole('button', { name: /^Fix bugs graph, \d+ items?$/ });
  const tileCenter = async (tile: ReturnType<typeof fixTile>) => {
    const box = (await tile.boundingBox())!;
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  };

  // Contacts split across sibling tiles have a background centroid and must
  // remain a canvas pinch, never whichever per-tile listener happens to fire.
  const fixCenter = await tileCenter(fixTile());
  const ideasCenter = await tileCenter(page.getByRole('button', { name: /^Ideas graph, \d+ items?$/ }));
  const splitCenter = { x: (fixCenter.x + ideasCenter.x) / 2, y: (fixCenter.y + ideasCenter.y) / 2 };
  expect(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest('[data-zoom-tile]'), splitCenter)).toBeNull();
  await touchGesture(page, [[fixCenter, ideasCenter], [
    { x: splitCenter.x + (fixCenter.x - splitCenter.x) * 1.25, y: splitCenter.y + (fixCenter.y - splitCenter.y) * 1.25 },
    { x: splitCenter.x + (ideasCenter.x - splitCenter.x) * 1.25, y: splitCenter.y + (ideasCenter.y - splitCenter.y) * 1.25 },
  ]]);
  await welcomeStaysSelected();

  await resetOverview();
  const background = await page.evaluate(() => {
    const box = document.querySelector('.graph-container')!.getBoundingClientRect();
    for (const fy of [0.2, 0.5, 0.8]) for (const fx of [0.2, 0.5, 0.8]) {
      const x = box.x + box.width * fx, y = box.y + box.height * fy;
      if (!document.elementFromPoint(x, y)?.closest('[data-zoom-tile]')) return { x, y };
    }
    throw new Error('no overview background point');
  });
  await pinch(page, background, 20, 65);
  await welcomeStaysSelected();

  await resetOverview();
  let center = await tileCenter(fixTile());
  const around = (distances: number[]) => distances.map(distance => [
    { x: center.x - distance, y: center.y }, { x: center.x + distance, y: center.y },
  ] as [TouchPoint, TouchPoint]);
  await touchGesture(page, around([20, 23, 19, 22])); // sensor jitter
  await welcomeStaysSelected();

  await resetOverview();
  center = await tileCenter(fixTile());
  await touchGesture(page, around([40, 32, 24, 16])); // inward pinch
  await welcomeStaysSelected();

  await resetOverview();
  center = await tileCenter(fixTile());
  await touchGesture(page, around([20, 24, 16, 65])); // outward, then reversed: cancelled
  await welcomeStaysSelected();

  await resetOverview();
  center = await tileCenter(fixTile());
  await cancelledThreeFingerPinch(page, center);
  await welcomeStaysSelected();

  await resetOverview();
  const tile = fixTile();
  center = await tileCenter(tile);
  expect(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest('[data-zoom-tile]')?.getAttribute('data-zoom-tile'), center))
    .toBe(await tile.getAttribute('data-zoom-tile'));
  const targetId = await tile.getAttribute('data-zoom-tile');
  const cameraBefore = await camera(page);
  const sourcePositions = await localSourcePositions(page);

  // The reverse gesture dives into the tile under its fixed centroid, just as
  // a wheel zoom or tap does. It is navigation only: source coordinates stay put.
  await pinch(page, center, 20, 65);
  await expect(selector(page)).toContainText('Fix bugs', { timeout: 15_000 });
  expect(await page.evaluate(() => localStorage.getItem('currentGraphId'))).toBe(targetId);
  const afterPositions = await localSourcePositions(page);
  for (const [id, position] of Object.entries(sourcePositions)) expect(afterPositions[id], `source position changed for ${id}`).toEqual(position);
  await evidence(info, 'pinch-sibling-receipt.json', JSON.stringify({
    viewport: await page.evaluate(() => ({ width: innerWidth, height: innerHeight, touchPoints: navigator.maxTouchPoints })),
    inputCenter: center,
    hitGraphId: targetId,
    originalGraphId,
    selectedGraphId: await page.evaluate(() => localStorage.getItem('currentGraphId')),
    camera: { before: cameraBefore, after: await camera(page) },
    preservedSourcePositions: Object.keys(sourcePositions).length,
  }, null, 2), 'application/json');
  await evidence(info, 'pinch-sibling-opened.png', await page.screenshot(), 'image/png');
});
