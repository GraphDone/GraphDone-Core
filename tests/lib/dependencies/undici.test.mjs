import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const require = createRequire(import.meta.url);
const sqliteRequire = createRequire(require.resolve('sqlite3/package.json'));
const nodeGypPath = sqliteRequire.resolve('node-gyp/package.json');
const nodeGypRequire = createRequire(nodeGypPath);
const { satisfies, valid } = nodeGypRequire('semver');
const lock = JSON.parse(readFileSync(resolve(root, 'package-lock.json'), 'utf8'));
const affected = '>=6.5.0 <6.29.1 || >=7.0.0 <7.30.1 || >=8.0.0 <8.12.2';

test('every locked Undici copy excludes the October 2026 content-encoding and EventSource advisories', () => {
  const entries = Object.entries(lock.packages).filter(([path]) => /(?:^|\/)node_modules\/undici$/.test(path));
  assert.ok(entries.length > 0, 'Expected the native SQLite build dependency in the audited lockfile');
  for (const [path, { version }] of entries) {
    assert.ok(valid(version) && !satisfies(version, affected, { includePrerelease: true }), `${path} resolves an affected Undici version (${version})`);
  }
});

test('SQLite node-gyp resolves the patched lockfile copy within its declared Undici range', () => {
  const packagePath = nodeGypRequire.resolve('undici/package.json');
  const installed = JSON.parse(readFileSync(packagePath, 'utf8'));
  const nodeGyp = JSON.parse(readFileSync(nodeGypPath, 'utf8'));
  const key = relative(root, dirname(packagePath)).split(sep).join('/');
  assert.equal(installed.version, lock.packages[key]?.version, 'Installed consumer resolution differs from the lockfile');
  assert.ok(satisfies(installed.version, nodeGyp.dependencies.undici), 'Patch must satisfy the existing node-gyp dependency range');
  assert.ok(!satisfies(installed.version, affected, { includePrerelease: true }), 'SQLite build tooling still resolves an affected Undici version');
});
