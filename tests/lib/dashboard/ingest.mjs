/**
 * Discovers + parses graphdone.unified-report/1 reports across configured run
 * roots. Pure transforms (runIdFor/summarize/isUnifiedReport) are separated from
 * the fs scan so they unit-test without disk. A "slot" root is overwritten in
 * place each run (Core test-artifacts/unified*) → its runId keys on finishedAt so
 * each distinct run is a distinct history entry; a "stamped" root keeps one dir
 * per run (Cloud live-full-report/<stamp>) → its runId keys on the dir name.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';
import { rollupStatus } from './format.mjs';

export function isUnifiedReport(obj) {
  return !!obj && typeof obj === 'object' && typeof obj.schema === 'string' && obj.schema.startsWith('graphdone.unified-report/') && Array.isArray(obj.sequences);
}

export function safeId(s) {
  return String(s).replace(/[^a-zA-Z0-9._-]/g, '_');
}

export function runIdFor(sourceName, { mode, dirName, report, mtimeMs }) {
  if (mode === 'stamped' && dirName) return `${sourceName}/${dirName}`;
  const stamp = report?.finishedAt || report?.startedAt || Math.round(mtimeMs || 0) || 0;
  return `${sourceName}/${stamp}`;
}

export function mediaCount(report) {
  let n = 0;
  for (const seq of report.sequences || []) for (const c of seq.cases || []) n += (c.attachments || []).length;
  return n;
}

export function summarize(report, extra = {}) {
  const totals = (report.rollup && report.rollup.totals) || {};
  const seqStatuses = (report.sequences || []).map((s) => s.status);
  return {
    runId: extra.runId,
    source: extra.source,
    label: extra.label,
    mode: extra.mode,
    target: report.target || null,
    profile: (report.env && (report.env.profile || report.env.kind)) || null,
    node: (report.env && report.env.node) || null,
    sources: (report.env && report.env.sources) || null,
    status: (report.rollup && report.rollup.status) || rollupStatus(seqStatuses),
    totals: {
      passed: totals.passed || 0,
      failed: totals.failed || 0,
      warned: totals.warned || 0,
      skipped: totals.skipped || 0,
      cases: totals.cases || 0,
      sequences: totals.sequences || (report.sequences || []).length,
    },
    startedAt: report.startedAt || null,
    finishedAt: report.finishedAt || report.startedAt || null,
    durationMs: report.durationMs ?? ((report.finishedAt && report.startedAt) ? report.finishedAt - report.startedAt : null),
    mediaCount: mediaCount(report),
  };
}

export function readReport(reportPath) {
  try {
    const obj = JSON.parse(readFileSync(reportPath, 'utf8'));
    return isUnifiedReport(obj) ? obj : null;
  } catch {
    return null;
  }
}

function listStampedDirs(rootPath) {
  if (!existsSync(rootPath)) return [];
  return readdirSync(rootPath)
    .map((d) => join(rootPath, d))
    .filter((p) => { try { return statSync(p).isDirectory(); } catch { return false; } });
}

/**
 * roots: [{ name, label, path, mode: 'slot'|'stamped' }]
 * returns discovered runs: [{ runId, source, label, mode, reportPath, dir, mtimeMs }]
 */
export function discover(roots) {
  const found = [];
  for (const root of roots) {
    if (!existsSync(root.path)) continue;
    if (root.mode === 'slot') {
      const reportPath = join(root.path, 'report.json');
      if (!existsSync(reportPath)) continue;
      const report = readReport(reportPath);
      if (!report) continue;
      const mt = safeMtime(reportPath);
      found.push({ runId: runIdFor(root.name, { mode: 'slot', report, mtimeMs: mt }), source: root.name, label: root.label, mode: 'slot', reportPath, dir: root.path, mtimeMs: mt, report });
    } else {
      for (const dir of listStampedDirs(root.path)) {
        const reportPath = join(dir, 'report.json');
        if (!existsSync(reportPath)) continue;
        const report = readReport(reportPath);
        if (!report) continue;
        found.push({ runId: runIdFor(root.name, { mode: 'stamped', dirName: basename(dir), report }), source: root.name, label: root.label, mode: 'stamped', reportPath, dir, mtimeMs: safeMtime(reportPath), report });
      }
    }
  }
  found.sort((a, b) => (b.report.finishedAt || b.mtimeMs || 0) - (a.report.finishedAt || a.mtimeMs || 0));
  return found;
}

function safeMtime(p) {
  try { return statSync(p).mtimeMs; } catch { return 0; }
}
function safeSize(p) {
  try { return statSync(p).size; } catch { return 0; }
}

/** Signature of all discoverable reports (mtime+size), for cheap change-detection. */
export function signature(roots) {
  const parts = [];
  for (const root of roots) {
    if (!existsSync(root.path)) continue;
    if (root.mode === 'slot') {
      const p = join(root.path, 'report.json');
      if (existsSync(p)) parts.push(`${root.name}:${safeMtime(p)}:${safeSize(p)}`);
    } else {
      for (const dir of listStampedDirs(root.path)) {
        const p = join(dir, 'report.json');
        if (existsSync(p)) parts.push(`${basename(dir)}:${safeMtime(p)}:${safeSize(p)}`);
      }
    }
  }
  return parts.sort().join('|');
}
