#!/usr/bin/env node
/**
 * GraphDone unified test harness — ONE reproducible entry that runs a profile of
 * sequences (unit + e2e + report captures) from the reusable tests/lib modules,
 * then emits DUAL output: a human-readable report.html (embedded screenshots +
 * .webm video clips) AND a machine-parsable report.json. Exit code = rollup
 * status, so it doubles as a CI gate.
 *
 *   node tests/run-unified.mjs [--profile smoke|pr|full|report] [--sequence <id>] [--open]
 */
import { mkdirSync, copyFileSync, realpathSync } from 'node:fs';
import { join, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runVitestSequence } from './lib/adapters/vitest.mjs';
import { runPlaywrightSequence } from './lib/adapters/playwright.mjs';
import { cloudAuditSequence, findLatestCloudFindings } from './lib/adapters/cloud-audit.mjs';
import { buildReport } from './lib/reporting/aggregate.mjs';
import { writeJsonReport } from './lib/reporting/json.mjs';
import { renderHtml } from './lib/reporting/html.mjs';
import { writeFileSync } from 'node:fs';
import { SEQUENCES, PROFILES } from './sequences/unified.config.mjs';
import { parseOptions, prepareOutput } from './lib/runner/unified-options.mjs';
import { sourceState } from './lib/runner/source-state.mjs';
import { ownedEvidencePath } from './lib/runner/evidence-path.mjs';

let options;
try { options = parseOptions(process.argv.slice(2), PROFILES, SEQUENCES); }
catch (error) { console.error(error.message); process.exit(2); }
const { profile, ids, open } = options;
const root = fileURLToPath(new URL('..', import.meta.url));
if (realpathSync(process.cwd()) !== realpathSync(root)) {
  console.error(`Run the unified harness from its repository root: ${root}`);
  process.exit(2);
}
let outDir;
const target = process.env.TEST_URL || 'http://localhost:3127';

const ICON = { passed: '✅', failed: '❌', warn: '⚠️', skipped: '⏭️' };

async function runOne(id) {
  const def = SEQUENCES[id];
  process.stdout.write(`\n▶ ${id} — ${def.title}\n`);
  if (def.adapter === 'vitest') return runVitestSequence({ id, title: def.title, cwd: def.cwd, blocking: def.blocking !== false });
  if (def.adapter === 'playwright') return runPlaywrightSequence({ id, title: def.title, args: def.args, target, blocking: def.blocking !== false });
  if (def.adapter === 'cloud-audit') {
    const cloudDir = def.cloudRepoDir || resolve(process.cwd(), '..', 'GraphDone-Cloud');
    const findingsPath = options.cloudFindings || findLatestCloudFindings(cloudDir);
    return cloudAuditSequence({ id, title: def.title, findingsPath });
  }
  throw new Error(`Unsupported adapter for ${id}`);
}

// Copy a sequence's harvested artifacts into outDir/assets/<id>/ and set href.
function materializeArtifacts(seq) {
  let n = 0;
  for (const c of seq.cases || []) {
    for (const a of c.attachments || []) {
      if (!a.srcPath) continue;
      try {
        const ext = extname(a.srcPath) || (a.type === 'video' ? '.webm' : '.png');
        const rel = join('assets', seq.id, `${n++}${ext}`);
        const dest = join(outDir, rel);
        mkdirSync(join(outDir, 'assets', seq.id), { recursive: true });
        copyFileSync(a.type === 'file' ? ownedEvidencePath(root, a.srcPath) : a.srcPath, dest);
        a.href = rel;
        delete a.srcPath;
      } catch (error) {
        if (a.type === 'file') throw new Error(`Could not retain file evidence: ${error.message}`);
      }
    }
  }
  return seq;
}

(async () => {
  const startedAt = Date.now();
  outDir = prepareOutput(resolve(options.out), root);
  const startedSource = sourceState(root, outDir);

  const sequences = [];
  for (const id of ids) {
    const seq = await runOne(id);
    materializeArtifacts(seq);
    const c = seq.counts || {};
    process.stdout.write(`   ${ICON[seq.status] || ''} ${seq.status} — ${c.passed || 0}✓ ${c.failed || 0}✗ ${c.warned || 0}⚠ ${c.skipped || 0}⏭ (${((seq.durationMs || 0) / 1000).toFixed(1)}s)\n`);
    sequences.push(seq);
  }

  const finishedSource = sourceState(root, outDir);
  const changedDuringRun = startedSource.fingerprint !== finishedSource.fingerprint;
  if (changedDuringRun) sequences.push({
    id: 'source-integrity', title: 'Source changed during test execution', kind: 'verification', status: 'failed',
    counts: { passed: 0, failed: 1, warned: 0, skipped: 0 },
    cases: [{ title: 'Source remained unchanged', status: 'failed', error: 'The tested repository changed during this run; rerun against a stable source tree.' }],
  });
  const report = buildReport({
    sequences, startedAt, finishedAt: Date.now(), target,
    env: { node: process.version, platform: process.platform, profile, sequences: ids },
    source: { started: startedSource, finished: finishedSource, changedDuringRun },
  });

  const { mainPath } = writeJsonReport(report, outDir);
  const htmlPath = join(outDir, 'report.html');
  writeFileSync(htmlPath, renderHtml(report));

  const r = report.rollup;
  process.stdout.write(`\n${'═'.repeat(48)}\n`);
  process.stdout.write(`${ICON[r.status]} ${r.status.toUpperCase()} · ${r.totals.passed}✓ ${r.totals.failed}✗ ${r.totals.warned}⚠ ${r.totals.skipped}⏭ across ${r.totals.sequences} sequences\n`);
  process.stdout.write(`HTML: ${htmlPath}\nJSON: ${mainPath}\n`);

  if (open) {
    const { spawn } = await import('node:child_process');
    spawn(process.platform === 'darwin' ? 'open' : 'xdg-open', [htmlPath], { stdio: 'ignore', detached: true });
  }
  process.exit(r.status === 'failed' ? 1 : 0);
})().catch(error => { console.error(`Unified test run failed: ${error.message}`); process.exitCode = 1; });
