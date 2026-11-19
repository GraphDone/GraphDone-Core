import { test, expect, Page, TestInfo } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { backend, openGraphView, SetupError } from '../../lib/journeys/workspace';
import { cancelledThreeFingerPinch, touchGesture, type TouchPoint } from '../../lib/journeys/touchContacts';
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

async function pinch(page: Page, center: TouchPoint, from: number, to: number) {
  await touchGesture(page, Array.from({ length: 9 }, (_, step) => {
    const distance = from + (to - from) * step / 8;
    return [{ x: center.x - distance, y: center.y }, { x: center.x + distance, y: center.y }];
  }));
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
  const resetOverview = async (gesture: string) => {
    info.annotations.push({ type: 'phone-pinch', description: gesture });
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
  await resetOverview('cross-tile contacts');
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

  await resetOverview('background');
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

  await resetOverview('jitter');
  let center = await tileCenter(fixTile());
  const around = (distances: number[]) => distances.map(distance => [
    { x: center.x - distance, y: center.y }, { x: center.x + distance, y: center.y },
  ] as [TouchPoint, TouchPoint]);
  await touchGesture(page, around([20, 23, 19, 22])); // sensor jitter
  await welcomeStaysSelected();

  await resetOverview('inward');
  center = await tileCenter(fixTile());
  await touchGesture(page, around([40, 32, 24, 16])); // inward pinch
  await welcomeStaysSelected();

  await resetOverview('reversal');
  center = await tileCenter(fixTile());
  await touchGesture(page, around([20, 24, 16, 65])); // outward, then reversed: cancelled
  await welcomeStaysSelected();

  await resetOverview('third contact');
  center = await tileCenter(fixTile());
  await cancelledThreeFingerPinch(page, center);
  await welcomeStaysSelected();

  const area = await resetOverview('slow expansion into sibling');
  const tile = fixTile();
  const tileBox = (await tile.boundingBox())!;
  const shortSide = Math.min(area.width, area.height);
  const tileSize = Math.max(tileBox.width, tileBox.height);
  // Start just below the point at which the camera hides sibling tiles. The
  // first small movement must cross that boundary before qualifying as a dive.
  if (tileSize < 0.43 * shortSide) {
    const canvasCenter = { x: area.x + area.width / 2, y: area.y + area.height / 2 };
    await pinch(page, canvasCenter, 40, 40 * 0.47 * shortSide / tileSize);
  }
  await expect(page.locator('.graph-container')).toHaveAttribute('data-zoom-level', '2');
  const targetId = await tile.getAttribute('data-zoom-tile');
  const cameraBefore = await camera(page);
  const sourcePositions = await localSourcePositions(page);
  const readyBox = (await tile.boundingBox())!;
  expect(Math.max(readyBox.width, readyBox.height) * 51 / 40).toBeGreaterThan(0.5 * shortSide);
  center = { x: Math.round(readyBox.x + readyBox.width / 2), y: Math.round(readyBox.y + readyBox.height / 2) };
  expect(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest('[data-zoom-tile]')?.getAttribute('data-zoom-tile'), center))
    .toBe(targetId);

  // An 11px first expansion stays below the 12px navigation threshold. Both
  // fingers stay down and keep spreading after the camera hides the tile.
  await touchGesture(page, [
    [{ x: center.x - 20, y: center.y }, { x: center.x + 20, y: center.y }],
    [{ x: center.x - 25, y: center.y }, { x: center.x + 26, y: center.y }],
    ...around([31, 37, 42, 48, 54, 59, 65]),
  ], async () => {
    await expect(page.locator('.graph-container')).toHaveAttribute('data-zoom-level', /^[01]$/);
    await expect(tile).toBeHidden();
    await welcomeStaysSelected();
  });
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
