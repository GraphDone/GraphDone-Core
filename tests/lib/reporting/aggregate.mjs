/**
 * Pure aggregation for the unified test harness — no I/O, fully unit-testable.
 * Every sequence (unit run, e2e spec, live audit, …) reports counts + a status;
 * these helpers roll the fleet up into one report object that both the HTML and
 * JSON reporters render. Reusable across both repos.
 */

export const STATUS = Object.freeze({ PASSED: 'passed', FAILED: 'failed', WARN: 'warn', SKIPPED: 'skipped' });

const RANK = { failed: 3, warn: 2, passed: 1, skipped: 0 };

/** Worst-of rollup: any failure → failed; else any warn → warn; else any pass → passed; else skipped. */
export function rollupStatus(statuses) {
  let worst = 'skipped';
  for (const s of statuses) {
    if ((RANK[s] ?? 0) > RANK[worst]) worst = s;
  }
  return worst;
}

/** Derive a sequence's status from its case counts (a failure dominates; warns warn). */
export function statusFromCounts({ passed = 0, failed = 0, warned = 0, skipped = 0 } = {}) {
  if (failed > 0) return STATUS.FAILED;
  if (warned > 0) return STATUS.WARN;
  if (passed > 0) return STATUS.PASSED;
  return STATUS.SKIPPED;
}

/** Sum per-sequence counts into a totals object (plus a sequence-status tally). */
export function sumCounts(sequences) {
  const totals = { passed: 0, failed: 0, warned: 0, skipped: 0, cases: 0, sequences: sequences.length };
  const byStatus = { passed: 0, failed: 0, warned: 0, skipped: 0 };
  for (const seq of sequences) {
    const c = seq.counts || {};
    totals.passed += c.passed || 0;
    totals.failed += c.failed || 0;
    totals.warned += c.warned || 0;
    totals.skipped += c.skipped || 0;
    totals.cases += (c.passed || 0) + (c.failed || 0) + (c.warned || 0) + (c.skipped || 0);
    byStatus[seq.status] = (byStatus[seq.status] || 0) + 1;
  }
  return { totals, byStatus };
}

/** Build the full report object the reporters consume. Pure; timestamps passed in. */
export function buildReport({ sequences = [], startedAt, finishedAt, target = '', env = {} } = {}) {
  const { totals, byStatus } = sumCounts(sequences);
  return {
    schema: 'graphdone.unified-report/1',
    startedAt,
    finishedAt,
    durationMs: startedAt != null && finishedAt != null ? finishedAt - startedAt : null,
    target,
    env,
    rollup: { status: rollupStatus(sequences.map((s) => s.status)), totals, byStatus },
    sequences,
  };
}
