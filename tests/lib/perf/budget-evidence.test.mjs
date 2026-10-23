import { test } from 'node:test';
import assert from 'node:assert/strict';
import { requirePerfMetrics, requireWorkItemSample, sampleP95 } from './budget-evidence.mjs';

const fixture = { graphId: 'owned-perf-graph', nodes: 4, edges: 3 };
const metrics = () => ({ graphId: fixture.graphId, settled: true, nodes: 4, edges: 3, samples: 1, alpha: 0, avgTickMs: 0.4, spatial: { rmsFromSavedPx: 0 } });
const items = [
  { id: 'owned-a', title: 'First', status: 'PLANNED', type: 'TASK' },
  { id: 'owned-b', title: 'Second', status: 'PLANNED', type: 'TASK' },
];
const sample = () => ({ status: 200, body: { data: { workItems: structuredClone(items) } }, durationMs: 4 });

test('actual tick and saved-snapshot measurements are accepted', () => {
  assert.deepEqual(requirePerfMetrics(metrics(), fixture), metrics());
});
for (const [name, change] of [
  ['missing metrics', () => undefined],
  ['another graph snapshot', value => ({ ...value, graphId: 'previous-graph' })],
  ['stale pre-settlement snapshot', value => ({ ...value, settled: false })],
  ['empty default graph', value => ({ ...value, nodes: 0, edges: 0 })],
  ['wrong graph size', value => ({ ...value, nodes: 2 })],
  ['missing rendered edges', value => ({ ...value, edges: 0 })],
  ['unmeasured zero tick cost', value => ({ ...value, samples: 0, avgTickMs: 0 })],
  ['missing spatial metrics', value => ({ ...value, spatial: undefined })],
  ['nonfinite drift', value => ({ ...value, spatial: { rmsFromSavedPx: NaN } })],
  ['invalid tick cost', value => ({ ...value, avgTickMs: -1 })],
  ['invalid alpha', value => ({ ...value, alpha: Infinity })],
]) {
  test(`required performance evidence rejects ${name}`, () => {
    assert.throws(() => requirePerfMetrics(change(metrics()), fixture));
  });
}

test('successful samples contain exactly the owned data in any response order', () => {
  const value = sample();
  value.body.data.workItems.reverse();
  assert.equal(requireWorkItemSample(value, items), 4);
});
for (const [name, change] of [
  ['fast HTTP error with data', value => ({ ...value, status: 500 })],
  ['fast HTTP authentication rejection', value => ({ ...value, status: 401 })],
  ['fast GraphQL error with partial data', value => ({ ...value, body: { ...value.body, errors: [{ message: 'denied' }] } })],
  ['missing GraphQL data', value => ({ ...value, body: {} })],
  ['empty graph response', value => ({ ...value, body: { data: { workItems: [] } } })],
  ['another graph response', value => ({ ...value, body: { data: { workItems: [{ ...items[0], id: 'other-owner' }, items[1]] } } })],
  ['wrong persisted status', value => ({ ...value, body: { data: { workItems: [{ ...items[0], status: 'COMPLETED' }, items[1]] } } })],
  ['duplicate work item', value => ({ ...value, body: { data: { workItems: [items[0], items[0]] } } })],
  ['invalid latency', value => ({ ...value, durationMs: NaN })],
]) {
  test(`latency evidence rejects ${name}`, () => {
    assert.throws(() => requireWorkItemSample(change(sample()), items));
  });
}
test('an empty expected fixture cannot prove latency coverage', () => {
  const value = sample();
  value.body.data.workItems = [];
  assert.throws(() => requireWorkItemSample(value, []));
});
test('p95 retains the existing conservative percentile and requires all twenty samples', () => {
  const times = Array.from({ length: 20 }, (_, i) => 20 - i);
  assert.equal(sampleP95(times), 20);
  assert.throws(() => sampleP95(times.slice(1)));
  assert.throws(() => sampleP95([...times.slice(1), Infinity]));
  assert.deepEqual(times, Array.from({ length: 20 }, (_, i) => 20 - i));
});
