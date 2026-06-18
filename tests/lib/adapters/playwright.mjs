import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runCommand } from '../runner/runSequence.mjs';

/**
 * Run a Playwright invocation and normalise its JSON report into a unified
 * sequence object. Harvests per-test attachments (videos + screenshots) as
 * { srcPath } for the entry to copy into the report's assets/ dir.
 */
export async function runPlaywrightSequence({ id, title, args = [], target, timeoutMs = 900000 }) {
  const jsonOut = join(mkdtempSync(join(tmpdir(), 'pw-')), 'pw.json');
  const env = {
    TEST_URL: target || process.env.TEST_URL || 'http://localhost:3127',
    PLAYWRIGHT_JSON_OUTPUT_NAME: jsonOut,
    CI: 'true',
  };
  const res = await runCommand('npx', ['playwright', 'test', ...args, '--reporter=json'], { env, timeoutMs });

  let parsed = null;
  if (existsSync(jsonOut)) { try { parsed = JSON.parse(readFileSync(jsonOut, 'utf8')); } catch { /* fall through */ } }
  if (!parsed) { try { parsed = JSON.parse(res.stdout); } catch { /* none */ } }

  const counts = { passed: 0, failed: 0, warned: 0, skipped: 0 };
  const cases = [];
  const walk = (suites = []) => {
    for (const s of suites) {
      for (const spec of s.specs || []) {
        for (const t of spec.tests || []) {
          const last = (t.results || []).slice(-1)[0] || {};
          let status = last.status === 'passed' ? 'passed' : last.status === 'skipped' ? 'skipped' : 'failed';
          if (spec.ok === false) status = 'failed';
          counts[status] = (counts[status] || 0) + 1;
          const attachments = [];
          for (const r of t.results || []) {
            for (const a of r.attachments || []) {
              if (!a.path) continue;
              if ((a.contentType || '').startsWith('video')) attachments.push({ type: 'video', name: spec.title, srcPath: a.path });
              else if ((a.contentType || '').startsWith('image')) attachments.push({ type: 'image', name: a.name || spec.title, srcPath: a.path });
            }
          }
          cases.push({ title: spec.title, status, durationMs: last.duration, error: last.error && last.error.message, attachments });
        }
      }
      if (s.suites) walk(s.suites);
    }
  };
  if (parsed && parsed.suites) walk(parsed.suites);

  if (!cases.length) {
    const ok = res.code === 0 && !res.timedOut;
    counts[ok ? 'passed' : 'failed']++;
    cases.push({ title, status: ok ? 'passed' : 'failed', durationMs: res.durationMs, error: ok ? undefined : (res.timedOut ? 'sequence timed out' : (res.stderr || res.stdout || '').slice(-2000)), attachments: [] });
  }
  const status = counts.failed > 0 ? 'failed' : counts.passed > 0 ? 'passed' : 'skipped';
  return { id, title, kind: 'e2e', command: `playwright test ${args.join(' ')}`, status, durationMs: res.durationMs, counts, cases };
}
