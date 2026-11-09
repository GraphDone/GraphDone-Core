import { expect, Page } from '@playwright/test';
import { cardBox, clickable, Item } from './workspace';

/**
 * Every way a person can connect one item to another, driven like a person:
 * real pointer events at what is on screen, no force clicks, no retry-until-pass.
 * Each path returns what it took (zoom steps, etc.) so reports can show friction.
 */
export type PathResult = { zoomIn?: number; zoomOut?: number; pans?: number };
export type LinkPath = { id: string; title: string; run: (page: Page, a: Item, b: Item) => Promise<PathResult> };


const isTouch = (page: Page) => page.evaluate(() => matchMedia('(pointer: coarse)').matches);

/** A tap on touch devices, a click otherwise: the way this device's person presses. */
async function press(page: Page, x: number, y: number) {
  if (await isTouch(page)) await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
}

/** Hold one finger still on (x, y) past the app's 500 ms long-press. */
async function longPress(page: Page, x: number, y: number) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] } as any);
  await page.waitForTimeout(800);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] } as any);
  await cdp.detach();
}

/** One zoom step at (x, y): a mouse-wheel notch on desktop, a two-finger pinch on
 * touch (CDP pinch, so touch projects run Chromium with device emulation). */
async function zoomStep(page: Page, x: number, y: number, direction: 'in' | 'out') {
  if (await isTouch(page)) {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.synthesizePinchGesture', { x, y, scaleFactor: direction === 'in' ? 1.6 : 0.62, gestureSourceType: 'touch' } as any);
    await cdp.detach();
  } else {
    await page.mouse.move(x, y);
    await page.mouse.wheel(0, direction === 'in' ? -240 : 240);
  }
  await page.waitForTimeout(450);
}

/** Start each path from the whole graph in view. Phones have no fit button, so
 * there the path starts from wherever creating the items left the camera. */
async function frameAll(page: Page) {
  const fit = page.getByRole('button', { name: 'Zoom to fit — frame all nodes' });
  if (!(await fit.isVisible().catch(() => false))) return;
  await fit.click();
  await page.waitForTimeout(700);
}

async function onScreen(page: Page, item: Item) {
  const box = await cardBox(page, item.id);
  return box && (await clickable(page, item.id, box.cx, box.cy)) ? box : null;
}

/** Drag empty canvas so (x, y) moves to the middle of the graph: a one-finger
 * swipe on touch, a mouse drag on desktop. Returns false if already in view. */
async function panIntoView(page: Page, x: number, y: number) {
  const f = (await page.locator('.graph-container').boundingBox())!;
  const margin = 40;
  if (x > f.x + margin && x < f.x + f.width - margin && y > f.y + margin && y < f.y + f.height - margin) return false;
  const sx = f.x + f.width * 0.5, sy = f.y + f.height * 0.25; // start on canvas, above where cards land
  const dx = Math.max(-f.width * 0.8, Math.min(f.width * 0.8, f.x + f.width / 2 - x));
  const dy = Math.max(-f.height * 0.6, Math.min(f.height * 0.6, f.y + f.height / 2 - y));
  if (await isTouch(page)) {
    const cdp = await page.context().newCDPSession(page);
    const touch = (type: string, px: number, py: number) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: px, y: py }] } as any);
    await touch('touchStart', sx, sy);
    for (let i = 1; i <= 12; i++) await touch('touchMove', sx + dx * i / 12, sy + dy * i / 12);
    await touch('touchEnd', sx + dx, sy + dy);
    await cdp.detach();
  } else {
    await page.mouse.move(sx, sy); await page.mouse.down();
    await page.mouse.move(sx + dx, sy + dy, { steps: 12 }); await page.mouse.up();
  }
  await page.waitForTimeout(450);
  return true;
}

/** Hover the card (desktop); if its control (e.g. "+" or the quick-edit gear) is not
 * shown, zoom in on it a step at a time (max 6), as a person would. */
async function revealControl(page: Page, item: Item, control: string) {
  const touch = await isTouch(page);
  let pans = 0;
  for (let step = 0; step <= 6; step++) {
    let box = await cardBox(page, item.id);
    if (!box) throw new Error(`${item.title} is not drawn`);
    for (let p = 0; p < 4 && (await panIntoView(page, box!.cx, box!.cy)); p++) { pans++; box = await cardBox(page, item.id); }
    if (!box) throw new Error(`${item.title} is not drawn`);
    if (!touch) { await page.mouse.move(box.cx, box.cy); await page.waitForTimeout(250); }
    const plus = await page.evaluate(({ id, control }) => {
      for (const e of Array.from(document.querySelectorAll(`${control}[data-node-id="${id}"]`))) {
        const r = e.getBoundingClientRect();
        if (r.width < 8) continue;
        const x = r.x + r.width / 2, y = r.y + r.height / 2;
        if (e.contains(document.elementFromPoint(x, y))) return { x, y };
      }
      return null;
    }, { id: item.id, control });
    if (plus) return { ...plus, zoomIn: step, pans };
    await zoomStep(page, box.cx, box.cy, 'in');
  }
  throw new Error(`no clickable ${control} on ${item.title}, even after zooming in 6 steps`);
}

/** Bring the target into view the way a person would: zoom out over the canvas (max 6). */
async function findOnScreen(page: Page, item: Item) {
  for (let step = 0; step <= 6; step++) {
    const box = await onScreen(page, item);
    if (box) return { box, zoomOut: step };
    const frame = await page.locator('.graph-container').boundingBox();
    await zoomStep(page, frame!.x + frame!.width / 2, frame!.y + frame!.height / 2, 'out');
  }
  throw new Error(`${item.title} could not be brought on screen to click`);
}

export const LINK_PATHS: (LinkPath & { desktopOnly?: boolean })[] = [
  {
    id: 'plus-then-node',
    title: 'click + on an item, then click another item',
    async run(page, a, b) {
      await frameAll(page);
      const plus = await revealControl(page, a, '.node-relationship-icon');
      await press(page, plus.x, plus.y);
      await expect(page.getByTestId('grow-hint').or(page.getByText('Click empty space to grow', { exact: false })).first(), '+ must enter connect mode on the first press').toBeVisible({ timeout: 2000 });
      const target = await findOnScreen(page, b);
      await press(page, target.box.cx, target.box.cy);
      return { zoomIn: plus.zoomIn, zoomOut: target.zoomOut, pans: plus.pans };
    },
  },
  {
    id: 'shift-click',
    desktopOnly: true,
    title: 'Shift-click an item, then Shift-click another item',
    async run(page, a, b) {
      await frameAll(page);
      const from = await findOnScreen(page, a);
      await page.keyboard.down('Shift');
      await page.mouse.click(from.box.cx, from.box.cy);
      const to = await findOnScreen(page, b);
      await page.mouse.click(to.box.cx, to.box.cy);
      await page.keyboard.up('Shift');
      return { zoomOut: from.zoomOut + to.zoomOut };
    },
  },
  {
    id: 'alt-drag',
    desktopOnly: true,
    title: 'Alt-drag from an item onto another item',
    async run(page, a, b) {
      await frameAll(page);
      const from = await findOnScreen(page, a), to = await findOnScreen(page, b);
      await page.keyboard.down('Alt');
      await page.mouse.move(from.box.cx, from.box.cy);
      await page.mouse.down();
      await page.mouse.move(to.box.cx, to.box.cy, { steps: 20 });
      await page.mouse.up();
      await page.keyboard.up('Alt');
      return {};
    },
  },
  {
    id: 'context-menu',
    title: 'open an item\'s menu (right-click, or long-press on touch), "Connect to Existing Work Items", pick the other item',
    async run(page, a, b) {
      await frameAll(page);
      const from = await findOnScreen(page, a);
      if (await isTouch(page)) await longPress(page, from.box.cx, from.box.cy);
      else await page.mouse.click(from.box.cx, from.box.cy, { button: 'right' });
      const connect = page.getByText('Connect to Existing Work Items', { exact: true });
      await expect(connect, 'the item\'s menu must open').toBeVisible({ timeout: 5000 });
      await connect.click();
      const search = page.getByPlaceholder('Search work items by title or type');
      await expect(search, '"Connect to Existing Work Items" must open the connect dialog').toBeVisible({ timeout: 5000 });
      await search.fill(b.title);
      await page.getByText(b.title, { exact: true }).last().click();
      await page.getByRole('button', { name: /^Connect 1 Node$/ }).click();
      return { zoomOut: from.zoomOut };
    },
  },
  {
    id: 'details-connect',
    title: 'quick edit an item, "Details & connections", Connect, pick the other item',
    async run(page, a, b) {
      await frameAll(page);
      const gear = await revealControl(page, a, '.node-edit-icon');
      await press(page, gear.x, gear.y);
      await page.getByTestId('node-quick-edit').getByRole('button', { name: 'Details & connections', exact: true }).click();
      const editor = page.getByRole('dialog', { name: 'Work item details', exact: true });
      await editor.getByRole('button', { name: /^Connect to other work items/ }).click();
      await editor.getByRole('checkbox', { name: `Select ${b.title} to connect`, exact: true }).locator('xpath=..').click();
      await editor.getByRole('button', { name: 'Connect Selected (1)', exact: true }).click();
      return { zoomIn: gear.zoomIn, pans: gear.pans };
    },
  },
];
