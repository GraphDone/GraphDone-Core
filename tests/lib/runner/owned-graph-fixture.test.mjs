import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../../../', import.meta.url));

for (const scenario of ['setup-timeout', 'late-create-response', 'late-edge-response', 'cleanup-failure']) {
  test(`owned graph cleanup remains strict after ${scenario}`, t => {
    const dir = mkdtempSync(join(tmpdir(), 'graphdone-fixture-negative-'));
    t.after(() => rmSync(dir, { recursive: true, force: true }));
    symlinkSync(join(root, 'node_modules'), join(dir, 'node_modules'), 'dir');
    const events = join(dir, 'events.json');
    writeFileSync(join(dir, 'playwright.config.ts'), 'export default { testDir: ".", retries: 0, workers: 1, reporter: "json", timeout: 5000 };');
    writeFileSync(join(dir, 'negative.spec.ts'), `
import { test as base } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { ownedGraphIdsFixture } from ${JSON.stringify(join(root, 'tests/lib/ownedGraphIdsFixture.ts'))};
const calls = [];
const fakePage = {
  async unroute() { calls.push('unroute'); },
  async evaluate(_callback, { query, variables }) {
    if (query.includes(' me ')) return { me: { id: 'owned-user' } };
    if (query.includes('createGraphs')) {
      calls.push('createRequested');
      if (${JSON.stringify(scenario)} === 'late-create-response') await new Promise(resolve => setTimeout(resolve, 250));
      calls.push('created');
      return { createGraphs: { graphs: [{ id: 'owned-graph' }] } };
    }
    if (query.includes('createWorkItems') || query.includes('createEdges')) {
      if (${JSON.stringify(scenario)} === 'late-edge-response') {
        if (query.includes('createWorkItems')) {
          calls.push('nodesCreated');
          return { createWorkItems: { workItems: variables.input.map((_, index) => ({ id: 'node-' + index })) } };
        }
        calls.push('edgeRequested:' + variables.input.length);
        if (variables.input.some(edge => edge.type === 'BLOCKS')) await new Promise(resolve => setTimeout(resolve, 250));
        calls.push('edgeFinished');
        return { createEdges: { edges: variables.input.map((_, index) => ({ id: 'edge-' + index })) } };
      }
      calls.push('unexpected-post-timeout-write');
      throw new Error('Seeding wrote after setup timed out');
    }
    if (variables.id !== 'owned-graph') throw new Error('Unexpected graph ownership');
    const operation = ['deleteEdges', 'deleteWorkItems', 'deleteGraphs', 'graphs('].find(name => query.includes(name));
    calls.push(operation);
    if (${JSON.stringify(scenario)} === 'cleanup-failure' && operation === 'deleteEdges') throw new Error('Owned deletion failed');
    return { graphs: [] };
  },
};
const test = base.extend({
  page: async ({}, use) => { try { await use(fakePage); } finally { writeFileSync(${JSON.stringify(events)}, JSON.stringify(calls)); } },
  ownedGraphIds: [ownedGraphIdsFixture, { timeout: 3000 }],
  setup: [async ({ ownedGraphIds }, use) => {
    await ownedGraphIds.seed({ size: ${scenario === 'late-edge-response' ? 2 : scenario === 'late-create-response' ? 1 : 0}, batchSize: 2,
      additionalEdges: ${JSON.stringify(scenario === 'late-edge-response' ? Array.from({ length: 5 }, (_, index) => ({ sourceIndex: 0, targetIndex: index % 2, type: 'BLOCKS' })) : [])}
    });
    if (${JSON.stringify(scenario)} === 'setup-timeout') await new Promise(() => {});
    await use(true);
  }, { timeout: 100 }],
});
test('intentional negative control', async ({ setup }) => {});
`);
    const result = spawnSync(process.execPath, [join(root, 'node_modules/@playwright/test/cli.js'), 'test', '--config', join(dir, 'playwright.config.ts')], {
      cwd: dir, env: { ...process.env, FORCE_COLOR: '0' }, encoding: 'utf8', timeout: 20000,
    });
    assert.equal(result.status, 1, result.stderr || result.stdout);
    const report = JSON.parse(result.stdout);
    assert.equal(report.stats.unexpected, 1, result.stdout);
    assert.equal(report.stats.skipped, 0);
    assert.deepEqual(JSON.parse(readFileSync(events, 'utf8')), scenario === 'late-edge-response'
      ? ['createRequested', 'created', 'nodesCreated', 'edgeRequested:2', 'edgeFinished', 'unroute', 'deleteEdges', 'deleteWorkItems', 'deleteGraphs', 'graphs(']
      : scenario !== 'cleanup-failure'
      ? ['createRequested', 'created', 'unroute', 'deleteEdges', 'deleteWorkItems', 'deleteGraphs', 'graphs(']
      : ['createRequested', 'created', 'unroute', 'deleteEdges']);
    const errors = report.suites[0].specs[0].tests[0].results[0].errors.map(error => error.message).join('\n');
    assert.match(errors, scenario !== 'cleanup-failure' ? /Fixture "setup" timeout/ : /Owned graph cleanup failed/);
  });
}
