// Browser-side measurement for the UI fit suite. Both functions are passed to
// page.evaluate(), so each must be self-contained (no imports or closures).

/**
 * Measure every visible interactive control on the page.
 * Returns plain data; rules.mjs decides what is a problem.
 */
export function collectControls() {
  const SELECTOR = [
    'button', 'a[href]', 'summary', 'select', 'textarea',
    'input:not([type="hidden"])',
    '[role="button"]', '[role="link"]', '[role="tab"]', '[role="menuitem"]', '[role="option"]',
    '[role="checkbox"]', '[role="radio"]', '[role="switch"]', '[role="combobox"]',
  ].join(',');
  const GLYPH = /^[^\p{L}\p{N}\s]{1,2}$/u;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const OVERLAY = '[role="dialog"], [role="alertdialog"], [aria-modal="true"], dialog[open], [data-modal-backdrop], [role="menu"], [role="listbox"], [role="tooltip"]';
  const isHidden = el => {
    if (el.closest('[aria-hidden="true"], [inert], .sr-only')) return true;
    // Content of a closed <details> keeps a layout box in some engines but is not drawn.
    const details = el.closest('details:not([open])');
    if (details && !el.closest('summary')) return true;
    if (el.checkVisibility && !el.checkVisibility({ opacityProperty: true, visibilityProperty: true, contentVisibilityAuto: true })) return true;
    let opacity = 1;
    for (let node = el; node && node.nodeType === 1; node = node.parentElement) {
      const css = getComputedStyle(node);
      if (css.display === 'none' || css.visibility === 'hidden') return true;
      opacity *= Number(css.opacity);
    }
    return opacity < 0.1;
  };

  // The part of `rect` not clipped away by scrolling ancestors or the viewport.
  const visibleRect = (el, rect) => {
    let left = Math.max(rect.left, 0), top = Math.max(rect.top, 0);
    let right = Math.min(rect.right, vw), bottom = Math.min(rect.bottom, vh);
    for (let node = el.parentElement; node && node !== document.body; node = node.parentElement) {
      const css = getComputedStyle(node);
      if (/(auto|scroll|hidden|clip)/.test(css.overflowX + css.overflowY)) {
        const clip = node.getBoundingClientRect();
        left = Math.max(left, clip.left); top = Math.max(top, clip.top);
        right = Math.min(right, clip.right); bottom = Math.min(bottom, clip.bottom);
      }
    }
    return { left, top, right, bottom, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
  };

  const textOf = node => (node?.textContent || '').replace(/\s+/g, ' ').trim();
  const accessibleName = el => {
    const label = el.getAttribute('aria-label');
    if (label?.trim()) return label.trim();
    const labelledBy = el.getAttribute('aria-labelledby');
    if (labelledBy) {
      const text = labelledBy.split(/\s+/).map(id => textOf(document.getElementById(id))).join(' ').trim();
      if (text) return text;
    }
    if (el.labels?.length) {
      const text = [...el.labels].map(textOf).join(' ').trim();
      if (text) return text;
    }
    const own = textOf(el) || [...el.querySelectorAll('img[alt]')].map(img => img.alt).join(' ').trim();
    if (own) return own;
    return (el.getAttribute('title') || el.getAttribute('placeholder') || el.querySelector(':scope > title')?.textContent || '').trim();
  };

  // Text the user can see inside the control (HTML text and SVG <text>).
  const visibleText = el => {
    const parts = [];
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const text = node.textContent.trim();
      const parent = node.parentElement;
      // Visual rules judge what is drawn: aria-hidden text is still on screen.
      if (!text || !parent || parent.closest('title, desc, .sr-only')) continue;
      if (getComputedStyle(parent).visibility === 'hidden') continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      const rects = [...range.getClientRects()].filter(r => r.width > 0 && r.height > 0);
      if (rects.length) parts.push({ text, rects, parent });
    }
    return parts;
  };

  const parseColor = value => {
    const m = value.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const [r, g, b, a = 1] = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    return [r, g, b, a];
  };
  // A horizontally scrolling ancestor makes partly hidden controls normal scroll content.
  // A deliberate sideways strip (tabs, a table's columns, a board) overflows
  // on the x axis only. An area that scrolls up and down and has also become
  // wider than the screen is an accident: it is reported (sidewaysScrollers
  // below), and controls pushed out of view inside it still count as cut off.
  // (CSS computes overflow-y: auto whenever overflow-x scrolls, so the test is
  // what actually overflows, not the declared overflow.)
  const scrolls = v => /(auto|scroll)/.test(v);
  const overflowsX = node => scrolls(getComputedStyle(node).overflowX) && node.scrollWidth > node.clientWidth + 1;
  const overflowsY = node => scrolls(getComputedStyle(node).overflowY) && node.scrollHeight > node.clientHeight + 1;
  const inHorizontalScroller = el => {
    // The graph is a pan-and-zoom surface: cards panned past its edge are
    // reached by panning, like a sideways strip.
    if (el.closest('.graph-container svg')) return true;
    for (let node = el.parentElement; node && node !== document.body; node = node.parentElement) {
      if (overflowsX(node) && !overflowsY(node)) return true;
    }
    return false;
  };
  // Is the control drawn over by an open dialog, menu or full-screen backdrop?
  const overlayAbove = (el, hit) => {
    const overlay = hit.closest(OVERLAY);
    if (overlay && !overlay.contains(el)) return true;
    for (let node = hit; node && node !== document.body; node = node.parentElement) {
      if (node.contains(el)) return false;
      const css = getComputedStyle(node);
      if (css.position === 'fixed') {
        const r = node.getBoundingClientRect();
        if (r.width * r.height >= 0.9 * vw * vh) return true;
      }
    }
    return false;
  };

  // Open dialogs, menus and the app's floating panels. Some ignore the pointer
  // (pointer-events: none), so hit-testing alone cannot see that they cover a control.
  const overlays = [...document.querySelectorAll(`${OVERLAY}, [data-graph-fit-obstacle]`)]
    .filter(node => !isHidden(node))
    .map(node => ({ node, rect: node.getBoundingClientRect() }))
    .filter(({ rect }) => rect.width > 0 && rect.height > 0);
  const underOverlay = (el, r) => overlays.some(({ node, rect }) => !node.contains(el)
    && rect.left < r.right && rect.right > r.left && rect.top < r.bottom && rect.bottom > r.top);

  const elements = [...new Set(document.querySelectorAll(SELECTOR))]
    // A control nested in another control (an <a> wrapping a <button>) is judged once, as the outer one.
    .filter(el => !el.parentElement?.closest(SELECTOR) || el.matches('input, select, textarea'));

  const controls = [];
  for (const el of elements) {
    const rect = el.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1 || isHidden(el)) continue;
    const vis = visibleRect(el, rect);
    const visibleFraction = (vis.width * vis.height) / (rect.width * rect.height);
    if (visibleFraction <= 0) continue;

    const isSvg = el instanceof SVGElement;
    // SVG controls draw a background <rect>; on touch devices a larger transparent
    // .touch-hit-area rect may sit under it. The visual box is the drawn rect,
    // the hit area is everything the pointer can reach.
    const drawn = isSvg ? [...el.querySelectorAll(':scope > rect')].find(r => !r.classList.contains('touch-hit-area')) : null;
    const visual = (drawn || el).getBoundingClientRect();

    const text = visibleText(el);
    const allText = text.map(t => t.text).join('');
    const glyphText = GLYPH.test(allText) ? allText : '';
    const iconOnly = (!allText || glyphText) && !!(el.querySelector('svg, img, path') || glyphText || isSvg);

    let textOverflow = 0;
    if (!el.matches('input, select, textarea')) {
      for (const part of text) {
        if (part.parent.closest('.truncate, [class*="line-clamp"]')) continue;
        if (getComputedStyle(part.parent).textOverflow === 'ellipsis') continue;
        for (const r of part.rects) {
          textOverflow = Math.max(textOverflow, visual.left - r.left, r.right - visual.right, visual.top - r.top, r.bottom - visual.bottom);
        }
      }
      if (!isSvg && el.scrollWidth > el.clientWidth + 2 && getComputedStyle(el).overflowX !== 'visible'
        && !el.querySelector('.truncate, [class*="line-clamp"]') && getComputedStyle(el).textOverflow !== 'ellipsis') {
        textOverflow = Math.max(textOverflow, el.scrollWidth - el.clientWidth);
      }
    }
    textOverflow = textOverflow > 2 ? textOverflow : 0;

    // Who receives a tap at the centre of the visible part?
    let coveredBy = '';
    let behindOverlay = false;
    const cx = vis.left + vis.width / 2;
    const cy = vis.top + vis.height / 2;
    const hit = document.elementFromPoint(cx, cy);
    if (hit && hit !== el && !el.contains(hit) && !hit.contains(el)) {
      const owner = hit.closest(SELECTOR);
      const label = el.labels && [...el.labels].some(l => l.contains(hit));
      // Graph cards live on a pan/zoom canvas: one panned under the app's
      // floating controls is out of view, like content scrolled off screen.
      const canvas = el.closest('.graph-container svg');
      if (overlayAbove(el, hit) || (canvas && !canvas.contains(hit))) {
        behindOverlay = true;
      } else if (!label && owner !== el) {
        const name = owner ? (owner.getAttribute('aria-label') || textOf(owner)).slice(0, 40) : '';
        coveredBy = `${hit.tagName.toLowerCase()}${hit.id ? `#${hit.id}` : ''}${name ? ` ("${name}")` : ''}`;
      }
    }

    // Pixel checks need the whole control in view: sample a 5×5 grid over it
    // (a rounded panel corner can hide part of a button but miss its corners).
    const owns = node => !!node && (node === el || el.contains(node) || node.contains(el));
    const grid = [];
    for (let i = 0; i < 5; i++) {
      for (let j = 0; j < 5; j++) grid.push([visual.left + 1 + (visual.width - 2) * i / 4, visual.top + 1 + (visual.height - 2) * j / 4]);
    }
    const unobstructed = !coveredBy && !behindOverlay && !underOverlay(el, visual) && grid.every(([x, y]) => x >= 0 && y >= 0 && x < vw && y < vh && owns(document.elementFromPoint(x, y)));

    const inlineLink = el.matches('a') && !!el.closest('p, li') && getComputedStyle(el).display === 'inline';
    const clippedX = rect.width <= vw && !inHorizontalScroller(el) ? Math.max(0, -rect.left, rect.right - vw) : 0;

    // Where the icon artwork is drawn: the <svg>/<img> of an HTML control, the
    // non-background shapes of an SVG control, or the line box of a text glyph.
    let iconBox = null;
    if (iconOnly) {
      let parts = [];
      if (isSvg) parts = [...el.children].filter(c => !['rect', 'title', 'desc'].includes(c.tagName.toLowerCase()));
      else parts = [...el.querySelectorAll('svg, img')].filter(c => !c.parentElement.closest('svg'));
      const rects = parts.map(c => c.getBoundingClientRect()).filter(r => r.width > 0 && r.height > 0);
      if (!rects.length && glyphText) rects.push(...text.flatMap(t => t.rects));
      if (rects.length) {
        const left = Math.min(...rects.map(r => r.left)), top = Math.min(...rects.map(r => r.top));
        const right = Math.max(...rects.map(r => r.right)), bottom = Math.max(...rects.map(r => r.bottom));
        iconBox = { x: left, y: top, width: right - left, height: bottom - top };
      }
    }

    // Text colours, for contrast against the rendered background. Disabled
    // controls are exempt (WCAG 1.4.3); a <select> shows its value as text.
    const disabled = el.disabled === true || el.getAttribute('aria-disabled') === 'true';
    const textColors = disabled ? [] : [...new Set(
      (el.matches('select') ? [el] : text.filter(t => !glyphText).map(t => t.parent)).map(node => getComputedStyle(node).color),
    )].map(parseColor).filter(c => c && c[3] >= 0.5);

    controls.push({
      tag: el.tagName.toLowerCase(),
      role: el.getAttribute('role') || ({ a: 'link', select: 'combobox', textarea: 'textbox', summary: 'button' })[el.tagName.toLowerCase()]
        || (el.matches('input') ? `input-${el.type}` : el.tagName.toLowerCase()),
      name: accessibleName(el).slice(0, 120),
      rect: { x: rect.left, y: rect.top, width: rect.width, height: rect.height },
      visual: { x: visual.left, y: visual.top, width: visual.width, height: visual.height },
      hit: { x: rect.left, y: rect.top, width: rect.width, height: rect.height },
      visibleFraction,
      behindOverlay,
      unobstructed,
      iconOnly: !!iconOnly,
      iconBox,
      textColors,
      glyphText,
      textOverflow,
      coveredBy,
      inlineLink,
      clippedX,
    });
  }
  // Things that look clickable (pointer cursor) but are not controls: a mouse
  // can use them, a keyboard or screen reader cannot. Report the outermost
  // such element (its children inherit the cursor). A pointer region that
  // holds real controls (a graph card with header buttons) is not itself
  // reported, but anything inside it that sets its own pointer cursor is.
  const clickables = [];
  const pointerOnly = new Set();
  const setsOwnPointer = el => (el.style && el.style.cursor === 'pointer') || el.classList.contains('cursor-pointer');
  for (const node of document.body.querySelectorAll('*')) {
    if (node.closest(SELECTOR) || node.closest('label, #ui-fit-overlay')) continue;
    const css = getComputedStyle(node);
    if (css.cursor !== 'pointer' || css.pointerEvents === 'none') continue;
    if (node.querySelector(SELECTOR)) continue;
    pointerOnly.add(node);
    let reported = false;
    for (let up = node.parentElement; up && !reported; up = up.parentElement) reported = pointerOnly.has(up);
    if (reported) continue;
    const parentPointer = node.parentElement && getComputedStyle(node.parentElement).cursor === 'pointer';
    if (parentPointer && !setsOwnPointer(node)) continue;
    const r = node.getBoundingClientRect();
    if (r.width < 1 || r.height < 1 || isHidden(node)) continue;
    const vis = visibleRect(node, r);
    if ((vis.width * vis.height) / (r.width * r.height) < 0.5) continue;
    const cls = (node.getAttribute('class') || '').trim().split(/\s+/)[0];
    const testId = node.getAttribute('data-testid');
    clickables.push({
      tag: node.tagName.toLowerCase(),
      name: `${node.tagName.toLowerCase()}${testId ? `[${testId}]` : cls ? `.${cls}` : ''} "${(node.getAttribute('aria-label') || node.querySelector(':scope > title')?.textContent || textOf(node)).slice(0, 40)}"`,
    });
  }

  // Areas that scroll their content up and down but show only a sliver of it
  // (MIN_SCROLL_ROOM in rules.mjs).
  const crampedScrollers = [];
  for (const node of document.body.querySelectorAll('*')) {
    if (node.closest('#ui-fit-overlay, select, textarea') || !overflowsY(node)) continue;
    const r = node.getBoundingClientRect();
    if (r.width < 1 || r.bottom <= 0 || r.top >= vh || isHidden(node)) continue;
    const shown = Math.min(r.bottom, vh) - Math.max(r.top, 0);
    if (shown >= 120) continue;
    const cls = (node.getAttribute('class') || '').trim().split(/\s+/)[0];
    crampedScrollers.push({ name: `${node.tagName.toLowerCase()}${cls ? `.${cls}` : ''}`, height: Math.round(shown) });
  }

  const sidewaysScrollers = [];
  for (const node of document.body.querySelectorAll('*')) {
    if (node.closest('#ui-fit-overlay')) continue;
    if (!overflowsX(node) || !overflowsY(node)) continue;
    const r = node.getBoundingClientRect();
    if (r.width < 1 || r.height < 1 || isHidden(node)) continue;
    const cls = (node.getAttribute('class') || '').trim().split(/\s+/)[0];
    const testId = node.getAttribute('data-testid');
    sidewaysScrollers.push({
      name: `${node.tagName.toLowerCase()}${testId ? `[${testId}]` : cls ? `.${cls}` : ''}`,
      overflow: node.scrollWidth - node.clientWidth,
    });
  }

  // Dialogs, sheets and peek panels must paint their own background: a class
  // the CSS build does not know (an opacity step like /98) leaves none, and
  // the page shows through the text. Opacity is the weakest alpha among the
  // background colour and every gradient stop; a full-screen dialog wrapper is
  // judged by the panel inside it that covers most of it.
  const alphaOf = color => {
    if (!color || color === 'transparent') return 0;
    const m = color.match(/rgba?\(([^)]+)\)/);
    if (!m) return 1;
    const parts = m[1].split(/[\s,/]+/).filter(Boolean);
    return parts.length > 3 ? Number(parts[3]) : 1;
  };
  const surfaceAlpha = el => {
    const style = getComputedStyle(el);
    const stops = (style.backgroundImage || '').match(/rgba?\([^)]+\)/g);
    const fromGradient = stops ? Math.min(...stops.map(alphaOf)) : 0;
    return Math.max(alphaOf(style.backgroundColor), fromGradient);
  };
  const seeThroughPanels = [];
  for (const panel of document.querySelectorAll('[data-modal-panel], [role="dialog"], [role="alertdialog"], [data-testid="node-inspector"]')) {
    if (panel.closest('#ui-fit-overlay') || isHidden(panel)) continue;
    const r = panel.getBoundingClientRect();
    if (r.width < 1 || r.height < 1 || r.bottom <= 0 || r.top >= vh) continue;
    if (panel.querySelector('[data-modal-panel]')) continue; // judged by its panel
    let alpha = surfaceAlpha(panel);
    if (alpha < 0.85) {
      // A wrapper whose first child paints the panel (covers 90% of it).
      for (const child of panel.children) {
        const c = child.getBoundingClientRect();
        if (c.width * c.height >= 0.9 * r.width * r.height) alpha = Math.max(alpha, surfaceAlpha(child));
      }
    }
    if (alpha >= 0.85) continue;
    const label = panel.getAttribute('aria-label')
      || (panel.getAttribute('aria-labelledby') && document.getElementById(panel.getAttribute('aria-labelledby'))?.textContent?.trim())
      || panel.querySelector('h1, h2, h3')?.textContent?.trim()
      || panel.getAttribute('data-testid') || panel.tagName.toLowerCase();
    seeThroughPanels.push({ name: label.slice(0, 60), alpha: Math.round(alpha * 100) / 100 });
  }

  return {
    controls,
    clickables,
    sidewaysScrollers,
    crampedScrollers,
    seeThroughPanels,
    page: { scrollWidth: document.documentElement.scrollWidth, innerWidth: vw, innerHeight: vh, dpr: window.devicePixelRatio },
  };
}

/**
 * Pixel measurements from a screenshot of the page (`png`, base64).
 *  - ink: for each {crop, box}, where the icon's ink inside `crop` sits
 *    relative to the centre of `box` → {dx, dy} in CSS px, or null.
 *  - background: for each box, the colour drawn behind its content → [r, g, b].
 * The background of a region is the most common colour on a ring just inside
 * its edge; ink is every pixel that clearly differs from it.
 */
export async function measurePixels({ png, ink, background, inset }) {
  const bytes = Uint8Array.from(atob(png), ch => ch.charCodeAt(0));
  const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bitmap, 0, 0);
  const scale = bitmap.width / window.innerWidth;

  const region = (box, pad) => {
    const x0 = Math.max(0, Math.round((box.x + pad) * scale));
    const y0 = Math.max(0, Math.round((box.y + pad) * scale));
    const x1 = Math.min(bitmap.width, Math.round((box.x + box.width - pad) * scale));
    const y1 = Math.min(bitmap.height, Math.round((box.y + box.height - pad) * scale));
    const w = x1 - x0, h = y1 - y0;
    if (w < 4 || h < 4) return null;
    return { x0, y0, w, h, data: ctx.getImageData(x0, y0, w, h).data };
  };
  const ringColor = ({ w, h, data }) => {
    const counts = new Map();
    const tally = (x, y) => {
      const i = (y * w + x) * 4;
      const key = ((data[i] >> 3) << 10) | ((data[i + 1] >> 3) << 5) | (data[i + 2] >> 3);
      counts.set(key, (counts.get(key) || 0) + 1);
    };
    for (let x = 0; x < w; x++) { tally(x, 0); tally(x, h - 1); }
    for (let y = 1; y < h - 1; y++) { tally(0, y); tally(w - 1, y); }
    const key = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
    return [((key >> 10) & 31) * 8 + 4, ((key >> 5) & 31) * 8 + 4, (key & 31) * 8 + 4];
  };

  const inkResults = ink.map(({ crop, box }) => {
    const r = region(crop, 0);
    if (!r) return null;
    const bg = ringColor(r);
    let minX = r.w, minY = r.h, maxX = -1, maxY = -1, count = 0;
    for (let y = 0; y < r.h; y++) {
      for (let x = 0; x < r.w; x++) {
        const i = (y * r.w + x) * 4;
        if (Math.max(Math.abs(r.data[i] - bg[0]), Math.abs(r.data[i + 1] - bg[1]), Math.abs(r.data[i + 2] - bg[2])) > 48) {
          count++;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (count < 6) return null;
    return {
      dx: (r.x0 + (minX + maxX + 1) / 2) / scale - (box.x + box.width / 2),
      dy: (r.y0 + (minY + maxY + 1) / 2) / scale - (box.y + box.height / 2),
      width: (maxX - minX + 1) / scale,
      height: (maxY - minY + 1) / scale,
    };
  });
  const backgrounds = background.map(box => {
    const r = region(box, inset);
    return r ? ringColor(r) : null;
  });
  return { ink: inkResults, background: backgrounds };
}

/** Draw the findings over the page for the annotated screenshot; returns nothing. */
export function annotate({ controls, failing }) {
  document.getElementById('ui-fit-overlay')?.remove();
  const layer = document.createElement('div');
  layer.id = 'ui-fit-overlay';
  layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483647';
  for (const c of controls) {
    if (c.visibleFraction < 0.5) continue;
    const bad = failing.includes(`${c.role}:${c.name || '(unnamed)'}`);
    const box = document.createElement('div');
    box.style.cssText = `position:fixed;left:${c.visual.x}px;top:${c.visual.y}px;width:${c.visual.width}px;height:${c.visual.height}px;`
      + `outline:${bad ? 2 : 1}px solid ${bad ? '#ff2d55' : 'rgba(52,199,89,.7)'};outline-offset:0`;
    layer.appendChild(box);
  }
  document.body.appendChild(layer);
}
