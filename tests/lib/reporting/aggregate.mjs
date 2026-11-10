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

/**
 * Wilson score interval lower bound: with `passes` of `trials`, the success rate
 * is at least this, with the given confidence (z = 1.96 → 95%). 30/30 gives ~0.89;
 * proving a path fails under 1% takes ~300 clean trials.
 */
export function wilsonLower(passes, trials, z = 1.96) {
  if (!trials) return 0;
  const p = passes / trials, z2 = z * z;
  return (p + z2 / (2 * trials) - z * Math.sqrt((p * (1 - p) + z2 / (4 * trials)) / trials)) / (1 + z2 / trials);
}

/**
 * Success rate per path when a sequence repeats its cases (--repeat-each):
 * cases with the same title on the same device/project are trials of one path.
 * Failures before the path's own action (error starting "SETUP:") are counted
 * apart so a broken setup does not pose as a broken path. Skips are not trials.
 */
export function reliability(cases = []) {
  const groups = new Map();
  for (const c of cases) {
    const key = `${c.project || ''}\u0000${c.title}`;
    if (!groups.has(key)) groups.set(key, { title: c.title, project: c.project || '', trials: 0, passes: 0, setupFailures: 0, failures: {} });
    const g = groups.get(key);
    if (c.status === 'skipped') continue;
    if (c.status !== 'passed' && /^(Error: )?SETUP:/.test(c.error || '')) { g.setupFailures++; continue; }
    g.trials++;
    if (c.status === 'passed') g.passes++;
    else { const why = String(c.error || 'failed').replace(/\u001b\[[0-9;]*m/g, '').split('\n')[0].slice(0, 160); g.failures[why] = (g.failures[why] || 0) + 1; }
  }
  // Repeated paths only: a one-off case (e.g. the runner's own exit check) is not a rate.
  const rows = [...groups.values()].filter((g) => g.trials + g.setupFailures > 1);
  if (!rows.length) return null;
  return rows.map((g) => ({ ...g, rate: g.trials ? g.passes / g.trials : null, lower95: Number(wilsonLower(g.passes, g.trials).toFixed(3)) }));
}

/** Build the full report object the reporters consume. Pure; timestamps passed in. */
/**
 * Stable hierarchical reference IDs so a reviewer can cite a specific check
 * (e.g. "3.5 looks wrong"). Each sequence gets a section number; each case gets
 * `<section>.<n>`. Pre-set refs (e.g. a deeper source.dimension.check from the
 * live runner) are preserved.
 */
export function assignRefs(sequences) {
  sequences.forEach((seq, i) => {
    seq.ref = seq.ref || String(i + 1);
    (seq.cases || []).forEach((c, j) => { c.ref = c.ref || `${seq.ref}.${j + 1}`; });
  });
  return sequences;
}

export function buildReport({ sequences = [], startedAt, finishedAt, target = '', env = {}, source } = {}) {
  assignRefs(sequences);
  for (const seq of sequences) {
    const rows = reliability(seq.cases);
    if (rows) seq.reliability = rows;
  }
  const { totals, byStatus } = sumCounts(sequences);
  return {
    schema: 'graphdone.unified-report/1',
    startedAt,
    finishedAt,
    durationMs: startedAt != null && finishedAt != null ? finishedAt - startedAt : null,
    target,
    env,
    ...(source ? { source } : {}),
    rollup: { status: rollupStatus(sequences.map((s) => s.status)), totals, byStatus },
    sequences,
  };
}
