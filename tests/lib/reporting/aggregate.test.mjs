import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rollupStatus, statusFromCounts, sumCounts, buildReport, STATUS, wilsonLower, reliability } from './aggregate.mjs';

test('rollupStatus: failure dominates', () => {
  assert.equal(rollupStatus(['passed', 'failed', 'warn']), 'failed');
});
test('rollupStatus: warn over passed', () => {
  assert.equal(rollupStatus(['passed', 'warn', 'passed']), 'warn');
});
test('rollupStatus: all skipped → skipped', () => {
  assert.equal(rollupStatus(['skipped', 'skipped']), 'skipped');
});
test('rollupStatus: empty → skipped', () => {
  assert.equal(rollupStatus([]), 'skipped');
});

test('statusFromCounts: any failure → failed', () => {
  assert.equal(statusFromCounts({ passed: 5, failed: 1 }), STATUS.FAILED);
});
test('statusFromCounts: warns but no fails → warn', () => {
  assert.equal(statusFromCounts({ passed: 5, warned: 2 }), STATUS.WARN);
});
test('statusFromCounts: only passes → passed', () => {
  assert.equal(statusFromCounts({ passed: 3 }), STATUS.PASSED);
});
test('statusFromCounts: nothing → skipped', () => {
  assert.equal(statusFromCounts({}), STATUS.SKIPPED);
});

test('sumCounts totals + status tally', () => {
  const seqs = [
    { status: 'passed', counts: { passed: 3, failed: 0, warned: 0, skipped: 1 } },
    { status: 'failed', counts: { passed: 1, failed: 2, warned: 0, skipped: 0 } },
  ];
  const { totals, byStatus } = sumCounts(seqs);
  assert.equal(totals.passed, 4);
  assert.equal(totals.failed, 2);
  assert.equal(totals.skipped, 1);
  assert.equal(totals.cases, 7);
  assert.equal(totals.sequences, 2);
  assert.equal(byStatus.passed, 1);
  assert.equal(byStatus.failed, 1);
});

test('buildReport assigns hierarchical refs (section + section.case), preserving presets', () => {
  const r = buildReport({ sequences: [
    { title: 'A', status: 'passed', counts: { passed: 2 }, cases: [{ title: 'x', status: 'passed' }, { title: 'y', status: 'passed' }] },
    { ref: '2.4', title: 'B', status: 'warn', counts: { warned: 1 }, cases: [{ ref: '2.4.1', title: 'z', status: 'warn' }] },
  ] });
  assert.equal(r.sequences[0].ref, '1');
  assert.deepEqual(r.sequences[0].cases.map((c) => c.ref), ['1.1', '1.2']);
  assert.equal(r.sequences[1].ref, '2.4');        // preset section ref preserved
  assert.equal(r.sequences[1].cases[0].ref, '2.4.1'); // preset case ref preserved
});

test('buildReport rolls up status + duration', () => {
  const r = buildReport({
    sequences: [{ status: 'passed', counts: { passed: 2 } }, { status: 'warn', counts: { warned: 1 } }],
    startedAt: 1000, finishedAt: 4000, target: 'http://x', env: { node: 'v20' },
  });
  assert.equal(r.schema, 'graphdone.unified-report/1');
  assert.equal(r.durationMs, 3000);
  assert.equal(r.rollup.status, 'warn');
  assert.equal(r.rollup.totals.sequences, 2);
  assert.equal(r.target, 'http://x');
});

test('wilsonLower: 30/30 bounds the success rate near 89%, 0/n at 0', () => {
  assert.equal(wilsonLower(30, 30).toFixed(3), '0.886');
  assert.equal(wilsonLower(0, 5), 0);
  assert.equal(wilsonLower(0, 0), 0);
  assert.ok(wilsonLower(299, 300) > 0.98);
});

test('reliability: repeats of one path on one device are trials; setup failures and skips are not', () => {
  const c = (status, project = 'desk', error) => ({ title: 'link plus', project, status, error });
  const rows = reliability([c('passed'), c('passed'), c('failed', 'desk', 'Error: the connection must be saved'),
    c('failed', 'desk', 'Error: SETUP: no title field'), c('skipped'), c('passed', 'phone'), c('passed', 'phone'),
    { title: 'runner exit', status: 'failed', error: 'exit 1' }]);
  const desk = rows.find((r) => r.project === 'desk');
  assert.deepEqual([desk.passes, desk.trials, desk.setupFailures], [2, 3, 1]);
  assert.deepEqual(desk.failures, { 'Error: the connection must be saved': 1 });
  const colored = reliability([{ title: 't', status: 'failed', error: '\u001b[31mTest timeout\u001b[39m' }, { title: 't', status: 'passed' }]);
  assert.deepEqual(colored[0].failures, { 'Test timeout': 1 });
  assert.equal(rows.find((r) => r.project === 'phone').trials, 2);
  assert.ok(!rows.some((r) => r.title === 'runner exit'), 'one-off cases are not rates');
});

test('reliability: a sequence that ran each case once has no rollup', () => {
  assert.equal(reliability([{ title: 'a', status: 'passed' }, { title: 'b', status: 'failed' }]), null);
});

test('buildReport attaches per-path reliability to repeated sequences', () => {
  const report = buildReport({ sequences: [{ id: 'journeys', status: 'failed', counts: { passed: 1, failed: 1 },
    cases: [{ title: 'p', status: 'passed' }, { title: 'p', status: 'failed', error: 'x' }] }] });
  assert.equal(report.sequences[0].reliability[0].trials, 2);
});
