#!/usr/bin/env node
/**
 * Local, read-only live test dashboard. Watches the unified-report/1 run roots in
 * GraphDone-Core (test-artifacts/unified*, overwritten each run) and GraphDone-
 * Cloud (live-full-report/<stamp>, one dir per run), accumulates trend history
 * that survives the Core overwrite, snapshots clobber-prone runs' media, and
 * serves a live SPA that pushes updates over SSE.
 *
 *   node tests/lib/dashboard/server.mjs [--port 3199] [--core <dir>] [--cloud <dir>] [--open]
 *
 * Bound to 127.0.0.1 only (no auth, no LAN exposure). Serves no command surface.
 */
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync, readFileSync, realpathSync, watch } from 'node:fs';
import { resolve, join, sep, extname } from 'node:path';
import { spawn } from 'node:child_process';
import { discover, signature, safeId, summarize } from './ingest.mjs';
import { reportMetrics, scanPerfArtifacts } from './metrics.mjs';
import { mergeRuns, mergeMetrics, readJsonl, appendJsonl, snapshotRun, pruneSnapshots } from './history.mjs';
import { renderShell } from './page.mjs';

const args = process.argv.slice(2);
const flag = (name, def) => { const i = args.indexOf(name); return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : def; };
const PORT = Number(flag('--port', process.env.DASHBOARD_PORT || 3199));
const CORE = resolve(flag('--core', process.cwd()));
const CLOUD = resolve(flag('--cloud', join(CORE, '..', 'GraphDone-Cloud')));
const OPEN = args.includes('--open');
const KEEP = Number(flag('--keep', 12));
const POLL_MS = 2500;

const ARTIFACTS = join(CORE, 'test-artifacts');
const STORE = join(ARTIFACTS, 'dashboard');
const RUNS_JSONL = join(STORE, 'runs.jsonl');
const METRICS_JSONL = join(STORE, 'metrics.jsonl');

const ROOTS = [
  { name: 'unified', label: 'Unified (latest)', path: join(ARTIFACTS, 'unified'), mode: 'slot' },
  { name: 'unified-cloudcheck', label: 'Cloud audit check', path: join(ARTIFACTS, 'unified-cloudcheck'), mode: 'slot' },
  { name: 'unified-perfcheck', label: 'Perf budgets', path: join(ARTIFACTS, 'unified-perfcheck'), mode: 'slot' },
  { name: 'unified-showcase', label: 'Showcase', path: join(ARTIFACTS, 'unified-showcase'), mode: 'slot' },
  { name: 'live-full-report', label: 'Cloudflare live', path: join(CLOUD, 'live-full-report'), mode: 'stamped' },
];

const STATIC = new Set(['app.mjs', 'charts.mjs', 'format.mjs']);
const HERE = resolve(new URL('.', import.meta.url).pathname);

const MIME = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.webp': 'image/webp', '.svg': 'image/svg+xml', '.webm': 'video/webm', '.mp4': 'video/mp4',
};
const MEDIA_EXT = new Set(Object.keys(MIME));

let state = { generatedAt: 0, latest: null, runs: [], metrics: [], roots: [] };
const runIndex = new Map();
const sseClients = new Set();

function snapshotPaths(runId) {
  const dir = join(STORE, 'runs', safeId(runId));
  return { dir, report: join(dir, 'report.json') };
}

function reindex() {
  const discovered = discover(ROOTS);
  const existingRuns = readJsonl(RUNS_JSONL);

  const summaries = [];
  for (const d of discovered) {
    const snap = snapshotPaths(d.runId);
    const srcMtime = safeMtime(join(d.dir, 'report.json'));
    const snapMtime = existsSync(snap.report) ? safeMtime(snap.report) : 0;
    if (d.mode === 'slot' && srcMtime > snapMtime) {
      try {
        const res = snapshotRun(d, STORE, { maxBytes: 200 * 1024 * 1024 });
        if (res.truncated) console.warn(`⚠️  ${d.runId}: assets ${(res.bytes / 1e6).toFixed(0)}MB exceed snapshot cap — media not snapshotted (trend kept)`);
      } catch (e) { console.warn(`⚠️  snapshot failed for ${d.runId}: ${e.message}`); }
    }
    const truncated = readTruncatedFlag(snap.dir);
    summaries.push({ ...summarize(d.report, { runId: d.runId, source: d.source, label: d.label, mode: d.mode }), snapshotTruncated: truncated });
  }

  const { merged, added } = mergeRuns(existingRuns, summaries);
  if (added.length) appendJsonl(RUNS_JSONL, added);

  const existingMetrics = readJsonl(METRICS_JSONL);
  const freshMetrics = [];
  for (const d of discovered) freshMetrics.push(...reportMetrics(d.report));
  freshMetrics.push(...scanPerfArtifacts(ARTIFACTS));
  const { added: metricsAdded } = mergeMetrics(existingMetrics, freshMetrics);
  if (metricsAdded.length) appendJsonl(METRICS_JSONL, metricsAdded);

  runIndex.clear();
  for (const r of merged) {
    const snap = snapshotPaths(r.runId);
    const live = discovered.find((d) => d.runId === r.runId);
    let reportPath = null, mediaBase = null;
    if (existsSync(snap.report)) { reportPath = snap.report; mediaBase = snap.dir; }
    else if (live) { reportPath = join(live.dir, 'report.json'); mediaBase = live.dir; }
    runIndex.set(r.runId, { reportPath, mediaBase });
    r.available = !!reportPath;
  }

  if (existsSync(join(STORE, 'runs'))) pruneSnapshots(STORE, KEEP);

  const allMetrics = readJsonl(METRICS_JSONL);
  state = {
    generatedAt: Date.now(),
    latest: merged[0] ? merged[0].runId : null,
    runs: merged,
    metrics: allMetrics.slice(-6000),
    roots: ROOTS.map((r) => ({ name: r.name, label: r.label, mode: r.mode, exists: existsSync(r.path), count: discovered.filter((d) => d.source === r.name).length })),
  };
  return added.length + metricsAdded.length;
}

function safeMtime(p) {
  try { return statSync(p).mtimeMs; } catch { return 0; }
}

function readTruncatedFlag(snapDir) {
  const p = join(snapDir, '.meta.json');
  if (!existsSync(p)) return false;
  try { return JSON.parse(readFileSync(p, 'utf8')).truncated === true; }
  catch (e) { console.warn(`⚠️  unreadable ${p}: ${e.message}`); return false; }
}

function broadcast() {
  const payload = `event: changed\ndata: ${JSON.stringify({ latest: state.latest, generatedAt: state.generatedAt })}\n\n`;
  for (const res of sseClients) { try { res.write(payload); } catch { /* */ } }
}

function send(res, code, type, body, extra = {}) {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-cache', ...extra });
  res.end(body);
}

function serveMedia(req, res, runId, href) {
  const entry = runIndex.get(runId);
  if (!entry || !entry.mediaBase) return send(res, 404, 'text/plain', 'unknown run');
  let base, target;
  try {
    base = realpathSync(entry.mediaBase);
    target = realpathSync(resolve(base, href));
  } catch { return send(res, 404, 'text/plain', 'not found'); }
  if (target !== base && !target.startsWith(base + sep)) return send(res, 403, 'text/plain', 'forbidden');
  const ext = extname(target).toLowerCase();
  if (!MEDIA_EXT.has(ext)) return send(res, 415, 'text/plain', 'unsupported');
  let st;
  try { st = statSync(target); } catch { return send(res, 404, 'text/plain', 'not found'); }
  if (!st.isFile()) return send(res, 404, 'text/plain', 'not found');
  const type = MIME[ext] || 'application/octet-stream';
  const range = req.headers.range;
  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    if (m && (m[1] || m[2])) {
      let start, end;
      if (m[1] === '') { start = Math.max(0, st.size - parseInt(m[2], 10)); end = st.size - 1; }
      else { start = parseInt(m[1], 10); end = m[2] ? parseInt(m[2], 10) : st.size - 1; }
      if (isNaN(start) || start < 0) start = 0;
      if (isNaN(end) || end >= st.size) end = st.size - 1;
      if (start > end) return send(res, 416, 'text/plain', 'range not satisfiable', { 'Content-Range': `bytes */${st.size}` });
      res.writeHead(206, { 'Content-Type': type, 'Content-Range': `bytes ${start}-${end}/${st.size}`, 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1, 'Cache-Control': 'public, max-age=31536000, immutable' });
      return createReadStream(target, { start, end }).pipe(res);
    }
  }
  res.writeHead(200, { 'Content-Type': type, 'Content-Length': st.size, 'Accept-Ranges': 'bytes', 'Cache-Control': 'public, max-age=31536000, immutable' });
  createReadStream(target).pipe(res);
}

const server = createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;
  if (req.method !== 'GET') return send(res, 405, 'text/plain', 'method not allowed');

  if (path === '/') return send(res, 200, 'text/html; charset=utf-8', renderShell(), { 'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; img-src 'self'; media-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'" });

  if (path.startsWith('/static/')) {
    const name = path.slice('/static/'.length);
    if (!STATIC.has(name)) return send(res, 404, 'text/plain', 'not found');
    try { return send(res, 200, 'text/javascript; charset=utf-8', readFileSync(join(HERE, name)), { 'Cache-Control': 'no-cache' }); }
    catch { return send(res, 404, 'text/plain', 'not found'); }
  }

  if (path === '/api/state') return send(res, 200, 'application/json', JSON.stringify(state));

  if (path.startsWith('/api/runs/')) {
    const id = decodeURIComponent(path.slice('/api/runs/'.length));
    const entry = runIndex.get(id);
    const summary = state.runs.find((r) => r.runId === id);
    if (!entry || !entry.reportPath || !summary) return send(res, 404, 'application/json', JSON.stringify({ error: 'unknown or unavailable run', id }));
    try { return send(res, 200, 'application/json', JSON.stringify({ runId: id, summary, report: JSON.parse(readFileSync(entry.reportPath, 'utf8')) })); }
    catch { return send(res, 410, 'application/json', JSON.stringify({ error: 'artifacts no longer on disk', id })); }
  }

  if (path.startsWith('/media/')) {
    const id = decodeURIComponent(path.slice('/media/'.length));
    const href = url.searchParams.get('href');
    if (!href) return send(res, 400, 'text/plain', 'missing href');
    return serveMedia(req, res, id, href);
  }

  if (path === '/api/events') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    res.write(`event: changed\ndata: ${JSON.stringify({ latest: state.latest })}\n\n`);
    sseClients.add(res);
    const hb = setInterval(() => { try { res.write(': ping\n\n'); } catch { /* */ } }, 25000);
    req.on('close', () => { clearInterval(hb); sseClients.delete(res); });
    return;
  }

  return send(res, 404, 'text/plain', 'not found');
});

let lastSig = '';
let debounce = null;
function check(force) {
  const sig = signature(ROOTS);
  if (!force && sig === lastSig) return;
  lastSig = sig;
  try { reindex(); broadcast(); } catch (e) { console.warn(`reindex error: ${e.message}`); }
}
function scheduleCheck() { clearTimeout(debounce); debounce = setTimeout(() => check(false), 400); }

server.listen(PORT, '127.0.0.1', () => {
  lastSig = signature(ROOTS);
  try { reindex(); } catch (e) { console.warn(`initial index error: ${e.message}`); }
  const url = `http://localhost:${PORT}`;
  console.log(`\n\x1b[1;36m📊 GraphDone live test dashboard\x1b[0m  ${url}`);
  console.log(`   core : ${CORE}`);
  console.log(`   cloud: ${CLOUD}`);
  console.log(`   runs : ${state.runs.length} indexed · ${state.metrics.length} metric points\n`);
  for (const root of ROOTS) {
    try { if (existsSync(root.path)) watch(root.path, { recursive: true }, scheduleCheck); } catch { /* recursive watch unsupported → poll covers it */ }
  }
  setInterval(() => check(false), POLL_MS);
  if (OPEN) { const cmd = process.platform === 'darwin' ? 'open' : 'xdg-open'; try { spawn(cmd, [url], { stdio: 'ignore', detached: true }).unref(); } catch { /* */ } }
});

process.on('SIGINT', () => { server.close(); process.exit(0); });
process.on('SIGTERM', () => { server.close(); process.exit(0); });
