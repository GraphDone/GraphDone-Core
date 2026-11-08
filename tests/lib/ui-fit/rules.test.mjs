import assert from 'node:assert/strict';
import test from 'node:test';
import { applyExemptions, contrastRatio, evaluate, targetSpacingOk } from './rules.mjs';

const box = (x, y, width, height) => ({ x, y, width, height });
const control = (overrides = {}) => ({
  tag: 'button', role: 'button', name: 'Save',
  rect: box(0, 0, 44, 44), visual: box(0, 0, 44, 44), hit: box(0, 0, 44, 44),
  visibleFraction: 1, behindOverlay: false, iconOnly: false, iconBox: null, textColors: [],
  glyphText: '', textOverflow: 0, coveredBy: '', inlineLink: false, clippedX: 0,
  ...overrides,
});
const page = { scrollWidth: 390, innerWidth: 390 };
const rules = (controls, touch = false) => evaluate({ controls, page }, { touch }).map(f => f.rule).sort();

test('a well-formed control produces no findings', () => {
  assert.deepEqual(rules([control()], true), []);
});

test('each measured defect maps to its rule', () => {
  assert.deepEqual(rules([control({ name: '' })]), ['accessible-name']);
  assert.deepEqual(rules([control({ coveredBy: 'div' })]), ['center-hit']);
  assert.deepEqual(rules([control({ textOverflow: 6 })]), ['text-contained']);
  assert.deepEqual(rules([control({ clippedX: 12 })]), ['in-viewport']);
  assert.deepEqual(rules([control({ glyphText: '+' })]), ['vector-icons']);
});

test('icon centring is gated at 0.75px on either axis', () => {
  assert.deepEqual(rules([control({ ink: { dx: 0.7, dy: -0.7 } })]), []);
  assert.deepEqual(rules([control({ ink: { dx: 0, dy: 1.33 } })]), ['icon-centered']);
  assert.deepEqual(rules([control({ ink: { dx: -4, dy: 0 } })]), ['icon-centered']);
});

test('label contrast uses the drawn background, compositing translucent text', () => {
  // White text on the light grey Safari draws behind a default <select>.
  assert.ok(contrastRatio([255, 255, 255, 1], [244, 244, 244]) < 1.2);
  assert.ok(contrastRatio([255, 255, 255, 1], [31, 41, 55]) > 14);
  assert.ok(contrastRatio([255, 255, 255, 0.1], [0, 0, 0]) < 1.4);
  assert.deepEqual(rules([control({ textColors: [[255, 255, 255, 1]], background: [244, 244, 244] })]), ['label-contrast']);
  assert.deepEqual(rules([control({ textColors: [[156, 163, 175, 1]], background: [28, 44, 52] })]), []);
});

test('a pointer-cursor element that is not a control is reported', () => {
  const findings = evaluate({ controls: [], clickables: [{ tag: 'g', name: 'g.node-relationship-icon "Add a connection (grow)"' }], page }, { touch: false });
  assert.deepEqual(findings.map(f => f.rule), ['clickable-is-control']);
});

test('sideways page scroll is a page-level finding', () => {
  const findings = evaluate({ controls: [], page: { scrollWidth: 420, innerWidth: 390 } }, { touch: true });
  assert.deepEqual(findings.map(f => [f.rule, f.key]), [['no-horizontal-scroll', 'page']]);
});

test('a scroll area showing only a sliver of its content is reported', () => {
  const findings = evaluate({ controls: [], page, crampedScrollers: [{ name: 'div.p-4', height: 20 }] }, { touch: true });
  assert.deepEqual(findings.map(f => [f.rule, f.key]), [['scroll-room', 'area:div.p-4']]);
});

test('a vertical scroll area that also scrolls sideways is reported by name', () => {
  const findings = evaluate({ controls: [], page, sidewaysScrollers: [{ name: 'main.flex-1', overflow: 64 }] }, { touch: true });
  assert.deepEqual(findings.map(f => [f.rule, f.key]), [['no-horizontal-scroll', 'area:main.flex-1']]);
});

test('a control mostly pushed past the screen edge still fails in-viewport', () => {
  const pushed = control({ name: 'Force Debug', rect: box(370, 80, 120, 40), visibleFraction: 0.2, clippedX: 97 });
  assert.deepEqual(rules([pushed]), ['in-viewport']);
  const scrolledAway = control({ name: 'Below', rect: box(0, 2000, 44, 44), visibleFraction: 0, clippedX: 0 });
  assert.deepEqual(rules([scrolledAway]), []);
});

test('controls behind an open dialog or scrolled out of view are not judged', () => {
  assert.deepEqual(rules([control({ name: '', behindOverlay: true })]), []);
  assert.deepEqual(rules([control({ name: '', visibleFraction: 0.3 })]), []);
});

test('undersized targets pass only when spaced per WCAG 2.5.8', () => {
  const small = control({ hit: box(100, 100, 18, 18) });
  const far = control({ name: 'Other', hit: box(160, 100, 18, 18) });
  const near = control({ name: 'Other', hit: box(118, 100, 18, 18) });
  assert.equal(targetSpacingOk(small, [small, far]), true);
  assert.equal(targetSpacingOk(small, [small, near]), false);
  assert.deepEqual(rules([small, near]), ['target-size', 'target-size']);
  assert.deepEqual(rules([small, far]), []);
});

test('touch comfort (44px) is reported on touch devices only and never gated', () => {
  const small = control({ hit: box(0, 0, 32, 32) });
  assert.deepEqual(rules([small], false), []);
  const findings = evaluate({ controls: [small], page }, { touch: true });
  assert.deepEqual(findings.map(f => f.rule), ['touch-comfort']);
  assert.deepEqual(applyExemptions(findings).failing, []);
});

test('repeated controls collapse into one finding with a count', () => {
  const plus = () => control({ name: 'Add a connection', glyphText: '+' });
  const findings = evaluate({ controls: [plus(), plus(), plus()], page }, { touch: false });
  assert.equal(findings.length, 1);
  assert.equal(findings[0].count, 3);
});

test('every gated finding fails unless exempted by design, with a reason', () => {
  const findings = [
    { rule: 'clickable-is-control', key: 'clickable:svg[mini-map] ""' },
    { rule: 'center-hit', key: 'link:GraphDone' },
    { rule: 'touch-comfort', key: 'button:Close' },
  ];
  const { failing, exempt } = applyExemptions(findings, { 'clickable-is-control|clickable:svg[mini-map] ""': 'pointer shortcut' });
  assert.deepEqual(failing.map(f => f.rule), ['center-hit']);
  assert.deepEqual(exempt.map(f => f.reason), ['pointer shortcut']);
});
