/**
 * Normalizes heterogeneous perf artifacts into one flat metric-point series the
 * dashboard charts as trends:
 *   { metric, value, unit, better: 'higher'|'lower', context:{...}, ts, key }
 * Pure transforms (one per artifact shape) are split from the fs scan so they
 * unit-test against fixtures. `key` dedupes points across re-scans.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

export function pointKey(metric, context, ts) {
  const c = context || {};
  const canon = JSON.stringify(Object.keys(c).sort().reduce((a, k) => { a[k] = c[k] === undefined ? null : c[k]; return a; }, {}));
  return `${metric}|${canon}|${ts || 0}`;
}

const pt = (metric, value, unit, better, context, ts) => (
  isFinite(value) ? { metric, value: Number(value), unit, better, context: context || {}, ts: ts || 0, key: pointKey(metric, context, ts) } : null
);

export function reportMetrics(report) {
  const t = (report.rollup && report.rollup.totals) || {};
  const ts = report.finishedAt || report.startedAt || 0;
  const total = t.cases || 0;
  const passRate = total ? (t.passed / total) * 100 : 0;
  const ctx = { target: report.target || null, profile: (report.env && (report.env.profile || report.env.kind)) || null };
  return [
    pt('suite.passRate', passRate, '%', 'higher', ctx, ts),
    pt('suite.cases', total, 'count', 'higher', ctx, ts),
    pt('suite.failed', t.failed || 0, 'count', 'lower', ctx, ts),
    pt('suite.warned', t.warned || 0, 'count', 'lower', ctx, ts),
    pt('suite.durationMs', report.durationMs ?? 0, 'ms', 'lower', ctx, ts),
  ].filter(Boolean);
}

export function scaleSweepMetrics(json) {
  const ts = Date.parse(json.timestampISO || '') || 0;
  const ctx = { graphSize: json.size, quality: json.quality };
  // The scale-sweep harness writes -1 for any measurement it could not take;
  // those are not real data points, so keep them out of the trend charts.
  const measured = (v) => (typeof v === 'number' && v < 0 ? NaN : v);
  return [
    pt('graph.interactionFps', measured(json.interactionFps), 'fps', 'higher', ctx, ts),
    pt('graph.loadMs', measured(json.loadMs), 'ms', 'lower', ctx, ts),
    pt('graph.settleMs', measured(json.settleMs), 'ms', 'lower', ctx, ts),
    pt('graph.avgTickMs', measured(json.avgTickMs), 'ms', 'lower', ctx, ts),
    pt('graph.queryP95Ms', measured(json.queryP95Ms), 'ms', 'lower', ctx, ts),
    pt('graph.driftPx', measured(json.rmsFromSavedPx), 'px', 'lower', ctx, ts),
    pt('graph.idleFps', measured(json.fps), 'fps', 'higher', ctx, ts),
  ].filter(Boolean);
}

export function largeGraphMetrics(json, ts) {
  const ctx = { quality: json.quality, graph: json.graph };
  return [
    pt('graph.idleFps', json.idleFps, 'fps', 'higher', ctx, ts),
    pt('graph.panFps', json.panFps, 'fps', 'higher', ctx, ts),
    pt('graph.dragFps', json.dragFps, 'fps', 'higher', ctx, ts),
    pt('graph.zoomFps', json.zoomFps, 'fps', 'higher', ctx, ts),
    pt('graph.zoomedInDragFps', json.zoomedInDragFps, 'fps', 'higher', ctx, ts),
  ].filter(Boolean);
}

export function physicsMetrics(json, ts) {
  const s = json.summary || {};
  const ctx = { graphId: json.graphId };
  return [
    pt('physics.settleSeconds', s.settleSeconds, 's', 'lower', ctx, ts),
    pt('physics.overlapAfterOrganize', s.overlapAfterOrganize, 'count', 'lower', ctx, ts),
    pt('physics.labelOverlapAfter', s.labelOverlapAfter, 'count', 'lower', ctx, ts),
  ].filter(Boolean);
}

export function vlmMetrics(json) {
  const ts = Date.parse(json.generatedAt || '') || 0;
  const out = [];
  for (const r of json.results || []) {
    const v = r.verdict || {};
    const ctx = { persona: r.persona, context: r.context };
    if (v.score != null) out.push(pt('vlm.score', v.score, 'score', 'higher', ctx, ts));
    if (v.latencyMs != null) out.push(pt('vlm.latencyMs', v.latencyMs, 'ms', 'lower', ctx, ts));
  }
  return out.filter(Boolean);
}

function readJson(p) {
  try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; }
}
function mtime(p) {
  try { return statSync(p).mtimeMs; } catch { return 0; }
}

/** Scan the Core test-artifacts dir for perf artifacts → metric points. */
export function scanPerfArtifacts(artifactsDir) {
  const out = [];
  if (!existsSync(artifactsDir)) return out;

  const sweepDir = join(artifactsDir, 'scale-sweep');
  if (existsSync(sweepDir)) {
    for (const f of readdirSync(sweepDir).filter((f) => f.endsWith('.json') && f !== 'index.json')) {
      const j = readJson(join(sweepDir, f));
      if (j && j.size != null) out.push(...scaleSweepMetrics(j));
    }
  }

  const largeDir = join(artifactsDir, 'large-graph');
  if (existsSync(largeDir)) {
    for (const f of readdirSync(largeDir).filter((f) => f.endsWith('.json'))) {
      const p = join(largeDir, f);
      const j = readJson(p);
      if (j && j.idleFps != null) out.push(...largeGraphMetrics(j, mtime(p)));
    }
  }

  const physicsPath = join(artifactsDir, 'physics', 'report.json');
  if (existsSync(physicsPath)) {
    const j = readJson(physicsPath);
    if (j && j.summary) out.push(...physicsMetrics(j, mtime(physicsPath)));
  }

  const vlmPath = join(artifactsDir, 'vlm', 'results.json');
  if (existsSync(vlmPath)) {
    const j = readJson(vlmPath);
    if (j && Array.isArray(j.results)) out.push(...vlmMetrics(j));
  }

  return out;
}
