import test from 'node:test';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { testAdminCredentials } from '../auth-credentials.mjs';
import { SEQUENCES } from '../../sequences/unified.config.mjs';
import { assertHealthy, isolateCompose, privateRequest, runProductionStages, verifyOwnedFixture, waitForProduction } from './production-stack.mjs';

const healthy = { status: 200, body: { status: 'healthy', services: { graphql: { status: 'healthy' }, neo4j: { status: 'healthy' }, mcp: { status: 'offline' } } } };
const project = 'graphdone-prod-test-12345678';
const options = { project, root: '/owned/repo', certDir: '/private/certs' };
function config() {
  return { services: {
    'graphdone-api': { container_name: 'graphdone-api', image: 'shared-api', build: { context: '..' },
      environment: { ADMIN_PASSWORD: 'private-generated-password', ADMIN_EMAIL: 'test@example.invalid', NEO4J_URI: 'bolt://graphdone-neo4j:7687' },
      volumes: [{ type: 'volume', source: 'sqlite_auth_data', target: '/app/packages/server/data' }, { type: 'bind', source: '/developer/.env', target: '/app/.env' }, { type: 'bind', source: '/developer/certs', target: '/app/certs' }] },
    'graphdone-web': { container_name: 'graphdone-web', build: { context: '..', args: {} }, ports: [{ target: 3128, published: '3128' }], volumes: [] },
    'graphdone-neo4j': { container_name: 'graphdone-neo4j', volumes: [{ type: 'volume', source: 'neo4j_data', target: '/data' }] },
    'graphdone-redis': { container_name: 'graphdone-redis', volumes: [] },
  }, volumes: { sqlite_auth_data: { name: 'shared_auth' }, neo4j_data: { name: 'shared_graph' } }, networks: { default: { name: 'shared_network' } } };
}

test('admin fixture overrides are explicit and defaults remain compatible', () => {
  assert.deepEqual(testAdminCredentials({}), { username: 'admin', password: 'graphdone', role: 'admin' });
  assert.deepEqual(testAdminCredentials({ TEST_ADMIN_USERNAME: 'owned', TEST_ADMIN_PASSWORD: 'private' }), { username: 'owned', password: 'private', role: 'admin' });
  for (const env of [{ TEST_ADMIN_USERNAME: 'owned' }, { TEST_ADMIN_PASSWORD: 'secret' }, { TEST_ADMIN_USERNAME: '', TEST_ADMIN_PASSWORD: 'secret' }]) {
    assert.throws(() => testAdminCredentials(env), error => !error.message.includes('secret') && /both/.test(error.message));
  }
});

test('production smoke selects the existing six-case spec with strict execution and failure traces', () => {
  const sequence = SEQUENCES['prod-smoke'];
  assert.equal(sequence.blocking, true);
  assert.equal(sequence.adapter, 'playwright');
  assert.deepEqual(sequence.args, ['tests/e2e/smoke/user-smoke.spec.ts', '--project=GraphDone-Core/dev-neo4j/chromium', '--headed', '--workers=1', '--retries=0', '--trace=retain-on-failure']);
});

test('readiness rejects HTTP failures, static HTML, auth-only mode and degraded Neo4j', () => {
  for (const response of [{ ...healthy, status: 502 }, { status: 200, body: 'nginx healthy' }, { status: 200, body: { status: 'healthy' } },
    { status: 200, body: { ...healthy.body, services: { ...healthy.body.services, neo4j: { status: 'unhealthy' } } } },
    { status: 200, body: { ...healthy.body, status: 'degraded' } }]) assert.throws(() => assertHealthy(response));
  assert.equal(assertHealthy(healthy).mcp, 'offline');
});

test('readiness recovery is bounded and records actual healthy attempt', async () => {
  let clock = 0;
  let calls = 0;
  const result = await waitForProduction({ target: 'https://127.0.0.1:443', request: async () => ++calls === 3 ? healthy : { status: 503 },
    timeoutMs: 30, intervalMs: 10, now: () => clock, sleep: async ms => { clock += ms; } });
  assert.equal(result.attempts, 3);
  await assert.rejects(waitForProduction({ target: 'https://127.0.0.1:443', request: async () => ({ status: 200, body: '<html/>' }),
    timeoutMs: 30, intervalMs: 10, now: () => clock, sleep: async ms => { clock += ms; } }), /readiness failed after 3 attempts/);
});

test('self-signed fixture client refuses remote, non-TLS and credential-bearing targets', () => {
  for (const url of ['https://graphdone.com/health', 'http://127.0.0.1:443/health', 'https://user:pass@127.0.0.1:443/health', 'https://127.0.0.1/health']) {
    assert.throws(() => privateRequest(url), /loopback HTTPS/);
  }
});

test('isolation preserves actual SQLite target while removing shared names, ports and env binds', () => {
  const original = config();
  const isolated = isolateCompose(original, options);
  assert.equal(original.services['graphdone-api'].container_name, 'graphdone-api');
  for (const service of Object.values(isolated.services)) assert.equal(service.container_name, undefined);
  assert.equal(isolated.services['graphdone-api'].image, `${project}-api:test`);
  assert.deepEqual(isolated.services['graphdone-web'].ports, [{ target: 3128, published: '0', host_ip: '127.0.0.1', protocol: 'tcp' }]);
  assert.equal(isolated.volumes.sqlite_auth_data.name, `${project}_sqlite_auth_data`);
  assert.equal(isolated.networks.default.name, `${project}_default`);
  assert.equal(isolated.services['graphdone-api'].volumes[0].target, '/app/packages/server/data');
  assert.equal(isolated.services['graphdone-api'].volumes.some(volume => volume.target === '/app/.env'), false);
  assert.equal(isolated.services['graphdone-api'].volumes[1].source, '/private/certs');
  assert.equal(isolated.services['graphdone-web'].build.args.VITE_GRAPHQL_URL, '');
});

test('isolation rejects external resources, arbitrary host mounts and missing fixture credentials', () => {
  const changes = [c => { c.volumes.sqlite_auth_data.external = true; }, c => { c.volumes.neo4j_data.driver_opts = { device: '/shared' }; },
    c => { c.networks.default.external = true; }, c => { c.services['graphdone-api'].network_mode = 'host'; },
    c => { c.services['graphdone-api'].volumes.push({ type: 'bind', source: '/shared', target: '/other' }); },
    c => { delete c.services['graphdone-api'].environment.ADMIN_PASSWORD; }, c => { c.services['graphdone-api'].environment.NEO4J_URI = 'bolt://localhost:7687'; }];
  for (const change of changes) { const input = config(); change(input); assert.throws(() => isolateCompose(input, options)); }
  assert.throws(() => isolateCompose(config(), { ...options, project: 'existing-stack' }));
});

test('build, startup, health, fixture and recreation failures each stop downstream acceptance', async () => {
  for (const fail of ['build', 'start', 'readiness', 'fixture', 'recreate', 'smoke', 'persistence']) {
    const calls = [];
    const stage = name => { calls.push(name); if (name === fail) throw new Error(`failed ${name}`); return 'target'; };
    await assert.rejects(runProductionStages({ composeArgs: ['compose'], env: {},
      command: async name => stage(name), getTarget: async () => stage('target'),
      readiness: async () => stage('readiness'), fixture: async () => stage('fixture'), recreate: async () => stage('recreate'),
      smoke: async () => stage('smoke'), persistence: async () => stage('persistence'),
    }), new RegExp(`failed ${fail}`));
    const expected = ['build', 'start', 'target', 'readiness', 'fixture', 'recreate', 'smoke', 'persistence'];
    assert.deepEqual(calls, expected.slice(0, expected.indexOf(fail) + 1));
  }
});

function fixtureRequest({ badReadback = false, failedCleanup = '', remaining = '', requireCaptcha = false } = {}) {
  const calls = [];
  const challenge = { algorithm: 'SHA-256', salt: 'owned-fixture?action=login&', maxnumber: 9,
    challenge: createHash('sha256').update('owned-fixture?action=login&7').digest('hex'), signature: 'a'.repeat(64) };
  return { calls, request: async (url, { body } = {}) => {
    if (url.endsWith('/api/captcha/challenge?action=login')) return { status: 200, body: challenge };
    const query = body.query;
    if (requireCaptcha && query.includes('login(')) {
      const proof = JSON.parse(Buffer.from(body.variables.input.captchaPayload || '', 'base64').toString() || '{}');
      if (proof.number !== 7 || proof.challenge !== challenge.challenge || proof.signature !== challenge.signature) {
        return { status: 200, body: { errors: [{ message: 'Server proof required' }] } };
      }
    }
    calls.push(query);
    if (failedCleanup && query.includes(failedCleanup)) return { status: 200, body: { errors: [{ message: 'injected cleanup error' }] } };
    const data = query.includes('login(') ? { login: { token: 'owned-token', user: { id: 'owner', username: 'admin' } } }
      : query === '{me{id username}}' ? { me: { id: 'owner', username: 'admin' } }
      : query.includes('createGraphs') ? { createGraphs: { graphs: [{ id: 'graph' }] } }
      : query.includes('createWorkItems') ? { createWorkItems: { workItems: [{ id: 'a' }, { id: 'b' }] } }
      : query.includes('createEdges') ? { createEdges: { edges: [{ id: 'edge' }] } }
      : query.includes('deleteEdges') ? { deleteEdges: { nodesDeleted: 1 } }
      : query.includes('deleteWorkItems') ? { deleteWorkItems: { nodesDeleted: 2 } }
      : query.includes('deleteGraphs') ? { deleteGraphs: { nodesDeleted: 1 } }
      : query === 'query($id:ID!){edges(where:{source:{graph:{id:$id}}}){id}}' ? { edges: remaining === 'edges' ? [{ id: 'edge' }] : [] }
      : query === 'query($id:ID!){workItems(where:{graph:{id:$id}}){id}}' ? { workItems: remaining === 'workItems' ? [{ id: 'node' }] : [] }
      : query === 'query($id:ID!){graphs(where:{id:$id}){id}}' ? { graphs: [] }
      : { workItems: [{ id: 'b' }, { id: badReadback ? 'stranger' : 'a' }], edges: [{ id: 'edge', source: { id: 'a' }, target: { id: 'b' } }] };
    return { status: 200, body: { data } };
  } };
}

test('owned seeding requires exact API readback and confirmed edge-first cleanup', async () => {
  const fixture = fixtureRequest();
  const result = await verifyOwnedFixture({ target: 'owned', env: { TEST_ADMIN_USERNAME: 'admin' }, request: fixture.request });
  assert.deepEqual(result.nodeIds, ['a', 'b']);
  assert.deepEqual(result.cleanup.map(item => item.nodesDeleted), [1, 2, 1]);
  const bad = fixtureRequest({ badReadback: true });
  await assert.rejects(verifyOwnedFixture({ target: 'owned', env: { TEST_ADMIN_USERNAME: 'admin' }, request: bad.request }), /does not match/);
  assert.equal(bad.calls.at(-1).includes('graphs(where:'), true);
});

test('failed child cleanup does not delete its ownership path or report success', async () => {
  for (const failedCleanup of ['deleteEdges', 'deleteWorkItems']) {
    const fixture = fixtureRequest({ failedCleanup });
    await assert.rejects(verifyOwnedFixture({ target: 'owned', env: { TEST_ADMIN_USERNAME: 'admin' }, request: fixture.request }), /operation failed/);
    assert.equal(fixture.calls.at(-1).includes(failedCleanup), true);
  }
  for (const remaining of ['edges', 'workItems']) {
    const fixture = fixtureRequest({ remaining });
    await assert.rejects(verifyOwnedFixture({ target: 'owned', env: { TEST_ADMIN_USERNAME: 'admin' }, request: fixture.request }), /remain after cleanup/);
    assert.equal(fixture.calls.some(query => query.includes('deleteGraphs')), false);
  }
});

test('real CLI child rejects failed builds/startup and confirms owned cleanup with private log redaction', () => {
  const source = fileURLToPath(new URL('../../../', import.meta.url));
  const temp = mkdtempSync(join(tmpdir(), 'prod-runner-test-'));
  const root = join(temp, 'repo');
  mkdirSync(root);
  for (const file of ['scripts/test-production-stack.mjs', 'tests/lib/runner/runSequence.mjs', 'tests/lib/runner/source-state.mjs', 'tests/lib/runner/production-stack.mjs', 'tests/lib/production/auth-captcha.mjs']) {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), readFileSync(join(source, file)));
  }
  writeFileSync(join(root, '.gitignore'), 'test-artifacts/\n');
  for (const args of [['init', '--quiet'], ['add', '.'], ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '--quiet', '-m', 'Owned test fixture']]) {
    const git = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
    assert.equal(git.status, 0, git.stderr);
  }
  const output = join(root, 'test-artifacts', `prod-runner-regression-${Date.now()}`);
  const bin = join(temp, 'bin');
  mkdirSync(bin);
  const fixture = JSON.stringify(config());
  writeFileSync(join(bin, 'docker'), `#!${process.execPath}\nimport fs from 'node:fs';\nconst args=process.argv.slice(2);fs.appendFileSync(process.env.PROBE_CALLS,JSON.stringify(args)+'\\n');\nif(args.includes('config')){const config=${fixture};config.services['graphdone-api'].environment.ADMIN_PASSWORD=process.env.ADMIN_PASSWORD;console.log(JSON.stringify(config));}\nif(args.includes('logs'))console.log('private='+process.env.ADMIN_PASSWORD+' jwt='+process.env.JWT_SECRET);\nif(args.includes(process.env.PROBE_FAIL))process.exit(7);\n`, { mode: 0o700 });
  writeFileSync(join(bin, 'openssl'), `#!${process.execPath}\nprocess.exit(0);\n`, { mode: 0o700 });
  try {
    for (const failed of ['build', 'up']) {
      const calls = join(temp, `${failed}.jsonl`);
      const result = spawnSync(process.execPath, ['scripts/test-production-stack.mjs', '--out', `${output}/${failed}`], {
        cwd: root, encoding: 'utf8', timeout: 15_000, env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, PROBE_FAIL: failed, PROBE_CALLS: calls },
      });
      assert.equal(result.status, 1, result.stderr);
      const run = join(output, failed, readdirSync(join(output, failed))[0]);
      const report = JSON.parse(readFileSync(join(run, 'report.json'), 'utf8'));
      assert.equal(report.status, 'failed');
      assert.equal(report.cleanup.confirmed, true);
      assert.equal(report.source.changedDuringRun, false);
      assert.equal(report.stages.some(stage => stage.stage === 'strict-smoke'), false);
      const commands = readFileSync(calls, 'utf8').trim().split('\n').map(line => JSON.parse(line));
      assert.equal(commands.some(args => args.includes('down') && args.includes('--volumes')), true);
      assert.equal(commands.some(args => args.includes('port')), false);
      const logs = readdirSync(run).filter(name => name.endsWith('.log')).map(name => readFileSync(join(run, name), 'utf8')).join('');
      assert.match(logs, /private=\[REDACTED\] jwt=\[REDACTED\]/);
    }
    writeFileSync(join(root, 'uncommitted.txt'), 'dirty');
    const dirtyCalls = join(temp, 'dirty.jsonl');
    const dirty = spawnSync(process.execPath, ['scripts/test-production-stack.mjs', '--out', `${output}/dirty`], {
      cwd: root, encoding: 'utf8', timeout: 15_000, env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, PROBE_FAIL: 'build', PROBE_CALLS: dirtyCalls },
    });
    assert.equal(dirty.status, 1);
    assert.match(dirty.stderr, /clean committed source/);
    assert.equal(readdirSync(temp).includes('dirty.jsonl'), false);
  } finally { rmSync(temp, { recursive: true, force: true }); rmSync(output, { recursive: true, force: true }); }
});


test('production fixture login solves a server-issued proof before seeding', async () => {
  const fixture = fixtureRequest({ requireCaptcha: true });
  const result = await verifyOwnedFixture({ target: 'https://127.0.0.1:1234', env: { TEST_ADMIN_USERNAME: 'admin' }, request: fixture.request });
  assert.deepEqual(result.nodeIds, ['a', 'b']);
  assert.equal(result.cleanup.length, 3);
});
