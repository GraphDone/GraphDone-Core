import { runCommand } from '../runner/runSequence.mjs';
import { finishSequence, validateCounter } from './execution-evidence.mjs';

/** Run a package's vitest suite and normalise its JSON into a unified sequence. */
export async function runVitestSequence({ id, title, cwd, timeoutMs = 300000, blocking = true }) {
  const res = await runCommand('npx', ['vitest', 'run', '--reporter=json'], { cwd, timeoutMs });
  let parsed = null;
  try { parsed = JSON.parse(res.stdout); } catch {
    const i = res.stdout.indexOf('{');
    const j = res.stdout.lastIndexOf('}');
    if (i >= 0 && j > i) { try { parsed = JSON.parse(res.stdout.slice(i, j + 1)); } catch { /* none */ } }
  }
  const counts = { passed: 0, failed: 0, warned: 0, skipped: 0 };
  const cases = [];
  const errors = [];
  let pending = 0;
  let skipped = 0;
  let todo = 0;
  if (parsed && Array.isArray(parsed.testResults)) {
    for (const f of parsed.testResults) {
      if (!f || !Array.isArray(f.assertionResults)) { errors.push('Invalid Vitest assertion results.'); continue; }
      if (f.status === 'failed') errors.push(`Vitest suite failed: ${f.name || 'unnamed suite'}`);
      for (const a of f.assertionResults || []) {
        const st = a?.status === 'passed' ? 'passed' : ['pending', 'skipped', 'todo'].includes(a?.status) ? 'skipped' : 'failed';
        if (a?.status === 'pending') pending++;
        if (a?.status === 'skipped') skipped++;
        if (a?.status === 'todo') todo++;
        counts[st]++;
        if (st !== 'passed') cases.push({ title: [...(a?.ancestorTitles || []), a?.title || 'unnamed assertion'].join(' › '), status: st, error: (a?.failureMessages || []).join('\n').slice(-1500) });
      }
    }
  } else errors.push('No valid Vitest JSON report was produced.');
  if (parsed && (parsed.success !== true || parsed.numFailedTestSuites > 0 || parsed.numPendingTestSuites > 0 || parsed.numRuntimeErrorTestSuites > 0 || pending > 0)) errors.push('Vitest reported an unsuccessful or unfinished run.');
  if (parsed && typeof parsed === 'object') {
    validateCounter(errors, parsed, 'numTotalTests', counts.passed + counts.failed + counts.skipped);
    validateCounter(errors, parsed, 'numPassedTests', [counts.passed, counts.passed + counts.skipped]);
    validateCounter(errors, parsed, 'numFailedTests', counts.failed);
    validateCounter(errors, parsed, 'numPendingTests', [pending, pending + skipped]);
    validateCounter(errors, parsed, 'numTodoTests', todo);
    for (const key of ['numTotalTestSuites', 'numPassedTestSuites', 'numFailedTestSuites', 'numPendingTestSuites', 'numRuntimeErrorTestSuites']) validateCounter(errors, parsed, key);
    if (parsed.numTotalTestSuites < (parsed.testResults?.length || 0)) errors.push('Vitest suite total is smaller than its reported test files.');
    if (['numTotalTestSuites', 'numPassedTestSuites', 'numFailedTestSuites'].every(key => Object.hasOwn(parsed, key)) && parsed.numTotalTestSuites !== parsed.numPassedTestSuites + parsed.numFailedTestSuites) errors.push('Vitest suite totals are inconsistent.');
  }
  return finishSequence({ id, title, kind: 'unit', command: `vitest run (${cwd})`, res, counts, cases, errors, blocking });
}
