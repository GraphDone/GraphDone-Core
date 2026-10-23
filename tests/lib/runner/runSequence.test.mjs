import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import test from 'node:test';
import { runCommand } from './runSequence.mjs';

const posixOnly = { skip: process.platform === 'win32', timeout: 10000 };

function isRunning(pid) {
  try {
    process.kill(pid, 0);
    if (process.platform === 'linux') {
      return !/\) [ZX] /.test(readFileSync(`/proc/${pid}/stat`, 'utf8'));
    }
    return true;
  } catch (error) {
    if (error.code === 'ESRCH' || error.code === 'ENOENT') return false;
    throw error;
  }
}

async function assertStopped(pid) {
  for (let attempt = 0; attempt < 40 && isRunning(pid); attempt += 1) await delay(25);
  assert.equal(isRunning(pid), false, `owned descendant ${pid} is still running`);
}

function fixture(t, { ignoreTerm = false, closeOutput = false, wrapperExits = false, escapeGroup = false } = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'graphdone-timeout-'));
  const pidPath = join(directory, 'descendant.pid');
  const wrapperPidPath = join(directory, 'wrapper.pid');
  t.after(() => {
    for (const path of [pidPath, wrapperPidPath]) {
      try {
        const pid = Number(readFileSync(path, 'utf8'));
        if (isRunning(pid)) process.kill(pid, 'SIGKILL');
      } catch (error) {
        if (error.code !== 'ENOENT' && error.code !== 'ESRCH') throw error;
      }
    }
    rmSync(directory, { recursive: true, force: true });
  });
  const descendant = `
    ${ignoreTerm ? "process.on('SIGTERM', () => {});" : ''}
    require('node:fs').writeFileSync(${JSON.stringify(pidPath)}, String(process.pid));
    ${closeOutput ? "require('node:fs').closeSync(1); require('node:fs').closeSync(2);" : ''}
    setTimeout(() => process.exit(0), 4000);
  `;
  const wrapper = `
    require('node:fs').writeFileSync(${JSON.stringify(wrapperPidPath)}, String(process.pid));
    const child = require('node:child_process').spawn(process.execPath, ['-e', ${JSON.stringify(descendant)}], { stdio: 'inherit', detached: ${escapeGroup} });
    ${wrapperExits ? 'child.unref();' : 'setInterval(() => {}, 1000);'}
  `;
  return { wrapper, pid: () => Number(readFileSync(pidPath, 'utf8')) };
}

test('captures successful output and preserves cwd/environment/argv without a shell', async t => {
  const directory = mkdtempSync(join(tmpdir(), 'graphdone-command-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const result = await runCommand(process.execPath, ['-e', 'console.log(JSON.stringify([process.cwd(), process.env.GRAPHDONE_FIXTURE, process.argv[1]])); console.error("stderr");', 'value with spaces; $(false)'], {
    cwd: directory, env: { GRAPHDONE_FIXTURE: 'local' }, timeoutMs: 5000,
  });
  assert.equal(result.code, 0);
  assert.equal(result.timedOut, false);
  assert.deepEqual(JSON.parse(result.stdout), [directory, 'local', 'value with spaces; $(false)']);
  assert.equal(result.stderr.trim(), 'stderr');
});

test('returns a missing-command error without rejecting or waiting for the timeout', async () => {
  const result = await runCommand('/graphdone-no-such-executable', [], { timeoutMs: 5000 });
  assert.equal(result.code, -1);
  assert.match(result.error, /ENOENT/);
  assert.ok(result.durationMs < 2500);
});

test('concurrent commands share interrupt listeners and remove them after settlement', async () => {
  const before = ['SIGINT', 'SIGTERM'].map(signal => process.listenerCount(signal));
  const commands = Array.from({ length: 3 }, () => runCommand(process.execPath, ['-e', 'setTimeout(() => {}, 30);'], { timeoutMs: 5000 }));
  assert.deepEqual(['SIGINT', 'SIGTERM'].map(signal => process.listenerCount(signal)), before.map(count => count + 1));
  for (const result of await Promise.all(commands)) assert.equal(result.code, 0);
  assert.deepEqual(['SIGINT', 'SIGTERM'].map(signal => process.listenerCount(signal)), before);
});

test('timeout terminates an ordinary descendant holding inherited output pipes', posixOnly, async t => {
  const { wrapper, pid } = fixture(t);
  const result = await runCommand(process.execPath, ['-e', wrapper], { timeoutMs: 600, terminationGraceMs: 50 });
  assert.equal(result.timedOut, true);
  assert.ok(result.durationMs < 2000, `timeout took ${result.durationMs} ms`);
  await assertStopped(pid());
});

test('timeout forcibly stops a descendant that ignores SIGTERM after its wrapper closes', posixOnly, async t => {
  const { wrapper, pid } = fixture(t, { ignoreTerm: true, closeOutput: true });
  const result = await runCommand(process.execPath, ['-e', wrapper], { timeoutMs: 600, terminationGraceMs: 50 });
  assert.equal(result.timedOut, true);
  assert.ok(result.durationMs < 2000, `timeout took ${result.durationMs} ms`);
  await assertStopped(pid());
});

test('timeout stops descendants when the wrapper already exited successfully', posixOnly, async t => {
  const { wrapper, pid } = fixture(t, { ignoreTerm: true, wrapperExits: true });
  const result = await runCommand(process.execPath, ['-e', wrapper], { timeoutMs: 600, terminationGraceMs: 50 });
  assert.equal(result.code, 0);
  assert.equal(result.timedOut, true);
  assert.ok(result.durationMs < 2000, `timeout took ${result.durationMs} ms`);
  await assertStopped(pid());
});

test('timeout leaves a separately owned process alive', posixOnly, async t => {
  const unrelated = spawn(process.execPath, ['-e', 'console.log("ready"); setInterval(() => console.log("alive"), 25);']);
  t.after(() => unrelated.kill('SIGKILL'));
  await once(unrelated.stdout, 'data');
  const { wrapper, pid } = fixture(t, { ignoreTerm: true });
  const result = await runCommand(process.execPath, ['-e', wrapper], { timeoutMs: 600, terminationGraceMs: 50 });
  assert.equal(result.timedOut, true);
  await assertStopped(pid());
  assert.equal(isRunning(unrelated.pid), true);
  assert.match(String((await once(unrelated.stdout, 'data'))[0]), /alive/);
});

test('output draining stays bounded when a descendant deliberately escapes its process group', posixOnly, async t => {
  const { wrapper, pid } = fixture(t, { escapeGroup: true });
  const result = await runCommand(process.execPath, ['-e', wrapper], { timeoutMs: 600, terminationGraceMs: 50 });
  assert.equal(result.timedOut, true);
  assert.ok(result.durationMs < 2000, `timeout took ${result.durationMs} ms`);
  assert.equal(isRunning(pid()), true);
});

for (const [signal, exitCode] of [['SIGINT', 130], ['SIGTERM', 143]]) {
  test(`${signal} cleans up detached owned processes before the runner exits`, posixOnly, async t => {
    const fixtures = [fixture(t, { ignoreTerm: true }), fixture(t, { ignoreTerm: true })];
    const runner = spawn(process.execPath, ['--input-type=module', '-e', `
      import { runCommand } from ${JSON.stringify(new URL('./runSequence.mjs', import.meta.url).href)};
      await Promise.all(${JSON.stringify(fixtures.map(({ wrapper }) => wrapper))}.map(wrapper => runCommand(process.execPath, ['-e', wrapper], { timeoutMs: 8000 })));
    `]);
    t.after(() => runner.kill('SIGKILL'));
    for (let attempt = 0; attempt < 100; attempt += 1) {
      try { if (fixtures.every(({ pid }) => pid())) break; } catch (error) { if (error.code !== 'ENOENT') throw error; }
      await delay(20);
    }
    const descendantPids = fixtures.map(({ pid }) => pid());
    const exit = once(runner, 'exit');
    runner.kill(signal);
    const exitResult = await exit;
    for (const descendantPid of descendantPids) await assertStopped(descendantPid);
    assert.deepEqual(exitResult, [exitCode, null]);
  });
}

test('interrupt cleanup preserves a caller-owned signal handler', posixOnly, async t => {
  const { wrapper, pid } = fixture(t, { ignoreTerm: true });
  const runner = spawn(process.execPath, ['--input-type=module', '-e', `
    import { runCommand } from ${JSON.stringify(new URL('./runSequence.mjs', import.meta.url).href)};
    process.on('SIGINT', () => { process.exitCode = 42; });
    const result = await runCommand(process.execPath, ['-e', ${JSON.stringify(wrapper)}], { timeoutMs: 8000 });
    console.log(result.error);
  `]);
  t.after(() => runner.kill('SIGKILL'));
  let output = '';
  runner.stdout.on('data', chunk => { output += chunk; });
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try { if (pid()) break; } catch (error) { if (error.code !== 'ENOENT') throw error; }
    await delay(20);
  }
  const descendantPid = pid();
  const close = once(runner, 'close');
  runner.kill('SIGINT');
  assert.deepEqual(await close, [42, null]);
  await assertStopped(descendantPid);
  assert.match(output, /Command interrupted by SIGINT/);
});
