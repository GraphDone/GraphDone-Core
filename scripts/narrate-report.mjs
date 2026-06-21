#!/usr/bin/env node
/**
 * Generates the narrated progress report for the live dashboard: gathers real
 * data (newest unified runs across both repos, recently-shipped commits, live
 * perf metrics, the feature-tour clips), builds a spoken script with narrate.mjs,
 * renders each segment to audio with piper-tts (high-quality female voice) +
 * ffmpeg, and writes a manifest the dashboard plays back, synced to charts/media.
 *
 *   node scripts/narrate-report.mjs
 *
 * Voice: test-artifacts/dashboard/voices/en_US-lessac-high.onnx (override PIPER_VOICE).
 * Output (git-ignored, under test-artifacts/): test-artifacts/dashboard/narration/.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync, readdirSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { discover } from '../tests/lib/dashboard/ingest.mjs';
import { readJsonl } from '../tests/lib/dashboard/history.mjs';
import { buildNarration } from '../tests/lib/dashboard/narrate.mjs';

const CORE = resolve(process.cwd());
const CLOUD = resolve(CORE, '..', 'GraphDone-Cloud');
const ARTIFACTS = join(CORE, 'test-artifacts');
const STORE = join(ARTIFACTS, 'dashboard');
const OUT = join(STORE, 'narration');
const VOICE = process.env.PIPER_VOICE || join(STORE, 'voices', 'en_US-lessac-high.onnx');
const VOICE_NAME = VOICE.split('/').pop().replace(/\.onnx$/, '');

const ROOTS = [
  { name: 'unified', label: 'Unified (latest)', path: join(ARTIFACTS, 'unified'), mode: 'slot' },
  { name: 'unified-cloudcheck', label: 'Cloud audit check', path: join(ARTIFACTS, 'unified-cloudcheck'), mode: 'slot' },
  { name: 'unified-perfcheck', label: 'Perf budgets', path: join(ARTIFACTS, 'unified-perfcheck'), mode: 'slot' },
  { name: 'unified-showcase', label: 'Showcase', path: join(ARTIFACTS, 'unified-showcase'), mode: 'slot' },
  { name: 'live-full-report', label: 'Cloudflare live', path: join(CLOUD, 'live-full-report'), mode: 'stamped' },
];

const PERF_LABELS = {
  'graph.idleFps': 'idle frame rate', 'graph.dragFps': 'drag frame rate', 'graph.interactionFps': 'interaction frame rate',
  'graph.avgTickMs': 'average simulation tick', 'graph.driftPx': 'layout drift', 'graph.queryP95Ms': 'query latency at the 95th percentile',
  'suite.passRate': 'suite pass rate', 'physics.settleSeconds': 'physics settle time',
};
const PERF_ORDER = ['graph.idleFps', 'graph.dragFps', 'graph.interactionFps', 'graph.avgTickMs', 'graph.driftPx', 'physics.settleSeconds'];

if (!existsSync(VOICE)) {
  console.error(`❌ Voice model not found: ${VOICE}\n   Download it, e.g.:\n   curl -L -o "${VOICE}" https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/high/en_US-lessac-high.onnx\n   (and the matching .onnx.json)`);
  process.exit(1);
}
for (const bin of ['piper', 'ffmpeg', 'ffprobe']) {
  if (spawnSync(bin, ['--help'], { stdio: 'ignore' }).error) { console.error(`❌ ${bin} not on PATH`); process.exit(1); }
}

// ── gather data ───────────────────────────────────────────────────────────────
const runs = discover(ROOTS);
const healthRun = runs[0] || null;
const mediaRun = runs.find((r) => {
  for (const s of r.report.sequences || []) for (const c of s.cases || []) if ((c.attachments || []).some((a) => a.type === 'video')) return true;
  return false;
}) || healthRun;

const health = healthRun ? (() => {
  const t = (healthRun.report.rollup && healthRun.report.rollup.totals) || {};
  const cases = t.cases || 0;
  return { cases, sequences: t.sequences || (healthRun.report.sequences || []).length, passed: t.passed || 0, failed: t.failed || 0, warned: t.warned || 0, passRate: cases ? Math.round((t.passed / cases) * 1000) / 10 : 0, target: healthRun.report.target };
})() : {};

const shipped = (() => {
  const r = spawnSync('git', ['log', '--no-merges', '--format=%s', '-n', '60'], { cwd: CORE, encoding: 'utf8' });
  const subjects = (r.stdout || '').split('\n').map((s) => s.trim()).filter(Boolean);
  const wanted = subjects.filter((s) => /^(feat|fix|perf|refactor|chore)(\([^)]*\))?:/i.test(s));
  return wanted.slice(0, 7).map((title) => ({ title }));
})();

const metricsRows = readJsonl(join(STORE, 'metrics.jsonl'));
const latestByMetric = new Map();
for (const m of metricsRows) {
  const prev = latestByMetric.get(m.metric);
  if (!prev || (m.ts || 0) >= (prev.ts || 0)) latestByMetric.set(m.metric, m);
}
const perf = PERF_ORDER.filter((k) => latestByMetric.has(k)).map((k) => {
  const m = latestByMetric.get(k);
  return { metric: k, label: PERF_LABELS[k] || k, value: m.value, unit: m.unit, better: m.better };
});

// Give the live-site journey clips a clean spoken name + a real description
// (the raw attachment name is just the test title, which would otherwise be
// read out twice). Falls back to the generic name for any other video clip.
const liveClipMeta = (title) => {
  const t = String(title || '').toLowerCase();
  if (/phone|mobile/.test(t)) return { name: 'The mobile journey', note: 'On a phone, a guest lands on the list view, switches to the live graph, opens the navigation, and reaches settings — with no horizontal overflow.' };
  if (/desktop/.test(t)) return { name: 'The desktop journey', note: 'On the desktop, a guest signs in, the live graph renders with real nodes and edges, and they open a node card, re-fit the view, and tour the pages.' };
  return null;
};

const tour = [];
if (mediaRun) {
  for (const s of mediaRun.report.sequences || []) {
    for (const c of s.cases || []) {
      for (const a of c.attachments || []) {
        if (a.type !== 'video') continue;
        const meta = liveClipMeta(c.title || a.name);
        tour.push(meta
          ? { name: meta.name, note: meta.note, kind: 'video', runId: mediaRun.runId, href: a.href }
          : { name: a.name || c.ref || `clip-${tour.length + 1}`, note: c.title || '', kind: 'video', runId: mediaRun.runId, href: a.href });
      }
    }
  }
}

const dateISO = new Date().toISOString();
const narration = buildNarration({ dateISO, voiceName: VOICE_NAME, health, shipped, perf, tour });
console.log(`📝 ${narration.segments.length} segments (${shipped.length} shipped, ${perf.length} perf, ${tour.length} clips${narration.meta.tourTruncated ? ' — truncated to 8' : ''})`);

// ── render audio ──────────────────────────────────────────────────────────────
if (existsSync(OUT)) rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const durOf = (f) => {
  const r = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nk=1:nw=1', f], { encoding: 'utf8' });
  return Math.round((parseFloat((r.stdout || '0').trim()) || 0) * 1000);
};

const outSegments = [];
let totalMs = 0;
for (const seg of narration.segments) {
  const wav = join(OUT, `${seg.id}.wav`);
  const mp3 = `${seg.id}.mp3`;
  const piperRes = spawnSync('piper', ['-m', VOICE, '-f', wav], { input: seg.text, encoding: 'utf8' });
  if (piperRes.status !== 0 || !existsSync(wav)) { console.warn(`  ⚠️  piper failed for ${seg.id}`); continue; }
  const ff = spawnSync('ffmpeg', ['-y', '-i', wav, '-ac', '1', '-b:a', '64k', join(OUT, mp3)], { stdio: 'ignore' });
  rmSync(wav, { force: true });
  if (ff.status !== 0) { console.warn(`  ⚠️  ffmpeg failed for ${seg.id}`); continue; }
  const durationMs = durOf(join(OUT, mp3));
  totalMs += durationMs;
  outSegments.push({ ...seg, audioHref: mp3, durationMs });
  console.log(`  🎙️  ${seg.id}  ${(durationMs / 1000).toFixed(1)}s`);
}

// combined single track
let full = null;
if (outSegments.length) {
  const listFile = join(OUT, 'concat.txt');
  writeFileSync(listFile, outSegments.map((s) => `file '${s.audioHref}'`).join('\n') + '\n');
  const ff = spawnSync('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', join(OUT, 'narration-full.mp3')], { stdio: 'ignore', cwd: OUT });
  rmSync(listFile, { force: true });
  if (ff.status === 0 && existsSync(join(OUT, 'narration-full.mp3'))) full = { audioHref: 'narration-full.mp3', durationMs: durOf(join(OUT, 'narration-full.mp3')) };
}

const manifest = {
  schema: 'graphdone.narration/1',
  generatedAt: Date.now(),
  voice: VOICE_NAME,
  target: health.target || null,
  totalDurationMs: totalMs,
  full,
  segments: outSegments,
};
writeFileSync(join(OUT, 'narration.json'), JSON.stringify(manifest, null, 2));

const sizeKb = readdirSync(OUT).reduce((s, f) => { try { return s + statSync(join(OUT, f)).size; } catch { return s; } }, 0) / 1024;
console.log(`\n🎧 Narration ready: ${outSegments.length} segments · ${(totalMs / 1000).toFixed(0)}s total · ${Math.round(sizeKb)}KB`);
console.log(`   voice : ${VOICE_NAME}`);
console.log(`   out   : ${join(OUT, 'narration.json')}`);
console.log(`   dashboard → Narrated tab (npm run dashboard)`);
