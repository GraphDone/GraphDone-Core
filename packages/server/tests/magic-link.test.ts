import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import sqlite3 from 'sqlite3';
import { sqliteAuthStore } from '../src/auth/sqlite-auth.js';

let db: sqlite3.Database;
const email = 'magic-link-fixture@graphdone.invalid';
const store = sqliteAuthStore as unknown as { db: sqlite3.Database | null; initialized: boolean };
const execute = (sql: string, values: unknown[] = []) => new Promise<void>((resolve, reject) => {
  db.run(sql, values, error => error ? reject(error) : resolve());
});
const row = <T>(sql: string, values: unknown[] = []) => new Promise<T>((resolve, reject) => {
  db.get(sql, values, (error, result: T) => error ? reject(error) : resolve(result));
});

beforeEach(async () => {
  vi.stubEnv('NODE_ENV', 'test');
  vi.stubEnv('ADMIN_EMAIL', email);
  vi.stubEnv('ADMIN_PASSWORD', 'disposable-magic-link-fixture');
  db = await new Promise<sqlite3.Database>((resolve, reject) => {
    const connection = new sqlite3.Database(':memory:', error => error ? reject(error) : resolve(connection));
  });
  store.db = db;
  store.initialized = false;
  await sqliteAuthStore.initialize();
});

afterEach(async () => {
  vi.restoreAllMocks();
  await new Promise<void>((resolve, reject) => db.close(error => error ? reject(error) : resolve()));
  store.db = null;
  store.initialized = false;
  vi.unstubAllEnvs();
});

describe('single-use magic links in real SQLite', () => {
  it('permits exactly one concurrent redemption for an existing account', async () => {
    const account = await sqliteAuthStore.findUserByEmailOrUsername(email);
    const link = await sqliteAuthStore.createMagicLink(email, 'login');
    const results = await Promise.all(Array.from({ length: 12 }, () => sqliteAuthStore.verifyMagicLink(link.token)));
    expect(results.filter(result => result.valid)).toEqual([{ valid: true, email, userId: account!.id, authVersion: 0, role: 'ADMIN' }]);
    expect(results.filter(result => !result.valid)).toHaveLength(11);
    expect((await row<{ usedAt: string }>('SELECT usedAt FROM magic_links WHERE id=?', [link.id])).usedAt).toBeTruthy();
    expect(await sqliteAuthStore.verifyMagicLink(link.token)).toEqual({ valid: false });
  });

  it('creates one new account when a fresh link is redeemed concurrently', async () => {
    const newEmail = 'new-magic-link-fixture@graphdone.invalid';
    const link = await sqliteAuthStore.createMagicLink(newEmail, 'login');
    const results = await Promise.all(Array.from({ length: 12 }, () => sqliteAuthStore.verifyMagicLink(link.token)));
    const account = await sqliteAuthStore.findUserByEmailOrUsername(newEmail);
    expect(results.filter(result => result.valid)).toEqual([{ valid: true, email: newEmail, userId: account!.id, authVersion: 0, role: 'USER' }]);
    expect(results.filter(result => !result.valid)).toHaveLength(11);
    expect(await row('SELECT COUNT(*) AS count FROM users WHERE email=?', [newEmail])).toEqual({ count: 1 });
    expect(account?.isActive).toBe(true);
  });

  it('allows independent valid links to identify the same existing account', async () => {
    const links = await Promise.all([sqliteAuthStore.createMagicLink(email, 'login'), sqliteAuthStore.createMagicLink(email, 'login')]);
    const results = await Promise.all(links.map(link => sqliteAuthStore.verifyMagicLink(link.token)));
    expect(results.every(result => result.valid)).toBe(true);
    expect(results[0].userId).toBe(results[1].userId);
  });

  it.each(['expired', 'used', 'missing'])('rejects an %s link without changing its record', async state => {
    const link = await sqliteAuthStore.createMagicLink(email, 'login');
    if (state === 'expired') await execute('UPDATE magic_links SET expiresAt=? WHERE id=?', ['2000-01-01T00:00:00.000Z', link.id]);
    if (state === 'used') await execute('UPDATE magic_links SET usedAt=? WHERE id=?', ['2000-01-01T00:00:00.000Z', link.id]);
    const before = await row('SELECT * FROM magic_links WHERE id=?', [link.id]);
    expect(await sqliteAuthStore.verifyMagicLink(state === 'missing' ? 'missing-fixture-token' : link.token)).toEqual({ valid: false });
    expect(await row('SELECT * FROM magic_links WHERE id=?', [link.id])).toEqual(before);
  });

  it('rejects a link that expires while its consumption write is delayed', async () => {
    const link = await sqliteAuthStore.createMagicLink(email, 'login');
    const originalRun = db.run.bind(db);
    let release!: () => void;
    const queued = new Promise<void>(resolve => {
      vi.spyOn(db, 'run').mockImplementationOnce((sql: string, ...args: unknown[]) => {
        release = () => { originalRun(sql, ...args); };
        resolve();
        return db;
      });
    });
    const redemption = sqliteAuthStore.verifyMagicLink(link.token);
    await queued;
    await execute('UPDATE magic_links SET expiresAt=? WHERE id=?', [new Date(Date.now() + 25).toISOString(), link.id]);
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(await row("SELECT expiresAt <= strftime('%Y-%m-%dT%H:%M:%fZ', 'now') AS expired FROM magic_links WHERE id=?", [link.id])).toEqual({ expired: 1 });
    release();
    expect(await redemption).toEqual({ valid: false });
    expect(await row('SELECT usedAt FROM magic_links WHERE id=?', [link.id])).toEqual({ usedAt: null });
  });

  it('rejects an inactive account and keeps its consumed link unusable after reactivation', async () => {
    const account = await sqliteAuthStore.findUserByEmailOrUsername(email);
    const link = await sqliteAuthStore.createMagicLink(email, 'login');
    await sqliteAuthStore.updateUserStatus(account!.id, false);
    await expect(sqliteAuthStore.createMagicLink(email, 'login')).rejects.toThrow('Email link unavailable');
    expect(await sqliteAuthStore.verifyMagicLink(link.token)).toEqual({ valid: false });
    await sqliteAuthStore.updateUserStatus(account!.id, true);
    expect(await sqliteAuthStore.verifyMagicLink(link.token)).toEqual({ valid: false });
  });

  it('rejects lookup database errors without issuing identity', async () => {
    await execute('DROP TABLE magic_links');
    await expect(sqliteAuthStore.verifyMagicLink('missing-fixture-token')).rejects.toThrow('no such table');
  });

  it('awaits consumption errors and allows a retry only after the failed update is repaired', async () => {
    const link = await sqliteAuthStore.createMagicLink(email, 'login');
    await execute("CREATE TRIGGER reject_magic_consumption BEFORE UPDATE OF usedAt ON magic_links BEGIN SELECT RAISE(ABORT, 'fixture consumption failure'); END");
    await expect(sqliteAuthStore.verifyMagicLink(link.token)).rejects.toThrow('fixture consumption failure');
    expect(await row('SELECT usedAt FROM magic_links WHERE id=?', [link.id])).toEqual({ usedAt: null });
    await execute('DROP TRIGGER reject_magic_consumption');
    expect((await sqliteAuthStore.verifyMagicLink(link.token)).valid).toBe(true);
    expect(await sqliteAuthStore.verifyMagicLink(link.token)).toEqual({ valid: false });
  });

  it('fails closed if identity lookup fails after the token was consumed', async () => {
    const link = await sqliteAuthStore.createMagicLink(email, 'login');
    const schema = await row<{ sql: string }>("SELECT sql FROM sqlite_master WHERE name='user_teams'");
    await execute('DROP TABLE user_teams');
    await expect(sqliteAuthStore.verifyMagicLink(link.token)).rejects.toThrow('no such table');
    expect((await row<{ usedAt: string }>('SELECT usedAt FROM magic_links WHERE id=?', [link.id])).usedAt).toBeTruthy();
    await execute(schema.sql);
    expect(await sqliteAuthStore.verifyMagicLink(link.token)).toEqual({ valid: false });
  });
});
