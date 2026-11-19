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

export async function splitSiblingContacts(page: Page, currentGraphId: string | null) {
  if (!currentGraphId) throw new Error('The currently open graph must be identified before testing sibling contacts.');
  const svg = page.locator('.graph-container[data-zoom-level="2"] svg:has(g.main-graph-group)');
  for (let pans = 0; pans <= 5; pans++) {
    const plan = await svg.evaluate((surface, current) => {
      const rect = surface.getBoundingClientRect();
      const view = visualViewport;
      const left = Math.max(rect.left, view?.offsetLeft ?? 0), top = Math.max(rect.top, view?.offsetTop ?? 0);
      const right = Math.min(rect.right, (view?.offsetLeft ?? 0) + (view?.width ?? innerWidth));
      const bottom = Math.min(rect.bottom, (view?.offsetTop ?? 0) + (view?.height ?? innerHeight));
      const blank = (p: TouchPoint) => {
        const hit = document.elementFromPoint(p.x, p.y);
        return hit === surface || hit?.matches('rect.background') && surface.contains(hit);
      };
      const inside = ({ x, y }: TouchPoint) => left + 2 <= x && x <= right - 2 && top + 2 <= y && y <= bottom - 2;
      const tiles = Array.from(surface.querySelectorAll<SVGGElement>('[data-zoom-tile][role="button"]'))
        .filter(el => el.dataset.zoomTile && el.dataset.zoomTile !== current)
        .map(el => ({ el, box: el.querySelector('.zoom-tile-bg')!.getBoundingClientRect() }));
      const axis = (a0: number, a1: number, b0: number, b1: number) => {
        if (a1 < b0) return [a1, b0];
        if (b1 < a0) return [a0, b1];
        const shared = (Math.max(a0, b0) + Math.min(a1, b1)) / 2;
        return [shared, shared];
      };
      let anchor: TouchPoint | undefined;
      let nearestGap = Infinity;
      for (const [i, a] of tiles.entries()) for (const b of tiles.slice(i + 1)) {
        const xs = axis(a.box.left, a.box.right, b.box.left, b.box.right);
        const ys = axis(a.box.top, a.box.bottom, b.box.top, b.box.bottom);
        const gap = Math.hypot(xs[0] - xs[1], ys[0] - ys[1]);
        if (gap < nearestGap) {
          nearestGap = gap;
          anchor = { x: (xs[0] + xs[1]) / 2, y: (ys[0] + ys[1]) / 2 };
        }
        // Use the facing edges of the reachable portions. Insets keep the
        // contacts inside the paint at rounded corners.
        const clipped = [a, b].map(({ box }) => ({
          l: Math.max(left, box.left), r: Math.min(right, box.right),
          t: Math.max(top, box.top), b: Math.min(bottom, box.bottom),
        }));
        if (clipped.some(r => r.r - r.l < 8 || r.b - r.t < 8)) continue;
        const [u, v] = clipped.map(r => {
          const pad = Math.min(8, (r.r - r.l) / 3, (r.b - r.t) / 3);
          return { l: r.l + pad, r: r.r - pad, t: r.t + pad, b: r.b - pad };
        });
        const x = axis(u.l, u.r, v.l, v.r), y = axis(u.t, u.b, v.t, v.b);
        const contacts = [a, b].map((_, n) => ({ x: Math.round(x[n]), y: Math.round(y[n]) }));
        if (![a, b].every(({ el }, n) => document.elementFromPoint(contacts[n].x, contacts[n].y)?.closest('[data-zoom-tile]') === el)) continue;
        const midpoint = { x: (contacts[0].x + contacts[1].x) / 2, y: (contacts[0].y + contacts[1].y) / 2 };
        if (!blank(midpoint)) continue;
        const distance = Math.hypot(contacts[0].x - contacts[1].x, contacts[0].y - contacts[1].y);
        const factor = Math.max(1.25, 1 + 16 / distance);
        const spread = contacts.map(p => ({ x: midpoint.x + (p.x - midpoint.x) * factor, y: midpoint.y + (p.y - midpoint.y) * factor }));
        if (spread.every(inside)) return { pair: { ids: [a.el.dataset.zoomTile!, b.el.dataset.zoomTile!], contacts, midpoint, spread } };
      }
      if (!anchor) throw new Error('Two sibling graphs are required for a split pinch.');
      const w = right - left, h = bottom - top;
      const dx = Math.max(-w / 3, Math.min(w / 3, (left + right) / 2 - anchor.x));
      const dy = Math.max(-h / 3, Math.min(h / 3, (top + bottom) / 2 - anchor.y));
      if (Math.hypot(dx, dy) >= 2) for (const fy of [0.2, 0.5, 0.8]) for (const fx of [0.2, 0.5, 0.8]) {
        const start = { x: left + w * fx, y: top + h * fy }, end = { x: start.x + dx, y: start.y + dy };
        if (blank(start) && inside(end) && document.elementFromPoint(end.x, end.y)?.closest('svg') === surface) return { start, end };
      }
      throw new Error('No reachable sibling pair with a blank midpoint or visible canvas drag toward its gap.');
    }, currentGraphId);
    if (plan.pair) return plan.pair;
    if (pans === 5) break;
    const { start, end } = plan;
    await touchGesture(page, Array.from({ length: 6 }, (_, i) => [{
      x: start.x + (end.x - start.x) * i / 5, y: start.y + (end.y - start.y) * i / 5,
    }]));
  }
  throw new Error('The gap between sibling graphs could not be reached by panning.');
}
