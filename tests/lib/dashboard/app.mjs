/**
 * Browser entry (native ES module, served at /static/app.mjs). Renders the live
 * dashboard from the server JSON APIs and re-renders on SSE change events while
 * preserving the open tab / run / expanded sections. Imports the SAME pure
 * charts.mjs + format.mjs the server unit-tests — no bundler, one source.
 */
import { lineChart, statusBar } from './charts.mjs';
import { STATUS_COLOR, STATUS_ICON, esc, fmtDuration, fmtAgo, fmtClock, pct, decodeMungedName } from './format.mjs';

const $ = (id) => document.getElementById(id);
const ui = { tab: 'overview', runId: null, mediaRunId: null, open: new Set() };
let state = null;
const detailCache = new Map();

async function fetchJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json();
}

const badge = (status) => `<span class="badge" style="background:${STATUS_COLOR[status] || '#888'}">${STATUS_ICON[status] || ''} ${esc(status)}</span>`;
const mediaUrl = (runId, href) => `/media/${encodeURIComponent(runId)}?href=${encodeURIComponent(href)}`;

function renderHeader() {
  const latest = state.runs[0];
  const roll = $('rollup');
  if (latest) {
    roll.textContent = `${STATUS_ICON[latest.status] || ''} ${latest.status}`;
    roll.style.background = STATUS_COLOR[latest.status] || '#475569';
  }
  const t = latest ? latest.totals : { cases: 0, passed: 0, failed: 0, warned: 0, skipped: 0 };
  $('cards').innerHTML = [
    ['Runs', state.runs.length, '#e2e8f0'],
    ['Latest cases', t.cases, '#e2e8f0'],
    ['Passed', t.passed, STATUS_COLOR.passed],
    ['Failed', t.failed, STATUS_COLOR.failed],
    ['Warn', t.warned, STATUS_COLOR.warn],
    ['Skipped', t.skipped, STATUS_COLOR.skipped],
  ].map(([l, n, c]) => `<div class="card"><div class="n" style="color:${c}">${n}</div><div class="l">${l}</div></div>`).join('');
  const targets = [...new Set(state.runs.map((r) => r.target).filter(Boolean))];
  $('meta').innerHTML = latest
    ? `latest: ${esc(latest.label)} · ${esc(latest.target || '')} · ${esc(fmtClock(latest.finishedAt))} (${esc(fmtAgo(latest.finishedAt))}) · ${state.metrics.length} metric points · targets: ${targets.map(esc).join(', ') || '—'}`
    : 'no runs indexed yet — run a test suite (e.g. <code>npm run test:unified</code>) and it will appear here live';
}

function seriesFor(metricName) {
  const pts = state.metrics.filter((m) => m.metric === metricName && isFinite(m.ts) && m.ts > 0);
  const groups = new Map();
  for (const m of pts) {
    const ctx = m.context || {};
    const lab = [ctx.quality, ctx.graphSize != null ? `${ctx.graphSize}n` : null, ctx.persona, ctx.profile && !ctx.quality ? ctx.profile : null]
      .filter(Boolean).join(' ') || (ctx.target ? new URL(ctx.target).host : 'series');
    if (!groups.has(lab)) groups.set(lab, []);
    groups.get(lab).push({ x: m.ts, y: m.value, title: `${fmtClock(m.ts)} — ${Math.round(m.value * 100) / 100}${m.unit || ''}` });
  }
  return [...groups.entries()].map(([label, points]) => ({ label, points }));
}

const CHART_DEFS = [
  { metric: 'suite.passRate', title: 'Suite pass rate over time', unit: '%' },
  { metric: 'suite.cases', title: 'Total checks over time', unit: '' },
  { metric: 'suite.failed', title: 'Failures over time', unit: '' },
  { metric: 'suite.durationMs', title: 'Suite duration', unit: 'ms' },
  { metric: 'graph.idleFps', title: 'Idle FPS', unit: 'fps' },
  { metric: 'graph.dragFps', title: 'Drag FPS', unit: 'fps' },
  { metric: 'graph.interactionFps', title: 'Interaction FPS (scale sweep)', unit: 'fps' },
  { metric: 'graph.loadMs', title: 'Graph load time', unit: 'ms', budget: null },
  { metric: 'graph.avgTickMs', title: 'Sim tick cost', unit: 'ms', budget: 8 },
  { metric: 'graph.queryP95Ms', title: 'Query p95 latency', unit: 'ms', budget: 800 },
  { metric: 'graph.driftPx', title: 'Layout drift', unit: 'px', budget: 25 },
  { metric: 'physics.settleSeconds', title: 'Physics settle time', unit: 's' },
  { metric: 'vlm.score', title: 'VLM visual score', unit: 'score' },
];

function renderOverview() {
  const charts = CHART_DEFS.map((d) => {
    const series = seriesFor(d.metric);
    if (!series.length) return '';
    return lineChart({ title: d.title, series, unit: d.unit, budget: d.budget ?? null, xIsTime: true });
  }).filter(Boolean).join('');
  $('view').innerHTML = `<div class="section-h">Performance &amp; health trends</div>`
    + (charts ? `<div class="charts">${charts}</div>` : `<p class="muted">No metric points yet. Run perf suites (scale-sweep, large-graph, physics, vlm) or any unified run and trends accumulate here.</p>`)
    + `<div class="section-h">Recent runs</div><div class="runlist">${state.runs.slice(0, 6).map(runRow).join('') || '<p class="muted">none</p>'}</div>`;
  wireRuns();
}

function runRow(r) {
  return `<div class="run" data-run="${esc(r.runId)}" tabindex="0" role="button" aria-label="${esc(r.label)} — ${esc(r.status)}, ${r.totals.cases} checks">
    ${badge(r.status)}
    <span class="src">${esc(r.source)}</span>
    <span class="rtitle">${esc(r.label)}</span>
    <span class="rmeta">${esc(r.target || '')}</span>
    ${r.sources && r.sources.length ? `<span class="rmeta">${r.sources.map(esc).join(' · ')}</span>` : ''}
    <span class="rspacer"></span>
    ${statusBar(r.totals)}
    <span class="rmeta">${r.totals.cases} checks${r.mediaCount ? ` · ${r.mediaCount} media` : ''}</span>
    <span class="rmeta">${esc(fmtAgo(r.finishedAt))}</span>
  </div>`;
}

function renderRuns() {
  $('view').innerHTML = `<div class="runlist">${state.runs.map(runRow).join('') || '<p class="empty-state">No runs indexed yet.</p>'}</div>`;
  wireRuns();
}

function wireRuns() {
  document.querySelectorAll('.run[data-run]').forEach((el) => el.onclick = () => openRun(el.getAttribute('data-run')));
}

function wireBack() {
  const b = document.querySelector('#view .back');
  if (b) b.onclick = () => { ui.runId = null; setTab('runs'); };
}

async function openRun(runId) {
  ui.runId = runId;
  setTab('detail', false);
  let detail = detailCache.get(runId);
  let loadingTimer;
  if (!detail) {
    loadingTimer = setTimeout(() => { $('view').innerHTML = `<span class="back" tabindex="0" role="button">← back</span><p class="muted">loading ${esc(runId)}…</p>`; wireBack(); }, 250);
    try { detail = await fetchJSON(`/api/runs/${encodeURIComponent(runId)}`); detailCache.set(runId, detail); }
    catch (e) {
      clearTimeout(loadingTimer);
      $('view').innerHTML = `<span class="back" tabindex="0" role="button">← back</span><p class="err">Could not load run: ${esc(String(e))}</p>`;
      wireBack();
      return;
    }
    clearTimeout(loadingTimer);
  }
  renderDetail(detail);
}

function caseHtml(runId, c) {
  const atts = (c.attachments || []).map((a) => {
    const url = mediaUrl(runId, a.href);
    if (a.type === 'video') return `<figure class="att"><video src="${esc(url)}" controls preload="metadata" playsinline></video><figcaption>${esc(decodeMungedName(a.name || a.href))}</figcaption></figure>`;
    return `<figure class="att"><a href="${esc(url)}" target="_blank"><img src="${esc(url)}" loading="lazy" alt="${esc(a.name || '')}"></a><figcaption>${esc(decodeMungedName(a.name || a.href))}</figcaption></figure>`;
  }).join('');
  return `<div class="case">
    <span class="dot" style="background:${STATUS_COLOR[c.status] || '#888'}"></span>
    ${c.ref ? `<code class="ref">${esc(c.ref)}</code>` : ''}
    <span>${esc(c.title || '')}</span>
    ${c.error ? `<pre class="err">${esc(c.error)}</pre>` : ''}
    ${atts ? `<div class="atts">${atts}</div>` : ''}
  </div>`;
}

function seqHtml(runId, seq) {
  const c = seq.counts || {};
  const key = `${runId}#${seq.ref || seq.id}`;
  const open = ui.open.has(key) || seq.status === 'failed' || seq.status === 'warn';
  return `<details class="seq" data-seq="${esc(key)}" ${open ? 'open' : ''}>
    <summary>${badge(seq.status)}${seq.ref ? `<code class="sref">§${esc(seq.ref)}</code>` : ''}<span class="sname">${esc(seq.title || seq.id)}</span><span class="counts">${c.passed || 0}✓ ${c.failed || 0}✗ ${c.warned || 0}⚠ ${c.skipped || 0}⏭</span></summary>
    ${(seq.cases || []).map((cs) => caseHtml(runId, cs)).join('') || '<p class="muted">no per-case detail</p>'}
  </details>`;
}

function renderDetail(detail) {
  const r = detail.report;
  const s = detail.summary;
  $('view').innerHTML = `<span class="back" tabindex="0" role="button">← back to runs</span>
    <div class="section-h">${badge(s.status)} &nbsp;${esc(s.label)} <span class="src">${esc(s.source)}</span></div>
    <div class="meta">${esc(s.target || '')} · ${esc(fmtClock(s.finishedAt))} · ${esc(fmtDuration(s.durationMs))} · ${s.totals.cases} checks · ${pct(s.totals.passed, s.totals.cases)}% pass${s.sources && s.sources.length ? ` · sources: ${s.sources.map(esc).join(', ')}` : ''}${s.snapshotTruncated ? ' · <span style="color:#fbbf24">media too large to snapshot</span>' : ''}</div>
    ${(r.sequences || []).map((seq) => seqHtml(s.runId, seq)).join('')}`;
  wireBack();
  document.querySelectorAll('details[data-seq]').forEach((d) => d.addEventListener('toggle', () => {
    const k = d.getAttribute('data-seq');
    if (d.open) ui.open.add(k); else ui.open.delete(k);
  }));
}

async function renderMedia() {
  const mediaRuns = state.runs.filter((r) => r.mediaCount > 0);
  if (!mediaRuns.length) { $('view').innerHTML = '<p class="empty-state">No screenshots or videos captured yet. Run the showcase/live-tour suites and clips appear here.</p>'; return; }
  if (!ui.mediaRunId || !mediaRuns.find((r) => r.runId === ui.mediaRunId)) ui.mediaRunId = mediaRuns[0].runId;
  const picker = `<div class="tabs">${mediaRuns.map((r) => `<div class="tab ${r.runId === ui.mediaRunId ? 'active' : ''}" data-mrun="${esc(r.runId)}">${esc(r.label)} · ${r.mediaCount}</div>`).join('')}</div>`;
  $('view').innerHTML = picker + '<p class="muted">loading media…</p>';
  document.querySelectorAll('[data-mrun]').forEach((el) => el.onclick = () => { ui.mediaRunId = el.getAttribute('data-mrun'); renderMedia(); });
  let detail = detailCache.get(ui.mediaRunId);
  try { if (!detail) { detail = await fetchJSON(`/api/runs/${encodeURIComponent(ui.mediaRunId)}`); detailCache.set(ui.mediaRunId, detail); } } catch { return; }
  const cases = [];
  for (const seq of detail.report.sequences || []) for (const c of seq.cases || []) if ((c.attachments || []).length) cases.push(c);
  $('view').innerHTML = picker + `<div class="atts" style="margin-left:0">${cases.flatMap((c) => (c.attachments || []).map((a) => {
    const url = mediaUrl(ui.mediaRunId, a.href);
    const cap = `${c.ref ? '§' + c.ref + ' ' : ''}${decodeMungedName(a.name || a.href)}`;
    return a.type === 'video'
      ? `<figure class="att"><video src="${esc(url)}" controls preload="metadata" playsinline></video><figcaption>${esc(cap)}</figcaption></figure>`
      : `<figure class="att"><a href="${esc(url)}" target="_blank"><img src="${esc(url)}" loading="lazy"></a><figcaption>${esc(cap)}</figcaption></figure>`;
  })).join('') || '<p class="muted">no media in this run</p>'}</div>`;
  document.querySelectorAll('[data-mrun]').forEach((el) => el.onclick = () => { ui.mediaRunId = el.getAttribute('data-mrun'); renderMedia(); });
}

function setTab(tab, render = true) {
  ui.tab = tab;
  document.querySelectorAll('.tab[data-tab]').forEach((el) => el.classList.toggle('active', el.getAttribute('data-tab') === tab));
  if (tab !== 'narrated') { try { narrAudio.pause(); narrIdx = -1; } catch { /* */ } }
  if (!render) return;
  if (tab === 'overview') renderOverview();
  else if (tab === 'runs') renderRuns();
  else if (tab === 'media') renderMedia();
  else if (tab === 'narrated') renderNarrated();
}

const narrAudio = new Audio();
let narration = null;
let narrIdx = -1;

function chartDef(ref) { return CHART_DEFS.find((d) => d.metric === ref) || { metric: ref, title: ref, unit: '' }; }

function narrMediaHtml(seg) {
  const m = seg.media || { kind: 'none' };
  if (m.kind === 'chart') {
    const d = chartDef(m.ref);
    return lineChart({ title: d.title, series: seriesFor(d.metric), unit: d.unit, budget: d.budget ?? null, xIsTime: true });
  }
  if (m.kind === 'video' && m.runId && m.href) return `<video src="${esc(mediaUrl(m.runId, m.href))}" autoplay muted loop playsinline></video>`;
  if (m.kind === 'image' && m.runId && m.href) return `<img src="${esc(mediaUrl(m.runId, m.href))}" alt="${esc(seg.title)}">`;
  return '<div class="muted" style="padding:40px;text-align:center">no media for this segment</div>';
}

function playNarrSegment(i) {
  if (!narration || i < 0 || i >= narration.segments.length) { narrIdx = -1; return; }
  narrIdx = i;
  const seg = narration.segments[i];
  const stage = $('narr-stage');
  if (stage) stage.innerHTML = narrMediaHtml(seg);
  document.querySelectorAll('.narr-seg').forEach((el) => el.classList.toggle('active', Number(el.getAttribute('data-i')) === i));
  const row = document.querySelector(`.narr-seg[data-i="${i}"]`);
  if (row) row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  narrAudio.src = `/narration/${encodeURIComponent(seg.audioHref)}`;
  narrAudio.play().catch(() => {});
}

narrAudio.onended = () => { if (ui.tab === 'narrated' && narrIdx >= 0) playNarrSegment(narrIdx + 1); };

async function renderNarrated() {
  let data;
  try { data = await fetchJSON('/api/narration'); }
  catch {
    narrAudio.pause();
    $('view').innerHTML = `<div class="empty-state">No narrated report yet.<br><br>Generate it with <code>npm run dashboard:narrate</code> (renders a piper-tts walkthrough of the latest results), then reopen this tab.</div>`;
    return;
  }
  narration = data;
  const mins = Math.round((data.totalDurationMs || 0) / 600) / 100;
  $('view').innerHTML = `
    <div class="section-h">🎧 Narrated progress report</div>
    <div class="meta">voice ${esc(data.voice || '')} · ${data.segments.length} segments · ~${mins} min · narrated by piper-tts${data.full ? ` · <a href="/narration/${esc(data.full.audioHref)}" download>download full track</a>` : ''}</div>
    <div class="narr-controls"><button id="narr-play" class="narr-btn">▶ Play narrated report</button><button id="narr-stop" class="narr-btn">■ Stop</button></div>
    <div id="narr-stage" class="narr-stage"><div class="muted" style="padding:40px;text-align:center">press play</div></div>
    <div class="narr-list">${data.segments.map((s, i) => `<div class="narr-seg" data-i="${i}" tabindex="0" role="button"><div class="narr-seg-h"><span class="narr-seg-t">${esc(s.title)}</span><span class="narr-seg-d">${((s.durationMs || 0) / 1000).toFixed(0)}s</span></div><div class="narr-seg-text">${esc(s.text)}</div></div>`).join('')}</div>`;
  $('narr-play').onclick = () => playNarrSegment(0);
  $('narr-stop').onclick = () => { narrAudio.pause(); narrIdx = -1; document.querySelectorAll('.narr-seg').forEach((el) => el.classList.remove('active')); };
  document.querySelectorAll('.narr-seg').forEach((el) => el.onclick = () => playNarrSegment(Number(el.getAttribute('data-i'))));
}

function rerender() {
  renderHeader();
  if (ui.tab === 'detail' && ui.runId) openRun(ui.runId);
  else if (ui.tab === 'narrated') { /* leave the narration player undisturbed by live run updates */ }
  else setTab(ui.tab);
}

async function refresh() {
  state = await fetchJSON('/api/state');
  rerender();
}

function connectSSE() {
  const live = $('live');
  const label = $('liveLabel');
  const es = new EventSource('/api/events');
  es.onopen = () => { live.classList.add('on'); label.textContent = 'live'; };
  es.onerror = () => { live.classList.remove('on'); label.textContent = 'reconnecting…'; };
  es.addEventListener('changed', async () => {
    live.classList.add('pulse'); setTimeout(() => live.classList.remove('pulse'), 700);
    const y = window.scrollY;
    detailCache.clear();
    try { await refresh(); window.scrollTo(0, y); } catch { /* */ }
  });
}

document.querySelectorAll('.tab[data-tab]').forEach((el) => el.onclick = () => { ui.runId = null; setTab(el.getAttribute('data-tab')); });
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const el = e.target.closest && e.target.closest('[data-run],[data-tab],[data-mrun],.narr-seg,.back');
  if (el) { e.preventDefault(); el.click(); }
});

refresh().then(connectSSE).catch((e) => { $('meta').innerHTML = `<span class="err">${esc(String(e))}</span>`; });
