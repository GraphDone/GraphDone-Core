import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import sqlite3 from 'sqlite3';
import express from 'express';
import { createServer, type Server } from 'node:http';
import { createHash } from 'node:crypto';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@as-integrations/express4';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { createClient, type Client } from 'graphql-ws';
import { useServer } from 'graphql-ws/lib/use/ws';
import { WebSocket, WebSocketServer } from 'ws';
import jwt from 'jsonwebtoken';
import { sqliteAuthStore } from '../src/auth/sqlite-auth';
import { verifyMagicLinkHandler, resetPasswordHandler } from '../src/auth/email-link-handlers';
import { createCaptchaChallenge } from '../src/utils/captcha';
import { authOnlyTypeDefs } from '../src/schema/auth-only-schema';
import { sqliteAuthResolvers } from '../src/resolvers/sqlite-auth';
import { resolveActiveAuthUser } from '../src/middleware/auth';
import { webSocketAuthentication } from '../src/auth/websocket-auth';
import { generateToken, verifyToken } from '../src/utils/auth';

let database: sqlite3.Database;
let server: Server;
let endpoint: string;
let apollo: ApolloServer;
let disposeSockets: () => Promise<void>;
let clients: Client[];
const email = 'purpose-boundary@example.invalid';
const signingSecret = process.env.JWT_SECRET || 'your-dev-secret-key';
const store = sqliteAuthStore as unknown as { db: sqlite3.Database | null; initialized: boolean };
const execute = (sql: string, values: unknown[] = []) => new Promise<void>((resolve, reject) => {
  database.run(sql, values, error => error ? reject(error) : resolve());
});
const row = <T>(sql: string, values: unknown[] = []) => new Promise<T>((resolve, reject) => {
  database.get(sql, values, (error, result: T) => error ? reject(error) : resolve(result));
});

async function graphRequest(query: string, token?: string, variables?: Record<string, unknown>) {
  const response = await fetch(`${endpoint}/graphql`, {
    method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ query, variables }),
  });
  return response.json();
}

function socket(token: string) {
  let closeCode: number | undefined;
  const client = createClient({ url: endpoint.replace('http:', 'ws:') + '/graphql', webSocketImpl: WebSocket,
    lazy: false, retryAttempts: 0, connectionParams: { authorization: `Bearer ${token}` },
    onNonLazyError: () => {},
    on: { closed: event => { closeCode = (event as { code: number }).code; } },
  });
  clients.push(client);
  return { client, closeCode: () => closeCode };
}

function socketMe(client: Client) {
  return new Promise<{ data?: { me?: { id: string } } }>((resolve, reject) => {
    client.subscribe({ query: '{ me { id } }' }, {
      next: value => resolve(value as { data?: { me?: { id: string } } }),
      error: () => reject(new Error('WebSocket authentication rejected')),
      complete: () => {},
    });
  });
}

async function reset(token: string, password = 'ChangedPurposeFixture!2026') {
  return fetch(`${endpoint}/auth/reset-password`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token, newPassword: password, captchaPayload: await resetProof() }),
  });
}

async function resetProof() {
  const challenge = await createCaptchaChallenge('reset-password');
  for (let number = 0; number <= challenge.maxnumber; number++) {
    if (createHash('sha256').update(challenge.salt + number).digest('hex') === challenge.challenge) {
      return Buffer.from(JSON.stringify({ ...challenge, number })).toString('base64');
    }
  }
  throw new Error('Owned challenge could not be solved');
}

beforeEach(async () => {
  vi.stubEnv('NODE_ENV', 'test');
  vi.stubEnv('ADMIN_EMAIL', email);
  vi.stubEnv('ADMIN_PASSWORD', 'OwnedPurposeFixture!2026');
  vi.spyOn(console, 'log').mockImplementation(() => {});
  database = await new Promise((resolve, reject) => {
    const connection = new sqlite3.Database(':memory:', error => error ? reject(error) : resolve(connection));
  });
  store.db = database; store.initialized = false;
  await sqliteAuthStore.initialize();
  clients = [];
  const schema = makeExecutableSchema({ typeDefs: authOnlyTypeDefs, resolvers: {
    Query: { me: sqliteAuthResolvers.Query.me },
    Mutation: { login: sqliteAuthResolvers.Mutation.login, refreshToken: sqliteAuthResolvers.Mutation.refreshToken },
  } });
  apollo = new ApolloServer({ schema });
  await apollo.start();
  const app = express();
  app.get('/auth/magic-link/verify', verifyMagicLinkHandler);
  app.post('/auth/reset-password', express.json(), resetPasswordHandler);
  app.use('/graphql', express.json(), expressMiddleware(apollo, {
    context: async ({ req }) => ({ user: await resolveActiveAuthUser(req.headers.authorization), req }),
  }));
  server = createServer(app);
  const ws = new WebSocketServer({ server, path: '/graphql' });
  const cleanup = useServer({ schema, ...webSocketAuthentication, context: async connection => {
    const header = connection.connectionParams?.authorization;
    return { user: await resolveActiveAuthUser(typeof header === 'string' ? header : undefined) };
  } }, ws);
  disposeSockets = () => cleanup.dispose();
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Owned HTTP fixture has no port');
  endpoint = `http://127.0.0.1:${address.port}`;
});

afterEach(async () => {
  for (const client of clients) await client.dispose();
  await disposeSockets();
  await apollo.stop();
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  await new Promise<void>((resolve, reject) => database.close(error => error ? reject(error) : resolve()));
  store.db = null; store.initialized = false;
  vi.restoreAllMocks(); vi.unstubAllEnvs();
});

describe('purpose-bound email links at the real HTTP handlers', () => {
  it('rejects a password-reset link at login without issuing a session', async () => {
    const link = await sqliteAuthStore.createMagicLink(email, 'password-reset');
    const response = await fetch(`${endpoint}/auth/magic-link/verify?token=${encodeURIComponent(link.token)}`, { redirect: 'manual' });
    expect(response.status).toBe(302);
    const location = new URL(response.headers.get('location')!);
    expect(location.searchParams.has('token')).toBe(false);
    expect(location.searchParams.has('error')).toBe(true);
    expect(await row('SELECT usedAt FROM magic_links WHERE id=?', [link.id])).toEqual({ usedAt: null });
    expect((await reset(link.token)).status).toBe(200);
  });

  it('rejects a login link at password reset without changing credentials', async () => {
    const before = await sqliteAuthStore.findUserByEmailOrUsername(email);
    const link = await sqliteAuthStore.createMagicLink(email, 'login');
    const response = await fetch(`${endpoint}/auth/reset-password`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: link.token, newPassword: 'ShouldNotBeInstalled!2026', captchaPayload: await resetProof() }),
    });
    expect(response.status).toBe(400);
    const after = await sqliteAuthStore.findUserByEmailOrUsername(email);
    expect(after!.passwordHash).toBe(before!.passwordHash);
    const login = await fetch(`${endpoint}/auth/magic-link/verify?token=${encodeURIComponent(link.token)}`, { redirect: 'manual' });
    const session = new URL(login.headers.get('location')!).searchParams.get('token');
    expect(Boolean(session)).toBe(true);
    expect((await graphRequest('{me{id}}', session!)).data.me.id).toBe(before!.id);
  });

  it('revokes old HTTP sessions, an open WebSocket, and all outstanding links on reset', async () => {
    const account = await sqliteAuthStore.findUserByEmailOrUsername(email);
    const login = await graphRequest('mutation($input:LoginInput!){login(input:$input){token}}', undefined,
      { input: { emailOrUsername: 'admin', password: 'OwnedPurposeFixture!2026' } });
    expect(login.errors).toBeUndefined();
    const token = login.data.login.token as string;
    const open = socket(token);
    expect((await socketMe(open.client)).data?.me?.id).toBe(account!.id);
    expect((await graphRequest('{me{id}}', token)).data.me.id).toBe(account!.id);
    const pendingLogin = await sqliteAuthStore.createMagicLink(email, 'login');
    const pendingReset = await sqliteAuthStore.createMagicLink(email, 'password-reset');
    const chosen = await sqliteAuthStore.createMagicLink(email, 'password-reset');
    expect((await reset(chosen.token)).status).toBe(200);
    expect((await graphRequest('{me{id}}', token)).data.me).toBeNull();
    await expect(socketMe(open.client)).rejects.toThrow('WebSocket authentication rejected');
    await vi.waitFor(() => expect(open.closeCode()).toBe(4403));
    const rejected = socket(token);
    await expect(socketMe(rejected.client)).rejects.toThrow('WebSocket authentication rejected');
    await vi.waitFor(() => expect(rejected.closeCode()).toBe(4403));
    expect(await sqliteAuthStore.verifyMagicLink(pendingLogin.token)).toEqual({ valid: false });
    expect((await reset(pendingReset.token)).status).toBe(400);
    expect((await reset(chosen.token)).status).toBe(400);
    const fresh = await graphRequest('mutation($input:LoginInput!){login(input:$input){token}}', undefined,
      { input: { emailOrUsername: 'admin', password: 'ChangedPurposeFixture!2026' } });
    expect(fresh.errors).toBeUndefined();
    expect(verifyToken(fresh.data.login.token).authVersion).toBe(1);
    expect((await graphRequest('{me{id}}', fresh.data.login.token)).data.me.id).toBe(account!.id);
    expect((await socketMe(socket(fresh.data.login.token).client)).data?.me?.id).toBe(account!.id);
  });

  it('does not revive sessions or outstanding links when a disabled account is reactivated', async () => {
    const account = await sqliteAuthStore.findUserByEmailOrUsername(email);
    const token = generateToken(account!.id, email, account!.role, account!.authVersion);
    const link = await sqliteAuthStore.createMagicLink(email, 'login');
    const resetLink = await sqliteAuthStore.createMagicLink(email, 'password-reset');
    const disabled = await sqliteAuthStore.updateUserStatus(account!.id, false);
    expect(disabled.isActive).toBe(false);
    expect((await graphRequest('{me{id}}', token)).data.me).toBeNull();
    expect(await sqliteAuthStore.verifyMagicLink(link.token)).toEqual({ valid: false });
    expect((await reset(resetLink.token)).status).toBe(400);
    await sqliteAuthStore.updateUserStatus(account!.id, true);
    expect((await graphRequest('{me{id}}', token)).data.me).toBeNull();
    await expect(socketMe(socket(token).client)).rejects.toThrow('WebSocket authentication rejected');
    expect(await sqliteAuthStore.verifyMagicLink(link.token)).toEqual({ valid: false });
    expect((await reset(resetLink.token)).status).toBe(400);
  });

  it('allows only one concurrent reset and commits password, session revision and link revocation together', async () => {
    const link = await sqliteAuthStore.createMagicLink(email, 'password-reset');
    const results = await Promise.all(Array.from({ length: 8 }, () => sqliteAuthStore.resetPasswordWithLink(link.token, 'ConcurrentReset!2026')));
    expect(results.filter(Boolean)).toHaveLength(1);
    const account = await sqliteAuthStore.findUserByEmailOrUsername(email);
    expect(account!.authVersion).toBe(1);
    expect(await sqliteAuthStore.validatePassword(account!, 'ConcurrentReset!2026')).toBe(true);
    expect((await row<{ usedAt: string }>('SELECT usedAt FROM magic_links WHERE id=?', [link.id])).usedAt).toBeTruthy();
  });

  it('rolls back the password and revision if link revocation fails in SQLite', async () => {
    const before = await sqliteAuthStore.findUserByEmailOrUsername(email);
    const link = await sqliteAuthStore.createMagicLink(email, 'password-reset');
    await execute("CREATE TRIGGER owned_revoke_failure BEFORE UPDATE OF usedAt ON magic_links BEGIN SELECT RAISE(ABORT, 'owned revocation failure'); END");
    await expect(sqliteAuthStore.resetPasswordWithLink(link.token, 'MustNotCommit!2026')).rejects.toThrow('owned revocation failure');
    const after = await sqliteAuthStore.findUserByEmailOrUsername(email);
    expect(after!.passwordHash).toBe(before!.passwordHash);
    expect(after!.authVersion).toBe(before!.authVersion);
    expect(await row('SELECT usedAt FROM magic_links WHERE id=?', [link.id])).toEqual({ usedAt: null });
  });

  it('migrates old tables by rejecting untyped links and keeps legacy JWTs revocable', async () => {
    const account = await sqliteAuthStore.findUserByEmailOrUsername(email);
    for (const statement of [
      'DROP TRIGGER revoke_links_on_auth_version',
      'ALTER TABLE magic_links DROP COLUMN authVersion',
      'ALTER TABLE magic_links DROP COLUMN purpose',
      'ALTER TABLE users DROP COLUMN authVersion',
      'ALTER TABLE users DROP COLUMN deactivationDate',
    ]) await execute(statement);
    await execute('INSERT INTO magic_links(id,email,token,expiresAt,createdAt) VALUES(?,?,?,?,?)',
      ['owned-legacy-link', email, 'owned-legacy-token', new Date(Date.now() + 60000).toISOString(), new Date().toISOString()]);
    store.initialized = false;
    await sqliteAuthStore.initialize();
    expect((await row<{ usedAt: string }>('SELECT usedAt FROM magic_links WHERE id=?', ['owned-legacy-link'])).usedAt).toBeTruthy();
    expect(await sqliteAuthStore.verifyMagicLink('owned-legacy-token')).toEqual({ valid: false });
    expect((await reset('owned-legacy-token')).status).toBe(400);
    const legacy = jwt.sign({ userId: account!.id, email, role: account!.role }, signingSecret, { expiresIn: '10m' });
    expect((await graphRequest('{me{id}}', legacy)).data.me.id).toBe(account!.id);
    await sqliteAuthStore.updateUserPassword(account!.id, 'MigrationReset!2026');
    expect((await graphRequest('{me{id}}', legacy)).data.me).toBeNull();
    await expect(socketMe(socket(legacy).client)).rejects.toThrow('WebSocket authentication rejected');
  });

  it('rejects refresh with an authorization snapshot captured before reset', async () => {
    const account = await sqliteAuthStore.findUserByEmailOrUsername(email);
    const token = generateToken(account!.id, email, account!.role, account!.authVersion);
    const user = await resolveActiveAuthUser(`Bearer ${token}`);
    await sqliteAuthStore.updateUserPassword(account!.id, 'RefreshFence!2026');
    await expect(sqliteAuthResolvers.Mutation.refreshToken(null, {}, { user })).rejects.toThrow('Session expired');
    const response = await graphRequest('mutation { refreshToken { token } }', token);
    expect(response.errors?.[0].extensions.code).toBe('UNAUTHENTICATED');
  });

  it('does not upgrade a consumed login link to the new revision if reset wins before identity lookup', async () => {
    const account = await sqliteAuthStore.findUserByEmailOrUsername(email);
    const link = await sqliteAuthStore.createMagicLink(email, 'login');
    const lookup = sqliteAuthStore.findUserByEmailOrUsername.bind(sqliteAuthStore);
    vi.spyOn(sqliteAuthStore, 'findUserByEmailOrUsername').mockImplementationOnce(async value => {
      await sqliteAuthStore.updateUserPassword(account!.id, 'IdentityFence!2026');
      return lookup(value);
    });
    expect(await sqliteAuthStore.verifyMagicLink(link.token)).toEqual({ valid: false });
  });

  it('checks reset expiry when SQLite executes a delayed password write', async () => {
    const account = await sqliteAuthStore.findUserByEmailOrUsername(email);
    const link = await sqliteAuthStore.createMagicLink(email, 'password-reset');
    const originalRun = database.run.bind(database);
    let release!: () => void;
    const queued = new Promise<void>(resolve => {
      vi.spyOn(database, 'run').mockImplementationOnce((sql: string, ...args: unknown[]) => {
        release = () => { originalRun(sql, ...args); };
        resolve();
        return database;
      });
    });
    const pending = sqliteAuthStore.resetPasswordWithLink(link.token, 'ExpiredWrite!2026');
    await queued;
    await execute('UPDATE magic_links SET expiresAt=? WHERE id=?', ['2000-01-01T00:00:00.000Z', link.id]);
    release();
    expect(await pending).toBe(false);
    const after = await sqliteAuthStore.findUserByEmailOrUsername(email);
    expect(after!.passwordHash).toBe(account!.passwordHash);
    expect(after!.authVersion).toBe(account!.authVersion);
  });

  it('rejects signed but malformed revision claims', async () => {
    const account = await sqliteAuthStore.findUserByEmailOrUsername(email);
    for (const authVersion of [-1, 0.5, '0', null, Number.MAX_SAFE_INTEGER + 1]) {
      const token = jwt.sign({ userId: account!.id, email, role: account!.role, authVersion }, signingSecret);
      expect((await graphRequest('{me{id}}', token)).data.me).toBeNull();
    }
  });

  it('does not upgrade an in-flight password login when reset changes the authenticated snapshot', async () => {
    const account = await sqliteAuthStore.findUserByEmailOrUsername(email);
    const validate = sqliteAuthStore.validatePassword.bind(sqliteAuthStore);
    vi.spyOn(sqliteAuthStore, 'validatePassword').mockImplementationOnce(async (user, password) => {
      await sqliteAuthStore.updateUserPassword(account!.id, 'PasswordSnapshotFence!2026');
      return validate(user, password);
    });
    const result = await graphRequest('mutation($input:LoginInput!){login(input:$input){token}}', undefined,
      { input: { emailOrUsername: 'admin', password: 'OwnedPurposeFixture!2026' } });
    expect(result.errors).toBeUndefined();
    expect(verifyToken(result.data.login.token).authVersion).toBe(0);
    expect((await graphRequest('{me{id}}', result.data.login.token)).data.me).toBeNull();
  });
});
