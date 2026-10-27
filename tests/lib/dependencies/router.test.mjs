import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import test from 'node:test';

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
  assert.equal(webRequire('react-router-dom/package.json').version, webRequire('react-router/package.json').version);
});
