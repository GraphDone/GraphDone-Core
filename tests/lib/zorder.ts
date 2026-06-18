import { Page } from '@playwright/test';

/**
 * Z-order / stacking auditors. The core test: an overlay that is meant to float
 * on top (dropdown, modal panel, menu, toast, select) must ACTUALLY be the
 * topmost element across its own area — `document.elementFromPoint` at points
 * inside it must return the overlay (or a descendant). If it returns something
 * else, that element is painted over the overlay → a z-order bug (the symptom the
 * user sees: a dropdown/menu/alert appearing behind the nav, a panel, etc.).
 */

export interface OnTopFinding {
  found: boolean;
  empty?: boolean;
  fitsViewport?: boolean;
  rect?: { x: number; y: number; w: number; h: number };
  // Points inside the overlay where a DIFFERENT element is on top (the occluders).
  coveredBy?: { x: number; y: number; tag: string; cls: string; id: string }[];
}

/**
 * Assert the element at `selector` (the visible overlay PANEL — not a transparent
 * backdrop) is on top wherever it's drawn. Samples a 3×3 grid inset from the edges
 * (avoids anti-aliased borders / rounded corners).
 */
export async function auditOnTop(page: Page, selector: string): Promise<OnTopFinding> {
  return page.evaluate((sel) => {
    const vw = window.innerWidth, vh = window.innerHeight;
    const el = document.querySelector(sel) as HTMLElement | null;
    if (!el) return { found: false };
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return { found: true, empty: true, fitsViewport: false, coveredBy: [] };
    const fitsViewport = r.left >= -2 && r.top >= -2 && r.right <= vw + 2 && r.bottom <= vh + 2;
    const inset = 6;
    const xs = [r.left + inset, (r.left + r.right) / 2, r.right - inset];
    const ys = [r.top + inset, (r.top + r.bottom) / 2, r.bottom - inset];
    const coveredBy: OnTopFinding['coveredBy'] = [];
    const seen = new Set<string>();
    for (const x of xs) for (const y of ys) {
      const cx = Math.min(Math.max(x, 1), vw - 1);
      const cy = Math.min(Math.max(y, 1), vh - 1);
      if (cx < 0 || cy < 0 || cx > vw || cy > vh) continue;
      const top = document.elementFromPoint(cx, cy) as HTMLElement | null;
      if (!top) continue;
      if (top === el || el.contains(top)) continue; // overlay is on top here — good
      const cls = (top.className?.toString?.() || '').slice(0, 50);
      const key = top.tagName + '|' + cls + '|' + (top.id || '');
      if (seen.has(key)) continue;
      seen.add(key);
      coveredBy!.push({ x: Math.round(cx), y: Math.round(cy), tag: top.tagName, cls, id: top.id || '' });
    }
    return { found: true, fitsViewport, coveredBy, rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } };
  }, selector);
}

/**
 * Snapshot of every positioned element with an explicit z-index — for debugging
 * the stacking landscape and spotting elements whose high z-index is trapped in a
 * local stacking context (an ancestor with transform/opacity/filter/will-change or
 * its own z-index).
 */
export async function stackingSnapshot(page: Page, rootSelector = 'body') {
  return page.evaluate((sel) => {
    const root = document.querySelector(sel) || document.body;
    const createsContext = (e: Element) => {
      const cs = getComputedStyle(e);
      if (cs.position !== 'static' && cs.zIndex !== 'auto') return true;
      if (cs.transform !== 'none' || cs.filter !== 'none' || cs.perspective !== 'none') return true;
      if (cs.willChange && /transform|opacity|filter/.test(cs.willChange)) return true;
      if (+cs.opacity < 1) return true;
      if (cs.mixBlendMode && cs.mixBlendMode !== 'normal') return true;
      if (cs.isolation === 'isolate') return true;
      return false;
    };
    const out: { tag: string; cls: string; z: string; pos: string; trappedUnder: string | null }[] = [];
    root.querySelectorAll('*').forEach((el) => {
      const cs = getComputedStyle(el);
      if (cs.zIndex === 'auto' || cs.position === 'static') return;
      const r = (el as HTMLElement).getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      // Find the nearest ancestor that establishes a stacking context (excluding the root html/body).
      let trappedUnder: string | null = null;
      let n = el.parentElement;
      while (n && n !== document.body && n !== document.documentElement) {
        if (createsContext(n)) { trappedUnder = n.tagName + '.' + (n.className?.toString?.() || '').slice(0, 40); break; }
        n = n.parentElement;
      }
      out.push({ tag: el.tagName, cls: (el.className?.toString?.() || '').slice(0, 50), z: cs.zIndex, pos: cs.position, trappedUnder });
    });
    return out.sort((a, b) => (parseInt(b.z, 10) || 0) - (parseInt(a.z, 10) || 0)).slice(0, 60);
  }, rootSelector);
}
