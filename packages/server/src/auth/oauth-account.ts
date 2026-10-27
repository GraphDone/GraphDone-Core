import sqlite3 from 'sqlite3';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { validateOAuthIdentity, type OAuthIdentity } from './oauth-identity.js';

const pending = new Map<string, Promise<void>>();

async function serializeWrite<T>(filename: string, write: () => Promise<T>): Promise<T> {
  const previous = pending.get(filename) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>(resolve => { release = resolve; });
  pending.set(filename, current);
  await previous;
  try { return await write(); }
  finally {
    release();
    if (pending.get(filename) === current) pending.delete(filename);
  }
}

export async function resolveOAuthAccount(database: sqlite3.Database, identity: OAuthIdentity): Promise<{ id: string; authVersion: number }> {
  validateOAuthIdentity(identity);
  const files = await new Promise<Array<{ name: string; file: string }>>((resolve, reject) => {
    database.all('PRAGMA database_list', (error, rows: Array<{ name: string; file: string }>) => error ? reject(error) : resolve(rows));
  });
  const filename = files.find(file => file.name === 'main')?.file;
  if (!filename) throw new Error('OAuth account linking requires a persistent authentication database');
  return serializeWrite(filename, async () => {
    const passwordHash = await bcrypt.hash(randomUUID(), 10);
    const connection = await new Promise<sqlite3.Database>((resolve, reject) => {
      const opened = new sqlite3.Database(filename, sqlite3.OPEN_READWRITE, error => error ? reject(error) : resolve(opened));
    });
    connection.configure('busyTimeout', 0);
    const run = (sql: string, values: unknown[] = []) => new Promise<void>((resolve, reject) => {
      connection.run(sql, values, error => error ? reject(error) : resolve());
    });
    const get = <T>(sql: string, values: unknown[] = []) => new Promise<T | undefined>((resolve, reject) => {
      connection.get(sql, values, (error, row: T) => error ? reject(error) : resolve(row));
    });
    const writeBoundary = async (sql: string) => {
      const deadline = Date.now() + 5000;
      while (true) {
        try { await run(sql); return; }
        catch (error) {
          if ((error as { code?: string }).code !== 'SQLITE_BUSY' || Date.now() >= deadline) throw error;
          await delay(10);
        }
      }
    };
    let transaction = false;
    try {
      await run('PRAGMA foreign_keys = ON');
      await writeBoundary('BEGIN IMMEDIATE');
      transaction = true;
      const bound = await get<{ id: string; authVersion: number; isActive: number }>(
        'SELECT u.id, u.authVersion, u.isActive FROM oauth_providers op JOIN users u ON u.id = op.userId WHERE op.provider = ? AND op.providerId = ?',
        [identity.provider, identity.providerId]);
      let account = bound;
      if (bound && !bound.isActive) throw new Error('Account unavailable');
      if (!account) {
        if (!identity.email || identity.emailVerified !== true || identity.canLinkByEmail !== true) {
          throw new Error('Verified provider email required; use an existing sign-in method');
        }
        const matches = await get<{ count: number }>('SELECT count(*) AS count FROM users WHERE lower(email) = ?', [identity.email]);
        if (matches && matches.count > 1) throw new Error('Account unavailable');
        const existing = await get<{ id: string; authVersion: number; isActive: number; isEmailVerified: number }>(
          'SELECT id, authVersion, isActive, isEmailVerified FROM users WHERE lower(email) = ?', [identity.email]);
        account = existing;
        if (account && !account.isActive) throw new Error('Account unavailable');
        if (existing && existing.isEmailVerified !== 1) throw new Error('Existing account recovery required');
        const now = new Date().toISOString();
        if (!account) {
          const id = randomUUID();
          await run('INSERT INTO users (id, email, username, name, role, passwordHash, createdAt, updatedAt, isActive, isEmailVerified) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 1)',
            [id, identity.email, `oauth_${randomUUID()}`, identity.name, 'USER', passwordHash, now, now]);
          account = { id, authVersion: 0, isActive: 1 };
        }
        await run('INSERT INTO oauth_providers (id, userId, provider, providerId, email, name, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [randomUUID(), account.id, identity.provider, identity.providerId, identity.email, identity.name, now, now]);
      }
      await writeBoundary('COMMIT');
      transaction = false;
      return { id: account.id, authVersion: account.authVersion };
    } finally {
      try { if (transaction) await run('ROLLBACK'); }
      finally { await new Promise<void>((resolve, reject) => connection.close(error => error ? reject(error) : resolve())); }
    }
  });
}
