import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseTag, compareVersions, checkVersions, evaluateChecks, isLatest, REQUIRED_CHECKS } from '../../../scripts/verify-release.mjs';

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

test('an older version never becomes latest', () => {
  assert.equal(isLatest('0.4.0-alpha', ['v0.3.1-alpha', 'v0.4.0-alpha']), true);
  assert.equal(isLatest('0.4.0-alpha', ['v0.3.1-alpha', 'v0.4.0']), false);
  assert.equal(isLatest('0.3.2-alpha', ['v0.3.1-alpha', 'v0.4.0-alpha', 'not-a-version']), false);
  assert.equal(isLatest('1.0.0', []), true);
});
