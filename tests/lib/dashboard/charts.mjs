/**
 * Pure, isomorphic inline-SVG chart builders — no deps, no DOM. Returns SVG
 * markup strings usable server-side (unit tests) and in the browser (innerHTML).
 * Visual idiom mirrors tests/lib/reporting/generate-perf-report.mjs.
 */
import { esc } from './format.mjs';

export const SERIES_COLORS = ['#34d399', '#60a5fa', '#f472b6', '#fbbf24', '#a78bfa', '#22d3ee', '#fb923c', '#4ade80'];

export function niceMax(v) {
  if (!(v > 0)) return 1;
  const exp = Math.floor(Math.log10(v));
  const base = Math.pow(10, exp);
  const f = v / base;
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
  return nice * base;
}

export function bounds(series) {
  let minX = Infinity, maxX = -Infinity, maxY = 0, minY = Infinity;
  for (const s of series) for (const p of s.points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
    if (p.y < minY) minY = p.y;
  }
  if (!isFinite(minX)) { minX = 0; maxX = 1; minY = 0; maxY = 1; }
  return { minX, maxX, minY, maxY };
}

const fmtTick = (v) => {
  const a = Math.abs(v);
  if (a >= 1000) return `${Math.round(v / 100) / 10}k`;
  if (a < 1 && a > 0) return v.toFixed(2);
  return String(Math.round(v * 10) / 10);
};

const fmtDate = (ms) => {
  const d = new Date(ms);
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

/**
 * Time-series (or any numeric-x) multi-line chart.
 * series: [{ label, color?, points: [{ x, y, title? }] }]
 */
export function lineChart({ title = '', series = [], unit = '', budget = null, xIsTime = true, width = 560, height = 240 } = {}) {
  const W = width, H = height, PADL = 52, PADB = 34, PADT = 10, PADR = 14;
  const live = (series || []).map((s) => ({ ...s, points: (s.points || []).filter((p) => p && isFinite(p.x) && isFinite(p.y)).sort((a, b) => a.x - b.x) })).filter((s) => s.points.length);
  if (!live.length) return `<div class="chart empty"><h3>${esc(title)}</h3><p class="muted">no data yet</p></div>`;
  const { minX, maxX, maxY } = bounds(live);
  const top = niceMax(Math.max(maxY, budget != null ? budget : 0) * 1.08) || 1;
  const sx = (x) => PADL + ((x - minX) / (maxX - minX || 1)) * (W - PADL - PADR);
  const sy = (y) => H - PADB - (y / top) * (H - PADT - PADB);

  const grid = [0, 0.25, 0.5, 0.75, 1].map((f) => {
    const y = sy(top * f);
    return `<line x1="${PADL}" y1="${y.toFixed(1)}" x2="${W - PADR}" y2="${y.toFixed(1)}" stroke="#243044"/><text x="${PADL - 8}" y="${(y + 4).toFixed(1)}" fill="#7c8aa0" font-size="10" text-anchor="end">${fmtTick(top * f)}${esc(unit)}</text>`;
  }).join('');

  const distinctX = new Set(live.flatMap((s) => s.points.map((p) => p.x))).size;
  const nTicks = Math.min(5, Math.max(1, distinctX));
  const tickX = (i) => (nTicks === 1 ? minX : minX + ((maxX - minX) * i) / (nTicks - 1));
  const xticks = Array.from({ length: nTicks }, (_, i) => {
    const x = tickX(i);
    const lab = xIsTime ? fmtDate(x) : fmtTick(x);
    return `<text x="${sx(x).toFixed(1)}" y="${H - PADB + 16}" fill="#7c8aa0" font-size="10" text-anchor="middle">${esc(lab)}</text>`;
  }).join('');

  const budgetLine = budget != null ? `<line x1="${PADL}" y1="${sy(budget).toFixed(1)}" x2="${W - PADR}" y2="${sy(budget).toFixed(1)}" stroke="#ef4444" stroke-dasharray="5 4"/><text x="${W - PADR}" y="${(sy(budget) - 4).toFixed(1)}" fill="#ef4444" font-size="9" text-anchor="end">budget ${esc(budget)}${esc(unit)}</text>` : '';

  const paths = live.map((s, i) => {
    const c = s.color || SERIES_COLORS[i % SERIES_COLORS.length];
    const d = s.points.map((p, j) => `${j === 0 ? 'M' : 'L'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(' ');
    const dots = s.points.map((p) => `<circle cx="${sx(p.x).toFixed(1)}" cy="${sy(p.y).toFixed(1)}" r="2.5" fill="${c}"><title>${esc(s.label)} — ${esc(p.title || `${fmtTick(p.y)}${unit}`)}</title></circle>`).join('');
    return `<path d="${d}" fill="none" stroke="${c}" stroke-width="2"/>${dots}`;
  }).join('');

  const legend = live.length > 1 ? `<div class="legend">${live.map((s, i) => `<span style="color:${s.color || SERIES_COLORS[i % SERIES_COLORS.length]}">● ${esc(s.label)}</span>`).join(' ')}</div>` : '';
  return `<div class="chart"><h3>${esc(title)}</h3>${legend}<svg viewBox="0 0 ${W} ${H}" width="100%" preserveAspectRatio="xMidYMid meet">${grid}${xticks}${budgetLine}${paths}</svg></div>`;
}

/**
 * Stacked horizontal bar of passed/failed/warned/skipped counts.
 */
export function statusBar(counts = {}, { width = 260, height = 14 } = {}) {
  const order = [['passed', '#34d399'], ['warned', '#fbbf24'], ['failed', '#f87171'], ['skipped', '#94a3b8']];
  const total = order.reduce((a, [k]) => a + (counts[k] || 0), 0) || 1;
  let x = 0;
  const segs = order.map(([k, c]) => {
    const w = ((counts[k] || 0) / total) * width;
    const seg = w > 0 ? `<rect x="${x.toFixed(1)}" y="0" width="${w.toFixed(1)}" height="${height}" fill="${c}"><title>${k}: ${counts[k] || 0}</title></rect>` : '';
    x += w;
    return seg;
  }).join('');
  return `<svg class="statusbar" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">${segs}</svg>`;
}

/**
 * Tiny sparkline of a single value series (latest-trend glance).
 */
export function sparkline(values = [], { color = '#60a5fa', width = 120, height = 28 } = {}) {
  const v = values.filter((n) => isFinite(n));
  if (v.length < 2) return `<svg class="spark" width="${width}" height="${height}"></svg>`;
  const max = Math.max(...v), min = Math.min(...v), span = max - min || 1;
  const sx = (i) => (i / (v.length - 1)) * (width - 2) + 1;
  const sy = (y) => height - 2 - ((y - min) / span) * (height - 4);
  const d = v.map((y, i) => `${i === 0 ? 'M' : 'L'}${sx(i).toFixed(1)},${sy(y).toFixed(1)}`).join(' ');
  return `<svg class="spark" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}"><path d="${d}" fill="none" stroke="${color}" stroke-width="1.5"/></svg>`;
}
