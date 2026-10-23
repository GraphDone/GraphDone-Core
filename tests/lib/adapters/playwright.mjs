import { mkdtempSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runCommand } from '../runner/runSequence.mjs';
import { finishSequence, validateCounter } from './execution-evidence.mjs';

/**
 * Run a Playwright invocation and normalise its JSON report into a unified
 * sequence object. Harvests per-test attachments (videos + screenshots) as
 * { srcPath } for the entry to copy into the report's assets/ dir.
 */
export async function runPlaywrightSequence({ id, title, args = [], target, timeoutMs = 900000, blocking = true }) {
  const reportDir = mkdtempSync(join(tmpdir(), 'pw-'));
  const jsonOut = join(reportDir, 'pw.json');
  const env = {
    TEST_URL: target || process.env.TEST_URL || 'http://localhost:3127',
    PLAYWRIGHT_JSON_OUTPUT_NAME: jsonOut,
    CI: 'true',
  };
  const res = await runCommand('npx', ['playwright', 'test', ...args, '--reporter=json'], { env, timeoutMs });

  let parsed = null;
  if (existsSync(jsonOut)) { try { parsed = JSON.parse(readFileSync(jsonOut, 'utf8')); } catch { /* fall through */ } }
  if (!parsed) { try { parsed = JSON.parse(res.stdout); } catch { /* none */ } }
  rmSync(reportDir, { recursive: true, force: true });

  const counts = { passed: 0, failed: 0, warned: 0, skipped: 0 };
  const cases = [];
  const errors = [];
  const outcomes = { expected: 0, unexpected: 0, flaky: 0, skipped: 0 };
  const walk = (suites = []) => {
    if (!Array.isArray(suites)) { errors.push('Invalid Playwright suite list.'); return; }
    for (const s of suites) {
      if (!s || (s.specs !== undefined && !Array.isArray(s.specs))) { errors.push('Invalid Playwright suite.'); continue; }
      for (const spec of s.specs || []) {
        if (!spec || !Array.isArray(spec.tests) || !spec.tests.length) { errors.push('Playwright spec has no test instances.'); continue; }
        for (const t of spec.tests || []) {
          if (Object.hasOwn(outcomes, t?.status)) outcomes[t.status]++;
          const results = Array.isArray(t?.results) ? t.results : [];
          const last = results.at(-1) || {};
          const skipped = t?.status === 'skipped' || last.status === 'skipped';
          const passed = t?.status === 'expected' && t.expectedStatus === 'passed' && results.length > 0 && results.every(r => r?.status === 'passed');
          let status = skipped ? 'skipped' : passed ? 'passed' : 'failed';
          if (spec.ok === false || t?.status === 'flaky' || t?.status === 'unexpected') status = 'failed';
          counts[status] = (counts[status] || 0) + 1;
          const attachments = [];
          for (const r of results) {
            if (!r || (r.attachments !== undefined && !Array.isArray(r.attachments))) { errors.push('Invalid Playwright result attachments.'); continue; }
            for (const a of r.attachments || []) {
              if (!a?.path) continue;
              if ((a.contentType || '').startsWith('video')) attachments.push({ type: 'video', name: spec.title, srcPath: a.path });
              else if ((a.contentType || '').startsWith('image')) attachments.push({ type: 'image', name: a.name || spec.title, srcPath: a.path });
            }
          }
          cases.push({ title: spec.title, status, durationMs: last.duration, error: last.error?.message || (status === 'failed' ? 'Expected an executed, non-flaky passing test result.' : undefined), attachments });
        }
      }
      if (s.suites) walk(s.suites);
    }
  };
  if (parsed && Array.isArray(parsed.suites)) walk(parsed.suites);
  else errors.push('No valid Playwright JSON report was produced.');
  if (parsed?.errors !== undefined && (!Array.isArray(parsed.errors) || parsed.errors.length)) errors.push('Playwright reported global execution errors.');
  if (parsed?.stats !== undefined) {
    if (!parsed.stats || typeof parsed.stats !== 'object' || Array.isArray(parsed.stats)) errors.push('Invalid Playwright statistics.');
    else for (const [key, expected] of Object.entries(outcomes)) validateCounter(errors, parsed.stats, key, expected);
  }
  return finishSequence({ id, title, kind: 'e2e', command: `playwright test ${args.join(' ')}`, res, counts, cases, errors, blocking });
}
