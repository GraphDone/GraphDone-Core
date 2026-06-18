import { runCommand } from '../runner/runSequence.mjs';

/** Run a package's vitest suite and normalise its JSON into a unified sequence. */
export async function runVitestSequence({ id, title, cwd, timeoutMs = 300000 }) {
  const res = await runCommand('npx', ['vitest', 'run', '--reporter=json'], { cwd, timeoutMs });
  let parsed = null;
  try { parsed = JSON.parse(res.stdout); } catch {
    const i = res.stdout.indexOf('{');
    const j = res.stdout.lastIndexOf('}');
    if (i >= 0 && j > i) { try { parsed = JSON.parse(res.stdout.slice(i, j + 1)); } catch { /* none */ } }
  }
  const counts = { passed: 0, failed: 0, warned: 0, skipped: 0 };
  const cases = [];
  if (parsed && parsed.testResults) {
    for (const f of parsed.testResults) {
      for (const a of f.assertionResults || []) {
        const st = a.status === 'passed' ? 'passed' : (a.status === 'pending' || a.status === 'skipped' || a.status === 'todo') ? 'skipped' : 'failed';
        counts[st]++;
        if (st !== 'passed') cases.push({ title: [...(a.ancestorTitles || []), a.title].join(' › '), status: st, error: (a.failureMessages || []).join('\n').slice(-1500) });
      }
    }
  } else if (parsed && parsed.numTotalTests != null) {
    counts.passed = parsed.numPassedTests || 0;
    counts.failed = parsed.numFailedTests || 0;
    counts.skipped = parsed.numPendingTests || 0;
  }
  if (!parsed) {
    const ok = res.code === 0 && !res.timedOut;
    counts[ok ? 'passed' : 'failed']++;
    if (!ok) cases.push({ title, status: 'failed', error: (res.timedOut ? 'timed out' : (res.stderr || res.stdout || '')).slice(-2000) });
  }
  const status = counts.failed > 0 ? 'failed' : counts.passed > 0 ? 'passed' : 'skipped';
  return { id, title, kind: 'unit', command: `vitest run (${cwd})`, status, durationMs: res.durationMs, counts, cases };
}
