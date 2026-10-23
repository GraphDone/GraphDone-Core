import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Optional ingest of the GraphDone-Cloud live-audit into the unified harness, so
 * one `test:unified --profile full` can also reflect the live Cloud audit when
 * both repos are checked out side by side. The Cloud audit (audit-kit AuditRun)
 * writes findings.json = { target, stamp, findings:[{dim,name,status,detail}], ... }
 * with status in pass|warn|fail|info. Skips cleanly when no findings file exists.
 */
const STATUS_MAP = { pass: 'passed', fail: 'failed', warn: 'warned', info: 'skipped' };

/** Newest live-audit-artifacts/<stamp>/findings.json under a Cloud repo dir, or null. */
export function findLatestCloudFindings(cloudRepoDir) {
  const root = join(cloudRepoDir, 'live-audit-artifacts');
  if (!existsSync(root)) return null;
  const stamps = readdirSync(root)
    .map((name) => join(root, name))
    .filter((p) => { try { return statSync(p).isDirectory() && existsSync(join(p, 'findings.json')); } catch { return false; } })
    .sort();
  return stamps.length ? join(stamps[stamps.length - 1], 'findings.json') : null;
}

export function cloudAuditSequence({ id = 'cloud-audit', title = 'Cloud live audit', findingsPath } = {}) {
  if (!findingsPath || !existsSync(findingsPath)) {
    return { id, title, kind: 'audit', status: 'skipped', durationMs: 0,
      counts: { passed: 0, failed: 0, warned: 0, skipped: 1 }, cases: [],
      notes: 'no Cloud findings.json found (run GraphDone-Cloud live-audit, or check out the sibling repo)' };
  }
  let data;
  try { data = JSON.parse(readFileSync(findingsPath, 'utf8')); } catch (e) {
    return { id, title, kind: 'audit', status: 'failed', durationMs: 0,
      counts: { passed: 0, failed: 0, warned: 0, skipped: 0 }, cases: [{ title: 'parse findings.json', status: 'failed', error: String(e) }] };
  }
  const counts = { passed: 0, failed: 0, warned: 0, skipped: 0 };
  const cases = [];
  for (const f of data.findings || []) {
    const status = STATUS_MAP[f.status] || 'skipped';
    counts[status]++;
    if (status === 'failed' || status === 'warn') cases.push({ title: `[${f.dim}] ${f.name}`, status, error: f.detail || undefined });
  }
  const status = counts.failed > 0 ? 'failed' : counts.warned > 0 ? 'warn' : counts.passed > 0 ? 'passed' : 'skipped';
  return { id, title: `${title} (${data.target || ''})`, kind: 'audit', status, durationMs: 0, counts, cases,
    notes: `ingested ${findingsPath}` };
}
