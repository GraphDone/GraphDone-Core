/**
 * Pure HTML renderer for the unified report. Takes the aggregated report object
 * (sequences may carry attachments {type:'image'|'video', name, href} whose href
 * is already relative to the report dir) and returns a self-contained HTML string
 * embedding <img> screenshots and <video> .webm clips. No I/O.
 */
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const COLOR = { passed: '#34d399', failed: '#f87171', warn: '#fbbf24', skipped: '#94a3b8' };
const ICON = { passed: '✅', failed: '❌', warn: '⚠️', skipped: '⏭️' };

function attachmentHtml(a) {
  if (!a || !a.href) return '';
  if (a.type === 'video') {
    return `<figure class="att"><video src="${esc(a.href)}" controls preload="metadata" playsinline></video><figcaption>${esc(a.name || '')}</figcaption></figure>`;
  }
  return `<figure class="att"><a href="${esc(a.href)}" target="_blank"><img src="${esc(a.href)}" loading="lazy" alt="${esc(a.name || '')}"></a><figcaption>${esc(a.name || '')}</figcaption></figure>`;
}

function caseHtml(c) {
  const atts = (c.attachments || []).map(attachmentHtml).join('');
  const err = c.error ? `<pre class="err">${esc(c.error)}</pre>` : '';
  return `<div class="case ${esc(c.status)}">
    <span class="dot" style="background:${COLOR[c.status] || '#888'}"></span>
    <span class="ctitle">${esc(c.title)}</span>
    ${c.durationMs != null ? `<span class="cdur">${(c.durationMs / 1000).toFixed(1)}s</span>` : ''}
    ${err}${atts ? `<div class="atts">${atts}</div>` : ''}
  </div>`;
}

function seqHtml(seq, i) {
  const c = seq.counts || {};
  const cases = (seq.cases || []);
  // Show failed/warn cases expanded; collapse a long all-green list to just its attachments.
  const notable = cases.filter((x) => x.status === 'failed' || x.status === 'warn');
  const withAtts = cases.filter((x) => (x.attachments || []).length);
  const shown = notable.length ? notable : withAtts.slice(0, 24);
  return `<details class="seq ${esc(seq.status)}" ${seq.status === 'failed' ? 'open' : ''}>
    <summary>
      <span class="badge" style="background:${COLOR[seq.status] || '#888'}">${ICON[seq.status] || ''} ${esc(seq.status)}</span>
      <span class="sname">${esc(seq.title || seq.id)}</span>
      <span class="counts">${c.passed || 0}✓ ${c.failed || 0}✗ ${c.warned || 0}⚠ ${c.skipped || 0}⏭</span>
      ${seq.durationMs != null ? `<span class="sdur">${(seq.durationMs / 1000).toFixed(1)}s</span>` : ''}
    </summary>
    ${seq.command ? `<code class="cmd">${esc(seq.command)}</code>` : ''}
    ${seq.notes ? `<p class="notes">${esc(seq.notes)}</p>` : ''}
    ${shown.map(caseHtml).join('') || '<p class="empty">no per-case detail</p>'}
  </details>`;
}

export function renderHtml(report) {
  const r = report.rollup || {};
  const t = r.totals || {};
  const when = report.finishedAt ? new Date(report.finishedAt).toISOString() : '';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>GraphDone — Unified Test Report</title>
<style>
:root{color-scheme:dark}
*{box-sizing:border-box}
body{margin:0;background:#0b1220;color:#e2e8f0;font:14px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}
.wrap{max-width:1100px;margin:0 auto;padding:28px 20px 80px}
h1{font-size:22px;margin:0 0 4px;display:flex;align-items:center;gap:10px}
.meta{color:#94a3b8;font-size:12px;margin-bottom:20px}
.rollup{display:inline-block;padding:4px 12px;border-radius:999px;font-weight:700;color:#0b1220}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:12px;margin:18px 0 26px}
.card{background:#111a2e;border:1px solid #1e293b;border-radius:12px;padding:14px}
.card .n{font-size:26px;font-weight:800}
.card .l{color:#94a3b8;font-size:11px;text-transform:uppercase;letter-spacing:.06em}
.seq{background:#0f1729;border:1px solid #1e293b;border-radius:12px;margin:10px 0;padding:6px 14px}
.seq summary{display:flex;align-items:center;gap:12px;cursor:pointer;list-style:none;padding:8px 0}
.seq summary::-webkit-details-marker{display:none}
.badge{padding:2px 10px;border-radius:999px;font-size:11px;font-weight:700;color:#0b1220;text-transform:uppercase}
.sname{font-weight:600;flex:1}
.counts{font-variant-numeric:tabular-nums;color:#cbd5e1;font-size:12px}
.sdur,.cdur{color:#64748b;font-size:12px}
.cmd{display:block;background:#0b1220;border:1px solid #1e293b;border-radius:6px;padding:6px 8px;color:#7dd3fc;font-size:12px;margin:4px 0;overflow-x:auto}
.notes{color:#94a3b8;margin:4px 0}
.case{padding:8px 0;border-top:1px solid #16223a}
.case .dot{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:8px;vertical-align:middle}
.ctitle{vertical-align:middle}
.cdur{margin-left:8px}
.err{background:#1a1014;border:1px solid #5b2330;color:#fca5a5;border-radius:6px;padding:8px;white-space:pre-wrap;font-size:12px;margin:6px 0 0 17px}
.atts{display:flex;flex-wrap:wrap;gap:12px;margin:10px 0 4px 17px}
.att{margin:0;width:280px}
.att img,.att video{width:280px;border-radius:8px;border:1px solid #1e293b;background:#000;display:block}
.att figcaption{color:#64748b;font-size:11px;margin-top:4px;word-break:break-all}
.empty{color:#64748b;font-size:12px;padding:6px 0 10px}
footer{color:#475569;font-size:12px;margin-top:30px;text-align:center}
</style></head><body><div class="wrap">
<h1>GraphDone — Unified Test Report
  <span class="rollup" style="background:${COLOR[r.status] || '#888'}">${ICON[r.status] || ''} ${esc(r.status || 'n/a')}</span>
</h1>
<div class="meta">${esc(when)} · target ${esc(report.target || 'n/a')} · ${esc((report.env && report.env.node) || '')} · ${report.durationMs != null ? (report.durationMs / 1000).toFixed(1) + 's' : ''}</div>
<div class="cards">
  <div class="card"><div class="n">${t.sequences || 0}</div><div class="l">Sequences</div></div>
  <div class="card"><div class="n">${t.cases || 0}</div><div class="l">Cases</div></div>
  <div class="card"><div class="n" style="color:${COLOR.passed}">${t.passed || 0}</div><div class="l">Passed</div></div>
  <div class="card"><div class="n" style="color:${COLOR.failed}">${t.failed || 0}</div><div class="l">Failed</div></div>
  <div class="card"><div class="n" style="color:${COLOR.warn}">${t.warned || 0}</div><div class="l">Warn</div></div>
  <div class="card"><div class="n" style="color:${COLOR.skipped}">${t.skipped || 0}</div><div class="l">Skipped</div></div>
</div>
${(report.sequences || []).map(seqHtml).join('')}
<footer>graphdone.unified-report/1 · machine-readable companion: report.json</footer>
</div></body></html>`;
}
