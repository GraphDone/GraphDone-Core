// UI fit rules: what every interactive control must satisfy on every device.
//
// The browser-side collector (collect.mjs) measures each visible control; the
// functions here turn those measurements into findings. They are pure so they
// can be unit tested (rules.test.mjs) without a browser.
//
// A finding is { rule, key, message, measured } where `key` identifies the
// control stably across runs ("<role>:<accessible name>").

/** WCAG 2.2 AA 2.5.8: targets at least 24×24 CSS px, or spaced so a 24 px circle fits. */
export const MIN_TARGET = 24;
/** Apple HIG / WCAG AAA 2.5.5 comfortable touch target. Reported on touch devices, not gated. */
export const TOUCH_TARGET = 44;
/** Largest offset (CSS px) between an icon's ink centre and its button's centre. */
export const ICON_CENTER_TOLERANCE = 0.75;
/** Icon-only controls larger than this are panels, not icon buttons; ink is not measured. */
export const MAX_ICON_BUTTON = 64;
/** Minimum contrast between a control's label and the background actually drawn behind it. */
export const MIN_LABEL_CONTRAST = 3;

export const RULES = {
  'clickable-is-control': 'Anything with a pointer cursor is a real button or link (role, focusable), so keyboards and screen readers can use it too.',
  'accessible-name': 'Every control has an accessible name (aria-label, label or visible text).',
  'center-hit': 'Tapping the centre of a control reaches that control, not something drawn over it.',
  'text-contained': 'A control\'s visible label stays inside its box (deliberate ellipsis excepted).',
  'in-viewport': 'A control is not cut off by the left or right edge of the screen.',
  'target-size': `Targets are at least ${MIN_TARGET}×${MIN_TARGET} px, or spaced so a ${MIN_TARGET} px circle around them touches no other target (WCAG 2.2 2.5.8).`,
  'icon-centered': `An icon-only button's artwork is centred in its box within ${ICON_CENTER_TOLERANCE} px on both axes, measured from rendered pixels.`,
  'label-contrast': `A control's label has at least ${MIN_LABEL_CONTRAST}:1 contrast with the background the browser actually draws (catches native Safari styling that ignores our CSS).`,
  'vector-icons': 'Icons are drawn as SVG, not as font characters such as "+", "⚙" or "×" whose position depends on the device\'s fonts.',
  'no-horizontal-scroll': 'The page never scrolls sideways.',
};

/** Rules measured and reported but not (yet) gated. */
export const REPORT_ONLY = new Set(['touch-comfort']);

export const controlKey = control => `${control.role}:${control.name || '(unnamed)'}`;

const round = n => Math.round(n * 100) / 100;

const channel = v => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const luminance = ([r, g, b]) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);

/** WCAG contrast ratio of an [r,g,b,a] colour drawn over an opaque [r,g,b] background. */
export function contrastRatio(fg, bg) {
  const a = fg[3] ?? 1;
  const drawn = [0, 1, 2].map(i => fg[i] * a + bg[i] * (1 - a));
  const [hi, lo] = [luminance(drawn), luminance(bg)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function distanceToRect(x, y, r) {
  const dx = Math.max(r.x - x, 0, x - (r.x + r.width));
  const dy = Math.max(r.y - y, 0, y - (r.y + r.height));
  return Math.hypot(dx, dy);
}

/**
 * WCAG 2.5.8 spacing exception: an undersized target passes when a 24 px
 * circle centred on it intersects no other target and no other undersized
 * target's circle.
 */
export function targetSpacingOk(control, others) {
  const cx = control.hit.x + control.hit.width / 2;
  const cy = control.hit.y + control.hit.height / 2;
  const radius = MIN_TARGET / 2;
  for (const other of others) {
    if (other === control) continue;
    if (distanceToRect(cx, cy, other.hit) < radius) return false;
    const undersized = other.hit.width < MIN_TARGET || other.hit.height < MIN_TARGET;
    if (undersized) {
      const ox = other.hit.x + other.hit.width / 2;
      const oy = other.hit.y + other.hit.height / 2;
      if (Math.hypot(cx - ox, cy - oy) < MIN_TARGET) return false;
    }
  }
  return true;
}

/**
 * Evaluate one screen's measurements.
 * @param {{controls: object[], page: {scrollWidth: number, innerWidth: number}}} snapshot
 * @param {{touch: boolean}} device
 */
export function evaluate(snapshot, device) {
  const findings = [];
  const add = (rule, control, message, measured) =>
    findings.push({ rule, key: control ? controlKey(control) : 'page', message, measured });

  const overflow = snapshot.page.scrollWidth - snapshot.page.innerWidth;
  if (overflow > 1) add('no-horizontal-scroll', null, `page is ${overflow}px wider than the screen`, { overflow });

  // Only controls that are actually on screen are judged; content scrolled out
  // of view (or clipped inside a scroll container) is measured when visible.
  for (const clickable of snapshot.clickables || []) {
    findings.push({ rule: 'clickable-is-control', key: `clickable:${clickable.name}`, message: `${clickable.tag} looks clickable but is not a button or link`, measured: {} });
  }

  // Controls under an open dialog, menu or backdrop are not usable by design.
  const onScreen = snapshot.controls.filter(c => c.visibleFraction >= 0.5 && !c.behindOverlay);
  for (const c of onScreen) {
    if (!c.name) add('accessible-name', c, `${c.tag} has no accessible name`, { tag: c.tag });
    if (c.coveredBy) add('center-hit', c, `centre is covered by ${c.coveredBy}`, { coveredBy: c.coveredBy });
    if (c.textOverflow) add('text-contained', c, `label sticks out by ${round(c.textOverflow)}px`, { overflow: round(c.textOverflow) });
    if (c.clippedX > 1) add('in-viewport', c, `${round(c.clippedX)}px is off the edge of the screen`, { clipped: round(c.clippedX) });
    if (c.glyphText) add('vector-icons', c, `icon is the text character "${c.glyphText}"`, { glyph: c.glyphText });

    const small = c.hit.width < MIN_TARGET || c.hit.height < MIN_TARGET;
    if (small && !c.inlineLink && !targetSpacingOk(c, onScreen)) {
      add('target-size', c, `target is ${round(c.hit.width)}×${round(c.hit.height)}px and crowded by neighbours`,
        { width: round(c.hit.width), height: round(c.hit.height) });
    }
    if (device.touch && !c.inlineLink && (c.hit.width < TOUCH_TARGET || c.hit.height < TOUCH_TARGET)) {
      add('touch-comfort', c, `touch target ${round(c.hit.width)}×${round(c.hit.height)}px is under ${TOUCH_TARGET}px`,
        { width: round(c.hit.width), height: round(c.hit.height) });
    }
    if (c.background) {
      const worst = Math.min(...(c.textColors || []).map(fg => contrastRatio(fg, c.background)));
      if (worst < MIN_LABEL_CONTRAST) {
        add('label-contrast', c, `label contrast is ${round(worst)}:1 against the drawn background rgb(${c.background.join(',')})`, { ratio: round(worst) });
      }
    }
    if (c.ink && (Math.abs(c.ink.dx) > ICON_CENTER_TOLERANCE || Math.abs(c.ink.dy) > ICON_CENTER_TOLERANCE)) {
      add('icon-centered', c, `icon is off-centre by dx=${round(c.ink.dx)} dy=${round(c.ink.dy)}px`,
        { dx: round(c.ink.dx), dy: round(c.ink.dy) });
    }
  }
  // One finding per control and rule: repeated controls (e.g. every graph card's
  // "+") collapse by key, keeping a count.
  const merged = new Map();
  for (const f of findings) {
    const id = `${f.rule}|${f.key}`;
    const seen = merged.get(id);
    if (seen) seen.count += 1; else merged.set(id, { ...f, count: 1 });
  }
  return [...merged.values()];
}

/**
 * Split findings into failures and declared exemptions. There is no baseline
 * of known problems: every gated finding fails until it is fixed. An exemption
 * is for something that is right by design, keyed "<rule>|<control key>",
 * and must say why.
 * @param {object[]} findings
 * @param {Record<string, string>} exemptions
 */
export function applyExemptions(findings, exemptions = {}) {
  const gated = findings.filter(f => !REPORT_ONLY.has(f.rule));
  const isExempt = f => `${f.rule}|${f.key}` in exemptions;
  return {
    failing: gated.filter(f => !isExempt(f)),
    exempt: gated.filter(isExempt).map(f => ({ ...f, reason: exemptions[`${f.rule}|${f.key}`] })),
  };
}
