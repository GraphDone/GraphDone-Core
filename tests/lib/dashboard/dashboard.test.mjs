import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { rollupStatus, fmtDuration, fmtBytes, pct, decodeMungedName, esc, STATUS_COLOR } from './format.mjs';
import { niceMax, bounds, lineChart, statusBar, sparkline } from './charts.mjs';
import { isUnifiedReport, runIdFor, summarize, mediaCount, safeId } from './ingest.mjs';
import { reportMetrics, scaleSweepMetrics, largeGraphMetrics, physicsMetrics, vlmMetrics, pointKey } from './metrics.mjs';
import { mergeRuns, mergeMetrics, readJsonl, appendJsonl, snapshotRun, pruneSnapshots, pickLatest } from './history.mjs';

// ── format ────────────────────────────────────────────────────────────────
test('rollupStatus: worst-of precedence', () => {
  assert.equal(rollupStatus(['passed', 'warn', 'failed']), 'failed');
  assert.equal(rollupStatus(['passed', 'warn']), 'warn');
  assert.equal(rollupStatus(['passed', 'skipped']), 'passed');
  assert.equal(rollupStatus([]), 'skipped');
});
test('fmtDuration buckets', () => {
  assert.equal(fmtDuration(450), '450ms');
  assert.equal(fmtDuration(5893), '5.9s');
  assert.equal(fmtDuration(98156), '1m 38s');
  assert.equal(fmtDuration(null), '—');
});
test('fmtBytes', () => {
  assert.equal(fmtBytes(900), '900 B');
  assert.equal(fmtBytes(2048), '2 KB');
  assert.equal(fmtBytes(3 * 1024 * 1024), '3.0 MB');
});
test('pct', () => {
  assert.equal(pct(212, 212), 100);
  assert.equal(pct(1, 3), 33.3);
  assert.equal(pct(0, 0), 0);
});
test('decodeMungedName humanizes', () => {
  assert.equal(decodeMungedName('tour-graph-overview.mp4'), 'Graph Overview');
  assert.equal(decodeMungedName('audit-route_'), 'Route');
  assert.equal(decodeMungedName(''), '—');
});
test('esc escapes html', () => {
  assert.equal(esc('<a href="x">&'), '&lt;a href=&quot;x&quot;&gt;&amp;');
});

// ── charts ──────────────────────────────────────────────────────────────────
test('niceMax rounds up to 1/2/5×10^n', () => {
  assert.equal(niceMax(0), 1);
  assert.equal(niceMax(7), 10);
  assert.equal(niceMax(42), 50);
  assert.equal(niceMax(130), 200);
});
test('bounds over multi-series', () => {
  const b = bounds([{ points: [{ x: 1, y: 5 }, { x: 3, y: 9 }] }, { points: [{ x: 2, y: 2 }] }]);
  assert.equal(b.minX, 1); assert.equal(b.maxX, 3); assert.equal(b.maxY, 9);
});
test('lineChart returns svg with data, empty fallback without', () => {
  const svg = lineChart({ title: 'FPS', series: [{ label: 'HIGH', points: [{ x: 1000, y: 58 }, { x: 2000, y: 60 }] }], unit: 'fps' });
  assert.match(svg, /<svg/);
  assert.match(svg, /<path/);
  const empty = lineChart({ title: 'none', series: [] });
  assert.match(empty, /no data yet/);
});
test('lineChart drops non-finite points safely', () => {
  const svg = lineChart({ title: 'x', series: [{ label: 'a', points: [{ x: 1, y: NaN }, { x: 2, y: 5 }, { x: 3, y: 7 }] }] });
  assert.match(svg, /<svg/);
});
test('lineChart renders single-point + all-equal-y without duplicate ticks or throw', () => {
  const one = lineChart({ title: 'one', series: [{ label: 'a', points: [{ x: 1700000000000, y: 58 }] }], unit: 'fps' });
  assert.match(one, /<svg/);
  const eq = lineChart({ title: 'flat', series: [{ label: 'a', points: [{ x: 1, y: 5 }, { x: 2, y: 5 }] }] });
  assert.match(eq, /<path/);
});
test('statusBar emits a segment per nonzero status', () => {
  const svg = statusBar({ passed: 8, failed: 2, warned: 0, skipped: 0 });
  assert.equal((svg.match(/<rect/g) || []).length, 2);
});
test('sparkline needs 2+ points', () => {
  assert.doesNotMatch(sparkline([5]), /<path/);
  assert.match(sparkline([5, 6, 4]), /<path/);
});

// ── ingest ──────────────────────────────────────────────────────────────────
const sampleReport = {
  schema: 'graphdone.unified-report/1', startedAt: 1000, finishedAt: 4000, durationMs: 3000,
  target: 'http://localhost:3127', env: { node: 'v20', profile: 'smoke' },
  rollup: { status: 'passed', totals: { passed: 5, failed: 0, warned: 0, skipped: 0, cases: 5, sequences: 2 } },
  sequences: [
    { id: 'unit', title: 'Unit', kind: 'unit', status: 'passed', counts: { passed: 3 }, cases: [] },
    { id: 'smoke', ref: '2', title: 'Smoke', kind: 'e2e', status: 'passed', counts: { passed: 2 }, cases: [
      { ref: '2.1', title: 'a', status: 'passed', attachments: [{ type: 'image', name: 'x', href: 'assets/0.png' }] },
      { ref: '2.2', title: 'b', status: 'passed', attachments: [{ type: 'video', name: 'y', href: 'assets/1.webm' }] },
    ] },
  ],
};
test('isUnifiedReport validates schema + sequences', () => {
  assert.ok(isUnifiedReport(sampleReport));
  assert.ok(!isUnifiedReport({ schema: 'other', sequences: [] }));
  assert.ok(!isUnifiedReport({ schema: 'graphdone.unified-report/1' }));
  assert.ok(!isUnifiedReport(null));
});
test('runIdFor: stamped uses dir, slot uses finishedAt, falls back to mtime', () => {
  assert.equal(runIdFor('live-full-report', { mode: 'stamped', dirName: '2026-06-19T05-07Z', report: sampleReport }), 'live-full-report/2026-06-19T05-07Z');
  assert.equal(runIdFor('unified', { mode: 'slot', report: sampleReport }), 'unified/4000');
  assert.equal(runIdFor('unified', { mode: 'slot', report: {}, mtimeMs: 555.7 }), 'unified/556');
});
test('mediaCount counts attachments across cases', () => {
  assert.equal(mediaCount(sampleReport), 2);
});
test('summarize extracts totals + status + media', () => {
  const s = summarize(sampleReport, { runId: 'unified/4000', source: 'unified', label: 'L', mode: 'slot' });
  assert.equal(s.status, 'passed');
  assert.equal(s.totals.cases, 5);
  assert.equal(s.mediaCount, 2);
  assert.equal(s.finishedAt, 4000);
  assert.equal(s.durationMs, 3000);
});
test('summarize handles a real Core report (no refs) and a Cloud report (hierarchical refs + sources)', () => {
  const coreLike = { schema: 'graphdone.unified-report/1', startedAt: 1, finishedAt: 2, target: 'http://localhost:3127', env: { node: 'v20', profile: 'smoke' }, rollup: { status: 'passed', totals: { passed: 205, cases: 205, sequences: 1 } }, sequences: [{ id: 'unit-web', title: 'Web unit tests', kind: 'unit', status: 'passed', counts: { passed: 205 }, cases: [] }] };
  const cs = summarize(coreLike, { runId: 'unified/2', source: 'unified', label: 'U', mode: 'slot' });
  assert.equal(cs.totals.cases, 205);
  assert.equal(cs.mediaCount, 0);
  assert.equal(cs.sources, null);
  const cloudLike = { schema: 'graphdone.unified-report/1', startedAt: 10, finishedAt: 20, target: 'https://graphdone-cloud.pages.dev', env: { node: 'v20', kind: 'live-full', sources: ['Live Audit', 'Red Team'] }, rollup: { status: 'warn', totals: { passed: 1, warned: 1, cases: 2, sequences: 1 } }, sequences: [{ id: 'audit-auth', ref: '1.1', title: 'Live Audit · AUTH', kind: 'audit', status: 'warn', counts: { passed: 1, warned: 1 }, cases: [{ ref: '1.1.1', title: 'x', status: 'passed', attachments: [{ type: 'image', name: 'route_', href: 'assets/audit-route_.jpg' }] }] }] };
  const cl = summarize(cloudLike, { runId: 'live-full-report/s', source: 'live-full-report', label: 'C', mode: 'stamped' });
  assert.deepEqual(cl.sources, ['Live Audit', 'Red Team']);
  assert.equal(cl.profile, 'live-full');
  assert.equal(cl.mediaCount, 1);
  assert.ok(!('sequenceTitles' in cl));
});
test('safeId strips unsafe chars', () => {
  assert.equal(safeId('unified/4000'), 'unified_4000');
  assert.equal(safeId('a/../b'), 'a_.._b');
});

// ── metrics ─────────────────────────────────────────────────────────────────
test('reportMetrics derives pass rate + duration', () => {
  const m = reportMetrics(sampleReport);
  const rate = m.find((x) => x.metric === 'suite.passRate');
  assert.equal(rate.value, 100);
  assert.equal(rate.ts, 4000);
  assert.ok(m.find((x) => x.metric === 'suite.durationMs').value === 3000);
});
test('scaleSweepMetrics maps fps/load/etc with context', () => {
  const m = scaleSweepMetrics({ size: 1000, quality: 'HIGH', interactionFps: 45, loadMs: 1200, settleMs: 3000, avgTickMs: 6, queryP95Ms: 300, rmsFromSavedPx: 4, fps: 58, timestampISO: '2026-06-19T00:00:00Z' });
  const fps = m.find((x) => x.metric === 'graph.interactionFps');
  assert.equal(fps.value, 45);
  assert.equal(fps.context.graphSize, 1000);
  assert.equal(fps.context.quality, 'HIGH');
  assert.equal(fps.better, 'higher');
});
test('scaleSweepMetrics drops -1 not-measured sentinels', () => {
  const m = scaleSweepMetrics({ size: 500, quality: 'ULTRA', interactionFps: -1, loadMs: 1200, settleMs: 0, avgTickMs: -1, queryP95Ms: -1, rmsFromSavedPx: -1, fps: -1, timestampISO: '2026-06-19T00:00:00Z' });
  for (const metric of ['graph.interactionFps', 'graph.avgTickMs', 'graph.queryP95Ms', 'graph.driftPx', 'graph.idleFps']) {
    assert.equal(m.find((x) => x.metric === metric), undefined, `${metric} sentinel should be dropped`);
  }
  assert.equal(m.find((x) => x.metric === 'graph.loadMs').value, 1200);
  assert.equal(m.find((x) => x.metric === 'graph.settleMs').value, 0);
});
test('largeGraphMetrics drops -1 not-measured fps sentinels', () => {
  const m = largeGraphMetrics({ quality: 'HIGH', graph: 'g', idleFps: 60, panFps: 55, dragFps: -1, zoomFps: 48, zoomedInDragFps: -1 }, 123);
  assert.equal(m.find((x) => x.metric === 'graph.dragFps'), undefined, 'dragFps sentinel should be dropped');
  assert.equal(m.find((x) => x.metric === 'graph.zoomedInDragFps'), undefined, 'zoomedInDragFps sentinel should be dropped');
  assert.equal(m.find((x) => x.metric === 'graph.idleFps').value, 60);
  assert.equal(m.length, 3);
});
test('largeGraphMetrics + physicsMetrics + vlmMetrics', () => {
  assert.equal(largeGraphMetrics({ quality: 'HIGH', graph: 'g', idleFps: 60, panFps: 55, dragFps: 50, zoomFps: 48, zoomedInDragFps: 40 }, 123).length, 5);
  const p = physicsMetrics({ graphId: 'g', summary: { settleSeconds: 4, overlapAfterOrganize: 0, labelOverlapAfter: 1 } }, 9);
  assert.equal(p.find((x) => x.metric === 'physics.settleSeconds').value, 4);
  const v = vlmMetrics({ generatedAt: '2026-06-19T00:00:00Z', results: [{ persona: 'new-user', context: 'home', verdict: { score: 0.8, latencyMs: 14000 } }] });
  assert.equal(v.length, 2);
});
test('metric points carry a dedupe key', () => {
  const m = reportMetrics(sampleReport);
  assert.ok(m.every((x) => typeof x.key === 'string' && x.key.includes('|')));
});
test('pointKey is canonical: context key order does not change the key', () => {
  assert.equal(pointKey('graph.idleFps', { quality: 'HIGH', graphSize: 1000 }, 5), pointKey('graph.idleFps', { graphSize: 1000, quality: 'HIGH' }, 5));
  assert.notEqual(pointKey('graph.idleFps', { quality: 'HIGH' }, 5), pointKey('graph.idleFps', { quality: 'LOW' }, 5));
  assert.notEqual(pointKey('graph.idleFps', { quality: 'HIGH' }, 5), pointKey('graph.idleFps', { quality: 'HIGH' }, 6));
});

// ── history merge ─────────────────────────────────────────────────────────
test('mergeRuns dedupes by runId, reports added, keeps newest', () => {
  const a = [{ runId: 'r1', finishedAt: 100 }];
  const { merged, added } = mergeRuns(a, [{ runId: 'r1', finishedAt: 200, status: 'passed' }, { runId: 'r2', finishedAt: 150 }]);
  assert.equal(merged.length, 2);
  assert.deepEqual(added.map((r) => r.runId).sort(), ['r1', 'r2']);
  assert.equal(merged.find((r) => r.runId === 'r1').finishedAt, 200);
  assert.equal(merged[0].runId, 'r1');
});
test('mergeRuns appends a CHANGED summary (same runId, different status), skips unchanged', () => {
  const existing = [{ runId: 'unified/1000', finishedAt: 1000, status: 'passed', totals: { cases: 5 } }];
  const r1 = mergeRuns(existing, [{ runId: 'unified/1000', finishedAt: 1000, status: 'passed', totals: { cases: 5 } }]);
  assert.equal(r1.added.length, 0);
  const r2 = mergeRuns(existing, [{ runId: 'unified/1000', finishedAt: 1000, status: 'failed', totals: { cases: 5 } }]);
  assert.equal(r2.added.length, 1);
  assert.equal(r2.merged.find((r) => r.runId === 'unified/1000').status, 'failed');
});
test('mergeRuns tie-breaks equal finishedAt deterministically by runId', () => {
  const { merged } = mergeRuns([], [{ runId: 'b', finishedAt: 5 }, { runId: 'a', finishedAt: 5 }]);
  assert.deepEqual(merged.map((r) => r.runId), ['a', 'b']);
});
test('pickLatest prefers newest available run, skips re-stamped/unavailable headline', () => {
  assert.equal(pickLatest([]), null);
  assert.equal(pickLatest(null), null);
  assert.equal(pickLatest([{ runId: 'r2', available: false }, { runId: 'r1', available: true }]), 'r1');
  assert.equal(pickLatest([{ runId: 'r2', available: true }, { runId: 'r1', available: true }]), 'r2');
  assert.equal(pickLatest([{ runId: 'r2', available: false }, { runId: 'r1', available: false }]), 'r2');
});
test('mergeMetrics dedupes by key', () => {
  const { merged, added } = mergeMetrics([{ key: 'a' }], [{ key: 'a' }, { key: 'b' }, { key: 'b' }]);
  assert.equal(merged.length, 2);
  assert.deepEqual(added.map((m) => m.key), ['b']);
});

// ── history fs round-trip ───────────────────────────────────────────────────
test('jsonl append/read round-trip tolerates blank lines', () => {
  const dir = mkdtempSync(join(tmpdir(), 'gd-dash-'));
  const p = join(dir, 'runs.jsonl');
  appendJsonl(p, [{ runId: 'r1' }, { runId: 'r2' }]);
  appendJsonl(p, [{ runId: 'r3' }]);
  const rows = readJsonl(p);
  assert.deepEqual(rows.map((r) => r.runId), ['r1', 'r2', 'r3']);
  assert.deepEqual(readJsonl(join(dir, 'missing.jsonl')), []);
});
test('snapshotRun copies report+assets, pruneSnapshots caps count', () => {
  const dir = mkdtempSync(join(tmpdir(), 'gd-snap-'));
  const store = join(dir, 'store');
  const src = join(dir, 'run');
  mkdirSync(join(src, 'assets'), { recursive: true });
  writeFileSync(join(src, 'report.json'), JSON.stringify(sampleReport));
  writeFileSync(join(src, 'assets', '0.png'), 'PNGDATA');
  const res = snapshotRun({ runId: 'unified/4000', dir: src, finishedAt: 4000 }, store);
  assert.ok(existsSync(join(res.dest, 'report.json')));
  assert.ok(existsSync(join(res.dest, 'assets', '0.png')));
  assert.equal(res.truncated, false);
  for (let i = 0; i < 15; i++) snapshotRun({ runId: `slot/${i}`, dir: src, finishedAt: i }, store);
  const removed = pruneSnapshots(store, 12);
  assert.ok(removed.length >= 1);
});
test('snapshotRun flags truncation above maxBytes', () => {
  const dir = mkdtempSync(join(tmpdir(), 'gd-trunc-'));
  const src = join(dir, 'run');
  mkdirSync(join(src, 'assets'), { recursive: true });
  writeFileSync(join(src, 'report.json'), JSON.stringify(sampleReport));
  writeFileSync(join(src, 'assets', 'big.bin'), Buffer.alloc(4096));
  const res = snapshotRun({ runId: 'unified/9', dir: src, finishedAt: 9 }, join(dir, 'store'), { maxBytes: 1024 });
  assert.equal(res.truncated, true);
  assert.ok(existsSync(join(res.dest, 'report.json')));
  assert.ok(!existsSync(join(res.dest, 'assets')));
});
