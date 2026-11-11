import type { Page } from '@playwright/test';

/**
 * Reads every relationship (edge) label the graph view draws, with geometry
 * from the DOM as the browser painted it, and says whether a person can read
 * it. A label box is the rotated `.edge-label-bg` rectangle in screen pixels.
 *
 * For each drawn edge (its line is painted):
 * - `shown`: its label is painted (displayed, opacity at least 0.5);
 * - `inView`: both of its cards lie completely inside the graph area and
 *   neither they nor the line between them is under a graph control (the
 *   controls, MiniMap and notes the renderer keeps labels off), so the whole
 *   edge is on screen and its label has to be shown;
 * - `underControls`: both cards are inside the graph area but a control
 *   covers a card or the line; recorded, not required to show a label;
 * - `cards`: ids of every card whose box intersects the label (any card, not
 *   only the edge's own two);
 * - `labels`: ids of the other shown labels whose box intersects this one;
 * - `hit`: `elementFromPoint` at the label's centre lands on the label itself;
 * - `inGap`: the label lies alongside the visible part of its own edge, the
 *   line between the two cards' borders;
 * - `textPx`: the label text's font size on screen, in CSS pixels.
 *
 * `offScreenCards` counts the cards not wholly inside the graph area or
 * under a control: with none, the whole graph is on screen.
 *
 * Boxes that only touch (within half a pixel) do not count as overlapping.
 */
export interface AuditedLabel {
  id: string;
  type: string;
  text: string;
  source: string;
  target: string;
  /** Card titles, for messages. */
  sourceTitle: string;
  targetTitle: string;
  shown: boolean;
  inView: boolean;
  underControls: boolean;
  cards: string[];
  labels: string[];
  hit: boolean;
  inGap: boolean;
  textPx: number;
  box: { x: number; y: number }[];
}

export interface LabelAudit {
  scale: number;
  cards: number;
  drawnEdges: number;
  inViewEdges: number;
  underControls: number;
  shownLabels: number;
  offScreenCards: number;
  labels: AuditedLabel[];
}

export interface LabelProblems {
  /** In-view edges whose label is not shown. */
  hidden: string[];
  /** Label/card pairs that intersect. */
  covered: string[];
  /** Label/label pairs that intersect (each pair once). */
  overlapping: string[];
  /** Shown labels whose centre does not hit the label. */
  unreachable: string[];
  /** Shown labels outside the visible gap of their edge. */
  outOfGap: string[];
  /** Shown labels whose text is smaller than READABLE_TEXT_PX on screen. */
  small: string[];
}

/** Smallest label text, in CSS pixels, that counts as readable. */
export const READABLE_TEXT_PX = 11;

export async function auditEdgeLabels(page: Page): Promise<LabelAudit> {
  return page.evaluate(() => {
    type P = { x: number; y: number };
    const area = document.querySelector('.graph-container');
    const svg = area?.querySelector('svg');
    const group = svg?.querySelector('g.main-graph-group');
    if (!area || !svg) return { scale: 0, cards: 0, drawnEdges: 0, inViewEdges: 0, underControls: 0, shownLabels: 0, offScreenCards: 0, labels: [] };
    const scale = Number(/scale\(([^)]+)\)/.exec(group?.getAttribute('transform') ?? '')?.[1] ?? 1);
    const bounds = area.getBoundingClientRect();
    const painted = (el: Element | null) => {
      let opacity = 1;
      for (let node = el; node && node !== document.documentElement; node = node.parentElement) {
        const style = getComputedStyle(node);
        if (style.display === 'none' || style.visibility === 'hidden') return false;
        opacity *= Number(style.opacity);
      }
      return opacity >= 0.5;
    };
    const quad = (rect: SVGGraphicsElement): P[] => {
      const m = rect.getScreenCTM();
      const b = rect.getBBox();
      if (!m) return [];
      return [
        [b.x, b.y], [b.x + b.width, b.y], [b.x + b.width, b.y + b.height], [b.x, b.y + b.height],
      ].map(([x, y]) => new DOMPoint(x, y).matrixTransform(m)).map(p => ({ x: p.x, y: p.y }));
    };
    // Separating-axis test for two convex quads; touching within half a pixel
    // is not an overlap.
    const intersects = (a: P[], b: P[]) => {
      for (const shape of [a, b])
        for (let i = 0; i < shape.length; i++) {
          const p = shape[i], q = shape[(i + 1) % shape.length];
          const nx = q.y - p.y, ny = p.x - q.x, len = Math.hypot(nx, ny);
          if (!len) continue;
          const project = (s: P[]) => s.map(v => (v.x * nx + v.y * ny) / len);
          const pa = project(a), pb = project(b);
          if (Math.max(...pa) <= Math.min(...pb) + 0.5 || Math.max(...pb) <= Math.min(...pa) + 0.5) return false;
        }
      return true;
    };
    // The rectangles the renderer keeps labels off (InteractiveGraphVisualization's
    // uiLabelObstacles), as quads.
    const controls = Array.from(document.querySelectorAll<HTMLElement>('[data-graph-fit-obstacle="true"], [data-lod-controls="true"]'))
      .filter(element => getComputedStyle(element).display !== 'none' && element.getClientRects().length)
      .map(element => element.getBoundingClientRect())
      .filter(rect => rect.width && rect.height)
      .map(rect => [{ x: rect.left, y: rect.top }, { x: rect.right, y: rect.top }, { x: rect.right, y: rect.bottom }, { x: rect.left, y: rect.bottom }]);
    const lineQuad = (a: P, b: P): P[] => [a, b, b, a];
    const inside = (s: P[]) => s.every(p => p.x >= bounds.left - 0.5 && p.x <= bounds.right + 0.5 && p.y >= bounds.top - 0.5 && p.y <= bounds.bottom + 0.5);

    const cards = new Map<string, P[]>();
    const titles = new Map<string, string>();
    for (const node of area.querySelectorAll<SVGGElement>('.nodes-group .node')) {
      const bg = node.querySelector<SVGRectElement>('.node-bg');
      const datum = (node as unknown as { __data__?: { id?: string; title?: string } }).__data__;
      const id = datum?.id;
      if (!bg || !id || !painted(node)) continue;
      cards.set(id, quad(bg));
      titles.set(id, datum?.title ?? id);
    }
    const labelGroups = new Map<string, SVGGElement>();
    for (const el of area.querySelectorAll<SVGGElement>('.edge-label-group')) labelGroups.set(el.dataset.edgeId ?? '', el);

    const labels: (AuditedLabel & { line?: [P, P] })[] = [];
    for (const path of area.querySelectorAll<SVGPathElement>('.edges-group .edge')) {
      const id = path.dataset.edgeId ?? '';
      const datum = (path as unknown as { __data__?: { type?: string; source?: { id?: string }; target?: { id?: string } } }).__data__;
      const length = path.getTotalLength?.() ?? 0;
      if (!painted(path) || getComputedStyle(path).stroke === 'none' || !(length > 1)) continue;
      const m = path.getScreenCTM();
      if (!m) continue;
      const a = new DOMPoint(path.getPointAtLength(0).x, path.getPointAtLength(0).y).matrixTransform(m);
      const b = new DOMPoint(path.getPointAtLength(length).x, path.getPointAtLength(length).y).matrixTransform(m);
      const source = datum?.source?.id ?? '', target = datum?.target?.id ?? '';
      const label = labelGroups.get(id);
      const bg = label?.querySelector<SVGRectElement>('.edge-label-bg');
      const shown = !!label && !!bg && painted(label);
      const sourceCard = cards.get(source), targetCard = cards.get(target);
      const onScreen = !!sourceCard && !!targetCard && inside(sourceCard) && inside(targetCard);
      const covered = onScreen && controls.some(control =>
        intersects(control, sourceCard!) || intersects(control, targetCard!) || intersects(control, lineQuad({ x: a.x, y: a.y }, { x: b.x, y: b.y })));
      labels.push({
        id, type: datum?.type ?? '', text: label?.querySelector('.edge-label')?.textContent ?? '',
        source, target, sourceTitle: titles.get(source) ?? source, targetTitle: titles.get(target) ?? target, shown,
        inView: onScreen && !covered,
        underControls: covered,
        cards: [], labels: [], hit: false, inGap: false, textPx: 0,
        box: shown ? quad(bg!) : [],
        line: [{ x: a.x, y: a.y }, { x: b.x, y: b.y }],
      });
    }
    const shown = labels.filter(l => l.shown && l.box.length === 4);
    for (const label of shown) {
      for (const [id, card] of cards) if (intersects(label.box, card)) label.cards.push(id);
      for (const other of shown) if (other !== label && intersects(label.box, other.box)) label.labels.push(other.id);
      const cx = label.box.reduce((s, p) => s + p.x, 0) / 4, cy = label.box.reduce((s, p) => s + p.y, 0) / 4;
      const hitEl = document.elementFromPoint(cx, cy);
      label.hit = !!hitEl && hitEl.closest('.edge-label-group') === labelGroups.get(label.id);
      const text = labelGroups.get(label.id)?.querySelector<SVGGraphicsElement>('.edge-label');
      const ctm = text?.getScreenCTM();
      label.textPx = text && ctm ? parseFloat(getComputedStyle(text).fontSize) * Math.hypot(ctm.a, ctm.b) : 0;
      const [a, b] = label.line!;
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      const ux = (b.x - a.x) / len, uy = (b.y - a.y) / len;
      label.inGap = len > 0 && label.box.every(p => {
        const along = (p.x - a.x) * ux + (p.y - a.y) * uy;
        return along >= -0.5 && along <= len + 0.5;
      });
    }
    for (const label of labels) delete label.line;
    const offScreenCards = [...cards.values()].filter(card => !inside(card) || controls.some(control => intersects(control, card))).length;
    return {
      scale,
      cards: cards.size,
      drawnEdges: labels.length,
      inViewEdges: labels.filter(l => l.inView).length,
      underControls: labels.filter(l => l.underControls).length,
      shownLabels: shown.length,
      offScreenCards,
      labels,
    };
  });
}

/**
 * How spread out the layout is, in graph units (independent of the camera):
 * the area of the box around every card, and the mean edge length centre to
 * centre and border to border (the visible line).
 */
export async function layoutSpread(page: Page) {
  return page.evaluate(() => {
    let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity;
    for (const node of document.querySelectorAll<SVGGElement>('.graph-container .nodes-group .node')) {
      const d = (node as unknown as { __data__?: { x?: number; y?: number } }).__data__;
      const box = node.querySelector<SVGRectElement>('.node-bg')?.getBBox();
      if (!d || !box || typeof d.x !== 'number' || typeof d.y !== 'number') continue;
      left = Math.min(left, d.x + box.x); right = Math.max(right, d.x + box.x + box.width);
      top = Math.min(top, d.y + box.y); bottom = Math.max(bottom, d.y + box.y + box.height);
    }
    const centre: number[] = [], visible: number[] = [];
    for (const path of document.querySelectorAll<SVGPathElement>('.graph-container .edges-group .edge')) {
      const d = (path as unknown as { __data__?: { source?: { x?: number; y?: number }; target?: { x?: number; y?: number } } }).__data__;
      if (!d?.source || !d.target || typeof d.source.x !== 'number' || typeof d.target.x !== 'number') continue;
      centre.push(Math.hypot(d.target.x - d.source.x, (d.target.y ?? 0) - (d.source.y ?? 0)));
      visible.push(path.getTotalLength?.() ?? 0);
    }
    const mean = (list: number[]) => list.length ? Math.round(list.reduce((s, v) => s + v, 0) / list.length) : 0;
    return {
      width: Math.round(right - left),
      height: Math.round(bottom - top),
      area: Math.round(((right - left) * (bottom - top)) / 1000) * 1000,
      meanEdge: mean(centre),
      meanVisibleEdge: mean(visible),
    };
  });
}

/** What is wrong with an audit: empty lists mean every label is readable. */
export function labelProblems(audit: LabelAudit): LabelProblems {
  const shown = audit.labels.filter(l => l.shown);
  const name = (l: AuditedLabel) => `${l.text || l.type} (${l.sourceTitle} → ${l.targetTitle})`;
  return {
    hidden: audit.labels.filter(l => l.inView && !l.shown).map(name),
    covered: shown.flatMap(l => l.cards.map(card => `${name(l)} under card ${card}`)),
    overlapping: shown.flatMap(l => l.labels.filter(other => l.id < other).map(other => {
      const peer = audit.labels.find(p => p.id === other)!;
      return `${name(l)} × ${name(peer)}`;
    })),
    unreachable: shown.filter(l => !l.hit).map(name),
    outOfGap: shown.filter(l => !l.inGap).map(name),
    small: shown.filter(l => l.textPx < READABLE_TEXT_PX).map(name),
  };
}

export function problemCount(problems: LabelProblems): number {
  return Object.values(problems).reduce((sum, list) => sum + list.length, 0);
}
