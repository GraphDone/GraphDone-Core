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
    : vitestReport([{ title: 'not configured', status: 'skipped' }]);
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

for (const [key, value] of [['expected', 0], ['unexpected', 2], ['skipped', 1], ['flaky', 1], ['expected', -1], ['expected', '1'], ['expected', 1.5]]) {
  test(`playwright: contradictory or invalid ${key}=${value} summary fails`, async t => {
    const report = { ...playwrightReport(), stats: { expected: 1, unexpected: 0, skipped: 0, flaky: 0, [key]: value } };
    assert.equal((await execute(t, 'playwright', report)).status, 'failed');
  });
}
for (const [key, value] of [['numPassedTests', 0], ['numFailedTests', 1], ['numPendingTests', 1], ['numTodoTests', 1], ['numPassedTests', -1], ['numFailedTests', '0'], ['numPendingTests', 0.5]]) {
  test(`vitest: contradictory or invalid ${key}=${value} summary fails`, async t => {
    const report = { ...vitestReport(), numPassedTests: 1, numFailedTests: 0, numPendingTests: 0, numTodoTests: 0, [key]: value };
    assert.equal((await execute(t, 'vitest', report)).status, 'failed');
  });
}
test('vitest: legacy nonfailed total never converts optional skipped/todo cases into passes', async t => {
  const report = { ...vitestReport([{ title: 'passed', status: 'passed' }, { title: 'skipped', status: 'skipped' }, { title: 'todo', status: 'todo' }]), numPassedTests: 3, numFailedTests: 0, numPendingTests: 0, numTodoTests: 1 };
  const result = await execute(t, 'vitest', report, { blocking: false });
  assert.equal(result.status, 'passed');
  assert.equal(result.counts.passed, 1);
  assert.equal(result.counts.skipped, 2);
});
test('vitest: a still-pending execution fails even for an optional sequence', async t => {
  const report = { ...vitestReport([{ title: 'unfinished', status: 'pending' }]), numPassedTests: 1, numFailedTests: 0, numPendingTests: 1, numTodoTests: 0 };
  assert.equal((await execute(t, 'vitest', report, { blocking: false })).status, 'failed');
});
for (const blocking of [true, false]) {
  test(`vitest: version 4 intentional skip remains ${blocking ? 'required failure' : 'optional skip'}`, async t => {
    const report = {
      ...vitestReport([{ title: 'intentional skip', status: 'skipped' }]),
      numPassedTests: 0, numFailedTests: 0, numPendingTests: 1, numTodoTests: 0,
      numTotalTestSuites: 1, numPassedTestSuites: 1, numPendingTestSuites: 0,
    };
    const result = await execute(t, 'vitest', report, { blocking });
    assert.equal(result.status, blocking ? 'failed' : 'skipped');
    assert.equal(result.counts.passed, 0);
    assert.equal(result.counts.skipped, 1);
    assert.equal(result.evidenceErrors.some(error => error.includes('numPendingTests')), false);
    assert.equal(result.counts.failed, blocking ? 1 : 0);
  });
}
for (const suites of [{ numTotalTestSuites: 0, numPassedTestSuites: 0 }, { numTotalTestSuites: 2, numPassedTestSuites: 1 }]) {
  test(`vitest: suite totals cannot contradict file evidence: ${JSON.stringify(suites)}`, async t => {
    assert.equal((await execute(t, 'vitest', { ...vitestReport(), ...suites })).status, 'failed');
  });
}
