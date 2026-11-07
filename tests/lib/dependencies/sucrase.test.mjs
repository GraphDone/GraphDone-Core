import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

// GHSA-3g3m-2fjr-6pw4 (glob 9.0.0-14.0.1) and GHSA-g3hv-75wg-m249
// (minimatch 7.0.0-11.0.0) reached the production tree only through
// Tailwind's config loader, sucrase 3.35.0 -> glob 10 -> minimatch 9.
// sucrase 3.35.1 replaces glob with tinyglobby inside Tailwind's existing
// ^3.35.0 range, so no override is needed.
const root = new URL('../../../', import.meta.url);
const require = createRequire(new URL('package.json', root));
const webRequire = createRequire(new URL('packages/web/package.json', root));
const tailwindRequire = createRequire(webRequire.resolve('tailwindcss'));
const semver = require('semver');
const lock = JSON.parse(await readFile(new URL('package-lock.json', root), 'utf8'));

test('Tailwind resolves a sucrase release without the glob dependency', () => {
  const tailwind = tailwindRequire('tailwindcss/package.json');
  const sucrase = tailwindRequire('sucrase/package.json');
  assert.ok(semver.satisfies(sucrase.version, tailwind.dependencies.sucrase), 'Patch must stay inside Tailwind\'s declared range');
  assert.ok(semver.gte(sucrase.version, '3.35.1'), `sucrase ${sucrase.version} still depends on glob`);
  assert.equal(sucrase.dependencies.glob, undefined);
  assert.equal(lock.packages['node_modules/sucrase']?.version, sucrase.version, 'Installed consumer differs from the lockfile');
});

test('no production lockfile copy of glob or minimatch is in an advisory range', () => {
  const affected = { glob: '>=9.0.0 <14.0.2', minimatch: '>=7.0.0 <11.0.1' };
  for (const [path, entry] of Object.entries(lock.packages)) {
    const name = path.match(/(?:^|\/)node_modules\/(glob|minimatch)$/)?.[1];
    if (!name || entry.dev) continue;
    assert.ok(!semver.satisfies(entry.version, affected[name]), `${path} resolves production ${name} ${entry.version}`);
  }
});

test('Tailwind\'s config loader still transforms and loads configs through sucrase', () => {
  // Tailwind's jiti fallback calls exactly this transform for TS/ESM configs
  // that plain require() cannot load.
  const { transform } = tailwindRequire('sucrase');
  const { code } = transform('import plugin from "x";\nconst size: number = 14;\nexport default { size, plugin };', { transforms: ['typescript', 'imports'] });
  assert.match(code, /require\(['"]x['"]\)/);
  assert.doesNotMatch(code, /: number/);
  const loadConfig = tailwindRequire('tailwindcss/loadConfig');
  const config = loadConfig(fileURLToPath(new URL('packages/web/tailwind.config.js', root)));
  assert.equal(config.theme.extend.fontWeight.normal, '500');
  assert.ok(Array.isArray(config.content) && config.content.length > 0);
});
