export function finishSequence({ id, title, kind, command, res, counts, cases, errors = [], blocking = true }) {
  if (res.timedOut) errors.push('Test process timed out.');
  if (res.code !== 0) errors.push(`Test process did not exit successfully (exit ${res.code ?? 'unknown'}).`);
  if (res.error) errors.push(`Test process could not start: ${res.error}`);
  if (counts.passed + counts.failed + counts.skipped === 0) errors.push('No executed test results were reported.');
  if (blocking && counts.skipped > 0) errors.push(`${counts.skipped} required test(s) were skipped.`);
  if (errors.length) {
    counts.failed++;
    cases.push({ title: `${title}: execution evidence`, status: 'failed', error: errors.join('\n'), attachments: [] });
  }
  const status = counts.failed > 0 ? 'failed' : counts.passed > 0 ? 'passed' : 'skipped';
  return {
    id, title, kind, command, status, durationMs: res.durationMs, counts, cases,
    blocking, execution: { exitCode: res.code, timedOut: !!res.timedOut }, evidenceErrors: errors,
  };
}
