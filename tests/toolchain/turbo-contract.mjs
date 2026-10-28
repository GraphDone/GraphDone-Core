import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const turbo = join(root, 'node_modules/turbo/bin/turbo');

test('installed Turbo preserves dependency order, environment, cache invalidation and task failures', { timeout: 30000 }, async () => {
  const fixture = await mkdtemp(join(tmpdir(), 'graphdone-turbo-'));
  try {
    const config = JSON.parse(await readFile(join(root, 'turbo.json'), 'utf8'));
    const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
    assert.equal(config.envMode, 'loose');
    assert.ok(config.tasks.build.env.includes('VITE_OFFLINE_SYNC'));
    await writeFile(join(fixture, 'package.json'), JSON.stringify({ name: 'owned-turbo-contract', private: true, packageManager: manifest.packageManager, workspaces: ['packages/*'] }));
    await writeFile(join(fixture, '.gitignore'), 'dist/\n.turbo/\nexecutions.log\n');
    await writeFile(join(fixture, 'turbo.json'), JSON.stringify({ envMode: config.envMode, tasks: { build: config.tasks.build } }));
    const packages = { '': { name: 'owned-turbo-contract', workspaces: ['packages/*'] } };
    for (const name of ['core', 'web']) {
      const dir = join(fixture, 'packages', name);
      await mkdir(dir, { recursive: true });
      const pkg = { name: `@owned/${name}`, version: '1.0.0', scripts: { build: 'node build.cjs' }, ...(name === 'web' ? { dependencies: { '@owned/core': '1.0.0' } } : {}) };
      await writeFile(join(dir, 'package.json'), JSON.stringify(pkg));
      packages[`packages/${name}`] = pkg;
      packages[`node_modules/@owned/${name}`] = { resolved: `packages/${name}`, link: true };
      await writeFile(join(dir, 'build.cjs'), `const fs=require('node:fs');
if (${JSON.stringify(name)} === 'core' && process.env.GRAPHDONE_PROBE_FAIL === 'yes') { process.stderr.write('owned-core-failure-23\\n'); process.exit(23); }
if (${JSON.stringify(name)} === 'web') {
  const core=JSON.parse(fs.readFileSync('../core/dist/result.json','utf8'));
  if (core.flavor !== process.env.VITE_OFFLINE_SYNC) throw Error('dependency output is stale');
}
fs.mkdirSync('dist',{recursive:true});
fs.appendFileSync('executions.log','executed\\n');
fs.writeFileSync('dist/result.json',JSON.stringify({flavor:process.env.VITE_OFFLINE_SYNC,passed:process.env.GRAPHDONE_PROBE_PASSTHROUGH}));
`);
    }
    await writeFile(join(fixture, 'package-lock.json'), JSON.stringify({ name: 'owned-turbo-contract', lockfileVersion: 3, requires: true, packages }));
    const run = (flavor, fail = false) => spawnSync(process.execPath, [turbo, 'run', 'build', fail ? '--cache=local:w' : '--cache=local:rw'], {
      cwd: fixture,
      encoding: 'utf8',
      timeout: 15000,
      env: { PATH: process.env.PATH, CI: 'true', TURBO_TELEMETRY_DISABLED: '1', VITE_OFFLINE_SYNC: flavor, GRAPHDONE_PROBE_PASSTHROUGH: 'owned-value', GRAPHDONE_PROBE_FAIL: fail ? 'yes' : 'no' },
    });
    const first = run('false');
    assert.equal(first.status, 0, first.stderr + first.stdout);
    for (const name of ['core', 'web']) assert.deepEqual(JSON.parse(await readFile(join(fixture, 'packages', name, 'dist/result.json'), 'utf8')), { flavor: 'false', passed: 'owned-value' });
    const second = run('true');
    assert.equal(second.status, 0, second.stderr + second.stdout);
    for (const name of ['core', 'web']) assert.equal(JSON.parse(await readFile(join(fixture, 'packages', name, 'dist/result.json'), 'utf8')).flavor, 'true');
    const cached = run('true');
    assert.equal(cached.status, 0, cached.stderr + cached.stdout);
    const failed = run('true', true);
    assert.notEqual(failed.status, 0);
    assert.equal(failed.error, undefined);
    assert.match(failed.stderr + failed.stdout, /owned-core-failure-23/);
    for (const name of ['core', 'web']) assert.equal((await readFile(join(fixture, 'packages', name, 'executions.log'), 'utf8')).trim().split('\n').length, 2);
  } finally {
    await rm(fixture, { recursive: true });
  }
});
