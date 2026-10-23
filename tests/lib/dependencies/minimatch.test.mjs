import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import test from 'node:test';

test('lint glob matching stays bounded for nested extglobs and preserves source selection', () => {
  const require = createRequire(import.meta.url);
  const parserRequire = createRequire(require.resolve('@typescript-eslint/typescript-estree'));
  const matcher = parserRequire.resolve('minimatch');
  const result = spawnSync(process.execPath, ['-e', `
    const { minimatch } = require(${JSON.stringify(matcher)});
    console.log(JSON.stringify([
      minimatch('a'.repeat(18) + 'z', '*(*(*(a|b)))'),
      minimatch('packages/web/src/App.tsx', 'packages/*/src/**/*.{ts,tsx}'),
      minimatch('packages/web/dist/app.js', 'packages/*/src/**/*.{ts,tsx}'),
      minimatch('ab', '*(a|b)')
    ]));
  `], { encoding: 'utf8', timeout: 2000 });
  assert.equal(result.error, undefined, String(result.error));
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), [false, true, false, true]);
});
