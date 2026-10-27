import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { relative, sep } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = new URL('../../../', import.meta.url);
const require = createRequire(new URL('package.json', root));
const webRequire = createRequire(new URL('packages/web/package.json', root));
const semver = require('semver');

test('all locked React Router paths contain the 7.18 security fixes', async () => {
  const lock = JSON.parse(await readFile(new URL('package-lock.json', root), 'utf8'));
  const paths = Object.entries(lock.packages).filter(([path]) => /(^|\/)node_modules\/react-router(?:-dom)?$/.test(path));
  assert.ok(paths.length >= 2);
  for (const [path, entry] of paths) {
    assert.ok(semver.satisfies(entry.version, '>=7.18.0', { includePrerelease: true }), `${path}: ${entry.version}`);
  }
  for (const name of ['react-router', 'react-router-dom']) {
    const installed = webRequire(`${name}/package.json`).version;
    const path = relative(fileURLToPath(root), webRequire.resolve(`${name}/package.json`)).split(sep).join('/').replace(/\/package\.json$/, '');
    assert.ok(semver.satisfies(installed, '>=7.18.0', { includePrerelease: true }), `${name}: installed ${installed}`);
    assert.equal(installed, lock.packages[path]?.version, `${name}: installed consumer matches lock`);
  }
  assert.equal(webRequire('react-router-dom/package.json').version, webRequire('react-router/package.json').version);
});
