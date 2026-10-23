/**
 * Append-only history store under test-artifacts/dashboard/. runs.jsonl +
 * metrics.jsonl give unbounded trend history (tiny) that survives Core's
 * overwrite of test-artifacts/unified/ each run. For clobber-prone "slot" runs
 * we snapshot report.json + assets into runs/<id>/ so media drill-down survives
 * the next run; snapshots are retention-capped. Pure merge/dedupe helpers are
 * exported separately for unit tests.
 */
import { existsSync, mkdirSync, readFileSync, appendFileSync, readdirSync, statSync, cpSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { safeId } from './ingest.mjs';

const sortKey = (r) => JSON.stringify({ ...r, available: undefined });

export function mergeRuns(existing, incoming) {
  const byId = new Map(existing.map((r) => [r.runId, r]));
  const added = [];
  for (const r of incoming) {
    const prev = byId.get(r.runId);
    const changed = !prev || sortKey(r) !== sortKey(prev);
    if (changed) { added.push(r); byId.set(r.runId, r); }
  }
  const merged = [...byId.values()].sort((a, b) => (b.finishedAt || 0) - (a.finishedAt || 0) || String(a.runId).localeCompare(String(b.runId)));
  return { merged, added };
}

/**
 * Pick the headline "latest" run for the dashboard. Runs come in newest-first
 * (as mergeRuns sorts them). Prefer the newest run whose report is actually on
 * disk (available) so the headline never points at a re-stamped/cached entry
 * that 404s on drill-down; fall back to the newest run overall, else null.
 */
export function pickLatest(runs) {
  if (!Array.isArray(runs) || !runs.length) return null;
  const available = runs.find((r) => r && r.available);
  return (available || runs[0]).runId;
}

/**
 * Drop not-measured sentinels from a stored metric series before it reaches the
 * charts. Ingestion (metrics.mjs) already filters -1 sentinels, but the
 * append-only metrics.jsonl retains points written before that fix landed; a -1
 * on a lower-is-better metric (driftPx, avgTickMs) otherwise reads as a perfect
 * score and distorts the trend. Every GraphDone metric is non-negative, so a
 * non-finite or negative value is always a sentinel.
 */
export function liveMetrics(metrics) {
  return metrics.filter((m) => m && typeof m.value === 'number' && isFinite(m.value) && m.value >= 0);
}

export function mergeMetrics(existing, incoming) {
  const seen = new Set(existing.map((m) => m.key));
  const added = [];
  for (const m of incoming) if (m.key && !seen.has(m.key)) { seen.add(m.key); added.push(m); }
  return { merged: existing.concat(added), added };
}

export function readJsonl(path) {
  if (!existsSync(path)) return [];
  const out = [];
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t) continue;
    try { out.push(JSON.parse(t)); } catch { /* skip a torn trailing line */ }
  }
  return out;
}

export function appendJsonl(path, records) {
  if (!records.length) return;
  ensureDir(join(path, '..'));
  appendFileSync(path, records.map((r) => JSON.stringify(r)).join('\n') + '\n');
}

function ensureDir(d) { if (!existsSync(d)) mkdirSync(d, { recursive: true }); }

function dirSize(dir) {
  let total = 0;
  const walk = (d) => {
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      const st = statSync(p);
      if (st.isDirectory()) walk(p); else total += st.size;
    }
  };
  try { walk(dir); } catch { /* */ }
  return total;
}

/**
 * Snapshot a slot run's report.json + assets/ into <storeDir>/runs/<safeId>/.
 * Skips the assets copy (but still copies report.json) when assets exceed
 * maxBytes, returning truncated:true so the caller can log it (no silent drop).
 */
export function snapshotRun(run, storeDir, { maxBytes = 200 * 1024 * 1024 } = {}) {
  const dest = join(storeDir, 'runs', safeId(run.runId));
  ensureDir(dest);
  const destAssets = join(dest, 'assets');
  if (existsSync(destAssets)) rmSync(destAssets, { recursive: true, force: true });
  const srcReport = join(run.dir, 'report.json');
  if (existsSync(srcReport)) cpSync(srcReport, join(dest, 'report.json'));
  const srcAssets = join(run.dir, 'assets');
  let truncated = false, bytes = 0;
  if (existsSync(srcAssets)) {
    bytes = dirSize(srcAssets);
    if (bytes <= maxBytes) cpSync(srcAssets, destAssets, { recursive: true });
    else truncated = true;
  }
  writeFileSync(join(dest, '.meta.json'), JSON.stringify({ runId: run.runId, finishedAt: run.finishedAt, truncated }, null, 2));
  return { dest, bytes, truncated };
}

export function pruneSnapshots(storeDir, keep = 12) {
  const runsDir = join(storeDir, 'runs');
  if (!existsSync(runsDir)) return [];
  const dirs = readdirSync(runsDir)
    .map((d) => join(runsDir, d))
    .filter((p) => { try { return statSync(p).isDirectory(); } catch { return false; } })
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  const removed = [];
  for (const old of dirs.slice(keep)) {
    try { rmSync(old, { recursive: true, force: true }); removed.push(old); } catch { /* */ }
  }
  return removed;
}
