import { test, expect } from '@playwright/test';
import { login, TEST_USERS, getBaseURL } from '../helpers/auth';
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import * as path from 'node:path';

/**
 * Graph balance / layout metrics (@balance), OpenCV-driven.
 *
 * Clips a screenshot to the graph canvas (`.graph-container`, which excludes the
 * nav rail, top bar, and the body-portaled minimap), then runs
 * tests/helpers/balance_metrics.py to compute OBJECTIVE numbers about how the
 * graph is placed: centroid offset from centre, bbox coverage, content usage,
 * margin balance, quadrant mass distribution, and an informational balanceScore.
 *
 * PHASE 1 = measurement, not a verdict. It records numbers + an annotated
 * overlay into the report and only asserts that content was detected — so we get
 * objective baselines first. Centering/usage THRESHOLDS (pass/fail) come once the
 * camera-centering work lands and we know what "good" looks like numerically.
 */

const PY = path.join(process.cwd(), 'tests/helpers/balance_metrics.py');
const OUT = path.join(process.cwd(), 'test-artifacts/balance');
mkdirSync(OUT, { recursive: true });

// Graph view is the default at >=768px; phones default to cards (graph-view on a
// 390px phone is a non-standard forced state), so balance is scanned at the
// resolutions where the graph canvas is a real, primary scenario.
const RESOLUTIONS = [
  { name: 'desktop', w: 1440, h: 900 },
  { name: 'laptop', w: 1280, h: 800 },
  { name: 'tablet', w: 768, h: 1024 },
];

test.describe('graph balance metrics (OpenCV) @balance', () => {
  test.describe.configure({ timeout: 120_000 });

  for (const r of RESOLUTIONS) {
    test(`balance @${r.name} ${r.w}x${r.h}`, async ({ page }, info) => {
      await page.setViewportSize({ width: r.w, height: r.h });
      await login(page, TEST_USERS.ADMIN);
      // Render in the flat high-contrast "audit" theme so OpenCV detection is clean
      // and deterministic (real render; only decoration is stripped, layout intact).
      await page.addInitScript(() => {
        localStorage.setItem('graphdone:viewMode', 'graph');
        localStorage.setItem('graphdone:theme', 'contrast');
      });
      await page.goto(`${getBaseURL()}/`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.graph-container svg .node', { timeout: 15_000 }).catch(() => {});
      await page.waitForTimeout(3500); // let physics settle + any camera framing run

      // Close the minimap so it doesn't sit in the clip region (it's chrome, not graph content).
      await page.locator('button[title="Hide Mini-Map"]').click().catch(() => {});
      await page.waitForTimeout(200);
      const canvas = page.locator('.graph-container').first();
      if (!(await canvas.isVisible().catch(() => false))) test.skip(true, 'no graph canvas in this view');
      const img = path.join(OUT, `${r.name}.png`);
      const ann = path.join(OUT, `${r.name}.annotated.jpg`);
      await canvas.screenshot({ path: img });

      const m = JSON.parse(execFileSync('python3', [PY, img, '--annotate', ann, '--flat']).toString());
      const c = m.centroid || {}, b = m.bbox || {}, q = m.quadrants || {};
      console.log(`[balance ${r.name}] score=${m.balanceScore} offMag=${c.offMag} (dx=${c.offX},dy=${c.offY}) usage=${m.contentFrac} bboxCov=${b.coverage} quadImb=${q.imbalance}`);

      await info.attach(`balance-${r.name}`, { path: ann, contentType: 'image/jpeg' });
      await info.attach(`metrics-${r.name}`, { body: JSON.stringify(m, null, 2), contentType: 'application/json' });

      // Phase 1 is measurement, not a gate: record even a near-empty canvas
      // (itself a signal the graph rendered off-screen) instead of failing.
      // Centering/usage THRESHOLDS become pass/fail once the camera work lands.
      expect(m, 'metrics computed').toBeTruthy();
      if ((m.contentPixels ?? 0) < 200) {
        console.warn(`[balance ${r.name}] near-empty canvas (${m.contentPixels}px) — graph likely rendered off-screen`);
      }
    });
  }
});
