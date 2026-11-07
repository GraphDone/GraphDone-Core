#!/usr/bin/env node
import { randomBytes } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runCommand } from '../tests/lib/runner/runSequence.mjs';
import { sourceState } from '../tests/lib/runner/source-state.mjs';
import { isolateCompose, privateRequest, runProductionStages, verifyOwnedFixture, waitForProduction } from '../tests/lib/runner/production-stack.mjs';

const root = realpathSync(fileURLToPath(new URL('..', import.meta.url)));
if (realpathSync(process.cwd()) !== root) throw new Error('Run production smoke from this script’s repository root.');
const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== '--out' || !args[1])) throw new Error('Usage: node scripts/test-production-stack.mjs [--out test-artifacts/prod-stack]');
const artifacts = join(root, 'test-artifacts');
const outputParent = resolve(root, args[1] || 'test-artifacts/prod-stack');
const inside = relative(artifacts, outputParent);
if (!inside || isAbsolute(inside) || inside === '..' || inside.startsWith(`..${sep}`)) throw new Error('Output must be a child of test-artifacts.');
for (let cursor = outputParent; cursor !== root; cursor = dirname(cursor)) {
  if (existsSync(cursor) && (lstatSync(cursor).isSymbolicLink() || !lstatSync(cursor).isDirectory())) throw new Error('Output must use real directories without symbolic links.');
}
mkdirSync(outputParent, { recursive: true });
const out = mkdtempSync(join(outputParent, 'run-'));
const project = `graphdone-prod-test-${Date.now()}-${randomBytes(6).toString('hex')}`;
const privateDir = mkdtempSync(join(tmpdir(), `${project}-`));
const composePath = join(privateDir, 'compose.json');
const composeArgs = ['compose', '--project-name', project, '--file', composePath];
const env = {
  JWT_SECRET: randomBytes(32).toString('hex'), SESSION_SECRET: randomBytes(32).toString('hex'),
  ADMIN_PASSWORD: randomBytes(32).toString('base64url'), ADMIN_EMAIL: `${project}@example.invalid`,
  TEST_ADMIN_USERNAME: 'admin', GRAPHDONE_START_TIME: new Date().toISOString(),
};
env.TEST_ADMIN_PASSWORD = env.ADMIN_PASSWORD;
const secrets = [env.JWT_SECRET, env.SESSION_SECRET, env.ADMIN_PASSWORD];
const redact = value => secrets.reduce((text, secret) => text.replaceAll(secret, '[REDACTED]'), String(value))
  .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[REDACTED_JWT]');
const report = { schema: 'graphdone.production-stack/1', project, startedAt: new Date().toISOString(),
  source: { started: sourceState(root, out) }, stages: [], status: 'failed', cleanup: { confirmed: false } };
let interrupted;
let ownsProject = false;
let config;
const signalHandlers = Object.fromEntries(['SIGINT', 'SIGTERM'].map(signal => [signal, () => { interrupted = signal; }]));
for (const [signal, handler] of Object.entries(signalHandlers)) process.on(signal, handler);
let cleanupStarted = false;
const command = async (stage, executable, argv, options = {}) => {
  if (interrupted && !cleanupStarted) throw new Error(`Production run interrupted by ${interrupted}.`);
  console.log(`Production stack: ${stage}`);
  const result = await runCommand(executable, argv, { cwd: root, env: { ...env, ...options.env }, timeoutMs: options.timeoutMs || 120_000 });
  const evidence = { stage, code: result.code, timedOut: result.timedOut, durationMs: result.durationMs };
  report.stages.push(evidence);
  if (stage !== 'resolve-compose') {
    const log = `${String(report.stages.length).padStart(2, '0')}-${stage.replace(/[^a-z0-9-]/gi, '-')}.log`;
    writeFileSync(join(out, log), redact(`${result.stdout}\n${result.stderr}`), { mode: 0o600 });
    evidence.log = log;
  }
  if (result.code !== 0 || result.timedOut || result.error) throw new Error(`Production stage ${stage} failed (exit ${result.code}, timeout ${result.timedOut}).`);
  return result;
};
const resourceIds = async kind => {
  const argv = kind === 'container' ? ['ps', '--all', '--quiet'] : [kind, 'ls', '--quiet'];
  const result = await command(`inspect-${kind}`, 'docker', [...argv, '--filter', `label=com.docker.compose.project=${project}`]);
  return result.stdout.trim().split(/\s+/).filter(Boolean);
};

try {
  if (report.source.started.dirty) throw new Error('Production acceptance requires a clean committed source tree.');
  for (const kind of ['container', 'volume', 'network']) {
    if ((await resourceIds(kind)).length) throw new Error('Refusing an existing Compose project.');
  }
  ownsProject = true;
  const resolved = await command('resolve-compose', 'docker', ['compose', '--project-name', project, '--file', join(root, 'deployment/docker-compose.yml'), 'config', '--format', 'json']);
  config = isolateCompose(JSON.parse(resolved.stdout), { project, root, certDir: privateDir });
  writeFileSync(composePath, JSON.stringify(config), { mode: 0o600 });
  await command('certificates', 'openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1',
    '-keyout', join(privateDir, 'server-key.pem'), '-out', join(privateDir, 'server-cert.pem'),
    '-subj', '/CN=localhost', '-addext', 'subjectAltName=DNS:localhost,IP:127.0.0.1']);
  const result = await runProductionStages({
    command, composeArgs, env,
    getTarget: async () => {
      const response = await command('web-port', 'docker', [...composeArgs, 'port', 'graphdone-web', '3128']);
      const match = /^127\.0\.0\.1:([0-9]+)$/.exec(response.stdout.trim());
      if (!match || Number(match[1]) < 1 || Number(match[1]) > 65535) throw new Error('Expected exactly one loopback web port.');
      report.images = {};
      for (const name of ['graphdone-api', 'graphdone-web']) {
        const tag = config.services[name].image;
        const image = await command(`image-${name}`, 'docker', ['image', 'inspect', '--format', '{{.Id}}', tag]);
        report.images[name] = { tag, id: image.stdout.trim() };
      }
      const target = `https://${match[0]}`;
      report.target = target;
      return target;
    },
    readiness: async target => (report.health = await waitForProduction({ target, request: privateRequest })),
    fixture: async target => (report.fixture = await verifyOwnedFixture({ target, env, request: privateRequest })),
    recreate: async target => {
      const { verifySqliteRecreation } = await import('../tests/lib/production/sqlite-recreation.mjs');
      report.recreation = await verifySqliteRecreation({ composeArgs, env, target, request: privateRequest, command });
      return report.recreation;
    },
    smoke: async target => {
      await command('strict-smoke', process.execPath, ['tests/run-unified.mjs', '--sequence', 'prod-smoke', '--out', join(out, 'smoke')],
        { env: { TEST_URL: target, CI: 'true' }, timeoutMs: 15 * 60_000 });
      const smoke = JSON.parse(readFileSync(join(out, 'smoke/report.json'), 'utf8'));
      if (smoke.rollup?.status !== 'passed' || smoke.rollup?.totals?.passed !== 6 || smoke.rollup.totals.failed || smoke.rollup.totals.skipped
        || smoke.source?.started?.fingerprint !== report.source.started.fingerprint || smoke.source?.changedDuringRun) {
        throw new Error('Strict production smoke did not prove all six cases against the starting source.');
      }
      report.smoke = { passed: 6, failed: 0, skipped: 0, retries: 0, report: 'smoke/report.json' };
    },
    persistence: async () => {
      await command('sqlite-persistence', process.execPath, ['scripts/test-sqlite-container-persistence.mjs'],
        { env: { GRAPHDONE_TEST_API_IMAGE: config.services['graphdone-api'].image }, timeoutMs: 180_000 });
    },
  });
  report.status = 'passed';
  report.result = result;
} catch (error) {
  report.error = redact(error.message);
  console.error(report.error);
} finally {
  cleanupStarted = true;
  try {
    if (ownsProject && existsSync(composePath)) {
      try { await command('stack-logs', 'docker', [...composeArgs, 'logs', '--no-color', '--tail', '500'], { timeoutMs: 30_000 }); }
      catch (error) { report.logError = redact(error.message); }
      await command('cleanup', 'docker', [...composeArgs, 'down', '--volumes', '--remove-orphans', '--timeout', '15'], { timeoutMs: 120_000 });
      const remaining = {};
      for (const kind of ['container', 'volume', 'network']) remaining[kind] = await resourceIds(kind);
      report.cleanup = { confirmed: Object.values(remaining).every(ids => !ids.length), remaining };
      if (!report.cleanup.confirmed) throw new Error('Owned Compose resources remain after cleanup.');
    } else report.cleanup = { confirmed: true, reason: 'No owned Compose configuration started.' };
  } catch (error) {
    report.status = 'failed';
    report.cleanup.error = redact(error.message);
    console.error(report.cleanup.error);
  }
  report.source.finished = sourceState(root, out);
  report.source.changedDuringRun = report.source.started.fingerprint !== report.source.finished.fingerprint;
  if (report.source.changedDuringRun || interrupted) report.status = 'failed';
  report.finishedAt = new Date().toISOString();
  writeFileSync(join(out, 'report.json'), JSON.stringify(report, null, 2), { mode: 0o600 });
  rmSync(privateDir, { recursive: true, force: true });
  for (const [signal, handler] of Object.entries(signalHandlers)) process.removeListener(signal, handler);
  console.log(`Production stack ${report.status}: ${join(out, 'report.json')}`);
  process.exitCode = interrupted ? (interrupted === 'SIGINT' ? 130 : 143) : report.status === 'passed' ? 0 : 1;
}
