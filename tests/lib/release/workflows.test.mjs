import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';

const { load } = createRequire(import.meta.url)('js-yaml');
const workflow = name => load(readFileSync(new URL(`../../../.github/workflows/${name}.yml`, import.meta.url), 'utf8'));

test('Docker builds cannot write registry images, manifests or release tags', () => {
  const doc = workflow('docker-publish');
  assert.deepEqual(doc.permissions, { contents: 'read' });
  assert.equal(doc.on.push.tags, undefined);
  for (const job of Object.values(doc.jobs)) {
    assert.equal(job.permissions?.packages, undefined);
    for (const step of job.steps) {
      assert.ok(!step.uses?.startsWith('docker/login-action'));
      if (step.uses?.startsWith('docker/build-push-action')) assert.equal(step.with.push, false);
      assert.ok(!/imagetools|docker\s+(?:push|login)|gh\s+release|git\s+push/.test(step.run || ''));
    }
  }
});

test('this repository has no deploy workflow; graphdone.com deploys from GraphDone-Cloud', () => {
  assert.equal(existsSync(new URL('../../../.github/workflows/deploy.yml', import.meta.url)), false);
});

test('release runs only for version tags, one at a time, with no default permissions', () => {
  const doc = workflow('release');
  assert.deepEqual(Object.keys(doc.on), ['push']);
  assert.deepEqual(doc.on.push, { tags: ['v*.*.*'] });
  assert.deepEqual(doc.permissions, {});
  assert.deepEqual(doc.concurrency, { group: 'release-${{ github.ref }}', 'cancel-in-progress': false });
});

test('images push only their version tag; latest moves for all images after every image published', () => {
  const { jobs } = workflow('release');
  const build = jobs.images.steps.find(step => step.uses?.startsWith('docker/build-push-action'));
  assert.equal(build.with.tags, 'ghcr.io/graphdone/graphdone-${{ matrix.image }}:${{ needs.verify.outputs.version }}');
  assert.equal(jobs.images.strategy['fail-fast'], true);
  const decide = jobs['github-release'].steps.findIndex(step => step.run === 'node scripts/verify-release.mjs --latest');
  const move = jobs['github-release'].steps.findIndex(step => /imagetools create/.test(step.run || ''));
  assert.ok(decide >= 0 && move > decide, 'latest is decided in the final job, then moved');
  assert.equal(jobs['github-release'].steps[move].if, "steps.latest.outputs.latest == 'true'");
  const web = jobs.images.strategy.matrix.include.find(item => item.image === 'web');
  assert.match(web['build-args'], /VITE_GRAPHQL_URL=https:\/\/localhost:3128\/api\/graphql/);
});

test('release writes happen only after the source gate, from the verified commit', () => {
  const { jobs } = workflow('release');
  assert.deepEqual(jobs.verify.permissions, { contents: 'read', actions: 'read' });
  assert.ok(jobs.verify.steps.some(step => step.run === 'node scripts/verify-release.mjs'));
  assert.deepEqual(jobs.images.permissions, { contents: 'read', packages: 'write' });
  assert.deepEqual(jobs['github-release'].permissions, { contents: 'write', packages: 'write' });
  assert.equal(jobs.images.needs, 'verify');
  assert.deepEqual(jobs['github-release'].needs, ['verify', 'images']);
  for (const [name, job] of Object.entries(jobs)) {
    for (const step of job.steps) {
      if (step.uses?.startsWith('actions/checkout')) {
        const expected = name === 'verify' ? '${{ github.sha }}' : '${{ needs.verify.outputs.sha }}';
        assert.equal(step.with.ref, expected, `${name} checks out the verified commit`);
      }
      if (step.uses?.startsWith('docker/build-push-action')) assert.equal(name, 'images');
      if (/gh\s+release|imagetools/.test(step.run || '')) assert.equal(name, 'github-release');
    }
  }
});

const ci = workflow('ci');
const required = ['quality', 'unit-tests', 'mcp-contract', 'build', 'security-scan', 'smoke-gate', 'runtime-images'];
function aggregate(results, selected) {
  const step = ci.jobs['ci-success'].steps.find(item => item.name === 'Verify required jobs passed');
  const script = step.run.replace(/\$\{\{ needs\.([\w-]+)\.result \}\}/g, (_, name) => results[name] ?? '');
  return spawnSync('bash', ['-e', '-c', script], { encoding: 'utf8', env: { ...process.env, PROD_REQUIRED: String(selected) } });
}

test('aggregate waits for the production job and selects it on main PRs', () => {
  for (const name of [...required, 'prod-smoke']) assert.ok(ci.jobs['ci-success'].needs.includes(name));
  assert.match(ci.jobs['prod-smoke'].if, /github\.base_ref == 'main'/);
  assert.match(ci.jobs['ci-success'].steps[0].env.PROD_REQUIRED, /github\.base_ref == 'main'/);
  assert.ok(ci.jobs['prod-smoke'].steps.some(step => step.run?.includes('node scripts/test-production-stack.mjs')));
});

for (const selected of [true, false]) {
  for (const state of ['success', 'failure', 'cancelled', 'skipped', 'pending', '']) {
    test(`aggregate production result=${state || 'missing'}, selected=${selected}`, () => {
      const results = Object.fromEntries(required.map(name => [name, 'success']));
      results['prod-smoke'] = state;
      const expected = selected ? state === 'success' : state === 'skipped';
      assert.equal(aggregate(results, selected).status, expected ? 0 : 1);
    });
  }
}

for (const name of required) {
  test(`aggregate rejects a failed or missing ${name}`, () => {
    for (const state of ['failure', 'cancelled', 'skipped', '']) {
      const results = Object.fromEntries([...required, 'prod-smoke'].map(key => [key, 'success']));
      results[name] = state;
      assert.equal(aggregate(results, true).status, 1);
    }
  });
}

for (const [event_name, ref, base_ref, selected] of [
  ['push', 'refs/heads/main', '', true],
  ['push', 'refs/heads/dev', '', false],
  ['pull_request', 'refs/pull/191/merge', 'main', true],
  ['pull_request', 'refs/pull/191/merge', 'dev', false],
  ['schedule', 'refs/heads/main', '', true],
  ['workflow_dispatch', 'refs/heads/audit/candidate', '', true],
]) {
  test(`production selection agrees with aggregate for ${event_name}/${ref}/${base_ref}`, () => {
    const context = { github: { event_name, ref, base_ref } };
    const condition = ci.jobs['prod-smoke'].if;
    const aggregateCondition = ci.jobs['ci-success'].steps[0].env.PROD_REQUIRED.slice(3, -2).trim();
    assert.equal(runInNewContext(condition, context), selected);
    assert.equal(runInNewContext(aggregateCondition, context), selected);
  });
}

test('public production artifacts exclude raw browser traces and unsanitized nested reports', () => {
  const upload = ci.jobs['prod-smoke'].steps.find(step => step.uses?.startsWith('actions/upload-artifact'));
  assert.equal(upload.if, 'always()');
  assert.equal(upload.with['if-no-files-found'], 'error');
  assert.deepEqual(upload.with.path.trim().split(/\s+/), [
    'test-artifacts/ci-prod-stack/run-*/report.json',
    'test-artifacts/ci-prod-stack/run-*/*.log',
  ]);
});
