import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

// Every entry allowed at the repository root. This list may only shrink:
// put new files in the folder AGENTS.md#repository-map names for them, and
// remove an entry here when its file leaves the root. Growing it needs the
// owner's explicit approval in the PR.
const ROOT_ALLOWLIST = [
  '.agents', '.claude', '.dockerignore', '.env.example', '.env.test.example', '.eslintrc.js',
  '.github', '.gitignore', '.prettierignore', '.prettierrc',
  'AGENTS.md', 'CLAUDE.md', 'LICENSE', 'Makefile', 'README.md',
  'deployment', 'docs', 'package-lock.json', 'package.json', 'packages',
  'playwright.config.ts', 'scripts', 'start', 'tests',
  'tsconfig.json', 'turbo.json',
];

function rootEntries() {
  // Tracked files plus untracked files that .gitignore does not cover.
  const result = spawnSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, `git ls-files failed: ${result.stderr}`);
  return new Set(result.stdout.split('\0').filter(Boolean).map((path) => path.split('/')[0]));
}

test('repository root holds only allowlisted entries', () => {
  const entries = rootEntries();
  const unexpected = [...entries].filter((name) => !ROOT_ALLOWLIST.includes(name)).sort();
  assert.deepEqual(unexpected, [], `Unexpected root entries: ${unexpected.join(', ')}. Move them into the folder AGENTS.md#repository-map names.`);
  const stale = ROOT_ALLOWLIST.filter((name) => !entries.has(name));
  assert.deepEqual(stale, [], `Allowlisted root entries no longer exist; remove them from ROOT_ALLOWLIST: ${stale.join(', ')}`);
});
