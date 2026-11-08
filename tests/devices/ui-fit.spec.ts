import { test, expect, type Page, type TestInfo } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { annotate, collectControls, measurePixels } from '../lib/ui-fit/collect.mjs';
import { applyExemptions, evaluate, MAX_ICON_BUTTON } from '../lib/ui-fit/rules.mjs';
import { UI_FIT_SCREENS, type UiFitScreen } from './screens';

// The UI fit gate: every screen in screens.ts, on every device in
// tests/lib/ui-fit/devices.mjs, measured against the rules in
// tests/lib/ui-fit/rules.mjs. Results (JSON + annotated screenshot per
// device and screen) land in test-artifacts/ui-fit/. See docs/quality/UI_FIT.md.

const EXEMPTIONS_FILE = 'tests/devices/ui-fit-exemptions.json';
const OUT = 'test-artifacts/ui-fit';
// Things that are right by design, each with its reason. Not a list of known bugs.
const exemptions: Record<string, string> = JSON.parse(readFileSync(EXEMPTIONS_FILE, 'utf8')).exemptions;

interface Device { id: string; label: string; touch: boolean }
interface Box { x: number; y: number; width: number; height: number }

// The icon's own box (an <svg> keeps its artwork inside its viewBox; a text
// glyph inside its line box), kept 1px inside the button's edge.
function cropAround(icon: Box, button: Box): Box {
  const left = Math.max(icon.x, button.x + 1), top = Math.max(icon.y, button.y + 1);
  const right = Math.min(icon.x + icon.width, button.x + button.width - 1);
  const bottom = Math.min(icon.y + icon.height, button.y + button.height - 1);
  return { x: left, y: top, width: right - left, height: bottom - top };
}

type Snapshot = Awaited<ReturnType<typeof collectControls>>;
const layoutSignature = (snapshot: Snapshot) => JSON.stringify(snapshot.controls.map(c => [
  c.role, c.name, c.unobstructed, c.behindOverlay, ...[c.visual.x, c.visual.y, c.visual.width, c.visual.height].map(v => Math.round(v * 2) / 2),
]));

async function check(page: Page, screen: UiFitScreen, info: TestInfo) {
  const device = info.project.metadata.device as Device;
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));

  await screen.open(page);
  if (!device.touch) await page.mouse.move(0, 0); // no hover state on the measured controls
  // Measure the settled UI: let every finite CSS/Web animation (panels sliding
  // in, fades) finish, so the DOM boxes match the pixels in the screenshot.
  await page.evaluate(() => Promise.race([
    Promise.all(document.getAnimations()
      .filter(animation => animation.effect?.getComputedTiming().iterations !== Infinity)
      .map(animation => animation.finished.catch(() => undefined))),
    new Promise(resolve => setTimeout(resolve, 5000)),
  ]));

  // Measure, screenshot, measure again: the pixels are only trusted when the
  // layout did not move in between (panels placed by script, graph settling).
  let snapshot = await page.evaluate(collectControls);
  let png = '';
  for (let attempt = 0; ; attempt++) {
    png = (await page.screenshot({ animations: 'disabled', caret: 'hide' })).toString('base64');
    const again = await page.evaluate(collectControls);
    if (layoutSignature(again) === layoutSignature(snapshot)) break;
    if (attempt === 5) throw new Error(`${screen.id}: the layout kept moving; cannot measure a settled screen`);
    await page.waitForTimeout(500);
    snapshot = await page.evaluate(collectControls);
  }
  // Pixel checks only on controls fully in view with nothing drawn over any part of them.
  const usable = snapshot.controls.filter(c => c.visibleFraction >= 0.99 && c.unobstructed);
  const icons = usable.filter(c => c.iconBox && c.visual.width <= MAX_ICON_BUTTON && c.visual.height <= MAX_ICON_BUTTON);
  // Label contrast is judged on button-sized controls; large cards mix many text styles.
  const labelled = usable.filter(c => c.textColors.length && c.visual.height <= MAX_ICON_BUTTON);
  const pixels = await page.evaluate(measurePixels, {
    png,
    inset: 2,
    ink: icons.map(c => ({ box: c.visual, crop: cropAround(c.iconBox!, c.visual) })),
    background: labelled.map(c => c.visual),
  });
  icons.forEach((c, i) => Object.assign(c, { ink: pixels.ink[i] }));
  labelled.forEach((c, i) => Object.assign(c, { background: pixels.background[i] }));

  const findings = evaluate(snapshot, device);
  const { failing, exempt } = applyExemptions(findings, exemptions);

  await page.evaluate(annotate, { controls: snapshot.controls, failing: failing.map(f => f.key) });
  const shot = await page.screenshot({ animations: 'disabled', caret: 'hide' });
  const dir = join(OUT, device.id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${screen.id}.png`), shot);
  const record = { device, screen: screen.id, findings, failing, exempt, controls: snapshot.controls, clickables: snapshot.clickables, page: snapshot.page };
  writeFileSync(join(dir, `${screen.id}.json`), JSON.stringify(record, null, 2));
  await info.attach(`${device.id}-${screen.id}.png`, { body: shot, contentType: 'image/png' });
  await info.attach('findings.json', { body: JSON.stringify({ findings, failing, exempt }, null, 2), contentType: 'application/json' });

  const describe = (f: { rule: string; key: string; message: string; count: number }) => `${f.rule} — ${f.key}: ${f.message}${f.count > 1 ? ` (×${f.count})` : ''}`;
  expect.soft(failing.map(describe), `${device.label} / ${screen.id}: UI fit problems (annotated: ${dir}/${screen.id}.png)`).toEqual([]);
  expect(errors, `${screen.id}: uncaught page errors`).toEqual([]);
}

test.describe.configure({ mode: 'parallel', timeout: 90_000 });

for (const screen of UI_FIT_SCREENS) {
  test.describe(screen.id, () => {
    if (screen.signedOut) test.use({ storageState: { cookies: [], origins: [] } });
    test(`${screen.id} fits`, async ({ page }, info) => check(page, screen, info));
  });
}
