#!/usr/bin/env node
/**
 * Renders local-VLM visual evaluations into one self-contained gallery:
 *   test-artifacts/vlm/index.html
 *
 * Input: test-artifacts/vlm/results.json (from visual-vlm.spec.ts)
 * Output: each captured screenshot with a card per persona verdict
 * (pass/flag badge, 0-1 score, summary, issues). No deps, no external assets.
 */
import * as fs from 'fs';
import * as path from 'path';

const VLM_DIR = path.resolve(process.cwd(), 'test-artifacts/vlm');
const RESULTS = path.join(VLM_DIR, 'results.json');
const OUT = path.join(VLM_DIR, 'index.html');

if (!fs.existsSync(RESULTS)) {
  console.error(`No VLM results at ${RESULTS} — run "npm run test:vlm" (with VLM_ENDPOINTS set) first.`);
  process.exit(1);
}

const { generatedAt, results } = JSON.parse(fs.readFileSync(RESULTS, 'utf8'));
const esc = (s) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

// Group verdicts by the screenshot they judged.
const byCapture = new Map();
for (const r of results) {
  const key = r.imagePath;
  if (!byCapture.has(key)) byCapture.set(key, { imagePath: r.imagePath, context: r.context, verdicts: [] });
  byCapture.get(key).verdicts.push(r);
}

const total = results.length;
const passed = results.filter((r) => r.verdict.pass).length;
const avgScore = total ? (results.reduce((a, r) => a + (r.verdict.score || 0), 0) / total).toFixed(2) : '—';

const sections = [...byCapture.values()].map((cap) => {
  const rel = path.relative(VLM_DIR, cap.imagePath).split(path.sep).join('/');
  const cards = cap.verdicts.map((r) => {
    const v = r.verdict;
    const cls = v.pass ? 'pass' : 'flag';
    const issues = v.issues?.length ? `<ul>${v.issues.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>` : '';
    const model = (v.model || '').replace(/\.gguf$/, '').slice(0, 28);
    const host = (v.endpoint || '').replace(/^https?:\/\//, '');
    const foot = (v.endpoint || v.latencyMs) ? `<div class="foot">${esc(model)} @ ${esc(host)}${v.latencyMs ? ` · ${(v.latencyMs / 1000).toFixed(1)}s` : ''}</div>` : '';
    return `<div class="card ${cls}">
      <div class="chead"><span class="badge ${cls}">${v.pass ? 'PASS' : 'FLAG'}</span>
      <strong>${esc(r.persona)}</strong><span class="score">score ${Number(v.score ?? 0).toFixed(2)}</span></div>
      <p>${esc(v.summary)}</p>${issues}${foot}</div>`;
  }).join('');
  return `<section class="capture">
    <div class="shot"><img loading="lazy" src="${rel}" alt="${esc(path.basename(cap.imagePath))}"><div class="cap">${esc(path.basename(cap.imagePath))}</div><p class="ctx">${esc(cap.context)}</p></div>
    <div class="verdicts">${cards}</div>
  </section>`;
}).join('');

const html = `<!doctype html><html><head><meta charset="utf-8"><title>GraphDone — Local VLM Visual Review</title>
<style>
body{background:#0b1018;color:#e6edf6;font:14px/1.5 system-ui,sans-serif;margin:0;padding:24px}
h1{font-size:20px}.muted{color:#7c8aa0}
.summary{background:#0f1623;border:1px solid #243044;border-radius:10px;padding:12px 16px;display:inline-block;margin-bottom:16px}
section.capture{display:grid;grid-template-columns:minmax(320px,440px) 1fr;gap:20px;background:#0f1623;border:1px solid #243044;border-radius:12px;padding:16px;margin-bottom:20px}
.shot img{width:100%;border-radius:8px;border:1px solid #243044}
.cap{font-weight:600;margin-top:8px}.ctx{color:#7c8aa0;font-size:12px}
.verdicts{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px;align-content:start}
.card{border:1px solid #243044;border-radius:8px;padding:10px;background:#0b1018}
.card.pass{border-left:3px solid #34d399}.card.flag{border-left:3px solid #fbbf24}
.chead{display:flex;align-items:center;gap:8px;font-size:13px}.score{margin-left:auto;color:#7c8aa0;font-size:12px}
.badge{font-size:10px;padding:1px 6px;border-radius:4px;font-weight:700}
.badge.pass{background:#064e3b;color:#6ee7b7}.badge.flag{background:#78350f;color:#fcd34d}
.card ul{margin:6px 0 0;padding-left:18px;font-size:12px;color:#cdd6e2}
.foot{margin-top:8px;font-size:10px;color:#5d6b80;border-top:1px solid #1b2536;padding-top:6px}
</style></head><body>
<h1>GraphDone — Local VLM Visual Review</h1>
<div class="summary"><strong>${passed}/${total}</strong> persona checks passed · avg score <strong>${avgScore}</strong><br>
<span class="muted">generated ${esc(generatedAt)} · evaluated by a local vision model</span></div>
${sections}
<p class="muted">Report-only. "FLAG" is the model's subjective concern from one perspective, not a hard failure — use it to spot real UX/rendering regressions worth a human look.</p>
</body></html>`;

fs.writeFileSync(OUT, html);
console.log(`✅ VLM review report: ${OUT} (${total} evaluations, ${passed} pass)`);
