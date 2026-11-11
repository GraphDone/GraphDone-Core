import { expect, Locator, Page } from '@playwright/test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { getRelationshipConfig } from '../../../packages/web/src/constants/workItemConstants';

/**
 * The relationship editor as a person meets it: how they open it on each
 * device, what it says, what the canvas and the relationship list show for one
 * relationship, and the problems (page errors, GraphQL errors, toasts) seen
 * along the way. Used by tests/e2e/journeys/relationship-edit.spec.ts.
 */
export const editorOf = (page: Page) => page.getByRole('dialog', { name: 'Edit relationship', exact: true });
const isTouch = (page: Page) => page.evaluate(() => matchMedia('(pointer: coarse)').matches);
const isPhone = (page: Page) => (page.viewportSize()?.width ?? 1440) < 640;
const browseButton = (page: Page) => page.getByRole('button', { name: /Browse all relationships$/ });
const listOf = (page: Page) => page.getByRole('region', { name: 'Graph relationships' });

/** A tap on touch devices, a click otherwise. */
export async function press(page: Page, target: Locator) {
  if (await isTouch(page)) await target.tap();
  else await target.click();
}

/** Page errors, GraphQL errors and the text of every toast shown, across reloads. */
export async function watchProblems(page: Page) {
  const problems: string[] = [];
  const toasts: string[] = [];
  page.on('pageerror', e => problems.push(`page error: ${e.message}`));
  page.on('response', async response => {
    if (!response.url().includes('graphql') || response.request().method() !== 'POST') return;
    const body = await response.json().catch(() => null);
    for (const e of body?.errors ?? []) problems.push(`GraphQL error: ${e.message}`);
  });
  await page.exposeFunction('__journeyToast', (text: string) => { toasts.push(text); });
  await page.addInitScript(() => {
    new MutationObserver(records => {
      for (const record of records) for (const node of Array.from(record.addedNodes)) {
        if (node instanceof HTMLElement && node.parentElement?.dataset.testid === 'toast-stack') {
          (window as any).__journeyToast(node.innerText || node.textContent || '');
        }
      }
    }).observe(document, { childList: true, subtree: true });
  });
  return { problems, toasts };
}

async function frameAll(page: Page) {
  const fit = page.getByRole('button', { name: 'Zoom to fit — frame all nodes' });
  if (!(await fit.isVisible().catch(() => false))) return;
  await fit.click();
  await page.waitForTimeout(700);
}

/**
 * Open the editor for one relationship as this device's person does, and
 * return how: "browse" (phones: "Browse all relationships", then its "Edit
 * relationship"), "label" (the connection's label, when it is drawn and a press
 * reaches it) or "wire" (the line itself, where no card covers it).
 */
export async function openEditor(page: Page, edgeId: string): Promise<string> {
  const editor = editorOf(page);
  if (isPhone(page)) {
    await press(page, browseButton(page));
    await press(page, listOf(page).getByRole('button', { name: `Edit relationship ${edgeId}`, exact: true }));
    await expect(editor, '"Edit relationship" in the list must open the editor').toBeVisible({ timeout: 5000 });
    return 'browse';
  }
  await frameAll(page);
  const target = await page.evaluate(id => {
    const reaches = (x: number, y: number, el: Element) => el.contains(document.elementFromPoint(x, y));
    const label = document.querySelector(`.graph-container .edge-label-group[data-edge-id="${id}"]`);
    if (label && getComputedStyle(label).display !== 'none' && getComputedStyle(label).pointerEvents !== 'none') {
      const r = label.getBoundingClientRect();
      const x = r.x + r.width / 2, y = r.y + r.height / 2;
      if (r.width > 0 && reaches(x, y, label)) return { how: 'label', x, y };
    }
    const wire = document.querySelector(`.graph-container .edge-clickable[data-edge-id="${id}"]`) as SVGPathElement | null;
    if (!wire) return null;
    for (const t of [0.5, 0.4, 0.6, 0.3, 0.7]) {
      const p = wire.getPointAtLength(wire.getTotalLength() * t);
      const screen = new DOMPoint(p.x, p.y).matrixTransform(wire.getScreenCTM()!);
      if (reaches(screen.x, screen.y, wire)) return { how: 'wire', x: screen.x, y: screen.y };
    }
    return null;
  }, edgeId);
  if (!target) throw new Error(`neither the label nor the wire of relationship ${edgeId} can be pressed`);
  if (await isTouch(page)) await page.touchscreen.tap(target.x, target.y);
  else await page.mouse.click(target.x, target.y);
  await expect(editor, `pressing the connection's ${target.how} must open its editor`).toBeVisible({ timeout: 5000 });
  // The person's pointer moves on to the editor (and off the hovered wire).
  if (!(await isTouch(page))) {
    const box = await editor.boundingBox();
    if (box) await page.mouse.move(box.x + box.width / 2, box.y + 12);
  }
  return target.how;
}

/**
 * What the editor shows: its "Editing relationship: A → B" line, the type
 * buttons it presses, and how many editors are open. Read at once, without
 * waiting.
 */
export async function editorShows(page: Page) {
  return page.evaluate(() => {
    const dialogs = (name: string) => Array.from(document.querySelectorAll(`[role="dialog"][aria-label="${name}"]`));
    const [editor] = dialogs('Edit relationship');
    const lines = editor ? Array.from(editor.querySelectorAll('div, p, span')).filter(el =>
      el.children.length === 0 && (el.textContent ?? '').trim().startsWith('Editing relationship: ')) : [];
    return {
      line: lines.length ? (lines[0].textContent ?? '').replace(/\s+/g, ' ').trim() : null,
      pressed: editor ? Array.from(editor.querySelectorAll('button[aria-pressed="true"]')).map(b => (b as HTMLElement).innerText.trim()) : [],
      editWindows: dialogs('Edit relationship').length,
    };
  });
}

/** Close the editor with its close button, as a person does. */
export async function closeEditor(page: Page, step: string) {
  const editor = editorOf(page);
  await press(page, editor.getByRole('button', { name: 'Close relationship editor', exact: true }));
  await expect(editor, `${step}: closing must close the editor`).toHaveCount(0);
}

/** The camera's zoom, from the graph group's transform. */
const zoomOf = (page: Page) => page.evaluate(() => {
  const m = /scale\(\s*([\d.e-]+)/.exec(document.querySelector('.graph-container svg g.main-graph-group')?.getAttribute('transform') || '');
  return m ? Number(m[1]) : 1;
});

/**
 * Bring the connection's arrow into view as a person does when it is not
 * drawn at this zoom (a phone opens the graph at half size, where arrows and
 * labels are hidden) or not on screen: zoom in on it (a pinch on touch
 * screens, the wheel otherwise), then drag the canvas until it is near the
 * middle. Gestures start on empty canvas, never on a card or a wire.
 */
export async function showPair(page: Page, aId: string, bId: string, type: string) {
  for (let attempt = 0; attempt < 4; attempt++) {
    if ((await drawnRelationship(page, aId, bId, type, { seen: true })).seen?.arrow) return;
    const k = await zoomOf(page);
    const at = await page.evaluate(({ aId, bId }) => {
      const id = (end: any) => end?.id ?? end;
      const ofPair = (selector: string) => (Array.from(document.querySelectorAll(`.graph-container svg ${selector}`)) as any[]).find(el => {
        const d = el.__data__; return d && [id(d.source), id(d.target)].sort().join() === [aId, bId].sort().join();
      });
      const arrow = ofPair('path.arrow') as SVGPathElement | undefined, wire = ofPair('path.edge') as SVGPathElement | undefined;
      const svg = document.querySelector('.graph-container svg') as SVGSVGElement | null;
      if (!svg) return null;
      const view = svg.getBoundingClientRect();
      // The arrow where it is drawn; the wire's middle when the arrow is not laid out.
      const box = arrow?.getBoundingClientRect();
      let tip = box && box.width + box.height > 0 ? { x: box.x + box.width / 2, y: box.y + box.height / 2 } : null;
      if (!tip && wire) {
        const p = wire.getPointAtLength(wire.getTotalLength() / 2);
        const q = new DOMPoint(p.x, p.y).matrixTransform(wire.getScreenCTM()!);
        tip = { x: q.x, y: q.y };
      }
      if (!tip) return null;
      const middle = { x: view.x + view.width / 2, y: view.y + view.height / 2 };
      const empty = (x: number, y: number) => {
        if (x < view.x + 40 || x > view.right - 40 || y < view.y + 40 || y > view.bottom - 40) return false;
        const hit = document.elementFromPoint(x, y);
        return !!hit && svg.contains(hit) && !hit.closest('g.node, .edge, .edge-clickable, .edge-label-group, .arrow, foreignObject, [data-local-item-card]');
      };
      const near = (c: { x: number; y: number }) => {
        for (let r = 0; r <= 180; r += 15) for (let a = 0; a < 16; a++) {
          const x = c.x + r * Math.cos(a * Math.PI / 8), y = c.y + r * Math.sin(a * Math.PI / 8);
          if (empty(x, y)) return { x, y };
          if (r === 0) break;
        }
        return null;
      };
      const onScreen = tip.x > view.x + 40 && tip.x < view.right - 40 && tip.y > view.y + 40 && tip.y < view.bottom - 40;
      return { tip, middle, onScreen, nearTip: near(tip), nearMiddle: near(middle) };
    }, { aId, bId });
    if (!at) return;
    const touch = await isTouch(page);
    if (!at.onScreen) {
      // Drag the canvas so the arrow comes to the middle.
      const from = at.nearMiddle;
      if (!from) return;
      const to = { x: from.x + (at.middle.x - at.tip.x), y: from.y + (at.middle.y - at.tip.y) };
      if (touch) {
        const cdp = await page.context().newCDPSession(page);
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: from.x, y: from.y }] });
        for (let step = 1; step <= 10; step++) {
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: from.x + (to.x - from.x) * step / 10, y: from.y + (to.y - from.y) * step / 10 }] });
        }
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await cdp.detach();
      } else {
        await page.mouse.move(from.x, from.y);
        await page.mouse.down();
        await page.mouse.move(to.x, to.y, { steps: 10 });
        await page.mouse.up();
      }
    } else if (k < 0.75 && at.nearTip) {
      // Zoom in around the arrow, so it stays on screen.
      const factor = Math.min(3, 0.9 / k);
      if (touch) {
        const cdp = await page.context().newCDPSession(page);
        await cdp.send('Input.synthesizePinchGesture', { x: at.nearTip.x, y: at.nearTip.y, scaleFactor: factor, gestureSourceType: 'touch' });
        await cdp.detach();
      } else {
        await page.mouse.move(at.nearTip.x, at.nearTip.y);
        await page.mouse.wheel(0, -Math.log2(factor) / 0.002);
      }
    } else {
      return;
    }
    await page.waitForTimeout(500);
  }
}

/**
 * With the editor closed, read the relationship's entry in "Browse all
 * relationships" (one entry for the pair, from → TYPE → to), and reopen the
 * editor from it, as a person checking the list would.
 */
export async function expectListed(page: Page, edgeId: string, fromTitle: string, toTitle: string, type: string, step: string) {
  const editor = editorOf(page);
  await press(page, browseButton(page));
  const list = listOf(page);
  await expect(list.locator('li[data-lod-edge-id]').filter({ hasText: fromTitle }).filter({ hasText: toTitle }),
    `${step}: the list must hold exactly one relationship for the pair`).toHaveCount(1);
  const entry = list.locator(`li[data-lod-edge-id="${edgeId}"]`);
  await expect(entry, `${step}: the list must show the relationship as ${type}`).toContainText(`→ ${type}`);
  const text = await entry.innerText();
  // The target's title after the arrow: an item's context line may name its
  // container (Is Part Of) before it.
  const arrow = text.indexOf(`→ ${type}`);
  const [from, to] = [text.indexOf(fromTitle), text.indexOf(toTitle, arrow)];
  expect(from >= 0 && from < arrow && to > arrow, `${step}: the list must read ${fromTitle} → ${type} → ${toTitle}, got: ${text.replace(/\s+/g, ' ')}`).toBe(true);
  await press(page, entry.getByRole('button', { name: `Edit relationship ${edgeId}`, exact: true }));
  await expect(editor, `${step}: "Edit relationship" in the list must reopen the editor`).toBeVisible({ timeout: 5000 });
}

/** The type's icon as the app's icon component draws it. */
const iconMarkup = (type: string) => renderToStaticMarkup(createElement(getRelationshipConfig(type as any).icon));

/**
 * What the canvas draws for the relationships between two items: how many
 * wires, arrows, labels and hit areas; the wire's direction, painted stroke and
 * arrow colour (computed style, as hex); which end the arrow sits at; and the
 * label's text and whether its icon is the type's icon. With `seen`, also
 * whether a person can see the wire and the arrow: displayed, at least half
 * opaque through every parent, and on screen.
 */
export async function drawnRelationship(page: Page, aId: string, bId: string, type: string, options: { seen?: boolean } = {}) {
  return page.evaluate(({ aId, bId, reference, withSeen }) => {
    const id = (end: any) => end?.id ?? end;
    const ofPair = (selector: string) => (Array.from(document.querySelectorAll(`.graph-container svg ${selector}`)) as any[]).filter(el => {
      const d = el.__data__;
      if (!d) return false;
      const s = id(d.source), t = id(d.target);
      return (s === aId && t === bId) || (s === bId && t === aId);
    });
    const hex = (color: string) => {
      const m = color.match(/[\d.]+/g);
      return m && m.length >= 3 ? `#${m.slice(0, 3).map(v => Math.round(Number(v)).toString(16).padStart(2, '0')).join('')}` : color;
    };
    const wires = ofPair('path.edge'), arrows = ofPair('path.arrow'), labels = ofPair('g.edge-label-group'), hitAreas = ofPair('path.edge-clickable');
    const wire = wires[0], arrow = arrows[0], label = labels[0];
    const nodeAt = (nid: string) => (Array.from(document.querySelectorAll('.graph-container g.node')) as any[]).find(n => n.__data__?.id === nid)?.__data__;
    let arrowAt: string | null = null;
    const m = /translate\(\s*([-\d.e]+)[\s,]+([-\d.e]+)\s*\)/.exec(arrow?.getAttribute('transform') || '');
    if (m && wire) {
      const s = nodeAt(id(wire.__data__.source)), t = nodeAt(id(wire.__data__.target));
      const x = Number(m[1]), y = Number(m[2]);
      if (s && t) arrowAt = Math.hypot(x - t.x, y - t.y) < Math.hypot(x - s.x, y - s.y) ? 'target' : 'source';
    }
    const shape = (svg: Element | null | undefined) => svg ? Array.from(svg.children).map(c =>
      `${c.tagName.toLowerCase()}:${Array.from(c.attributes).filter(a => a.name !== 'class').map(a => `${a.name}=${a.value}`).sort().join(';')}`).join('|') : null;
    const template = document.createElement('template');
    template.innerHTML = reference;
    const icon = label?.querySelector('.edge-label-icon svg');
    const visible = (el: Element | undefined) => {
      if (!el) return false;
      let opacity = 1;
      for (let n: Element | null = el; n && n.tagName.toLowerCase() !== 'svg'; n = n.parentElement) {
        const style = getComputedStyle(n);
        if (style.display === 'none' || style.visibility === 'hidden') return false;
        opacity *= Number(style.opacity);
      }
      const r = el.getBoundingClientRect();
      return opacity >= 0.5 && r.width + r.height > 0 && r.right > 0 && r.bottom > 0 && r.left < innerWidth && r.top < innerHeight;
    };
    return {
      wires: wires.length, arrows: arrows.length, labels: labels.length, hitAreas: hitAreas.length,
      source: wire ? id(wire.__data__.source) : null, target: wire ? id(wire.__data__.target) : null,
      stroke: wire ? hex(getComputedStyle(wire).stroke) : null,
      arrowFill: arrow ? hex(getComputedStyle(arrow).fill) : null,
      arrowAt,
      labelText: label?.querySelector('.edge-label')?.textContent ?? null,
      labelIcon: !icon ? 'missing' : shape(icon) === shape(template.content.firstElementChild) ? 'matches the type' : 'another icon',
      ...(withSeen ? { seen: { wire: visible(wire), arrow: visible(arrow) } } : {}),
    };
  }, { aId, bId, reference: iconMarkup(type), withSeen: !!options.seen });
}
