import assert from 'node:assert/strict';

export function requirePerfMetrics(metrics, { graphId, nodes, edges }) {
  assert.ok(metrics && typeof metrics === 'object', 'PerfMeter must publish metrics for the fixture');
  assert.equal(metrics.graphId, graphId, 'PerfMeter must measure the selected owned graph');
  assert.equal(metrics.settled, true, 'PerfMeter must publish the terminal measured snapshot');
  assert.equal(metrics.nodes, nodes, 'PerfMeter must measure every owned fixture node');
  assert.equal(metrics.edges, edges, 'PerfMeter must measure every owned fixture edge');
  assert.ok(Number.isSafeInteger(metrics.samples) && metrics.samples > 0, 'PerfMeter must contain actual tick samples');
  for (const key of ['alpha', 'avgTickMs']) {
    assert.ok(Number.isFinite(metrics[key]) && metrics[key] >= 0, `${key} must be a finite nonnegative measurement`);
  }
  assert.ok(Number.isFinite(metrics.spatial?.rmsFromSavedPx) && metrics.spatial.rmsFromSavedPx >= 0,
    'DriftMeter must publish a finite nonnegative saved-snapshot measurement');
  return metrics;
}

export function requireWorkItemSample(sample, expectedItems) {
  assert.ok(Number.isInteger(sample?.status) && sample.status >= 200 && sample.status < 300,
    `workItems query must succeed over HTTP (received ${sample?.status})`);
  assert.ok(sample.body && typeof sample.body === 'object', 'workItems query must return a GraphQL response');
  assert.ok(sample.body.errors === undefined || (Array.isArray(sample.body.errors) && sample.body.errors.length === 0),
    'workItems query must not return GraphQL errors');
  assert.ok(Array.isArray(sample.body.data?.workItems), 'workItems query must return work item data');
  const sorted = items => [...items].sort((a, b) => a.id.localeCompare(b.id));
  assert.ok(expectedItems.length > 0, 'Latency samples require a nonempty owned fixture');
  assert.deepEqual(sorted(sample.body.data.workItems), sorted(expectedItems), 'workItems query must return exactly the owned fixture data');
  assert.ok(Number.isFinite(sample.durationMs) && sample.durationMs >= 0, 'Latency must be a finite nonnegative measurement');
  return sample.durationMs;
}

export function sampleP95(times, expectedSamples = 20) {
  assert.equal(times.length, expectedSamples, 'Every required latency sample must execute');
  assert.ok(times.every(value => Number.isFinite(value) && value >= 0), 'Every latency sample must be finite and nonnegative');
  return [...times].sort((a, b) => a - b)[Math.min(times.length - 1, Math.floor(times.length * 0.95))];
}
