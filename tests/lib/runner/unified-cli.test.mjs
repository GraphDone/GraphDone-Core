import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, cpSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { prepareOutput } from './unified-options.mjs';
import { SEQUENCES, PROFILES } from '../../sequences/unified.config.mjs';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const { load } = createRequire(import.meta.url)('js-yaml');

// How CI's Smoke Gate runs each sequence, read from the shard matrix in
// ci.yml: one entry per shard line, "<sequence> <output dir> [xvfb]".
function smokeGateRuns() {
  const ci = load(readFileSync(join(root, '.github/workflows/ci.yml'), 'utf8'));
  const runs = {};
  for (const shard of ci.jobs['smoke-gate-shard'].strategy.matrix.include) {
    for (const line of shard.sequences.split('\n').map(entry => entry.trim()).filter(Boolean)) {
      const [sequence, out, display = ''] = line.split(/\s+/);
      (runs[sequence] ??= []).push({ shard: shard.name, out, display });
    }
  }
  return { ci, runs };
}

// The sequence runs in exactly one Smoke Gate shard, writing to
// test-artifacts/<out>, under a virtual display when xvfb is true.
function assertSmokeGateRuns(sequence, { out, xvfb }) {
  const entries = smokeGateRuns().runs[sequence] ?? [];
  assert.equal(entries.length, 1, `${sequence} must run in exactly one Smoke Gate shard`);
  assert.equal(entries[0].out, out);
  assert.equal(entries[0].display, xvfb ? 'xvfb' : '');
}

test('relationship-edit as a hosted guest leaves out the self-hosted second-tab path instead of skipping it', t => {
  const report = { suites: [{ specs: [{ title: 'fixture', ok: true,
    tests: [{ status: 'expected', expectedStatus: 'passed', results: [{ status: 'passed' }] }],
  }] }], stats: { expected: 1, unexpected: 0, flaky: 0, skipped: 0 }, errors: [] };
  for (const [backend, inverted] of [['selfhost', []], ['hosted-guest', ['--grep-invert=relationship-edit second-tab']]]) {
    const { dir, run } = fixture(t);
    writeFileSync(join(dir, 'bin/npx'), `#!${process.execPath}\nconst fs=require('node:fs'); fs.writeFileSync('bin/argv.json', JSON.stringify(process.argv.slice(2))); process.stdout.write(${JSON.stringify(JSON.stringify(report))});\n`, { mode: 0o700 });
    const result = run(['--sequence', 'relationship-edit'], { JOURNEY_BACKEND: backend });
    assert.equal(result.status, 0, result.stdout);
    const args = JSON.parse(readFileSync(join(dir, 'bin/argv.json')));
    assert.deepEqual(args.filter(arg => arg.startsWith('--grep')), inverted, backend);
  }
});

test('required performance and mobile gates select their bounded suites without retries', () => {
  assert.deepEqual(SEQUENCES['perf-budgets'].args, ['tests/perf/graph-perf.spec.ts', '--project=perf', '--workers=1', '--retries=0', '--trace=retain-on-failure']);
  assert.equal(SEQUENCES['perf-budgets'].blocking, true);
  assert.deepEqual(SEQUENCES.mobile.args, ['--grep', '@mobile|@audit', '--project=GraphDone-Core/dev-neo4j/chromium', '--workers=1', '--retries=0', '--trace=retain-on-failure']);
  assert.equal(SEQUENCES.mobile.blocking, true);
  assert.deepEqual(SEQUENCES.devices.args, ['--project=ui-fit:*', '--workers=4', '--retries=0', '--trace=retain-on-failure']);
  assert.equal(SEQUENCES.devices.blocking, true);
  assert.ok(PROFILES.pr.includes('devices') && PROFILES.full.includes('devices'));
});
function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'graphdone-unified-cli-'));
  mkdirSync(join(dir, 'tests'), { recursive: true });
  cpSync(join(root, 'tests/lib'), join(dir, 'tests/lib'), { recursive: true });
  cpSync(join(root, 'tests/sequences'), join(dir, 'tests/sequences'), { recursive: true });
  cpSync(join(root, 'tests/run-unified.mjs'), join(dir, 'tests/run-unified.mjs'));
  mkdirSync(join(dir, 'packages/web'), { recursive: true });
  mkdirSync(join(dir, 'bin'));
  writeFileSync(join(dir, '.gitignore'), 'test-artifacts/\nbin/\n');
  writeFileSync(join(dir, 'sentinel.txt'), 'keep source');
  writeFileSync(join(dir, 'bin/npx'), `#!${process.execPath}\nconst fs=require('node:fs'); const report={success:true,numTotalTests:1,testResults:[{status:'passed',assertionResults:[{title:'fixture',status:'passed'}]}]}; process.stdout.write(JSON.stringify(report));\n`, { mode: 0o700 });
  execFileSync('git', ['init', '-q'], { cwd: dir });
  execFileSync('git', ['config', '--local', 'maintenance.auto', 'false'], { cwd: dir });
  execFileSync('git', ['config', '--local', 'gc.auto', '0'], { cwd: dir });
  execFileSync('git', ['add', '.'], { cwd: dir });
  execFileSync('git', ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'fixture'], { cwd: dir, env: { ...process.env, GIT_TRACE2_EVENT: join(dir, 'bin/git-trace.jsonl') } });
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const run = (args, env = {}) => spawnSync(process.execPath, ['tests/run-unified.mjs', ...args], {
    cwd: dir, env: { ...process.env, PATH: `${join(dir, 'bin')}:${process.env.PATH}`, ...env }, encoding: 'utf8', timeout: 10000,
  });
  return { dir, run };
}

test('disposable Git fixture commits do not spawn background maintenance', t => {
  const { dir } = fixture(t);
  const events = readFileSync(join(dir, 'bin/git-trace.jsonl'), 'utf8').trim().split('\n').map(line => JSON.parse(line));
  assert.ok(events.some(event => event.event === 'exit' && event.code === 0));
  assert.deepEqual(events.filter(event => event.event === 'child_start' && event.argv?.includes('maintenance')), []);
});

for (const sequence of ['new-user', 'example-resume', 'agent-connection', 'inspector-readability', 'semantic-lod', 'nested-lod', 'item-wires', 'large-symbols', 'schematic-visual', 'layout-recovery', 'router-navigation', 'mobile', 'devices', 'perf-budgets', 'relationship-edit', 'zoom-out']) {
  test(`CLI forwards failure-only tracing without retries for ${sequence}`, t => {
    const { dir, run } = fixture(t);
    const report = { suites: [{ specs: [{ title: 'fixture', ok: true,
      tests: [{ status: 'expected', expectedStatus: 'passed', results: [{ status: 'passed' }] }],
    }] }], stats: { expected: 1, unexpected: 0, flaky: 0, skipped: 0 }, errors: [] };
    writeFileSync(join(dir, 'bin/npx'), `#!${process.execPath}\nconst fs=require('node:fs'); fs.writeFileSync('bin/argv.json', JSON.stringify(process.argv.slice(2))); process.stdout.write(${JSON.stringify(JSON.stringify(report))});\n`, { mode: 0o700 });
    const result = run(['--sequence', sequence]);
    assert.equal(result.status, 0, result.stdout);
    const args = JSON.parse(readFileSync(join(dir, 'bin/argv.json')));
    if (sequence === 'new-user') {
      assert.ok(!args.includes('tests/e2e/graph/semantic-lod.spec.ts'));
      assert.ok(!args.includes('tests/e2e/auth/router-navigation.spec.ts'));
      assert.ok(!args.includes('tests/e2e/graph/inspector-readability.spec.ts'));
      assert.ok(!args.includes('tests/e2e/quality/example-resume.spec.ts'));
    }
    if (sequence === 'example-resume') {
      assert.deepEqual(args.filter(arg => arg.endsWith('.spec.ts')), ['tests/e2e/quality/example-resume.spec.ts']);
      assert.ok(!args.includes('--headed'));
      assert.equal(SEQUENCES[sequence].blocking, true);
      assertSmokeGateRuns(sequence, { out: 'ci-example-resume', xvfb: false });
    }
    if (sequence === 'agent-connection') {
      assert.deepEqual(args.filter(arg => arg.endsWith('.spec.ts')), ['tests/e2e/quality/agent-collaboration.spec.ts']);
      assert.ok(args.includes('--headed'));
      assert.equal(SEQUENCES[sequence].blocking, true);
      for (const profile of ['pr', 'full']) assert.ok(PROFILES[profile].includes(sequence));
      assertSmokeGateRuns(sequence, { out: 'ci-agent-connection', xvfb: true });
    }
    if (sequence === 'inspector-readability') {
      assert.deepEqual(args.filter(arg => arg.endsWith('.spec.ts')), ['tests/e2e/graph/inspector-readability.spec.ts']);
      assert.ok(args.includes('--headed'));
      assert.equal(SEQUENCES[sequence].blocking, true);
      for (const profile of ['pr', 'full']) assert.ok(PROFILES[profile].includes(sequence));
      assertSmokeGateRuns(sequence, { out: 'ci-inspector-readability', xvfb: true });
    }
    if (sequence === 'relationship-edit') {
      assert.deepEqual(args.filter(arg => arg.endsWith('.spec.ts')), ['tests/e2e/journeys/relationship-edit.spec.ts']);
      assert.deepEqual(args.filter(arg => arg.startsWith('--project=')), ['--project=journeys', '--project=journeys-ipad', '--project=journeys-iphone']);
      assert.ok(!args.some(arg => arg.startsWith('--repeat-each')));
      assert.equal(SEQUENCES[sequence].blocking, true);
      for (const profile of ['pr', 'full']) assert.ok(PROFILES[profile].includes(sequence));
      assertSmokeGateRuns(sequence, { out: 'ci-relationship-edit', xvfb: false });
      // ...and once more as a hosted guest, on the hosted build, in one shard.
      const { ci } = smokeGateRuns();
      const guest = ci.jobs['smoke-gate-shard'].steps.filter(step => step.env?.JOURNEY_BACKEND === 'hosted-guest');
      assert.equal(guest.length, 1);
      assert.equal(guest[0].if, 'matrix.guest && !cancelled()');
      assert.match(guest[0].run, /VITE_OFFLINE_SYNC=true VITE_HOSTED_USAGE=true .* vite build --outDir \/tmp\/graphdone-guest\)/);
      assert.match(guest[0].run, /\nnode tests\/run-unified\.mjs --sequence relationship-edit --out test-artifacts\/ci-relationship-edit-guest\n/);
      assert.equal(ci.jobs['smoke-gate-shard'].strategy.matrix.include.filter(shard => shard.guest).length, 1);
    }
    if (sequence === 'zoom-out') {
      assert.deepEqual(args.filter(arg => arg.endsWith('.spec.ts')), ['tests/e2e/journeys/zoom-out.spec.ts']);
      assert.deepEqual(args.filter(arg => arg.startsWith('--project=')), ['--project=journeys', '--project=journeys-ipad', '--project=journeys-iphone']);
      assert.equal(SEQUENCES[sequence].blocking, true);
      for (const profile of ['pr', 'full']) assert.ok(PROFILES[profile].includes(sequence));
      assertSmokeGateRuns(sequence, { out: 'ci-zoom-out', xvfb: false });
    }
    if (sequence === 'large-symbols') {
      assert.ok(args.includes('tests/e2e/graph/large-graph-symbols.spec.ts'));
      assert.ok(!args.includes('--headed'));
      assert.equal(SEQUENCES[sequence].blocking, true);
      for (const profile of ['pr', 'full']) assert.ok(PROFILES[profile].includes(sequence));
      assertSmokeGateRuns(sequence, { out: 'ci-large-symbols', xvfb: false });
    }
    if (sequence === 'schematic-visual') {
      assert.ok(args.includes('--config=tests/visual/playwright.schematic.config.ts'));
      assert.equal(SEQUENCES[sequence].blocking, true);
      for (const profile of ['pr', 'full']) assert.ok(PROFILES[profile].includes(sequence));
      // Runs before the dev stack, in the one shard that also runs the toolchain contracts.
      const { ci } = smokeGateRuns();
      const steps = ci.jobs['smoke-gate-shard'].steps.filter(step => step.run === 'node tests/run-unified.mjs --sequence schematic-visual --out test-artifacts/ci-schematic-visual');
      assert.equal(steps.length, 1);
      assert.equal(steps[0].if, 'matrix.toolchain');
      assert.equal(ci.jobs['smoke-gate-shard'].strategy.matrix.include.filter(shard => shard.toolchain).length, 1);
    }
    if (sequence === 'item-wires' || sequence === 'nested-lod' || sequence === 'semantic-lod' || sequence === 'layout-recovery' || sequence === 'router-navigation') {
      const spec = sequence === 'item-wires' ? 'tests/e2e/graph/item-wire-consumers.spec.ts' : sequence === 'nested-lod' ? 'tests/e2e/graph/nested-semantic-lod.spec.ts' : sequence === 'semantic-lod' ? 'tests/e2e/graph/semantic-lod.spec.ts' : sequence === 'layout-recovery' ? 'tests/e2e/graph/layout-recovery.spec.ts' : 'tests/e2e/auth/router-navigation.spec.ts';
      assert.ok(args.includes(spec));
      if (sequence === 'item-wires') assert.ok(args.includes('tests/e2e/graph/item-symbols.spec.ts'));
      assert.equal(SEQUENCES[sequence].blocking, true);
      assertSmokeGateRuns(sequence, { out: `ci-${sequence}`, xvfb: true });
    }
    assert.deepEqual(args.filter(arg => arg.startsWith('--trace=')), ['--trace=retain-on-failure']);
    assert.deepEqual(args.filter(arg => arg.startsWith('--retries=')), ['--retries=0']);
    // The device matrix only reads (it opens screens and dialogs, never saves),
    // so its 120+ independent cases may share the stack four at a time. Each
    // relationship-edit trial works in its own new graph, two at a time.
    const workers = { devices: '--workers=4', 'relationship-edit': '--workers=2' }[sequence] ?? '--workers=1';
    assert.deepEqual(args.filter(arg => arg.startsWith('--workers=')), [workers]);
  });
}

for (const sequence of ['new-user', 'agent-connection', 'inspector-readability']) {
  test(`${sequence}: failed browser traces and diagnostics survive later Playwright output cleanup`, t => {
    const { dir, run } = fixture(t);
    const original = join(dir, 'test-artifacts/playwright-output');
    mkdirSync(original, { recursive: true });
    const trace = join(original, 'trace.zip');
    const diagnostics = join(original, 'button-navigation-diagnostics.json');
    writeFileSync(trace, 'owned trace bytes');
    writeFileSync(diagnostics, '{"navigation":{"route":"/agents","width":320}}');
    const report = { suites: [{ specs: [{ title: 'navigation failed', ok: false,
      tests: [{ status: 'unexpected', expectedStatus: 'passed', results: [{ status: 'failed', attachments: [
        { name: 'trace', contentType: 'application/zip', path: trace },
        { name: 'button-navigation-diagnostics.json', contentType: 'application/json', path: diagnostics },
      ] }] }],
    }] }], stats: { expected: 0, unexpected: 1, flaky: 0, skipped: 0 }, errors: [] };
    writeFileSync(join(dir, 'bin/npx'), `#!${process.execPath}\nprocess.stdout.write(${JSON.stringify(JSON.stringify(report))}); process.exitCode=1;\n`, { mode: 0o700 });
    assert.equal(run(['--sequence', sequence]).status, 1);
    const out = join(dir, 'test-artifacts/unified');
    const result = JSON.parse(readFileSync(join(out, 'report.json')));
    const attachments = result.sequences[0].cases[0].attachments;
    assert.equal(attachments.length, 2);
    assert.ok(attachments.every(attachment => attachment.type === 'file' && !attachment.srcPath));
    rmSync(original, { recursive: true });
    assert.equal(readFileSync(join(out, attachments[0].href), 'utf8'), 'owned trace bytes');
    assert.equal(JSON.parse(readFileSync(join(out, attachments[1].href))).navigation.route, '/agents');
    const html = readFileSync(join(out, 'report.html'), 'utf8');
    for (const attachment of attachments) assert.ok(html.includes(`<a href="${attachment.href}" download>`));
  });

}

for (const location of ['outside-root', 'symlink', 'directory-symlink', 'directory']) {
  test(`CLI rejects ${location} sources for downloadable evidence`, t => {
    const { dir, run } = fixture(t);
    const outside = mkdtempSync(join(tmpdir(), 'graphdone-outside-evidence-'));
    t.after(() => rmSync(outside, { recursive: true, force: true }));
    const sentinel = join(outside, 'sentinel.json');
    writeFileSync(sentinel, 'unrelated owned sentinel');
    const artifacts = join(dir, 'test-artifacts/playwright-output');
    mkdirSync(artifacts, { recursive: true });
    let source = sentinel;
    if (location === 'symlink') {
      source = join(artifacts, 'alias.json');
      symlinkSync(sentinel, source);
    } else if (location === 'directory-symlink') {
      const alias = join(artifacts, 'linked-directory');
      symlinkSync(outside, alias, 'dir');
      source = join(alias, 'sentinel.json');
    } else if (location === 'directory') source = artifacts;
    const report = { suites: [{ specs: [{ title: 'declared file', ok: true,
      tests: [{ status: 'expected', expectedStatus: 'passed', results: [{ status: 'passed', attachments: [
        { name: 'diagnostics', contentType: 'application/json', path: source },
      ] }] }],
    }] }], stats: { expected: 1, unexpected: 0, flaky: 0, skipped: 0 }, errors: [] };
    writeFileSync(join(dir, 'bin/npx'), `#!${process.execPath}\nprocess.stdout.write(${JSON.stringify(JSON.stringify(report))});\n`, { mode: 0o700 });
    const result = run(['--sequence', 'new-user']);
    assert.equal(result.status, 1, result.stdout);
    const unified = JSON.parse(readFileSync(join(dir, 'test-artifacts/unified/report.json')));
    assert.equal(unified.rollup.status, 'failed');
    assert.match(unified.sequences[0].evidenceErrors.join(' '), /file attachment/i);
    assert.ok(unified.sequences[0].cases.every(result => result.attachments.length === 0));
    assert.equal(readFileSync(sentinel, 'utf8'), 'unrelated owned sentinel');
  });
}

for (const args of [['--sequence', 'does-not-exist'], ['--profile', 'does-not-exist'], ['--out']]) {
  test(`CLI rejects invalid selection before touching output: ${args.join(' ')}`, t => {
    const { dir, run } = fixture(t);
    const out = join(dir, 'test-artifacts/unified');
    mkdirSync(out, { recursive: true });
    writeFileSync(join(out, 'sentinel.txt'), 'keep evidence');
    const result = run(args);
    assert.notEqual(result.status, 0, result.stdout);
    assert.equal(readFileSync(join(out, 'sentinel.txt'), 'utf8'), 'keep evidence');
  });
}

test('CLI refuses a source-root output directory without deleting source', t => {
  const { dir, run } = fixture(t);
  const result = run(['--sequence', 'unit-web', '--out', '.']);
  assert.notEqual(result.status, 0, result.stdout);
  assert.equal(readFileSync(join(dir, 'sentinel.txt'), 'utf8'), 'keep source');
  assert.ok(existsSync(join(dir, 'tests/run-unified.mjs')));
});
test('CLI refuses a nonempty unrelated output directory', t => {
  const { dir, run } = fixture(t);
  const out = join(dir, 'test-artifacts/unrelated');
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, 'sentinel.txt'), 'keep evidence');
  const result = run(['--sequence', 'unit-web', '--out', out]);
  assert.notEqual(result.status, 0, result.stdout);
  assert.equal(readFileSync(join(out, 'sentinel.txt'), 'utf8'), 'keep evidence');
});
test('CLI permits its own rerun and records source provenance', t => {
  const { dir, run } = fixture(t);
  const args = ['--sequence', 'unit-web'];
  for (let i = 0; i < 2; i++) {
    const result = run(args);
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(readFileSync(join(dir, 'test-artifacts/unified/report.json')));
    assert.equal(report.schema, 'graphdone.unified-report/1');
    assert.equal(report.rollup.status, 'passed');
    assert.equal(report.source.changedDuringRun, false);
    assert.match(report.source.started.revision, /^[a-f0-9]{40}$/);
    assert.equal(report.source.started.dirty, false);
    assert.equal(report.source.started.fingerprint, report.source.finished.fingerprint);
    if (i === 0) writeFileSync(join(dir, 'test-artifacts/unified/retained.txt'), 'keep previous evidence');
  }
  assert.equal(readFileSync(join(dir, 'test-artifacts/unified/retained.txt'), 'utf8'), 'keep previous evidence');
});
test('CLI rejects symlinks inside an owned report directory', t => {
  const { dir, run } = fixture(t);
  assert.equal(run(['--sequence', 'unit-web']).status, 0);
  const out = join(dir, 'test-artifacts/unified');
  symlinkSync(join(dir, 'sentinel.txt'), join(out, 'linked-source'));
  assert.notEqual(run(['--sequence', 'unit-web']).status, 0);
  assert.equal(readFileSync(join(dir, 'sentinel.txt'), 'utf8'), 'keep source');
});
test('CLI can refresh a legacy report without a marker', t => {
  const { dir, run } = fixture(t);
  assert.equal(run(['--sequence', 'unit-web']).status, 0);
  rmSync(join(dir, 'test-artifacts/unified/.graphdone-unified-output'));
  assert.equal(run(['--sequence', 'unit-web']).status, 0);
});
test('CLI explicitly optional absent audit remains skipped without a fabricated pass', t => {
  const { dir, run } = fixture(t);
  const result = run(['--sequence', 'cloud-audit', '--cloud-findings', join(dir, 'absent.json')]);
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(readFileSync(join(dir, 'test-artifacts/unified/report.json')));
  assert.equal(report.rollup.status, 'skipped');
  assert.equal(report.rollup.totals.passed, 0);
});

for (const sequence of ['perf-budgets', 'mobile', 'devices']) {
  test(`CLI rejects a successful process with skipped required ${sequence} cases`, t => {
    const { dir, run } = fixture(t);
    const report = { suites: [{ specs: Array.from({ length: 3 }, (_, i) => ({
      title: `required case ${i}`, ok: true,
      tests: [{ status: 'skipped', expectedStatus: 'skipped', results: [{ status: 'skipped' }] }],
    })) }], stats: { expected: 0, unexpected: 0, flaky: 0, skipped: 3 }, errors: [] };
    writeFileSync(join(dir, 'bin/npx'), `#!${process.execPath}\nprocess.stdout.write(${JSON.stringify(JSON.stringify(report))});\n`, { mode: 0o700 });
    const result = run(['--sequence', sequence]);
    assert.equal(result.status, 1, result.stdout);
    const unified = JSON.parse(readFileSync(join(dir, 'test-artifacts/unified/report.json')));
    assert.equal(unified.rollup.status, 'failed');
    assert.equal(unified.rollup.totals.passed, 0);
    assert.equal(unified.rollup.totals.skipped, 3);
  });
}
test('CLI detects a source edit while tests are running', t => {
  const { dir, run } = fixture(t);
  const fake = join(dir, 'bin/npx');
  writeFileSync(fake, readFileSync(fake, 'utf8') + `fs.writeFileSync(${JSON.stringify(resolve(dir, 'sentinel.txt'))}, 'changed');\n`);
  const result = run(['--sequence', 'unit-web']);
  assert.notEqual(result.status, 0, result.stdout);
  const report = JSON.parse(readFileSync(join(dir, 'test-artifacts/unified/report.json')));
  assert.equal(report.source.changedDuringRun, true);
  assert.equal(report.rollup.status, 'failed');
});

test('CLI refuses to stamp one repository while executing from another', t => {
  const a = fixture(t);
  const b = fixture(t);
  const result = spawnSync(process.execPath, [join(a.dir, 'tests/run-unified.mjs'), '--sequence', 'unit-web'], {
    cwd: b.dir, env: { ...process.env, PATH: `${join(b.dir, 'bin')}:${process.env.PATH}` }, encoding: 'utf8', timeout: 10000,
  });
  assert.notEqual(result.status, 0, result.stdout);
  assert.ok(!existsSync(join(b.dir, 'test-artifacts/unified/report.json')));
});

for (const location of ['git-dir', 'git-common-dir', 'symlink']) {
  test(`linked worktree output rejects actual Git metadata: ${location}`, t => {
    const { dir } = fixture(t);
    const linked = join(dir, 'test-artifacts/linked');
    execFileSync('git', ['worktree', 'add', '--detach', linked, 'HEAD'], { cwd: dir, stdio: 'pipe' });
    const gitDir = execFileSync('git', ['rev-parse', '--absolute-git-dir'], { cwd: linked, encoding: 'utf8' }).trim();
    const common = resolve(linked, execFileSync('git', ['rev-parse', '--git-common-dir'], { cwd: linked, encoding: 'utf8' }).trim());
    const alias = join(dir, 'test-artifacts/metadata-alias');
    if (location === 'symlink') symlinkSync(gitDir, alias, 'dir');
    const output = join(location === 'git-dir' ? gitDir : location === 'git-common-dir' ? common : alias, 'review-output');
    assert.throws(() => prepareOutput(output, linked), /Git metadata/);
    assert.ok(!existsSync(output));
  });
}

test('every Smoke Gate shard warms up with THE GATE, and the summary job keeps the Smoke Gate name', () => {
  const { ci, runs } = smokeGateRuns();
  const shards = ci.jobs['smoke-gate-shard'].strategy.matrix.include;
  for (const shard of shards) {
    const first = shard.sequences.trim().split('\n')[0].trim().split(/\s+/);
    assert.deepEqual(first, ['smoke', 'ci-smoke'], `${shard.name} must start with THE GATE on its fresh database`);
  }
  assert.equal(runs.smoke.length, shards.length);
  // Every sequence the single Smoke Gate job ran before #274 (its schematic-visual
  // and toolchain steps are checked above), plus relationship-edit (#262) and
  // zoom-out (#277), so a sequence dropped from every shard fails here. Change
  // this list on purpose only.
  assert.deepEqual(Object.keys(runs).sort(), [
    'agent-connection', 'example-resume', 'inspector-readability', 'item-wires', 'large-symbols', 'layout-recovery',
    'living-graph-effects', 'mobile', 'nested-lod', 'new-user', 'perf-budgets', 'relationship-edit',
    'router-navigation', 'semantic-lod', 'smoke', 'zoom-out',
  ]);
  for (const [sequence, entries] of Object.entries(runs)) {
    if (sequence !== 'smoke') assert.equal(entries.length, 1, `${sequence} runs in exactly one shard`);
  }
  assert.equal(ci.jobs['smoke-gate'].name, 'Smoke Gate');
  assert.deepEqual(ci.jobs['smoke-gate'].needs, ['smoke-gate-shard']);
  assert.ok(ci.jobs['ci-success'].needs.includes('smoke-gate'));
});

test('the journeys measurement gets time in proportion to its repeats', () => {
  const limit = env => JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e',
    "const { SEQUENCES } = await import(process.argv[1]); console.log(JSON.stringify([SEQUENCES.journeys.timeoutMs, SEQUENCES.journeys.args.find(a => a.startsWith('--repeat-each'))]))",
    join(root, 'tests/sequences/unified.config.mjs')], { env: { PATH: process.env.PATH, ...env }, encoding: 'utf8' }));
  // Six minutes per repeat: a fixed 15 minutes stopped 20 repeats before any result was written.
  assert.deepEqual(limit({}), [60 * 60_000, '--repeat-each=10']);
  assert.deepEqual(limit({ JOURNEY_REPEAT: '20' }), [120 * 60_000, '--repeat-each=20']);
  assert.deepEqual(limit({ JOURNEY_REPEAT: '20', JOURNEY_TIMEOUT_MINUTES: '30' }), [30 * 60_000, '--repeat-each=20']);
  // Run-once gates keep the adapter's default limit.
  assert.equal(SEQUENCES['relationship-edit'].timeoutMs, undefined);
  assert.match(readFileSync(join(root, 'tests/run-unified.mjs'), 'utf8'), /runPlaywrightSequence\(\{[^}]*timeoutMs: def\.timeoutMs/);
});
