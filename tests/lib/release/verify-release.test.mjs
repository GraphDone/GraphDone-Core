import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseTag, compareVersions, checkVersions, evaluateChecks, isLatest, onMainLine, mainPushJobs, REQUIRED_CHECKS,
} from '../../../scripts/verify-release.mjs';

const SCRIPT = fileURLToPath(new URL('../../../scripts/verify-release.mjs', import.meta.url));

test('tags must be vMAJOR.MINOR.PATCH with an optional suffix', () => {
  assert.equal(parseTag('v0.4.0-alpha').version, '0.4.0-alpha');
  assert.equal(parseTag('v1.2.3').version, '1.2.3');
  for (const bad of ['0.4.0', 'v0.4', 'v0.4.0.1', 'vX.Y.Z', 'v0.4.0-', 'release-1', '', undefined]) {
    assert.throws(() => parseTag(bad), /not vMAJOR/);
  }
});

test('version precedence follows semver', () => {
  const ordered = ['0.3.1-alpha', '0.3.1', '0.4.0-alpha', '0.4.0-alpha.2', '0.4.0-alpha.10', '0.4.0-beta', '0.4.0', '0.10.0', '1.0.0'];
  for (let i = 0; i < ordered.length - 1; i++) {
    assert.ok(compareVersions(ordered[i], ordered[i + 1]) < 0, `${ordered[i]} < ${ordered[i + 1]}`);
    assert.ok(compareVersions(ordered[i + 1], ordered[i]) > 0, `${ordered[i + 1]} > ${ordered[i]}`);
  }
  assert.equal(compareVersions('0.4.0-alpha', '0.4.0-alpha'), 0);
});

test('every workspace manifest must carry the tag version', () => {
  assert.doesNotThrow(() => checkVersions('0.4.0-alpha', { 'package.json': '0.4.0-alpha', 'packages/web/package.json': '0.4.0-alpha' }));
  assert.throws(
    () => checkVersions('0.4.0-alpha', { 'package.json': '0.4.0-alpha', 'packages/web/package.json': '0.3.1-alpha' }),
    /packages\/web\/package.json=0.3.1-alpha/,
  );
});

const passing = () => REQUIRED_CHECKS.map(name => ({ name, status: 'completed', conclusion: 'success', started_at: '2026-11-07T10:00:00Z' }));

test('all required checks passing allows publication', () => {
  assert.deepEqual(evaluateChecks(passing()), []);
});

for (const [label, change] of [
  ['missing', runs => runs.slice(1)],
  ['in progress', runs => { runs[0] = { ...runs[0], status: 'in_progress', conclusion: null }; return runs; }],
  ['queued', runs => { runs[0] = { ...runs[0], status: 'queued', conclusion: null }; return runs; }],
  ['failed', runs => { runs[0] = { ...runs[0], conclusion: 'failure' }; return runs; }],
  ['cancelled', runs => { runs[0] = { ...runs[0], conclusion: 'cancelled' }; return runs; }],
  ['skipped', runs => { runs[0] = { ...runs[0], conclusion: 'skipped' }; return runs; }],
  ['neutral', runs => { runs[0] = { ...runs[0], conclusion: 'neutral' }; return runs; }],
  ['timed out', runs => { runs[0] = { ...runs[0], conclusion: 'timed_out' }; return runs; }],
]) {
  test(`a ${label} required check blocks publication`, () => {
    const problems = evaluateChecks(change(passing()));
    assert.equal(problems.length, 1);
    assert.match(problems[0], new RegExp(`^${REQUIRED_CHECKS[0]}:`));
  });
}

test('the newest run of a check decides, so a failed re-run blocks and a passing re-run clears', () => {
  const failedRerun = [...passing(), { name: REQUIRED_CHECKS[0], status: 'completed', conclusion: 'failure', started_at: '2026-11-07T11:00:00Z' }];
  assert.equal(evaluateChecks(failedRerun).length, 1);
  const runs = passing();
  runs[0] = { ...runs[0], conclusion: 'failure', started_at: '2026-11-07T09:00:00Z' };
  runs.push({ name: REQUIRED_CHECKS[0], status: 'completed', conclusion: 'success', started_at: '2026-11-07T12:00:00Z' });
  assert.deepEqual(evaluateChecks(runs), []);
});

test('latest follows published releases; pre-releases never outrank a stable release', () => {
  assert.equal(isLatest('0.4.0-alpha', ['v0.3.1-alpha']), true);
  assert.equal(isLatest('0.4.0-alpha', ['v0.3.1-alpha', 'v0.4.0-alpha']), true, 'its own release does not count');
  assert.equal(isLatest('0.4.0-alpha', ['v0.3.1-alpha', 'v0.4.0']), false);
  assert.equal(isLatest('0.3.2-alpha', ['v0.3.1-alpha', 'v0.4.0-alpha', 'not-a-version']), false);
  assert.equal(isLatest('1.0.0', []), true);
  assert.equal(isLatest('1.1.0-beta', ['v1.0.0']), false, 'a beta does not replace a stable latest');
  assert.equal(isLatest('1.1.0', ['v1.0.0', 'v1.1.0-beta']), true);
});

test('only jobs from main push runs of the exact commit count', () => {
  const sha = 'a'.repeat(40);
  const runs = [
    { id: 1, event: 'push', head_branch: 'main', head_sha: sha },
    { id: 2, event: 'pull_request', head_branch: 'dev', head_sha: sha },
    { id: 3, event: 'push', head_branch: 'dev', head_sha: sha },
    { id: 4, event: 'push', head_branch: 'main', head_sha: 'b'.repeat(40) },
    { id: 5, event: 'schedule', head_branch: 'main', head_sha: sha },
  ];
  const job = (name, conclusion) => ({ name, status: 'completed', conclusion, started_at: '2026-11-07T10:00:00Z' });
  const jobsByRun = Object.fromEntries(runs.map(run => [run.id, REQUIRED_CHECKS.map(name => job(name, run.id === 1 ? 'failure' : 'success'))]));
  const selected = mainPushJobs(sha, runs, jobsByRun);
  assert.equal(selected.length, REQUIRED_CHECKS.length);
  assert.equal(evaluateChecks(selected).length, REQUIRED_CHECKS.length, 'green PR/dev/other-commit runs cannot stand in for main');
  assert.deepEqual(evaluateChecks(mainPushJobs(sha, runs.slice(1), jobsByRun)), REQUIRED_CHECKS.map(name => `${name}: missing`));
});

test('onMainLine accepts only listed first-parent commits', () => {
  assert.equal(onMainLine('abc', ['abc', 'def']), true);
  assert.equal(onMainLine('xyz', ['abc', 'def']), false);
});

// End-to-end through the CLI against a throwaway origin. Every case here must
// fail before any GitHub API call, so a fake token is enough.
test('CLI refuses a mismatched tag, a dev commit merged into main, and wrong manifest versions', () => {
  const root = mkdtempSync(join(tmpdir(), 'verify-release-'));
  try {
    const run = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', env: { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@example.com', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@example.com' } }).trim();
    const origin = join(root, 'origin.git');
    const work = join(root, 'work');
    run(root, 'init', '-q', '--bare', '-b', 'main', origin);
    run(root, 'clone', '-q', origin, work);
    const writeVersions = version => {
      writeFileSync(join(work, 'package.json'), JSON.stringify({ version }));
      mkdirSync(join(work, 'packages', 'web'), { recursive: true });
      writeFileSync(join(work, 'packages', 'web', 'package.json'), JSON.stringify({ version }));
      run(work, 'add', '-A');
    };
    run(work, 'checkout', '-q', '-b', 'main');
    writeVersions('0.4.0-alpha');
    run(work, 'commit', '-q', '-m', 'base');
    run(work, 'checkout', '-q', '-b', 'dev');
    writeFileSync(join(work, 'feature.txt'), 'x');
    run(work, 'add', '-A');
    run(work, 'commit', '-q', '-m', 'dev work');
    const devCommit = run(work, 'rev-parse', 'HEAD');
    run(work, 'checkout', '-q', 'main');
    run(work, 'merge', '-q', '--no-ff', '-m', 'promote', 'dev');
    const mainCommit = run(work, 'rev-parse', 'HEAD');
    run(work, 'push', '-q', 'origin', 'main', 'dev');

    const cli = (tag, sha) => {
      run(work, 'tag', '-f', tag, sha);
      run(work, 'checkout', '-q', sha);
      return spawnSync(process.execPath, [SCRIPT], {
        cwd: work, encoding: 'utf8',
        env: { ...process.env, GITHUB_REF_NAME: tag, GITHUB_SHA: sha, GITHUB_REPOSITORY: 'example/repo', GITHUB_TOKEN: 'unused', GITHUB_OUTPUT: '' },
      });
    };

    // The tag names the main commit, but the run claims the dev commit.
    run(work, 'tag', '-f', 'v0.4.0-alpha', mainCommit);
    let result = spawnSync(process.execPath, [SCRIPT], { cwd: work, encoding: 'utf8', env: { ...process.env, GITHUB_REF_NAME: 'v0.4.0-alpha', GITHUB_SHA: devCommit, GITHUB_REPOSITORY: 'example/repo', GITHUB_TOKEN: 'unused', GITHUB_OUTPUT: '' } });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /does not point at/);

    result = cli('v0.4.0-alpha', devCommit);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /not a commit main was at/, 'reachable from main is not enough');

    run(work, 'checkout', '-q', 'main');
    writeVersions('0.3.1-alpha');
    run(work, 'commit', '-q', '-m', 'stale version');
    run(work, 'push', '-q', 'origin', 'main');
    result = cli('v0.4.0-alpha', run(work, 'rev-parse', 'main'));
    assert.equal(result.status, 1);
    assert.match(result.stderr, /package versions do not match 0\.4\.0-alpha/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
