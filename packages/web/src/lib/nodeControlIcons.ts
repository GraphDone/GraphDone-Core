import type { Selection } from 'd3';

// Graph card header controls (quick edit, grow, expand, open sub-graph) draw
// their icons as SVG geometry, never as font glyphs. A text glyph's ink sits
// wherever the device's font puts it: the old "+" landed between 0.7 px above
// and 1.3 px below the centre of its 16 px button depending on the installed
// font, so it looked off-centre on some phones and desktops and fine on others.
//
// Every icon is drawn on a 24-unit grid whose centre (12, 12) is the centre of
// the artwork, then scaled and shifted so that centre lands on the button's
// origin. Path data is from Lucide (ISC licence, https://lucide.dev), the icon
// set the rest of the React UI already uses.

type IconElement = readonly [tag: 'path' | 'circle' | 'polyline' | 'line', attrs: Readonly<Record<string, string>>];

export const NODE_CONTROL_ICONS = {
  settings: [
    ['path', { d: 'M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z' }],
    ['circle', { cx: '12', cy: '12', r: '3' }],
  ],
  plus: [
    ['path', { d: 'M5 12h14' }],
    ['path', { d: 'M12 5v14' }],
  ],
  maximize: [
    ['path', { d: 'M8 3H5a2 2 0 0 0-2 2v3' }],
    ['path', { d: 'M21 8V5a2 2 0 0 0-2-2h-3' }],
    ['path', { d: 'M3 16v3a2 2 0 0 0 2 2h3' }],
    ['path', { d: 'M16 21h3a2 2 0 0 0 2-2v-3' }],
  ],
  maximize2: [
    ['polyline', { points: '15 3 21 3 21 9' }],
    ['polyline', { points: '9 21 3 21 3 15' }],
    ['line', { x1: '21', x2: '14', y1: '3', y2: '10' }],
    ['line', { x1: '3', x2: '10', y1: '21', y2: '14' }],
  ],
} as const satisfies Record<string, readonly IconElement[]>;

export type NodeControlIcon = keyof typeof NODE_CONTROL_ICONS;

/** The icon's 24-unit artwork fills this fraction of the button's side. */
export const NODE_CONTROL_GLYPH_RATIO = 0.7;

/** Stroke width on the 24-unit grid; scales with the icon. */
export const NODE_CONTROL_STROKE = 2.5;

/**
 * Transform that centres the 24-unit artwork on the button origin.
 * `emphasis` enlarges it around the same centre (hover feedback).
 */
export function nodeControlGlyphTransform(buttonSize: number, emphasis = 1): string {
  const scale = (buttonSize * NODE_CONTROL_GLYPH_RATIO * emphasis) / 24;
  return `scale(${+scale.toFixed(4)}) translate(-12, -12)`;
}

/**
 * Append a centred, decorative icon to a header control group. The group
 * itself carries the role, name and handlers; the icon is hidden from
 * assistive technology and never takes pointer events.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function appendNodeControlGlyph(parent: Selection<SVGGElement, any, any, any>, icon: NodeControlIcon, buttonSize: number, className: string) {
  const glyph = parent.append('g')
    .attr('class', `node-control-glyph ${className}`)
    .attr('data-icon', icon)
    .attr('transform', nodeControlGlyphTransform(buttonSize))
    .attr('fill', 'none')
    .attr('stroke', '#ffffff')
    .attr('stroke-width', NODE_CONTROL_STROKE)
    .attr('stroke-linecap', 'round')
    .attr('stroke-linejoin', 'round')
    .attr('aria-hidden', 'true')
    .style('pointer-events', 'none');
  for (const [tag, attrs] of NODE_CONTROL_ICONS[icon]) {
    const element = glyph.append(tag);
    for (const [name, value] of Object.entries(attrs)) element.attr(name, value);
  }
  return glyph;
}
