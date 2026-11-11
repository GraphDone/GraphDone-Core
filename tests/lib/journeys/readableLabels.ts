import type { Page } from '@playwright/test';

/** The smallest text height, in CSS pixels, that counts as readable. */
export const READABLE_PX = 11;

/**
 * Text a person can actually read in the graph view right now. Text that is
 * only in the DOM does not count: it must be shown (not hidden, not faded below
 * half opacity), at least READABLE_PX tall as rendered, at least partly inside
 * the graph area, and not painted over by anything else: another card, a tile,
 * a panel, a toast or an app control.
 * Each SVG <text> is one label: its readable <tspan> lines joined by spaces.
 */
export async function readableLabels(page: Page): Promise<string[]> {
  return page.evaluate(min => {
    const area = document.querySelector('.graph-container');
    if (!area) return [];
    const box = area.getBoundingClientRect();
    // The app draws labels with pointer-events:none, which hit-testing skips.
    // Make text hittable while measuring so each label shows up in the stack
    // of elements under a point, below whatever is painted over it.
    const probe = document.createElement('style');
    probe.textContent = 'svg text, svg tspan { pointer-events: auto !important; }';
    document.head.appendChild(probe);
    try {
      const opacity = (el: Element | null) => {
        let value = 1;
        for (let node = el; node && node !== document.documentElement; node = node.parentElement) {
          const style = getComputedStyle(node);
          if (style.display === 'none' || style.visibility === 'hidden') return 0;
          value *= Number(style.opacity);
        }
        return value;
      };
      const clear = (colour: string) => colour === 'none' || colour === 'transparent' || /rgba\([^)]*,\s*0\)$/.test(colour);
      // Does this element put paint on the screen (so it hides what is under it)?
      const paints = (el: Element) => {
        const style = getComputedStyle(el);
        if (Number(style.opacity) === 0 || style.visibility === 'hidden') return false;
        if (el instanceof SVGElement) {
          const tag = el.tagName.toLowerCase();
          if (tag === 'text' || tag === 'tspan' || tag === 'image') return true;
          if (['g', 'svg', 'foreignobject', 'defs', 'clippath', 'mask', 'use'].includes(tag)) return false;
          return !clear(style.fill) && Number(style.fillOpacity) > 0.2;
        }
        if (el.tagName === 'IMG' || el.tagName === 'CANVAS' || el.tagName === 'VIDEO') return true;
        const ownText = [...el.childNodes].some(n => n.nodeType === Node.TEXT_NODE && n.textContent?.trim());
        return ownText || !clear(style.backgroundColor);
      };
      const isLabel = (el: Element, hit: Element) =>
        hit === el || el.contains(hit) || (hit.tagName.toLowerCase() === 'text' && hit.contains(el));
      // Covered at a point: something that paints sits above the label there.
      // Points where the label is not hit at all (between glyphs) don't count.
      const coveredAt = (el: Element, x: number, y: number): boolean | null => {
        const stack = document.elementsFromPoint(x, y);
        const at = stack.findIndex(hit => isLabel(el, hit));
        if (at < 0) return null;
        return stack.slice(0, at).some(paints);
      };
      const covered = (el: Element, r: DOMRect) => {
        const points: [number, number][] = [[0.5, 0.5], [0.15, 0.3], [0.85, 0.3], [0.15, 0.7], [0.85, 0.7]];
        const results = points.map(([fx, fy]) => coveredAt(el, r.left + r.width * fx, r.top + r.height * fy));
        const tested = results.filter(result => result !== null);
        // Hidden in the middle, or over half of it hidden.
        return results[0] === true || tested.filter(Boolean).length * 2 > tested.length;
      };
      const out: string[] = [];
      const readable = (el: Element) => {
        const own = [...el.childNodes].filter(n => n.nodeType === Node.TEXT_NODE).map(n => n.textContent ?? '').join('').trim();
        if (!own) return '';
        const r = el.getBoundingClientRect();
        if (r.height < min || r.width <= 0) return '';
        if (r.right <= box.left || r.left >= box.right || r.bottom <= box.top || r.top >= box.bottom) return '';
        if (opacity(el) <= 0.5 || covered(el, r)) return '';
        return own;
      };
      for (const text of area.querySelectorAll('svg text')) {
        const lines = text.querySelector('tspan') ? [...text.querySelectorAll('tspan')].map(readable) : [readable(text)];
        const label = lines.filter(Boolean).join(' ');
        if (label) out.push(label);
      }
      for (const el of area.querySelectorAll('foreignObject *')) {
        const label = readable(el);
        if (label) out.push(label);
      }
      return out;
    } finally {
      probe.remove();
    }
  }, READABLE_PX);
}
