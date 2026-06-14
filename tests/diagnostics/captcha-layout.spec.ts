import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * CodeCaptcha (ALTCHA-style) layout diagnostic. Measures whether the refresh
 * ("try different style") button is vertically centered against the challenge
 * content, in BOTH the math state (no speaker button) and the text/complex
 * state (speaker button present). Report-only — no app behavior changed.
 */
const OUT = path.resolve(process.cwd(), 'test-artifacts/captcha');

async function measure(page: Page) {
  return page.evaluate(() => {
    const refresh = document.querySelector('button[title="Try different style"]') as HTMLElement | null;
    const speaker = document.querySelector('button[title="Listen to code"]') as HTMLElement | null;
    // the challenge box (the bordered panel) and the math number / canvas
    const num = [...document.querySelectorAll('p')].find((p) => /=\s*\?/.test(p.textContent || '')) as HTMLElement | null;
    const canvas = document.querySelector('canvas') as HTMLElement | null;
    const content = (num ?? canvas) as HTMLElement | null;
    const box = refresh?.closest('.rounded-lg') as HTMLElement | null;
    const c = (el: HTMLElement | null) => { if (!el) return null; const r = el.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), cy: Math.round(r.top + r.height / 2), h: Math.round(r.height) }; };
    return {
      style: num ? 'math' : (canvas ? 'image' : 'unknown'),
      hasSpeaker: !!speaker,
      refresh: c(refresh),
      content: c(content),
      panel: c(box),
    };
  });
}

test.describe('captcha layout diagnostic @geometry', () => {
  test('refresh button vertical centering (math vs speaker state)', async ({ page }) => {
    fs.mkdirSync(OUT, { recursive: true });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/signup');
    await page.waitForTimeout(1500);
    await page.locator('button[title="Try different style"]').first().waitFor({ timeout: 15000 });

    const results: any[] = [];
    // State 1: as first shown (math, no speaker)
    let m = await measure(page);
    await page.screenshot({ path: path.join(OUT, `state-${m.style}-speaker${m.hasSpeaker}.png`), clip: m.panel ? { x: 0, y: Math.max(0, m.panel.top - 20), width: 1280, height: m.panel.h + 40 } : undefined }).catch(() => {});
    results.push(m);

    // Click refresh until we land on an image/text style (speaker appears), to
    // compare. Bounded so we don't loop forever if RNG keeps picking math.
    for (let i = 0; i < 12 && !(results.find((r) => r.hasSpeaker)); i++) {
      await page.locator('button[title="Try different style"]').click();
      await page.waitForTimeout(500);
      const cur = await measure(page);
      if (cur.style !== results[results.length - 1].style || cur.hasSpeaker !== results[results.length - 1].hasSpeaker) {
        await page.screenshot({ path: path.join(OUT, `state-${cur.style}-speaker${cur.hasSpeaker}.png`), clip: cur.panel ? { x: 0, y: Math.max(0, cur.panel.top - 20), width: 1280, height: cur.panel.h + 40 } : undefined }).catch(() => {});
        results.push(cur);
      }
    }

    const report = results.map((r) => ({
      style: r.style,
      hasSpeaker: r.hasSpeaker,
      refreshCy: r.refresh?.cy,
      contentCy: r.content?.cy,
      panelCy: r.panel?.cy,
      refreshVsContent: r.refresh && r.content ? r.refresh.cy - r.content.cy : null,
      refreshVsPanel: r.refresh && r.panel ? r.refresh.cy - r.panel.cy : null,
    }));
    fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
    // eslint-disable-next-line no-console
    for (const r of report) console.log('[captcha] ' + JSON.stringify(r));

    expect(report.length, 'measured at least the math state').toBeGreaterThan(0);
  });
});
