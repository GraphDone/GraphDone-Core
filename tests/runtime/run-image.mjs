import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';

const [image, expectedUid] = process.argv.slice(2);
assert.ok(image && ['0', '1000', '1001'].includes(expectedUid), 'Usage: node tests/runtime/run-image.mjs IMAGE EXPECTED_UID');
assert.equal(process.env.GRAPHDONE_DISPOSABLE_NEO4J, '1');
for (const name of ['NEO4J_URI', 'NEO4J_USER', 'NEO4J_PASSWORD']) assert.ok(process.env[name], `Missing ${name}`);
assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(new URL(process.env.NEO4J_URI).hostname));
const suffix = randomUUID();
const volume = `graphdone-image-contract-${suffix}`;
const containers = [];
const env = {
  ...process.env,
  JWT_SECRET: randomBytes(32).toString('hex'), SESSION_SECRET: randomBytes(32).toString('hex'),
  ADMIN_EMAIL: `image-${suffix}@example.invalid`, ADMIN_PASSWORD: randomBytes(24).toString('hex'),
  GRAPHDONE_EXPECTED_UID: expectedUid, SSL_ENABLED: 'false',
};
function docker(args, { input, expectedFailure = false, timeout = 150000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn('docker', args, { env, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    const timer = setTimeout(() => { child.kill('SIGTERM'); reject(new Error('Owned image command timed out')); }, timeout);
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.stdout.on('data', chunk => { stdout += chunk.toString(); });
    child.stderr.on('data', chunk => { stderr += chunk.toString(); });
    child.once('close', code => {
      clearTimeout(timer);
      if ((expectedFailure && code === 0) || (!expectedFailure && code !== 0)) reject(new Error(`Owned image command exited ${code}: ${stderr.slice(-6000)}${stdout.slice(-6000)}`));
      else resolve({ stdout, stderr, code });
    });
    child.stdin.on('error', error => { if (error.code !== 'EPIPE') reject(error); });
    child.stdin.end(input);
  });
}
try {
  const config = JSON.parse((await docker(['image', 'inspect', image, '--format', '{{json .Config}}'])).stdout);
  assert.deepEqual(config.Cmd, ['node', 'dist/index.js']);
  assert.equal(config.WorkingDir, '/app/packages/server');
  assert.ok(config.Env.includes('NODE_ENV=production'));
  const rejectedName = `graphdone-image-secret-${suffix}`;
  containers.push(rejectedName);
  const rejected = await docker(['run', '--rm', '--name', rejectedName, '--network', 'none', image], { expectedFailure: true, timeout: 15000 });
  assert.match(rejected.stdout + rejected.stderr, /Invalid production secrets: JWT_SECRET, SESSION_SECRET/);
  const inventoryName = `graphdone-image-inventory-${suffix}`;
  containers.push(inventoryName);
  const inventory = await docker(['run', '--rm', '--name', inventoryName, '-e', 'GRAPHDONE_EXPECTED_UID', '--entrypoint', 'node', '-i', image, '--input-type=module'], { input: readFileSync(new URL('./image-inventory.mjs', import.meta.url)) });
  const installed = JSON.parse(inventory.stdout);
  assert.equal(installed.nativeSQLite, 'passed');
  await docker(['volume', 'create', volume]);
  for (const restart of [false, true]) {
    const name = `graphdone-image-runtime-${restart ? 'restart' : 'initial'}-${suffix}`;
    containers.push(name);
    env.GRAPHDONE_REQUIRE_RECOVERY = restart ? '1' : '0';
    const keys = ['NEO4J_URI', 'NEO4J_USER', 'NEO4J_PASSWORD', 'GRAPHDONE_DISPOSABLE_NEO4J', 'JWT_SECRET', 'SESSION_SECRET', 'ADMIN_EMAIL', 'ADMIN_PASSWORD', 'SSL_ENABLED', 'GRAPHDONE_REQUIRE_RECOVERY'];
    if (env.GRAPHDONE_IMAGE_TEST_PORT) keys.push('GRAPHDONE_IMAGE_TEST_PORT');
    const result = await docker(['run', '--rm', '--name', name, '--network', 'host', '--mount', `type=volume,source=${volume},target=/app/packages/server/data`, ...keys.flatMap(key => ['-e', key]), '--entrypoint', 'node', '-i', image, '--input-type=module'], { input: readFileSync(new URL('./image-contract.mjs', import.meta.url)) });
    const outcome = JSON.parse(result.stdout);
    assert.equal(outcome.independentNeo4jReadback, 'passed');
    console.log(JSON.stringify({ image, restart, ...outcome }));
  }
  console.log(JSON.stringify({ image, uid: expectedUid, installedPackageCount: installed.installedPackages.length, nativeSQLite: 'passed', defaultSecretRejection: 'passed', replacementContainerRecovery: 'passed' }));
} finally {
  for (const name of containers) {
    const existing = await docker(['container', 'ls', '--all', '--filter', `name=^/${name}$`, '--format', '{{.Names}}']);
    if (existing.stdout.trim()) await docker(['container', 'rm', '--force', name]);
  }
  const existing = await docker(['volume', 'ls', '--filter', `name=^${volume}$`, '--format', '{{.Name}}']);
  if (existing.stdout.trim()) await docker(['volume', 'rm', volume]);
}
