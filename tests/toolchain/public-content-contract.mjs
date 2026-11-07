import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

// This repository is public. Maintainers' private repositories, home
// directories and private-network (Tailscale CGNAT) addresses must not be
// committed; use placeholders such as /home/user, 100.x.y.z or your-tailnet.
export const FORBIDDEN = [
  { name: 'private Valpatel repository path', pattern: /Valpatel\/[A-Za-z0-9_.-]+/ },
  { name: 'private-network (100.64.0.0/10) address', pattern: /\b100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.\d{1,3}\.\d{1,3}\b/ },
  { name: 'personal Linux home directory', pattern: /\/home\/(?!(user|runner|node|ubuntu|app|appuser)\b)[a-z][a-z0-9_-]*/ },
  { name: 'personal macOS home directory', pattern: /\/Users\/(?!user\b)[A-Za-z][A-Za-z0-9_-]*/ },
];

export function findForbidden(path, text) {
  const hits = [];
  text.split('\n').forEach((line, index) => {
    for (const { name, pattern } of FORBIDDEN) if (pattern.test(line)) hits.push(`${path}:${index + 1}: ${name}`);
  });
  return hits;
}

test('rules catch real leaks and allow the documented placeholders', () => {
  assert.equal(findForbidden('a', 'see github.com/Valpatel/some-repo/issues/1').length, 1);
  assert.equal(findForbidden('a', 'ssh ops@100.73.1.2').length, 1);
  assert.equal(findForbidden('a', 'cd /home/alice/Code').length, 1);
  assert.equal(findForbidden('a', 'open /Users/alice/Code').length, 1);
  assert.deepEqual(findForbidden('a', '/home/user/app 100.x.y.z /Users/user /home/runner 10.0.0.1 100.1.2.3 100.128.0.1'), []);
});

// This file is excluded: its rules and samples are the only intended matches.
test('tracked files contain no private repository paths, home directories or private-network addresses', () => {
  const listed = spawnSync('git', ['grep', '-nIE', '--', 'Valpatel/|100\\.|/home/|/Users/', '--', '.', ':!package-lock.json', ':!tests/toolchain/public-content-contract.mjs'], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  assert.ok(listed.status === 0 || listed.status === 1, `git grep failed: ${listed.stderr}`);
  const hits = [];
  for (const row of listed.stdout.split('\n').filter(Boolean)) {
    const [path, line, ...rest] = row.split(':');
    hits.push(...findForbidden(path, rest.join(':')).map(hit => hit.replace(/:1:/, `:${line}:`)));
  }
  assert.deepEqual(hits, [], `Public-repository leak:\n${hits.join('\n')}`);
});
