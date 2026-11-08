import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const require = createRequire(new URL('package.json', root));
const semver = require('semver');
const ranges = { vite: '^7.3.7', vitest: '^4.1.12', '@vitest/coverage-v8': '^4.1.12', '@vitejs/plugin-react': '^5.2.0', esbuild: '>=0.25.0' };

for (const [name, range] of Object.entries(ranges)) {
  test(`all locked ${name} paths are on the reviewed patched line`, async () => {
    const lock = JSON.parse(await readFile(new URL('package-lock.json', root), 'utf8'));
    const paths = Object.entries(lock.packages).filter(([path]) => path.endsWith(`node_modules/${name}`));
    assert.ok(paths.length > 0, name);
    for (const [path, entry] of paths) assert.ok(semver.satisfies(entry.version, range), `${path}: ${entry.version}`);
  });
}

for (const workspace of ['core', 'server', 'mcp-server', 'web']) {
  test(`${workspace} resolves matching Vitest/coverage and supported Vite from its lock`, async () => {
    const local = createRequire(new URL(`packages/${workspace}/package.json`, root));
    const lock = JSON.parse(await readFile(new URL('package-lock.json', root), 'utf8'));
    for (const name of ['vite', 'vitest', '@vitest/coverage-v8']) {
      const pkg = local(`${name}/package.json`);
      const path = relative(fileURLToPath(root), local.resolve(`${name}/package.json`)).split(sep).join('/').replace(/\/package\.json$/, '');
      assert.equal(pkg.version, lock.packages[path]?.version);
      assert.ok(semver.satisfies(pkg.version, ranges[name]), `${workspace}/${name}: ${pkg.version}`);
      if (name !== '@vitest/coverage-v8') {
        assert.ok(pkg.engines?.node);
        for (const node of ['22.18.0', '24.0.0']) assert.ok(semver.satisfies(node, pkg.engines.node), `${name} Node ${node}`);
      }
    }
    const runner = local('vitest/package.json');
    const coverage = local('@vitest/coverage-v8/package.json');
    assert.equal(runner.version, coverage.version);
    assert.ok(semver.satisfies(runner.version, coverage.peerDependencies.vitest));
    assert.ok(semver.satisfies(local('vite/package.json').version, runner.peerDependencies.vite));
  });
}

test('no legacy Vitest worker or vite-node remains installed or locked', async () => {
  const lock = JSON.parse(await readFile(new URL('package-lock.json', root), 'utf8'));
  assert.deepEqual(Object.keys(lock.packages).filter(path => /(^|\/)node_modules\/(tinypool|vite-node)$/.test(path)), []);
  for (const workspace of ['core', 'server', 'mcp-server', 'web']) {
    const local = createRequire(new URL(`packages/${workspace}/package.json`, root));
    for (const name of ['tinypool', 'vite-node']) assert.throws(() => local.resolve(name), { code: 'MODULE_NOT_FOUND' });
  }
});

test('the installed React transform supports the actual Vite consumer', () => {
  const local = createRequire(new URL('packages/web/package.json', root));
  const plugin = JSON.parse(readFileSync(join(dirname(local.resolve('@vitejs/plugin-react')), '../package.json'), 'utf8'));
  assert.equal(plugin.name, '@vitejs/plugin-react');
  assert.ok(semver.satisfies(local('vite/package.json').version, plugin.peerDependencies.vite));
  for (const node of ['22.18.0', '24.0.0']) assert.ok(semver.satisfies(node, plugin.engines.node));
});
