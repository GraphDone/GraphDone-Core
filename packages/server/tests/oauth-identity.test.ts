import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sqlite3 from 'sqlite3';
import express from 'express';
import { createServer } from 'node:http';
import { sqliteAuthStore } from '../src/auth/sqlite-auth';
import { oauthLoginCallback } from '../src/auth/oauth-callback';
import { verifyToken } from '../src/utils/auth';
import passport from 'passport';
import { configureOAuthStrategies } from '../src/auth/oauth-strategies';
import { sqliteAuthResolvers } from '../src/resolvers/sqlite-auth';
import { resolveActiveAuthUser } from '../src/middleware/auth';

let directory: string;
let database: sqlite3.Database;
const store = sqliteAuthStore as unknown as { db: sqlite3.Database | null; initialized: boolean };
const execute = (sql: string, values: unknown[] = []) => new Promise<void>((resolve, reject) => {
  database.run(sql, values, error => error ? reject(error) : resolve());
});
const row = <T>(sql: string, values: unknown[] = []) => new Promise<T>((resolve, reject) => {
  database.get(sql, values, (error, result: T) => error ? reject(error) : resolve(result));
});
const identity = (changes = {}) => ({ provider: 'github', providerId: 'owned-provider-subject',
  email: 'owned-oauth@example.invalid', name: 'Owned OAuth user', emailVerified: true, canLinkByEmail: true, ...changes });

beforeEach(async () => {
  vi.stubEnv('NODE_ENV', 'test');
  vi.stubEnv('ADMIN_EMAIL', 'oauth-admin@example.invalid');
  vi.stubEnv('ADMIN_PASSWORD', 'OwnedOAuthFixture!2026');
  vi.stubEnv('CLIENT_URL', 'http://localhost:3127');
  vi.spyOn(console, 'log').mockImplementation(() => {});
  directory = await mkdtemp(join(tmpdir(), 'graphdone-oauth-'));
  database = await new Promise((resolve, reject) => {
    const connection = new sqlite3.Database(join(directory, 'auth.db'), error => error ? reject(error) : resolve(connection));
  });
  store.db = database; store.initialized = false;
  await sqliteAuthStore.initialize();
});

afterEach(async () => {
  await new Promise<void>((resolve, reject) => database.close(error => error ? reject(error) : resolve()));
  store.db = null; store.initialized = false;
  await rm(directory, { recursive: true, force: true });
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('OAuth account identity boundary', () => {
  it('rejects unverified email collisions without linking an existing account', async () => {
    await expect(sqliteAuthStore.findOrCreateUserFromOAuth(identity({ email: 'oauth-admin@example.invalid', emailVerified: false })))
      .rejects.toThrow();
    expect(await row('SELECT count(*) AS count FROM oauth_providers')).toEqual({ count: 0 });
  });

  it('does not relink a disabled provider subject through a different active email', async () => {
    const first = await sqliteAuthStore.findOrCreateUserFromOAuth(identity());
    await sqliteAuthStore.updateUserStatus(first.id, false);
    await expect(sqliteAuthStore.findOrCreateUserFromOAuth(identity({ email: 'oauth-admin@example.invalid' }))).rejects.toThrow();
    expect(await row('SELECT userId FROM oauth_providers WHERE providerId = ?', ['owned-provider-subject']))
      .toEqual({ userId: first.id });
  });

  it('rolls back a new user if provider linking fails', async () => {
    await execute("CREATE TRIGGER reject_owned_link BEFORE INSERT ON oauth_providers BEGIN SELECT RAISE(ABORT, 'Owned link failure'); END");
    await expect(sqliteAuthStore.findOrCreateUserFromOAuth(identity())).rejects.toThrow();
    expect(await row('SELECT count(*) AS count FROM users WHERE email = ?', ['owned-oauth@example.invalid'])).toEqual({ count: 0 });
  });

  it('preserves a bound subject when its email changes or is absent', async () => {
    const first = await sqliteAuthStore.findOrCreateUserFromOAuth(identity());
    for (const address of ['oauth-admin@example.invalid', undefined]) {
      const user = await sqliteAuthStore.findOrCreateUserFromOAuth(identity({ email: address, emailVerified: false, canLinkByEmail: false }));
      expect(user.id).toBe(first.id);
      expect(user.email).toBe(first.email);
    }
    expect(await row('SELECT count(*) AS count FROM users WHERE email = ?', [first.email])).toEqual({ count: 1 });
  });

  it('requires exact verified and authoritative claims for a new binding', async () => {
    for (const changes of [{ emailVerified: 'true' }, { canLinkByEmail: false }, { email: undefined }, { providerId: '' }]) {
      await expect(sqliteAuthStore.findOrCreateUserFromOAuth(identity(changes))).rejects.toThrow();
    }
    expect(await row('SELECT count(*) AS count FROM oauth_providers')).toEqual({ count: 0 });
  });

  it('links a verified email without confusing a matching username for ownership', async () => {
    const admin = await sqliteAuthStore.findUserByEmailOrUsername('oauth-admin@example.invalid');
    expect(admin!.isEmailVerified).toBe(true);
    await execute('UPDATE users SET username = ? WHERE id = ?', ['owned-oauth@example.invalid', admin!.id]);
    const created = await sqliteAuthStore.findOrCreateUserFromOAuth(identity());
    expect(created.id).not.toBe(admin!.id);
    const linked = await sqliteAuthStore.findOrCreateUserFromOAuth(identity({ providerId: 'owned-admin-subject', email: admin!.email }));
    expect(linked.id).toBe(admin!.id);
  });

  it('rejects linking to a preregistered unverified account with another password and session', async () => {
    const account = await sqliteAuthStore.createUser({ email: 'owned-oauth@example.invalid', username: 'preregistered',
      password: 'PreRegisteredPassword!2026', name: 'Unverified registration' });
    expect(account.isEmailVerified).toBe(false);
    const login = await sqliteAuthResolvers.Mutation.login(null,
      { input: { emailOrUsername: account.email, password: 'PreRegisteredPassword!2026' } }, { req: { ip: '127.0.0.77' } } as any);
    expect((await resolveActiveAuthUser(`Bearer ${login.token}`))?.userId).toBe(account.id);
    await expect(sqliteAuthStore.findOrCreateUserFromOAuth(identity())).rejects.toThrow('Existing account recovery required');
    expect(await row('SELECT count(*) AS count FROM oauth_providers WHERE userId = ?', [account.id])).toEqual({ count: 0 });
    expect((await sqliteAuthStore.findUserById(account.id))!.isEmailVerified).toBe(false);
  });

  it('rejects verified email linking to a disabled account', async () => {
    const admin = await sqliteAuthStore.findUserByEmailOrUsername('oauth-admin@example.invalid');
    await sqliteAuthStore.updateUserStatus(admin!.id, false);
    await expect(sqliteAuthStore.findOrCreateUserFromOAuth(identity({ email: admin!.email }))).rejects.toThrow('Account unavailable');
  });

  it('serializes simultaneous first logins without orphan users or duplicate bindings', async () => {
    const users = await Promise.all(Array.from({ length: 8 }, () => sqliteAuthStore.findOrCreateUserFromOAuth(identity())));
    expect(new Set(users.map(user => user.id)).size).toBe(1);
    expect(await row('SELECT count(*) AS count FROM users WHERE email = ?', ['owned-oauth@example.invalid'])).toEqual({ count: 1 });
    expect(await row('SELECT count(*) AS count FROM oauth_providers')).toEqual({ count: 1 });
  });

  it('rejects a revision changed after the identity transaction instead of minting a newer session', async () => {
    const find = sqliteAuthStore.findUserById.bind(sqliteAuthStore);
    vi.spyOn(sqliteAuthStore, 'findUserById').mockImplementationOnce(async id => {
      await execute('UPDATE users SET authVersion = authVersion + 1 WHERE id = ?', [id]);
      return find(id);
    });
    await expect(sqliteAuthStore.findOrCreateUserFromOAuth(identity())).rejects.toThrow('Account changed');
  });

  it('waits outside an unrelated transaction without joining its rollback', async () => {
    await execute('BEGIN IMMEDIATE');
    const original = sqlite3.Database.prototype.run;
    let attempted = false;
    vi.spyOn(sqlite3.Database.prototype, 'run').mockImplementation(function (this: sqlite3.Database, ...args: any[]) {
      if (this !== database && args[0] === 'BEGIN IMMEDIATE') attempted = true;
      return original.apply(this, args as any);
    });
    const authentication = sqliteAuthStore.findOrCreateUserFromOAuth(identity());
    try {
      await vi.waitFor(() => expect(attempted).toBe(true));
      await execute('UPDATE users SET name = ? WHERE email = ?', ['Uncommitted change', 'oauth-admin@example.invalid']);
    } finally { await execute('ROLLBACK'); }
    const user = await authentication;
    expect(await sqliteAuthStore.findUserById(user.id)).not.toBeNull();
    expect((await sqliteAuthStore.findUserByEmailOrUsername('oauth-admin@example.invalid'))!.name).not.toBe('Uncommitted change');
  });

  it('issues the actual HTTP callback token without logging credentials and rejects stale snapshots', async () => {
    let authenticated = await sqliteAuthStore.findOrCreateUserFromOAuth(identity());
    const app = express();
    app.get('/callback', (req, _res, next) => { req.user = authenticated; next(); }, oauthLoginCallback);
    const server = createServer(app);
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Owned callback server has no address');
    const url = `http://127.0.0.1:${address.port}/callback`;
    const log = vi.mocked(console.log);
    log.mockClear();
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const result = await fetch(url, { redirect: 'manual' });
      expect(result.status).toBe(302);
      expect(result.headers.get('cache-control')).toBe('no-store');
      expect(result.headers.get('referrer-policy')).toBe('no-referrer');
      const redirect = new URL(result.headers.get('location')!);
      expect(redirect.origin).toBe('http://localhost:3127');
      expect(verifyToken(redirect.searchParams.get('token')!)).toMatchObject({ userId: authenticated.id, authVersion: 0 });
      expect(log).not.toHaveBeenCalled(); expect(error).not.toHaveBeenCalled(); expect(warn).not.toHaveBeenCalled();
      await sqliteAuthStore.updateUserStatus(authenticated.id, false);
      expect((await fetch(url, { redirect: 'manual' })).status).toBe(401);
      await sqliteAuthStore.updateUserStatus(authenticated.id, true);
      expect((await fetch(url, { redirect: 'manual' })).status).toBe(401);
      authenticated = await sqliteAuthStore.findOrCreateUserFromOAuth(identity());
      expect((await fetch(url, { redirect: 'manual' })).status).toBe(302);
    } finally {
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
  });

  it.each(['google', 'github', 'linkedin'])('enforces verified linking and subject continuity in the %s callback', async provider => {
    for (const name of ['GOOGLE', 'GITHUB', 'LINKEDIN']) {
      vi.stubEnv(`${name}_CLIENT_ID`, name.toLowerCase() === provider ? 'owned-client' : '');
      vi.stubEnv(`${name}_CLIENT_SECRET`, 'owned-client-secret');
    }
    const authenticator = new passport.Passport();
    configureOAuthStrategies(authenticator);
    const strategy = (authenticator as any)._strategy(provider);
    const authenticate = (subject: string, address: string | undefined, verified: boolean) => new Promise<any>((resolve, reject) => {
      const profile = { id: subject, displayName: 'Owned provider user',
        _json: { sub: subject, email: address, email_verified: verified, hd: 'example.invalid' },
        emails: address ? [{ value: address, primary: true, verified }] : [],
      };
      vi.stubGlobal('fetch', vi.fn(async (url: string) => {
        await new Promise<void>(resolve => setImmediate(resolve));
        const data = url.includes('/user/emails') ? (address ? [{ email: address, primary: true, verified }] : []) :
          { ...profile._json, id: subject, name: profile.displayName };
        return new Response(JSON.stringify(data), { headers: { 'content-type': 'application/json' } });
      }));
      const done = (error: Error | null, user: unknown) => error ? reject(error) : resolve(user);
      if (provider === 'linkedin') strategy._verify('https://www.linkedin.com', profile, { id: subject }, {}, '', '', '', {}, done);
      else strategy._verify('owned-access-token', 'owned-refresh-token', profile, done);
    });
    await expect(authenticate('new-unproved-subject', 'oauth-admin@example.invalid', false)).rejects.toThrow();
    await expect(authenticate('new-missing-email', undefined, false)).rejects.toThrow();
    const user = await authenticate('owned-subject', 'owned-oauth@example.invalid', true);
    expect((await authenticate('owned-subject', undefined, false)).id).toBe(user.id);
    expect((await authenticate('owned-subject', 'oauth-admin@example.invalid', true)).id).toBe(user.id);
    expect(await row('SELECT accessToken, refreshToken, profile FROM oauth_providers WHERE provider = ?', [provider]))
      .toEqual({ accessToken: null, refreshToken: null, profile: null });
    await sqliteAuthStore.updateUserStatus(user.id, false);
    await expect(authenticate('owned-subject', 'oauth-admin@example.invalid', true)).rejects.toThrow('Account unavailable');
  });
});
