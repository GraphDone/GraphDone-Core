import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runPlaywrightSequence } from './playwright.mjs';
import { runVitestSequence } from './vitest.mjs';

const playwrightReport = (tests = [{ status: 'expected', expectedStatus: 'passed', results: [{ status: 'passed', duration: 1 }] }]) => ({
  suites: [{ specs: [{ title: 'fixture case', ok: true, tests }] }], errors: [],
});
const vitestReport = (assertions = [{ title: 'fixture case', status: 'passed' }]) => ({
  success: true, numTotalTests: assertions.length, numFailedTestSuites: 0,
  testResults: [{ status: 'passed', assertionResults: assertions }],
});

async function execute(t, adapter, report, options = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'graphdone-evidence-'));
  const originalPath = process.env.PATH;
  writeFileSync(join(dir, 'npx'), `#!${process.execPath}\nconst fs = require('node:fs');\nconst output = ${JSON.stringify(typeof report === 'string' ? report : JSON.stringify(report))};\nif (process.env.PLAYWRIGHT_JSON_OUTPUT_NAME) fs.writeFileSync(process.env.PLAYWRIGHT_JSON_OUTPUT_NAME, output);\nelse process.stdout.write(output);\n${options.timeout ? 'setInterval(() => {}, 1000);' : `process.exit(${options.exitCode || 0});`}\n`, { mode: 0o700 });
  process.env.PATH = `${dir}:${originalPath}`;
  t.after(() => { process.env.PATH = originalPath; rmSync(dir, { recursive: true, force: true }); });
  const run = adapter === 'playwright' ? runPlaywrightSequence : runVitestSequence;
  return run({ id: 'fixture', title: 'Fixture', cwd: dir, target: 'http://127.0.0.1:1', timeoutMs: options.timeout ? 1000 : 5000, blocking: options.blocking ?? true });
}

for (const adapter of ['playwright', 'vitest']) {
  const valid = adapter === 'playwright' ? playwrightReport : vitestReport;
  test(`${adapter}: real expected pass is accepted`, async t => {
    const result = await execute(t, adapter, valid());
    assert.equal(result.status, 'passed');
    assert.equal(result.counts.passed, 1);
  });
  for (const [label, report] of [['missing JSON', 'not a report'], ['zero executed tests', valid([])], ['unrecognized JSON', {}]]) {
    test(`${adapter}: ${label} cannot fabricate a pass`, async t => {
      const result = await execute(t, adapter, report);
      assert.equal(result.status, 'failed');
      assert.equal(result.counts.passed, 0);
    });
  }
  test(`${adapter}: exit failure overrides already written passing cases`, async t => {
    assert.equal((await execute(t, adapter, valid(), { exitCode: 1 })).status, 'failed');
  });
  test(`${adapter}: timeout overrides already written passing cases`, async t => {
    const result = await execute(t, adapter, valid(), { timeout: true });
    assert.equal(result.status, 'failed');
    assert.equal(result.counts.passed, 1);
    assert.equal(result.execution.timedOut, true);
  });
  const skipped = adapter === 'playwright'
    ? playwrightReport([{ status: 'skipped', expectedStatus: 'skipped', results: [{ status: 'skipped' }] }])
    : vitestReport([{ title: 'not configured', status: 'pending' }]);
  test(`${adapter}: required skips are a failure`, async t => {
    assert.equal((await execute(t, adapter, skipped)).status, 'failed');
  });
  test(`${adapter}: explicitly optional skips remain skipped`, async t => {
    const result = await execute(t, adapter, skipped, { blocking: false });
    assert.equal(result.status, 'skipped');
    assert.equal(result.counts.passed, 0);
  });
}

test('playwright: failed attempt followed by pass is not clean acceptance', async t => {
  const report = playwrightReport([{ status: 'flaky', expectedStatus: 'passed', results: [{ status: 'failed' }, { status: 'passed' }] }]);
  assert.equal((await execute(t, 'playwright', report)).status, 'failed');
});
test('playwright: listed tests with no execution results fail', async t => {
  assert.equal((await execute(t, 'playwright', playwrightReport([{ expectedStatus: 'passed', results: [] }]))).status, 'failed');
});
test('playwright: global setup/teardown errors override passing cases', async t => {
  assert.equal((await execute(t, 'playwright', { ...playwrightReport(), errors: [{ message: 'teardown failed' }] })).status, 'failed');
});
test('vitest: failed suite without failed assertion overrides passing cases', async t => {
  assert.equal((await execute(t, 'vitest', { ...vitestReport(), success: false, numFailedTestSuites: 1 })).status, 'failed');
});
