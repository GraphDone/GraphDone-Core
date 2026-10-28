import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const configOnly = process.argv.includes('--config-only');
const image = process.env.GRAPHDONE_TEST_API_IMAGE;
const adminPassword = randomBytes(32).toString('base64url');
const fixturePassword = randomBytes(32).toString('base64url');
const adminEmail = `persistence-${randomUUID()}@example.invalid`;
const environment = {
  ...process.env,
  JWT_SECRET: randomBytes(32).toString('hex'),
  SESSION_SECRET: randomBytes(32).toString('hex'),
  ADMIN_EMAIL: adminEmail,
  ADMIN_PASSWORD: adminPassword,
  GRAPHDONE_START_TIME: 'sqlite-persistence-test',
};
const results = [];

function docker(args, options = {}) {
  try {
    return execFileSync('docker', args, {
      cwd: root, encoding: 'utf8', timeout: 120_000,
      stdio: ['pipe', 'pipe', 'pipe'], ...options,
    });
  } catch (error) {
    throw new Error(`Docker operation failed (${args.slice(0, 2).join(' ')}, exit ${error.status ?? 'timeout'})`);
  }
}

async function check(name, action) {
  try {
    await action();
    results.push({ name, status: 'passed' });
  } catch (error) {
    results.push({ name, status: 'failed', message: error.message });
  }
}

const configs = new Map();
for (const file of ['docker-compose.yml', 'docker-compose.http.yml', 'docker-compose.dev.yml']) {
  const config = JSON.parse(docker(['compose', '-f', `deployment/${file}`, 'config', '--format', 'json'], { env: environment }));
  configs.set(file, config);
  await check(`${file}: SQLite volume covers the server workspace`, () => {
    const mounts = config.services['graphdone-api'].volumes;
    assert.ok(mounts.some(mount => mount.type === 'volume' && mount.source === 'sqlite_auth_data' && mount.target === '/app/packages/server/data'), 'SQLite mount must cover /app/packages/server/data');
  });
  if (file !== 'docker-compose.dev.yml') {
    await check(`${file}: private admin fixture reaches production`, () => {
      const env = config.services['graphdone-api'].environment;
      assert.ok(env.ADMIN_EMAIL === adminEmail && env.ADMIN_PASSWORD === adminPassword, 'Production Compose must forward the configured admin credentials');
    });
  }
}

const probe = `
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const { sqliteAuthStore: store } = await import(pathToFileURL(resolve('dist/auth/sqlite-auth.js')));
await store.initialize();
const admin = await store.findUserByEmailOrUsername('admin');
const generated = !process.env.ADMIN_PASSWORD;
const bootstrap = 'data/bootstrap-admin.json';
const saved = existsSync(bootstrap) ? readFileSync(bootstrap) : null;
const password = generated ? JSON.parse(saved).password : process.env.ADMIN_PASSWORD;
assert.ok(await store.validatePassword(admin, password), 'Admin password validation failed');
if (generated) assert.equal(statSync(bootstrap).mode & 0o777, 0o600, 'Bootstrap file must remain private');
else assert.ok(!saved, 'Configured admin must not create a recovery password file');
let user = await store.findUserByEmailOrUsername('persistence-fixture');
if (process.env.GRAPHDONE_PERSISTENCE_PHASE === 'write') {
  assert.ok(!user, 'Disposable fixture must start empty');
  user = await store.createUser({ email: 'persistence-fixture@example.invalid', username: 'persistence-fixture', name: 'Container persistence fixture', password: process.env.GRAPHDONE_PERSISTENCE_PASSWORD });
}
const result = {
  cwd: process.cwd(), adminId: admin.id,
  userId: user?.id ?? null,
  passwordValid: !!user && await store.validatePassword(user, process.env.GRAPHDONE_PERSISTENCE_PASSWORD),
  bootstrapDigest: saved ? createHash('sha256').update(saved).digest('hex') : null,
  bootstrapMode: saved ? statSync(bootstrap).mode & 0o777 : null,
};
console.log('GRAPHDONE_PERSISTENCE_RESULT=' + JSON.stringify(result));
process.exit(0);
`;

if (!configOnly) {
  assert.ok(image, 'Set GRAPHDONE_TEST_API_IMAGE to an already built local API image; this test never pulls or publishes images');
  const inspected = JSON.parse(docker(['image', 'inspect', image]))[0];
  const imageId = inspected.Id;
  assert.deepEqual(inspected.Config.Cmd, ['node', 'dist/index.js'], 'Use the actual production API image');
  assert.equal(inspected.Config.WorkingDir, '/app/packages/server', 'Use the declared production server directory');
  for (const generated of [true, false]) {
    await check(`${generated ? 'generated' : 'configured'} admin and owned account survive container recreation`, () => {
      const name = `graphdone-sqlite-test-${randomUUID()}`;
      const directory = mkdtempSync(join(tmpdir(), 'graphdone-sqlite-test-'));
      let created = false;
      const containers = [];
      try {
        docker(['volume', 'create', '--label', `graphdone.persistence-test=${name}`, name]);
        created = true;
        const api = configs.get('docker-compose.yml').services['graphdone-api'];
        const mount = api.volumes.find(value => value.type === 'volume' && value.source === 'sqlite_auth_data');
        assert.ok(mount, 'Production Compose has no SQLite volume');
        const envPath = join(directory, 'runtime.env');
        const env = {
          NODE_ENV: 'production', ADMIN_EMAIL: api.environment.ADMIN_EMAIL ?? '',
          ADMIN_PASSWORD: generated ? '' : api.environment.ADMIN_PASSWORD ?? '',
          GRAPHDONE_PERSISTENCE_PASSWORD: fixturePassword,
        };
        writeFileSync(envPath, Object.entries(env).map(([key, value]) => `${key}=${value}`).join('\n') + '\n', { mode: 0o600 });
        const run = phase => {
          const container = `${name}-${phase}`;
          containers.push(container);
          const output = docker(['run', '--rm', '-i', '--pull=never', '--name', container, '--network', 'none', '--label', `graphdone.persistence-test=${name}`, '--mount', `type=volume,src=${name},dst=${mount.target}`, '--env-file', envPath, '-e', `GRAPHDONE_PERSISTENCE_PHASE=${phase}`, imageId, 'node', '--input-type=module'], { input: probe });
          const line = output.split('\n').find(value => value.startsWith('GRAPHDONE_PERSISTENCE_RESULT='));
          assert.ok(line, 'Container did not return persistence evidence');
          return JSON.parse(line.slice('GRAPHDONE_PERSISTENCE_RESULT='.length));
        };
        const first = run('write');
        const second = run('read');
        assert.equal(first.cwd, '/app/packages/server', 'Probe must use the image server directory');
        assert.equal(second.cwd, first.cwd, 'Replacement must use the same server directory');
        assert.ok(first.userId && first.passwordValid, 'Owned account was not created and authenticated');
        assert.ok(second.userId === first.userId && second.passwordValid, 'Owned account identity/password were lost across container recreation');
        assert.ok(first.adminId === second.adminId, 'Admin identity changed across container recreation');
        assert.ok(first.bootstrapDigest === second.bootstrapDigest, 'Bootstrap credentials changed across container recreation');
        assert.equal(second.bootstrapMode, generated ? 0o600 : null);
      } finally {
        for (const container of containers) {
          try { docker(['rm', '-f', container]); } catch {}
        }
        try {
          if (created) docker(['volume', 'rm', name]);
        } finally {
          rmSync(directory, { recursive: true, force: true });
        }
      }
    });
  }
}

console.log(JSON.stringify({ image: image ?? null, configOnly, results }, null, 2));
if (results.some(result => result.status !== 'passed')) process.exitCode = 1;
