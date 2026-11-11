import type { Page } from '@playwright/test';

/** The smallest text height, in CSS pixels, that counts as readable. */
export const READABLE_PX = 11;

/**
 * Text a person can actually read in the graph view right now. Text that is
 * only in the DOM does not count: it must be shown (not hidden, not faded below
 * half opacity), at least READABLE_PX tall as rendered, at least partly inside
 * the graph area, and not under an app control such as a toolbar or dialog.
 * Each SVG <text> is one label: its readable <tspan> lines joined by spaces.
 */
export async function readableLabels(page: Page): Promise<string[]> {
  return page.evaluate(min => {
    const area = document.querySelector('.graph-container');
    if (!area) return [];
    const box = area.getBoundingClientRect();
    const opacity = (el: Element | null) => {
      let value = 1;
      for (let node = el; node && node !== document.documentElement; node = node.parentElement) {
        const style = getComputedStyle(node);
        if (style.display === 'none' || style.visibility === 'hidden') return 0;
        value *= Number(style.opacity);
      }
      return value;
    };
    const covered = (el: Element, r: DOMRect) => {
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      if (!hit || hit === el || el.contains(hit) || hit.contains(el) || hit.closest('svg')) return false;
      return !!hit.closest('button, [role="dialog"], nav, header, aside, [data-minimap]');
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
  }, READABLE_PX);
}
