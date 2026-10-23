/**
 * Server-rendered HTML shell for the dashboard. All live content is filled by the
 * browser module /static/app.mjs (which imports the same pure charts.mjs +
 * format.mjs over /static/). Theme mirrors reporting/html.mjs.
 */
export function renderShell() {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>GraphDone — Live Test Dashboard</title>
<style>
:root{color-scheme:dark}
*{box-sizing:border-box}
body{margin:0;background:#0b1220;color:#e2e8f0;font:14px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}
a{color:#7dd3fc}
.wrap{max-width:1200px;margin:0 auto;padding:20px 20px 80px}
header.top{display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:6px}
h1{font-size:20px;margin:0;display:flex;align-items:center;gap:10px}
.rollup{display:inline-block;padding:3px 12px;border-radius:999px;font-weight:700;color:#0b1220;font-size:13px}
.live{display:inline-flex;align-items:center;gap:6px;font-size:12px;color:#94a3b8;margin-left:auto}
.live .dot{width:9px;height:9px;border-radius:50%;background:#475569;transition:background .3s}
.live.on .dot{background:#34d399;box-shadow:0 0 8px #34d39988}
.live.pulse .dot{animation:pp .6s ease}
@keyframes pp{0%{transform:scale(1)}50%{transform:scale(1.8)}100%{transform:scale(1)}}
.meta{color:#94a3b8;font-size:12px;margin-bottom:16px}
.tabs{display:flex;gap:8px;margin:10px 0 18px;flex-wrap:wrap}
.tab{padding:6px 14px;border-radius:8px;background:#0f1729;border:1px solid #1e293b;cursor:pointer;font-size:13px;color:#cbd5e1}
.tab.active{background:#1e293b;color:#fff;border-color:#334155}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(108px,1fr));gap:10px;margin-bottom:22px}
.card{background:#111a2e;border:1px solid #1e293b;border-radius:12px;padding:12px}
.card .n{font-size:24px;font-weight:800}
.card .l{color:#94a3b8;font-size:10px;text-transform:uppercase;letter-spacing:.06em}
.section-h{font-size:13px;color:#94a3b8;text-transform:uppercase;letter-spacing:.06em;margin:24px 0 10px;border-bottom:1px solid #1e293b;padding-bottom:6px}
.charts{display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:16px}
.chart{background:#0f1623;border:1px solid #243044;border-radius:10px;padding:12px}
.chart h3{font-size:13px;margin:0 0 4px;color:#e2e8f0}
.chart.empty{opacity:.6}
.legend{font-size:11px;margin-bottom:4px;display:flex;gap:12px;flex-wrap:wrap}
.muted{color:#7c8aa0;font-size:12px}
.runlist{display:flex;flex-direction:column;gap:8px}
.run{display:flex;align-items:center;gap:12px;background:#0f1729;border:1px solid #1e293b;border-radius:10px;padding:10px 14px;cursor:pointer}
.run:hover{border-color:#334155;background:#13203a}
.run .badge{flex-shrink:0}
.badge{padding:2px 9px;border-radius:999px;font-size:10px;font-weight:700;color:#0b1220;text-transform:uppercase}
.run .rtitle{font-weight:600}
.run .rmeta{color:#94a3b8;font-size:12px}
.run .rspacer{flex:1}
.statusbar{border-radius:4px;overflow:hidden;display:block}
.src{font-size:10px;padding:1px 7px;border-radius:5px;background:#1e293b;color:#7dd3fc;border:1px solid #334155}
.detail{margin-top:6px}
.back{display:inline-block;margin-bottom:12px;cursor:pointer;color:#7dd3fc;font-size:13px}
.seq{background:#0f1729;border:1px solid #1e293b;border-radius:12px;margin:10px 0;padding:6px 14px}
.seq summary{display:flex;align-items:center;gap:12px;cursor:pointer;list-style:none;padding:8px 0}
.seq summary::-webkit-details-marker{display:none}
.sref{background:#1e293b;color:#7dd3fc;border:1px solid #334155;border-radius:5px;padding:1px 7px;font-size:12px;font-weight:700;font-variant-numeric:tabular-nums}
.sname{font-weight:600;flex:1}
.counts{font-variant-numeric:tabular-nums;color:#cbd5e1;font-size:12px}
.case{padding:8px 0;border-top:1px solid #16223a}
.case .dot{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:8px;vertical-align:middle}
.ref{background:#0b1220;color:#fbbf24;border:1px solid #334155;border-radius:5px;padding:0 6px;font-size:11px;font-weight:700;margin-right:8px;font-variant-numeric:tabular-nums;user-select:all}
.err{background:#1a1014;border:1px solid #5b2330;color:#fca5a5;border-radius:6px;padding:8px;white-space:pre-wrap;font-size:12px;margin:6px 0 0 17px}
.atts{display:flex;flex-wrap:wrap;gap:12px;margin:10px 0 4px 17px}
.att{margin:0;width:300px}
.att img,.att video{width:300px;border-radius:8px;border:1px solid #1e293b;background:#000;display:block}
.att figcaption{color:#64748b;font-size:11px;margin-top:4px;word-break:break-all}
.empty-state{color:#64748b;padding:40px;text-align:center}
.narr-controls{display:flex;gap:10px;margin:8px 0 14px}
.narr-btn{padding:8px 16px;border-radius:8px;background:#1e293b;border:1px solid #334155;color:#e2e8f0;cursor:pointer;font-size:14px;font-weight:600}
.narr-btn:hover{background:#27364f}
.narr-stage{background:#0f1623;border:1px solid #243044;border-radius:12px;padding:12px;min-height:200px;display:flex;align-items:center;justify-content:center;margin-bottom:16px}
.narr-stage video,.narr-stage img{max-width:100%;max-height:420px;border-radius:8px;border:1px solid #1e293b;background:#000}
.narr-stage .chart{width:100%;max-width:640px}
.narr-list{display:flex;flex-direction:column;gap:8px}
.narr-seg{background:#0f1729;border:1px solid #1e293b;border-radius:10px;padding:10px 14px;cursor:pointer}
.narr-seg:hover{border-color:#334155}
.narr-seg.active{border-color:#34d399;background:#10241f;box-shadow:0 0 0 1px #34d39955}
.narr-seg-h{display:flex;align-items:center;gap:10px}
.narr-seg-t{font-weight:600;flex:1;text-transform:capitalize}
.narr-seg-d{color:#64748b;font-size:12px;font-variant-numeric:tabular-nums}
.narr-seg-text{color:#94a3b8;font-size:12px;margin-top:4px;line-height:1.5}
footer{color:#475569;font-size:12px;margin-top:40px;text-align:center}
</style></head><body><div class="wrap">
<header class="top">
  <h1>GraphDone — Live Test Dashboard <span id="rollup" class="rollup" style="background:#475569">…</span></h1>
  <span id="live" class="live"><span class="dot"></span><span id="liveLabel">connecting…</span></span>
</header>
<div class="meta" id="meta">loading…</div>
<div class="cards" id="cards"></div>
<div class="tabs" role="tablist">
  <div class="tab active" data-tab="overview" role="tab" tabindex="0">Overview</div>
  <div class="tab" data-tab="runs" role="tab" tabindex="0">Runs</div>
  <div class="tab" data-tab="media" role="tab" tabindex="0">Media</div>
  <div class="tab" data-tab="narrated" role="tab" tabindex="0">🎧 Narrated</div>
</div>
<div id="view"></div>
<footer>graphdone.unified-report/1 · live dashboard · read-only · localhost</footer>
</div>
<script type="module" src="/static/app.mjs"></script>
</body></html>`;
}
