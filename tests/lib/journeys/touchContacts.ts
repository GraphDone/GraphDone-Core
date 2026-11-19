import type { Locator, Page } from '@playwright/test';

export type TouchPoint = { x: number; y: number };

type SendContacts = (type: 'touchStart' | 'touchMove', points: TouchPoint[]) => Promise<void>;

async function withTouchContacts(page: Page, start: TouchPoint[], move: (send: SendContacts) => Promise<void>) {
  const cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    const origin = await page.evaluate(() => ({ x: visualViewport?.offsetLeft ?? 0, y: visualViewport?.offsetTop ?? 0 }));
    const send: SendContacts = async (type, points) => {
      const touchPoints = points.map(({ x, y }, index) => ({
        x: Math.round(x) - origin.x, y: Math.round(y) - origin.y,
        id: index + 1, radiusX: 2, radiusY: 2, force: 1,
      }));
      await cdp.send('Input.dispatchTouchEvent', { type, touchPoints });
    };
    await send('touchStart', start);
    await move(send);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } catch (error) {
    // A failed assertion or a torn-down target must not leave active contacts
    // or replace the error identifying the failed gesture.
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] }).catch(() => {});
    await cdp.detach().catch(() => {});
    throw error;
  }
  await cdp.detach();
  await page.waitForTimeout(400);
}

export async function touchGesture(page: Page, frames: TouchPoint[][], afterFirstMove?: () => Promise<void>) {
  await withTouchContacts(page, frames[0], async send => {
    for (const [index, frame] of frames.slice(1).entries()) {
      await send('touchMove', frame);
      await page.waitForTimeout(30);
      if (index === 0) await afterFirstMove?.();
    }
  });
}

export async function cancelledThreeFingerPinch(page: Page, center: TouchPoint) {
  const two = [{ x: center.x - 20, y: center.y }, { x: center.x + 20, y: center.y }];
  const third = { x: center.x, y: center.y + 30 };
  await withTouchContacts(page, two, async send => {
    await send('touchStart', [...two, third]);
    await send('touchMove', [
      { x: center.x - 65, y: center.y }, { x: center.x + 65, y: center.y }, third,
    ]);
  });
}

/** Bring the intended contacts into the visible graph by dragging empty canvas. */
export async function visibleTileCenter(page: Page, tile: Locator, halfSpan = 0) {
  for (let drag = 0; drag <= 5; drag++) {
    const view = await tile.evaluate((element, span) => {
      const rect = (element.querySelector('.zoom-tile-bg') ?? element).getBoundingClientRect();
      const layout = element.closest('.graph-container')!.getBoundingClientRect();
      const view = visualViewport;
      const left = Math.max(layout.left, view?.offsetLeft ?? 0), top = Math.max(layout.top, view?.offsetTop ?? 0);
      const right = Math.min(layout.right, (view?.offsetLeft ?? 0) + (view?.width ?? innerWidth));
      const bottom = Math.min(layout.bottom, (view?.offsetTop ?? 0) + (view?.height ?? innerHeight));
      const canvas = new DOMRect(left, top, right - left, bottom - top);
      const svg = element.closest('svg')!;
      const center = { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
      const inside = (x: number, y: number) => x > canvas.left && x < canvas.right && y > canvas.top && y < canvas.bottom;
      const hit = (x: number, y: number) => document.elementFromPoint(x, y);
      const ready = [-span, 0, span].every(offset =>
        inside(center.x + offset, center.y) && hit(center.x + offset, center.y)?.closest('[data-zoom-tile]') === element);
      if (ready) return { center };

      const clamp = (distance: number, limit: number) => Math.max(-limit, Math.min(limit, distance));
      const dx = clamp(canvas.x + canvas.width / 2 - center.x, canvas.width / 3);
      const dy = clamp(canvas.y + canvas.height / 2 - center.y, canvas.height / 3);
      for (const fy of [0.25, 0.5, 0.75, 0.1, 0.9]) for (const fx of [0.25, 0.5, 0.75, 0.1, 0.9]) {
        const start = { x: canvas.x + fx * canvas.width, y: canvas.y + fy * canvas.height };
        const end = { x: start.x + dx, y: start.y + dy };
        const target = hit(start.x, start.y);
        if (target !== svg && !(target?.matches('rect.background') && svg.contains(target))) continue;
        if (inside(end.x, end.y) && hit(end.x, end.y)?.closest('svg') === svg) return { start, end };
      }
      throw new Error('No visible canvas background is available to pan toward the sibling graph.');
    }, halfSpan);
    if (view.center) return view.center;
    if (drag === 5) break;
    const { start, end } = view;
    await touchGesture(page, Array.from({ length: 6 }, (_, i) => [{
      x: start.x + (end.x - start.x) * i / 5,
      y: start.y + (end.y - start.y) * i / 5,
    }]));
  }
  throw new Error('The sibling graph is not reachable by the intended touch contacts after panning.');
}
