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
import { mkdirSync, copyFileSync, rmSync } from 'node:fs';
import { join, extname, resolve } from 'node:path';
import { runVitestSequence } from './lib/adapters/vitest.mjs';
import { runPlaywrightSequence } from './lib/adapters/playwright.mjs';
import { cloudAuditSequence, findLatestCloudFindings } from './lib/adapters/cloud-audit.mjs';
import { buildReport } from './lib/reporting/aggregate.mjs';
import { writeJsonReport } from './lib/reporting/json.mjs';
import { renderHtml } from './lib/reporting/html.mjs';
import { writeFileSync } from 'node:fs';
import { SEQUENCES, PROFILES } from './sequences/unified.config.mjs';

const args = process.argv.slice(2);
const flag = (name, def) => { const i = args.indexOf(name); return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : def; };
const profile = flag('--profile', 'smoke');
const single = flag('--sequence', null);
const open = !!flag('--open', false);
const outDir = resolve(String(flag('--out', 'test-artifacts/unified')));
const target = process.env.TEST_URL || 'http://localhost:3127';

const ids = single ? [single] : (PROFILES[profile] || PROFILES.smoke);

const ICON = { passed: '✅', failed: '❌', warn: '⚠️', skipped: '⏭️' };

async function runOne(id) {
  const def = SEQUENCES[id];
  if (!def) return { id, title: id, kind: 'unknown', status: 'skipped', counts: { passed: 0, failed: 0, warned: 0, skipped: 1 }, cases: [], notes: 'unknown sequence id' };
  process.stdout.write(`\n▶ ${id} — ${def.title}\n`);
  if (def.adapter === 'vitest') return runVitestSequence({ id, title: def.title, cwd: def.cwd });
  if (def.adapter === 'playwright') return runPlaywrightSequence({ id, title: def.title, args: def.args, target });
  if (def.adapter === 'cloud-audit') {
    const cloudDir = def.cloudRepoDir || resolve(process.cwd(), '..', 'GraphDone-Cloud');
    const explicit = flag('--cloud-findings', null);
    const findingsPath = typeof explicit === 'string' ? explicit : findLatestCloudFindings(cloudDir);
    return cloudAuditSequence({ id, title: def.title, findingsPath });
  }
  return { id, title: def.title, status: 'skipped', counts: { passed: 0, failed: 0, warned: 0, skipped: 1 }, cases: [] };
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
        copyFileSync(a.srcPath, dest);
        a.href = rel;
        delete a.srcPath;
      } catch { /* skip unreadable artifact */ }
    }
  }
  return seq;
}

(async () => {
  const startedAt = Date.now();
  try { rmSync(outDir, { recursive: true, force: true }); } catch { /* fresh */ }
  mkdirSync(outDir, { recursive: true });

  const sequences = [];
  for (const id of ids) {
    const seq = await runOne(id);
    materializeArtifacts(seq);
    const c = seq.counts || {};
    process.stdout.write(`   ${ICON[seq.status] || ''} ${seq.status} — ${c.passed || 0}✓ ${c.failed || 0}✗ ${c.warned || 0}⚠ ${c.skipped || 0}⏭ (${((seq.durationMs || 0) / 1000).toFixed(1)}s)\n`);
    sequences.push(seq);
  }

  const report = buildReport({
    sequences, startedAt, finishedAt: Date.now(), target,
    env: { node: process.version, platform: process.platform, profile },
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
})();
