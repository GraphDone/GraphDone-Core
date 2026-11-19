import { test, expect, Page, TestInfo } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { backend, openGraphView, SetupError } from '../../lib/journeys/workspace';
import { bareCanvasPinchCenter, cancelledThreeFingerPinch, splitSiblingContacts, touchGesture, visibleTileCenter, type TouchPoint } from '../../lib/journeys/touchContacts';
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
  const touchReceipts: { phase: string; contacts: { x: number; y: number; owner: string }[]; midpointIsCanvas: boolean; scale: number; after: number }[] = [];
  const observePair = async (phase: string, expected: (string | null)[]) => {
    const handle = await page.evaluateHandle(() => {
      const seen = { contacts: [] as { x: number; y: number; owner: string }[], midpointIsCanvas: false, scale: visualViewport?.scale ?? 1 };
      const start = (event: TouchEvent) => {
        if (event.touches.length !== 2) return;
        window.removeEventListener('touchstart', start, true);
        const svg = document.querySelector('.graph-container svg:has(g.main-graph-group)');
        const [a, b] = Array.from(event.touches);
        const midpoint = document.elementFromPoint((a.clientX + b.clientX) / 2, (a.clientY + b.clientY) / 2);
        seen.midpointIsCanvas = !!svg && (midpoint === svg || !!midpoint?.matches('rect.background') && svg.contains(midpoint));
        seen.contacts = Array.from(event.touches, touch => {
          const target = touch.target as Element;
          const background = target === svg || target.matches('rect.background') && svg?.contains(target);
          return { x: touch.clientX, y: touch.clientY, owner: target.closest('[data-zoom-tile]')?.getAttribute('data-zoom-tile') ?? (background ? 'canvas' : 'other') };
        });
      };
      window.addEventListener('touchstart', start, { capture: true, passive: true });
      return seen;
    });
    return async () => {
      const seen = { phase, ...await handle.jsonValue(), after: await page.evaluate(() => visualViewport?.scale ?? 1) };
      await handle.dispose();
      touchReceipts.push(seen);
      info.annotations.push({ type: 'phone-touch', description: JSON.stringify(seen) });
      expect(seen.contacts.map(c => c.owner)).toEqual(expected);
      expect(seen.after, 'pinching the graph must keep whole-page magnification unchanged').toBeCloseTo(seen.scale, 3);
      return seen;
    };
  };
  await enterWelcome(page);
  const originalGraphId = await page.evaluate(() => localStorage.getItem('currentGraphId'));
  const welcomeStaysSelected = async () => {
    await expect(selector(page)).toContainText('Welcome');
    expect(await page.evaluate(() => localStorage.getItem('currentGraphId'))).toBe(originalGraphId);
  };
  const zoomOnCanvas = async (from: number, to: number) => {
    const center = await bareCanvasPinchCenter(page, from, to);
    const check = await observePair('camera calibration', ['canvas', 'canvas']);
    await pinch(page, center, from, to);
    expect((await check()).midpointIsCanvas).toBe(true);
    await welcomeStaysSelected();
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
      const to = 50 * 0.16 / scale;
      if (to > 50) await zoomOnCanvas(50, to);
      else await pinch(page, canvasCenter, 50, to);
    }
    await expect(page.locator('.graph-container')).toHaveAttribute('data-zoom-level', '2');
    return area;
  };
  await resetOverview('cross-tile contacts');
  const fixTile = () => page.getByRole('button', { name: /^Fix bugs graph, \d+ items?$/ });
  const split = await splitSiblingContacts(page, originalGraphId);
  const beforeSplit = await camera(page);
  const checkSplit = await observePair('cross-tile contacts', split.ids);
  await touchGesture(page, [split.contacts, split.spread]);
  expect((await checkSplit()).midpointIsCanvas).toBe(true);
  expect(await camera(page)).toBeGreaterThan(beforeSplit);
  await welcomeStaysSelected();

  await resetOverview('background');
  const background = await page.evaluate(() => {
    const svg = document.querySelector('.graph-container svg:has(g.main-graph-group)')!;
    const box = svg.getBoundingClientRect();
    for (const fy of [0.2, 0.5, 0.8, 0.1, 0.35, 0.65, 0.9]) for (const fx of [0.2, 0.5, 0.8]) {
      const x = Math.round(box.x + box.width * fx), y = Math.round(box.y + box.height * fy);
      const blank = [-20, 0, 20].every(offset => {
        const hit = document.elementFromPoint(x + offset, y);
        return hit === svg || hit?.matches('rect.background') && svg.contains(hit);
      });
      if (blank) return { x, y };
    }
    throw new Error('no overview background point');
  });
  const checkBackground = await observePair('background', ['canvas', 'canvas']);
  await pinch(page, background, 20, 65);
  await checkBackground();
  await welcomeStaysSelected();

  await resetOverview('jitter');
  let center = await visibleTileCenter(page, fixTile(), 20);
  const around = (distances: number[]) => distances.map(distance => [
    { x: center.x - distance, y: center.y }, { x: center.x + distance, y: center.y },
  ] as [TouchPoint, TouchPoint]);
  await touchGesture(page, around([20, 23, 19, 22])); // sensor jitter
  await welcomeStaysSelected();

  await resetOverview('inward');
  center = await visibleTileCenter(page, fixTile(), 40);
  await touchGesture(page, around([40, 32, 24, 16])); // inward pinch
  await welcomeStaysSelected();

  await resetOverview('reversal');
  center = await visibleTileCenter(page, fixTile(), 20);
  await touchGesture(page, around([20, 24, 16, 65])); // outward, then reversed: cancelled
  await welcomeStaysSelected();

  await resetOverview('third contact');
  center = await visibleTileCenter(page, fixTile(), 20);
  await cancelledThreeFingerPinch(page, center);
  await welcomeStaysSelected();

  const area = await resetOverview('slow expansion into sibling');
  const tile = fixTile();
  const tileBox = (await tile.locator('.zoom-tile-bg').boundingBox())!;
  const shortSide = Math.min(area.width, area.height);
  const tileSize = Math.max(tileBox.width, tileBox.height);
  // Start just below the point at which the camera hides sibling tiles. The
  // first small movement must cross that boundary before qualifying as a dive.
  if (tileSize < 0.43 * shortSide) {
    await zoomOnCanvas(40, 40 * 0.47 * shortSide / tileSize);
  }
  await expect(page.locator('.graph-container')).toHaveAttribute('data-zoom-level', '2');
  const targetId = await tile.getAttribute('data-zoom-tile');
  const cameraBefore = await camera(page);
  const sourcePositions = await localSourcePositions(page);
  center = await visibleTileCenter(page, tile, 20);
  const readyBox = (await tile.locator('.zoom-tile-bg').boundingBox())!;
  expect(Math.max(readyBox.width, readyBox.height) * 51 / 40).toBeGreaterThan(0.5 * shortSide);
  const contactHits = await page.evaluate(({ x, y }) => [-20, 0, 20].map(offset => ({
    x: x + offset, y,
    graphId: document.elementFromPoint(x + offset, y)?.closest('[data-zoom-tile]')?.getAttribute('data-zoom-tile'),
  })), center);
  expect(contactHits.map(hit => hit.graphId)).toEqual([targetId, targetId, targetId]);

  const checkDive = await observePair('slow expansion into sibling', [targetId, targetId]);
  // An 11px first expansion stays below the 12px navigation threshold. Both
  // fingers stay down and keep spreading after the camera hides the tile.
  await touchGesture(page, [
    [{ x: center.x - 20, y: center.y }, { x: center.x + 20, y: center.y }],
    [{ x: center.x - 25, y: center.y }, { x: center.x + 26, y: center.y }],
    ...around([31, 37, 42, 48, 54, 59, 65]),
  ], async () => {
    await checkDive();
    await expect(page.locator('.graph-container')).toHaveAttribute('data-zoom-level', /^[01]$/);
    await expect(tile).toBeHidden();
    await welcomeStaysSelected();
  });
  expect(await page.evaluate(() => visualViewport?.scale ?? 1)).toBeCloseTo(touchReceipts[touchReceipts.length - 1].scale, 3);
  await expect(selector(page)).toContainText('Fix bugs', { timeout: 15_000 });
  expect(await page.evaluate(() => localStorage.getItem('currentGraphId'))).toBe(targetId);
  const afterPositions = await localSourcePositions(page);
  for (const [id, position] of Object.entries(sourcePositions)) expect(afterPositions[id], `source position changed for ${id}`).toEqual(position);
  await evidence(info, 'pinch-sibling-receipt.json', JSON.stringify({
    viewport: await page.evaluate(() => ({ width: innerWidth, height: innerHeight })),
    inputCenter: center,
    splitSiblingContacts: split,
    touchReceipts,
    contactHits,
    hitGraphId: targetId,
    originalGraphId,
    selectedGraphId: await page.evaluate(() => localStorage.getItem('currentGraphId')),
    camera: { before: cameraBefore, after: await camera(page) },
    preservedSourcePositions: Object.keys(sourcePositions).length,
  }, null, 2), 'application/json');
  await evidence(info, 'pinch-sibling-opened.png', await page.screenshot(), 'image/png');
});
