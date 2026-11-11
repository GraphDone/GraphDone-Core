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
const createDialogOf = (page: Page) => page.getByRole('dialog', { name: 'Create relationship', exact: true });
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

/** The editor is still the edit editor, reads from → to, and presses the saved type. */
export async function expectEditor(page: Page, fromTitle: string, toTitle: string, typeLabel: string, step: string) {
  const editor = editorOf(page);
  await expect(editor.getByText(`Editing relationship: ${fromTitle} → ${toTitle}`, { exact: true }), `${step}: the editor must stay open and read ${fromTitle} → ${toTitle}`).toBeVisible();
  await expect(editor.getByRole('button', { pressed: true }), `${step}: the pressed type must be ${typeLabel}`).toHaveText(typeLabel);
  await expect(createDialogOf(page), `${step}: the editor must never turn into "Create relationship"`).toHaveCount(0);
}

/**
 * Close the editor, read the relationship's entry in "Browse all
 * relationships" (one entry for the pair, from → TYPE → to), and reopen the
 * editor from it, as a person checking the list would.
 */
export async function expectListed(page: Page, edgeId: string, fromTitle: string, toTitle: string, type: string, step: string) {
  const editor = editorOf(page);
  await press(page, editor.getByRole('button', { name: 'Close relationship editor', exact: true }));
  await expect(editor, `${step}: closing must close the editor`).toHaveCount(0);
  await press(page, browseButton(page));
  const list = listOf(page);
  await expect(list.locator('li[data-lod-edge-id]').filter({ hasText: fromTitle }).filter({ hasText: toTitle }),
    `${step}: the list must hold exactly one relationship for the pair`).toHaveCount(1);
  const entry = list.locator(`li[data-lod-edge-id="${edgeId}"]`);
  await expect(entry, `${step}: the list must show the relationship as ${type}`).toContainText(`→ ${type}`);
  const text = await entry.innerText();
  const [from, arrow, to] = [text.indexOf(fromTitle), text.indexOf(`→ ${type}`), text.indexOf(toTitle)];
  expect(from < arrow && arrow < to, `${step}: the list must read ${fromTitle} → ${type} → ${toTitle}, got: ${text.replace(/\s+/g, ' ')}`).toBe(true);
  await press(page, entry.getByRole('button', { name: `Edit relationship ${edgeId}`, exact: true }));
  await expect(editor, `${step}: "Edit relationship" in the list must reopen the editor`).toBeVisible({ timeout: 5000 });
}

/** The type's icon as the app's icon component draws it. */
const iconMarkup = (type: string) => renderToStaticMarkup(createElement(getRelationshipConfig(type as any).icon));

/**
 * What the canvas draws for the relationships between two items: how many
 * wires, arrows, labels and hit areas; the wire's direction, painted stroke and
 * arrow colour (computed style, as hex); which end the arrow sits at; and the
 * label's text and whether its icon is the type's icon.
 */
export async function drawnRelationship(page: Page, aId: string, bId: string, type: string) {
  return page.evaluate(({ aId, bId, reference }) => {
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
    return {
      wires: wires.length, arrows: arrows.length, labels: labels.length, hitAreas: hitAreas.length,
      source: wire ? id(wire.__data__.source) : null, target: wire ? id(wire.__data__.target) : null,
      stroke: wire ? hex(getComputedStyle(wire).stroke) : null,
      arrowFill: arrow ? hex(getComputedStyle(arrow).fill) : null,
      arrowAt,
      labelText: label?.querySelector('.edge-label')?.textContent ?? null,
      labelIcon: !icon ? 'missing' : shape(icon) === shape(template.content.firstElementChild) ? 'matches the type' : 'another icon',
    };
  }, { aId, bId, reference: iconMarkup(type) });
}
