#!/usr/bin/env node
/**
 * Stitches the showcase artifacts into one web-efficient gallery:
 *   test-artifacts/showcase/index.html
 *
 * Inputs (produced by `playwright test --project=showcase`):
 *   - test-artifacts/showcase/<viewport>/NN-step.png   (step screenshots)
 *   - test-artifacts/playwright-output/.../video.webm   (one .webm per viewport tour)
 *
 * Web-efficient: videos are VP8 .webm, lazy (preload="none") with a screenshot
 * poster; images lazy-load. Open the single index.html to review every mode at
 * every resolution.
 */
import * as fs from 'fs';
import * as path from 'path';

const ROOT = process.cwd();
const SHOT_ROOT = path.join(ROOT, 'test-artifacts/showcase');
const PW_OUT = path.join(ROOT, 'test-artifacts/playwright-output');
const OUT = path.join(SHOT_ROOT, 'index.html');

const VIEWPORTS = ['iphone-se', 'iphone-15', 'ipad', 'laptop-1080p', 'desktop-4k'];

function walk(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

const allWebm = walk(PW_OUT).filter((f) => f.endsWith('.webm'));

function sectionFor(vp) {
  const dir = path.join(SHOT_ROOT, vp);
  const shots = fs.existsSync(dir)
    ? fs.readdirSync(dir).filter((f) => f.endsWith('.png')).sort()
    : [];
  // Pick the video whose output path mentions this viewport, and copy it into
  // the viewport folder so the whole showcase/ dir is self-contained/portable.
  const srcVideo = allWebm.find((f) => f.toLowerCase().includes(vp));
  let localVideo = null;
  if (srcVideo && fs.existsSync(dir)) {
    localVideo = `${vp}/tour.webm`;
    fs.copyFileSync(srcVideo, path.join(SHOT_ROOT, localVideo));
  }
  const poster = shots[1] || shots[0]; // graph-overview if present
  const videoHtml = localVideo
    ? `<video controls preload="none" ${poster ? `poster="${vp}/${poster}"` : ''} width="480">
         <source src="${localVideo}" type="video/webm">
       </video>`
    : `<p class="muted">No video captured.</p>`;
  const shotsHtml = shots.length
    ? shots.map((s) => `
        <figure>
          <img loading="lazy" src="${vp}/${s}" alt="${s}">
          <figcaption>${s.replace(/^\d+-/, '').replace(/\.png$/, '').replace(/-/g, ' ')}</figcaption>
        </figure>`).join('')
    : `<p class="muted">No screenshots.</p>`;
  return `
    <section>
      <h2>${vp} <span class="muted">(${shots.length} steps${localVideo ? ', video' : ''})</span></h2>
      <div class="video">${videoHtml}</div>
      <div class="grid">${shotsHtml}</div>
    </section>`;
}

const generatedAt = new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>GraphDone — Showcase Report</title>
<style>
  :root { color-scheme: dark; }
  body { margin: 0; font: 15px/1.5 system-ui, sans-serif; background: #0b1220; color: #e5e7eb; }
  header { padding: 24px 28px; background: linear-gradient(135deg,#065f46,#0b1220); }
  h1 { margin: 0 0 4px; font-size: 22px; }
  .muted { color: #94a3b8; font-weight: 400; }
  main { padding: 12px 28px 60px; }
  section { margin: 28px 0; border-top: 1px solid #1e293b; padding-top: 18px; }
  h2 { font-size: 18px; text-transform: capitalize; }
  .video video { border-radius: 10px; border: 1px solid #1e293b; max-width: 100%; background:#000; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 14px; margin-top: 14px; }
  figure { margin: 0; background: #111827; border: 1px solid #1e293b; border-radius: 10px; overflow: hidden; }
  figure img { width: 100%; display: block; background:#000; }
  figcaption { padding: 8px 10px; font-size: 12px; color: #cbd5e1; text-transform: capitalize; }
  nav a { color: #34d399; margin-right: 14px; text-decoration: none; }
</style></head>
<body>
<header>
  <h1>🌊 GraphDone — Showcase Report</h1>
  <div class="muted">Every mode of operation, captured as web-friendly .webm video and full-page screenshots across the responsive viewport matrix. Generated ${generatedAt}.</div>
  <nav style="margin-top:10px">${VIEWPORTS.map((v) => `<a href="#${v}">${v}</a>`).join('')}</nav>
</header>
<main>
${VIEWPORTS.map((vp) => `<a id="${vp}"></a>${sectionFor(vp)}`).join('')}
</main>
</body></html>`;

fs.mkdirSync(SHOT_ROOT, { recursive: true });
fs.writeFileSync(OUT, html);
const videoCount = VIEWPORTS.filter((v) => allWebm.some((f) => f.toLowerCase().includes(v))).length;
const shotCount = VIEWPORTS.reduce((n, v) => {
  const d = path.join(SHOT_ROOT, v);
  return n + (fs.existsSync(d) ? fs.readdirSync(d).filter((f) => f.endsWith('.png')).length : 0);
}, 0);
console.log(`Showcase report: ${OUT}`);
console.log(`  ${videoCount}/${VIEWPORTS.length} viewports with video, ${shotCount} screenshots total`);
