#!/usr/bin/env node
/**
 * Renders the large-scale perf sweep into a single self-contained page:
 *   test-artifacts/scale-sweep/index.html
 *
 * Input: test-artifacts/scale-sweep/<size>n-<quality>.json (from scale-sweep.spec.ts)
 * Output: an HTML table of every metric plus inline SVG line charts (no deps,
 * no external assets) showing how settle time, tick cost, FPS, drift and query
 * latency scale with graph size, per quality tier.
 */
import * as fs from 'fs';
import * as path from 'path';

const DIR = path.resolve(process.cwd(), 'test-artifacts/scale-sweep');
const OUT = path.join(DIR, 'index.html');

if (!fs.existsSync(DIR)) {
  console.error(`No sweep results at ${DIR} — run "npm run test:perf:scale" first.`);
  process.exit(1);
}

const rows = fs
  .readdirSync(DIR)
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')))
  .sort((a, b) => a.size - b.size || String(a.quality).localeCompare(b.quality));

if (rows.length === 0) {
  console.error('No JSON sweep results found.');
  process.exit(1);
}

const qualities = [...new Set(rows.map((r) => r.quality))];
const sizes = [...new Set(rows.map((r) => r.size))].sort((a, b) => a - b);
const COLORS = ['#34d399', '#60a5fa', '#f472b6', '#fbbf24', '#a78bfa'];

const num = (v) => (typeof v === 'number' && v >= 0 ? v : null);

function lineChart(title, key, { unit = '', budget = null } = {}) {
  const W = 560, H = 260, PADL = 56, PADB = 36, PADT = 28, PADR = 16;
  const series = qualities.map((q) => ({
    q,
    pts: sizes.map((s) => {
      const row = rows.find((r) => r.size === s && r.quality === q);
      return { x: s, y: row ? num(row[key]) : null };
    }).filter((p) => p.y !== null),
  })).filter((s) => s.pts.length);
  const allY = series.flatMap((s) => s.pts.map((p) => p.y)).concat(budget != null ? [budget] : []);
  if (allY.length === 0) return '';
  const maxY = Math.max(...allY) * 1.1 || 1;
  const maxX = Math.max(...sizes);
  const minX = Math.min(...sizes);
  const sx = (x) => PADL + ((x - minX) / (maxX - minX || 1)) * (W - PADL - PADR);
  const sy = (y) => H - PADB - (y / maxY) * (H - PADT - PADB);

  const grid = [0, 0.25, 0.5, 0.75, 1].map((f) => {
    const y = sy(maxY * f);
    return `<line x1="${PADL}" y1="${y}" x2="${W - PADR}" y2="${y}" stroke="#243044"/><text x="${PADL - 8}" y="${y + 4}" fill="#7c8aa0" font-size="11" text-anchor="end">${Math.round(maxY * f)}</text>`;
  }).join('');
  const xticks = sizes.map((s) => `<text x="${sx(s)}" y="${H - PADB + 18}" fill="#7c8aa0" font-size="11" text-anchor="middle">${s}</text>`).join('');
  const budgetLine = budget != null ? `<line x1="${PADL}" y1="${sy(budget)}" x2="${W - PADR}" y2="${sy(budget)}" stroke="#ef4444" stroke-dasharray="5 4"/><text x="${W - PADR}" y="${sy(budget) - 5}" fill="#ef4444" font-size="10" text-anchor="end">budget ${budget}${unit}</text>` : '';
  const lines = series.map((s, i) => {
    const c = COLORS[qualities.indexOf(s.q) % COLORS.length];
    const d = s.pts.map((p, j) => `${j === 0 ? 'M' : 'L'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(' ');
    const dots = s.pts.map((p) => `<circle cx="${sx(p.x).toFixed(1)}" cy="${sy(p.y).toFixed(1)}" r="3" fill="${c}"><title>${s.q} @ ${p.x}n: ${p.y}${unit}</title></circle>`).join('');
    return `<path d="${d}" fill="none" stroke="${c}" stroke-width="2"/>${dots}`;
  }).join('');
  const legend = series.map((s, i) => {
    const c = COLORS[qualities.indexOf(s.q) % COLORS.length];
    return `<span style="color:${c}">● ${s.q}</span>`;
  }).join('&nbsp;&nbsp;');
  return `<div class="chart"><h3>${title}</h3><div class="legend">${legend}</div><svg viewBox="0 0 ${W} ${H}" width="100%">${grid}${xticks}${budgetLine}${lines}<text x="${W / 2}" y="${H - 4}" fill="#7c8aa0" font-size="11" text-anchor="middle">graph size (nodes)</text></svg></div>`;
}

const HEADERS = [
  ['size', 'nodes'], ['quality', 'quality'], ['renderedNodes', 'rendered n'], ['renderedEdges', 'rendered e'],
  ['loadMs', 'load ms'], ['settleMs', 'settle ms'], ['finalAlpha', 'alpha'], ['avgTickMs', 'tick ms'],
  ['p95TickMs', 'tick p95'], ['fps', 'fps'], ['droppedFrames', 'dropped'], ['rmsFromSavedPx', 'drift px'],
  ['queryP95Ms', 'query p95'],
];
const tableRows = rows.map((r) => `<tr>${HEADERS.map(([k]) => `<td>${r[k] === null ? '—' : r[k]}</td>`).join('')}</tr>`).join('');

const html = `<!doctype html><html><head><meta charset="utf-8"><title>GraphDone — Large-Scale Perf Sweep</title>
<style>
body{background:#0b1018;color:#e6edf6;font:14px/1.5 system-ui,sans-serif;margin:0;padding:24px}
h1{font-size:20px}h2{font-size:16px;margin-top:32px;border-bottom:1px solid #243044;padding-bottom:6px}
h3{font-size:13px;margin:0 0 4px}.muted{color:#7c8aa0}
table{border-collapse:collapse;width:100%;margin-top:12px;font-variant-numeric:tabular-nums}
th,td{border:1px solid #243044;padding:6px 8px;text-align:right}th{background:#131c2b;position:sticky;top:0}
td:nth-child(2){text-align:center}
.charts{display:grid;grid-template-columns:repeat(auto-fit,minmax(380px,1fr));gap:20px;margin-top:16px}
.chart{background:#0f1623;border:1px solid #243044;border-radius:10px;padding:12px}
.legend{font-size:11px;margin-bottom:4px}
</style></head><body>
<h1>GraphDone — Large-Scale Graph Performance Sweep</h1>
<p class="muted">${rows.length} runs · sizes ${sizes.join(', ')} · qualities ${qualities.join(', ')} · generated ${new Date().toISOString()}</p>
<div class="charts">
${lineChart('Settle time vs size', 'settleMs', { unit: 'ms' })}
${lineChart('Avg simulation tick vs size', 'avgTickMs', { unit: 'ms', budget: 8 })}
${lineChart('Frame rate vs size', 'fps', { unit: '' })}
${lineChart('Layout drift vs size', 'rmsFromSavedPx', { unit: 'px', budget: 25 })}
${lineChart('Query p95 latency vs size', 'queryP95Ms', { unit: 'ms', budget: 800 })}
${lineChart('Initial load vs size', 'loadMs', { unit: 'ms' })}
</div>
<h2>All metrics</h2>
<table><thead><tr>${HEADERS.map(([, h]) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${tableRows}</tbody></table>
<p class="muted" style="margin-top:24px">Report-only. Budgets shown (red dashed) mirror the @perf gate; this sweep characterises how they scale, it does not enforce them.</p>
</body></html>`;

fs.writeFileSync(OUT, html);
console.log(`✅ Perf sweep report: ${OUT} (${rows.length} runs)`);
