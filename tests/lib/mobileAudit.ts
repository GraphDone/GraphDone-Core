import { Page } from '@playwright/test';

/**
 * Reusable mobile-UI auditors. These run in the browser and return structured
 * findings so specs can assert "no problems" across every route/dialog instead
 * of someone eyeballing screenshots. They encode the bug classes we keep hitting:
 *   - layout: horizontal page overflow, swipe-sideways scroll containers,
 *     labels squeezed to an unreadable width.
 *   - contrast: text that is (nearly) invisible against its background — e.g. the
 *     `dark:` variants not applying on a light-OS device → black-on-dark.
 *   - dialogs: modals that don't fit the viewport or are painted under the nav.
 */

export interface LayoutFindings {
  pageOverflowPx: number;
  sideScroll: { tag: string; cls: string; scrollW: number; clientW: number }[];
  squeezed: { tag: string; cls: string; clientW: number; txt: string }[];
}

export interface ContrastFinding {
  txt: string;
  color: string;
  ratio: number;
  tag: string;
  cls: string;
}

export async function auditLayout(page: Page, rootSelector = 'body'): Promise<LayoutFindings> {
  return page.evaluate((sel) => {
    const root = document.querySelector(sel) || document.body;
    const vw = window.innerWidth;
    const sideScroll: LayoutFindings['sideScroll'] = [];
    const squeezed: LayoutFindings['squeezed'] = [];
    root.querySelectorAll('*').forEach((d) => {
      const e = d as HTMLElement;
      const cs = getComputedStyle(e);
      if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return;
      const r = e.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      const cw = e.clientWidth;
      const sw = e.scrollWidth;
      // A horizontally-scrollable box with clipped content forces sideways swiping —
      // unless it's explicitly opted out (e.g. a wide data table on an admin page),
      // marked with data-audit-scroll-ok so the exception is greppable.
      if ((cs.overflowX === 'auto' || cs.overflowX === 'scroll') && cw > 0 && sw > cw + 16 && !e.closest('[data-audit-scroll-ok]')) {
        sideScroll.push({ tag: e.tagName, cls: (e.className?.toString?.() || '').slice(0, 48), scrollW: sw, clientW: cw });
      }
      // A multi-character leaf label collapsed to ~nothing is unreadable.
      const txt = (e.textContent || '').trim();
      if (e.children.length === 0 && txt.length > 2 && cw > 0 && cw < 12) {
        squeezed.push({ tag: e.tagName, cls: (e.className?.toString?.() || '').slice(0, 48), clientW: cw, txt: txt.slice(0, 16) });
      }
    });
    return {
      pageOverflowPx: document.documentElement.scrollWidth - vw,
      sideScroll: sideScroll.slice(0, 8),
      squeezed: squeezed.slice(0, 8),
    };
  }, rootSelector);
}

/**
 * Flags text whose contrast against its (effective) background is below `minRatio`.
 * Default 3.0 is a "severe" gate — it reliably catches invisible/near-invisible
 * text (black-on-dark ≈ 1.2) without false-flagging legitimate muted grays (≈ 4-7).
 */
export async function auditContrast(page: Page, rootSelector = 'body', minRatio = 3.0): Promise<ContrastFinding[]> {
  return page.evaluate(({ sel, minRatio }) => {
    const root = document.querySelector(sel) || document.body;
    const parse = (c: string) => {
      const m = c.match(/rgba?\(([^)]+)\)/);
      if (!m) return null;
      const p = m[1].split(',').map((s) => parseFloat(s));
      return { r: p[0], g: p[1], b: p[2], a: p[3] === undefined ? 1 : p[3] };
    };
    const lum = ({ r, g, b }: { r: number; g: number; b: number }) => {
      const f = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const ratio = (a: any, b: any) => { const L1 = lum(a), L2 = lum(b); return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05); };
    const blend = (fg: any, bg: any) => ({ r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a), a: 1 });
    const effBg = (el: Element) => {
      let n: Element | null = el;
      while (n) {
        const bg = parse(getComputedStyle(n).backgroundColor);
        if (bg && bg.a > 0.5) return bg;
        n = n.parentElement;
      }
      return { r: 17, g: 24, b: 39, a: 1 }; // app surface fallback (gray-900)
    };
    const findings: any[] = [];
    const seen = new Set<string>();
    root.querySelectorAll('*').forEach((el) => {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return;
      if (el.closest('svg')) return; // graph text handled elsewhere
      // Gradient text (bg-clip-text) has a transparent `color`; the gradient is the
      // visible fill, so contrast can't be measured from `color` — skip it.
      const clip = (cs as any).backgroundClip || (cs as any).webkitBackgroundClip;
      if (clip === 'text') return;
      const hasOwnText = [...el.childNodes].some((n) => n.nodeType === 3 && (n.textContent || '').trim().length > 1);
      if (!hasOwnText) return;
      const r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) return;
      let fg = parse(cs.color);
      if (!fg) return;
      const bg = effBg(el);
      if (fg.a < 1) fg = blend(fg, bg);
      const cr = ratio(fg, bg);
      if (cr < minRatio) {
        const txt = (el.textContent || '').trim().slice(0, 24);
        const key = txt + '|' + cs.color;
        if (seen.has(key)) return;
        seen.add(key);
        findings.push({ txt, color: cs.color, ratio: Math.round(cr * 100) / 100, tag: el.tagName, cls: (el.className?.toString?.() || '').slice(0, 40) });
      }
    });
    return findings.slice(0, 12);
  }, { sel: rootSelector, minRatio });
}

/**
 * For an open dialog: is its panel within the viewport AND actually on top
 * (not painted under the bottom nav / a sibling stacking context)?
 */
export async function auditDialog(page: Page, panelTextMatch: string) {
  return page.evaluate((match) => {
    const vw = window.innerWidth, vh = window.innerHeight;
    // The overlay = a fixed, ~full-viewport container holding the dialog text.
    const overlays = [...document.querySelectorAll('div')].filter((d) => {
      const cs = getComputedStyle(d);
      const r = d.getBoundingClientRect();
      return cs.position === 'fixed' && r.width >= vw * 0.9 && r.height >= vh * 0.9 && (d.textContent || '').includes(match);
    });
    if (!overlays.length) return { found: false } as any;
    const overlay = overlays[overlays.length - 1]; // innermost (the dialog root)
    // The card = the largest descendant with a visible background that holds the
    // text (the panel itself), so we can check it fits the viewport.
    let card: HTMLElement | null = null;
    let best = 0;
    overlay.querySelectorAll('*').forEach((d) => {
      const e = d as HTMLElement;
      if (!(e.textContent || '').includes(match)) return;
      const cs = getComputedStyle(e);
      const r = e.getBoundingClientRect();
      const hasBg = !/rgba\(0, 0, 0, 0\)|transparent/.test(cs.backgroundColor) || /gradient|url/.test(cs.backgroundImage);
      const area = r.width * r.height;
      if (hasBg && area > best && area <= vw * vh * 1.02) { best = area; card = e; }
    });
    const rect = (card || overlay).getBoundingClientRect();
    const cx = Math.min(Math.max(rect.left + rect.width / 2, 1), vw - 1);
    // On-top: at points down the dialog's column (incl. the very bottom, where the
    // nav would intrude), the topmost element must belong to the overlay.
    const ys = [rect.top + 8, (rect.top + rect.bottom) / 2, Math.min(rect.bottom - 8, vh - 8), vh - 4];
    let coveredBy: string | null = null;
    for (const y of ys) {
      if (y < 1 || y > vh - 1) continue;
      const top = document.elementFromPoint(cx, y);
      if (top && !overlay.contains(top) && top !== overlay) {
        coveredBy = top.tagName + '.' + (top.className?.toString?.() || '').slice(0, 40);
        break;
      }
    }
    return {
      found: true,
      fitsWidth: rect.left >= -1 && rect.right <= vw + 1,
      fitsHeight: rect.top >= -1 && rect.bottom <= vh + 1,
      coveredBy,
    };
  }, panelTextMatch);
}
