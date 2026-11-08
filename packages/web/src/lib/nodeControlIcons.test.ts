import { describe, expect, it } from 'vitest';
import * as d3 from 'd3';
import { appendNodeControlGlyph, NODE_CONTROL_ICONS, nodeControlGlyphTransform } from './nodeControlIcons';

// Bounding box centre of an icon's artwork, from its shapes' end points.
function extent(icon: keyof typeof NODE_CONTROL_ICONS) {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const [tag, attrs] of NODE_CONTROL_ICONS[icon]) {
    const a = attrs as Record<string, string>;
    if (tag === 'line') { xs.push(+a.x1, +a.x2); ys.push(+a.y1, +a.y2); }
    if (tag === 'polyline') {
      const n = a.points.split(/\s+/).map(Number);
      for (let i = 0; i < n.length; i += 2) { xs.push(n[i]); ys.push(n[i + 1]); }
    }
    if (tag === 'circle') { xs.push(+a.cx - +a.r, +a.cx + +a.r); ys.push(+a.cy - +a.r, +a.cy + +a.r); }
    if (tag === 'path') {
      // Walk the path's end points (M/L/H/V/A, absolute and relative).
      let x = 0, y = 0;
      for (const [, cmd, args] of a.d.matchAll(/([MLHVAmlhva])([^A-Za-z]*)/g)) {
        const n = (args.match(/-?\d*\.?\d+/g) ?? []).map(Number);
        const rel = cmd === cmd.toLowerCase();
        const size = { m: 2, l: 2, h: 1, v: 1, a: 7 }[cmd.toLowerCase() as 'm' | 'l' | 'h' | 'v' | 'a'];
        for (let i = 0; i + size <= n.length; i += size) {
          const k = cmd.toLowerCase();
          if (k === 'h') x = rel ? x + n[i] : n[i];
          else if (k === 'v') y = rel ? y + n[i] : n[i];
          else { const [px, py] = k === 'a' ? [n[i + 5], n[i + 6]] : [n[i], n[i + 1]]; x = rel ? x + px : px; y = rel ? y + py : py; }
          xs.push(x); ys.push(y);
        }
      }
    }
  }
  return { cx: (Math.min(...xs) + Math.max(...xs)) / 2, cy: (Math.min(...ys) + Math.max(...ys)) / 2 };
}

describe('node control icons', () => {
  it('draws vector shapes, never font glyphs, hidden from assistive technology', () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const group = d3.select(svg).append('g');
    for (const icon of Object.keys(NODE_CONTROL_ICONS) as (keyof typeof NODE_CONTROL_ICONS)[]) {
      appendNodeControlGlyph(group, icon, 20, `glyph-${icon}`);
    }
    expect(svg.querySelectorAll('text')).toHaveLength(0);
    const glyphs = [...svg.querySelectorAll('.node-control-glyph')];
    expect(glyphs).toHaveLength(4);
    for (const glyph of glyphs) {
      expect(glyph.getAttribute('aria-hidden')).toBe('true');
      expect(glyph.getAttribute('fill')).toBe('none');
      expect(glyph.children.length).toBeGreaterThan(0);
    }
  });

  it('centres the 24-unit artwork on the button origin at any size', () => {
    expect(nodeControlGlyphTransform(16)).toBe('scale(0.4667) translate(-12, -12)');
    expect(nodeControlGlyphTransform(24, 1.2)).toBe('scale(0.84) translate(-12, -12)');
  });

  it('keeps every icon\'s artwork centred on the grid centre (12, 12)', () => {
    for (const icon of ['plus', 'maximize', 'maximize2', 'settings'] as const) {
      const { cx, cy } = extent(icon);
      expect(cx, icon).toBeCloseTo(12, 2);
      expect(cy, icon).toBeCloseTo(12, 2);
    }
  });
});
