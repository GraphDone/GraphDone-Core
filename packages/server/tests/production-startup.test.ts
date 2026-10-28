import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Server } from 'node:http';
import { randomBytes } from 'node:crypto';
import { ApolloServer } from '@apollo/server';
import jwt from 'jsonwebtoken';

const fixture = vi.hoisted(() => ({
  envPath: '',
  initialize: vi.fn(async () => {}),
  session: vi.fn(() => ({ run: vi.fn(async () => ({})), close: vi.fn(async () => {}) })),
}));

vi.mock('dotenv', async importOriginal => {
  const original = await importOriginal<typeof import('dotenv')>();
  return { default: { config: () => original.config({ path: fixture.envPath }) } };
});
vi.mock('../src/auth/sqlite-auth.js', () => ({
  sqliteAuthStore: { initialize: fixture.initialize, getUserCount: vi.fn(async () => 1) },
}));
vi.mock('../src/db.js', () => ({ driver: { session: fixture.session }, NEO4J_URI: 'test://isolated' }));
vi.mock('@neo4j/graphql', async () => {
  const { createRequire } = await import('node:module');
  const { buildSchema } = createRequire(import.meta.url)('graphql');
  return { Neo4jGraphQL: class { async getSchema() { return buildSchema('type Query { ready: Boolean }'); } } };
});
vi.mock('child_process', async importOriginal => {
  const original = await importOriginal<typeof import('child_process')>();
  return { ...original, exec: vi.fn((_command, _options, callback) => callback(null, '', '')) };
});

describe('production API startup secret boundary', () => {
  let directory: string;
  let signingSecret: string;
  let sessionSecret: string;
  let servers: ApolloServer[];
  let listening: Promise<void>;
  let listen: ReturnType<typeof vi.spyOn>;
  const start = ApolloServer.prototype.start;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
    directory = mkdtempSync(join(tmpdir(), 'graphdone-startup-'));
    fixture.envPath = join(directory, '.env');
    writeFileSync(fixture.envPath, '');
    signingSecret = randomBytes(32).toString('hex');
    sessionSecret = randomBytes(32).toString('hex');
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('JWT_SECRET', signingSecret);
    vi.stubEnv('SESSION_SECRET', sessionSecret);
    for (const key of ['GOOGLE_CLIENT_ID', 'LINKEDIN_CLIENT_ID', 'GITHUB_CLIENT_ID', 'SSL_ENABLED', 'EMAIL_USER', 'EMAIL_PASS']) {
      vi.stubEnv(key, '');
    }
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('Unexpected process exit'); });
    servers = [];
    vi.spyOn(ApolloServer.prototype, 'start').mockImplementation(async function () {
      servers.push(this);
      await start.call(this);
    });
    listening = new Promise(resolve => {
      listen = vi.spyOn(Server.prototype, 'listen').mockImplementation(function () {
        resolve();
        return this;
      });
    });
  });

  afterEach(async () => {
    if (fixture.initialize.mock.calls.length) await listening;
    for (const server of servers) await server.stop();
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    rmSync(directory, { recursive: true, force: true });
  });

  it.each([
    ['missing JWT_SECRET', 'JWT_SECRET', undefined],
    ['blank SESSION_SECRET', 'SESSION_SECRET', '  '],
    ['fallback JWT_SECRET', 'JWT_SECRET', 'your-dev-secret-key'],
    ['fallback SESSION_SECRET', 'SESSION_SECRET', 'graphdone-default-secret-change-in-production'],
    ['fallback ALTCHA_HMAC_KEY', 'ALTCHA_HMAC_KEY', 'your-secret-hmac-key-change-in-production'],
  ])('rejects %s before database initialization or listening', async (_label, name, value) => {
    if (value === undefined) delete process.env[name!];
    else vi.stubEnv(name!, value);
    await expect(import('../src/index.js')).rejects.toThrow(`Invalid production secrets: ${name}`);
    expect(fixture.initialize).not.toHaveBeenCalled();
    expect(fixture.session).not.toHaveBeenCalled();
    expect(listen).not.toHaveBeenCalled();
  });

  it('reaches the real API listen boundary with configured production secrets', async () => {
    await import('../src/index.js');
    await listening;
    expect(fixture.initialize).toHaveBeenCalledOnce();
    expect(fixture.session).toHaveBeenCalledOnce();
    expect(listen).toHaveBeenCalledOnce();
    const { generateToken } = await import('../src/utils/auth.js');
    expect(jwt.verify(generateToken('startup-user', 'startup@example.test', 'USER'), signingSecret)).toMatchObject({ userId: 'startup-user' });
  });

  it('loads .env secrets before auth modules capture their signing key', async () => {
    delete process.env.JWT_SECRET;
    delete process.env.SESSION_SECRET;
    writeFileSync(fixture.envPath, `JWT_SECRET=${signingSecret}\nSESSION_SECRET=${sessionSecret}\n`);
    await import('../src/index.js');
    await listening;
    const { generateToken } = await import('../src/utils/auth.js');
    expect(jwt.verify(generateToken('dotenv-user', 'dotenv@example.test', 'USER'), signingSecret)).toMatchObject({ userId: 'dotenv-user' });
  });

  it('preserves development startup without explicit secrets', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    delete process.env.JWT_SECRET;
    delete process.env.SESSION_SECRET;
    await import('../src/index.js');
    await listening;
    expect(listen).toHaveBeenCalledOnce();
  });

  it('validates production mode supplied by .env before initializing the database', async () => {
    delete process.env.NODE_ENV;
    delete process.env.JWT_SECRET;
    delete process.env.SESSION_SECRET;
    writeFileSync(fixture.envPath, 'NODE_ENV=production\n');
    await expect(import('../src/index.js')).rejects.toThrow('Invalid production secrets: JWT_SECRET, SESSION_SECRET');
    expect(fixture.initialize).not.toHaveBeenCalled();
    expect(listen).not.toHaveBeenCalled();
  });
});
