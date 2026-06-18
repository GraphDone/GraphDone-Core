#!/usr/bin/env node
/**
 * Stitches the feature-matrix screenshots into one self-contained gallery:
 *   test-artifacts/matrix/index.html
 *
 * Input (produced by `playwright test --project=matrix`):
 *   test-artifacts/matrix/<viewport>/<feature>.png
 *
 * Grid: one row per feature (view / page / dialog / signin), one column per
 * resolution. Lazy images; click any cell to open it full-size. Open the single
 * index.html — every screen at every resolution, side by side.
 */
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.join(process.cwd(), 'test-artifacts/matrix');
if (!fs.existsSync(ROOT)) { console.error('No matrix screenshots at', ROOT, '— run `npm run report:matrix` first.'); process.exit(1); }

const viewports = fs.readdirSync(ROOT, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name)
  .sort((a, b) => (parseInt(a.replace(/\D+/g, ''), 10) || 0) - (parseInt(b.replace(/\D+/g, ''), 10) || 0));

// Union of feature filenames across viewports, in a stable, readable order.
const featureSet = new Set();
for (const vp of viewports) {
  for (const f of fs.readdirSync(path.join(ROOT, vp)).filter((f) => f.endsWith('.png'))) featureSet.add(f.replace(/\.png$/, ''));
}
const order = (f) => (f.startsWith('view-') ? 0 : f.startsWith('page-') ? 1 : f.startsWith('feature-') ? 2 : 3);
const features = [...featureSet].sort((a, b) => order(a) - order(b) || a.localeCompare(b));

const cell = (vp, feat) => {
  const rel = `${vp}/${feat}.png`;
  return fs.existsSync(path.join(ROOT, rel))
    ? `<td><a href="${rel}" target="_blank"><img loading="lazy" src="${rel}" alt="${feat} @ ${vp}"></a></td>`
    : `<td class="missing">—</td>`;
};
const groupLabel = (f) => f.startsWith('view-') ? 'View · ' + f.slice(5)
  : f.startsWith('page-') ? 'Page · ' + f.slice(5)
  : f.startsWith('feature-') ? 'Feature · ' + f.slice(8)
  : f;

const total = viewports.reduce((n, vp) => n + fs.readdirSync(path.join(ROOT, vp)).filter((f) => f.endsWith('.png')).length, 0);
const rows = features.map((f) =>
  `<tr><th class="rowhead">${groupLabel(f)}</th>${viewports.map((vp) => cell(vp, f)).join('')}</tr>`
).join('\n');

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>GraphDone — Feature × Resolution Matrix</title>
<style>
  :root { color-scheme: dark; }
  body { margin: 0; background: #0b0f1a; color: #e5e7eb; font: 14px/1.4 system-ui, sans-serif; }
  header { position: sticky; top: 0; z-index: 3; background: #0b0f1aee; backdrop-filter: blur(6px); padding: 14px 18px; border-bottom: 1px solid #1f2937; }
  h1 { margin: 0; font-size: 18px; } .sub { color: #9ca3af; font-size: 13px; margin-top: 2px; }
  .wrap { overflow: auto; padding: 8px; }
  table { border-collapse: separate; border-spacing: 8px; }
  th.colhead { position: sticky; top: 64px; z-index: 2; background: #111827; color: #a5b4fc; font-weight: 600; padding: 6px 10px; border-radius: 8px; white-space: nowrap; }
  th.rowhead { position: sticky; left: 0; z-index: 1; background: #111827; text-align: left; padding: 8px 12px; border-radius: 8px; white-space: nowrap; vertical-align: middle; }
  td { vertical-align: top; }
  td.missing { color: #4b5563; text-align: center; }
  img { display: block; width: 320px; height: auto; border: 1px solid #1f2937; border-radius: 8px; background: #000; }
  a { line-height: 0; }
</style></head><body>
<header>
  <h1>GraphDone — Feature × Resolution Matrix</h1>
  <div class="sub">${features.length} features × ${viewports.length} resolutions · ${total} screenshots · click any cell to open full-size</div>
</header>
<div class="wrap"><table>
<tr><th class="rowhead">&nbsp;</th>${viewports.map((vp) => `<th class="colhead">${vp}</th>`).join('')}</tr>
${rows}
</table></div></body></html>`;

const out = path.join(ROOT, 'index.html');
fs.writeFileSync(out, html);
console.log(`Matrix gallery: ${out}`);
console.log(`  ${features.length} features × ${viewports.length} resolutions = ${total} screenshots`);
