import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import express from 'express';
import { createServer, type Server } from 'node:http';
import { createHash } from 'node:crypto';
import {
  SessionHandoverStore, sessionHandovers, redirectWithHandover, previewHandoverHandler, completeHandoverHandler,
} from '../src/auth/session-handover';

const session = { token: 'owned-session-jwt', account: 'owned@example.invalid' };
const digest = (code: string) => createHash('sha256').update(code).digest('hex');

describe('one-time session handover codes', () => {
  it('issues a long random URL-safe code and stores only its hash', () => {
    const store = new SessionHandoverStore();
    const code = store.issue(session);
    expect(code).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(store.issue(session)).not.toBe(code);
    expect([...store.entries.keys()]).toContain(digest(code));
    expect(JSON.stringify([...store.entries])).not.toContain(code);
  });

  it('previews without consuming and completes exactly once', () => {
    const store = new SessionHandoverStore();
    const code = store.issue(session);
    expect(store.preview(code)).toBe('owned@example.invalid');
    expect(store.preview(code)).toBe('owned@example.invalid');
    expect(store.complete(code)).toBe('owned-session-jwt');
    expect(store.complete(code)).toBeNull();
    expect(store.preview(code)).toBeNull();
    expect(store.entries.size).toBe(0);
  });

  it('refuses unknown, malformed and expired codes and sweeps expired entries', () => {
    let now = 1_000;
    const store = new SessionHandoverStore({ now: () => now });
    const code = store.issue(session);
    for (const value of [undefined, null, 42, '', 'owned-unknown-code', { code }]) {
      expect(store.preview(value)).toBeNull();
      expect(store.complete(value)).toBeNull();
    }
    now += 119_999;
    expect(store.preview(code)).toBe('owned@example.invalid');
    now += 1;
    expect(store.preview(code)).toBeNull();
    expect(store.complete(code)).toBeNull();
    expect(store.entries.size).toBe(0);
  });

  it('caps the number of pending codes by dropping the oldest', () => {
    const store = new SessionHandoverStore({ limit: 3 });
    const codes = [1, 2, 3, 4].map(n => store.issue({ token: `owned-jwt-${n}`, account: `owned-${n}` }));
    expect(store.entries.size).toBe(3);
    expect(store.complete(codes[0])).toBeNull();
    expect(codes.slice(1).map(code => store.complete(code))).toEqual(['owned-jwt-2', 'owned-jwt-3', 'owned-jwt-4']);
  });
});

describe('session handover over HTTP', () => {
  let server: Server;
  let endpoint: string;

  beforeEach(async () => {
    const app = express();
    app.get('/redirect', (_req, res) => redirectWithHandover(res, session));
    app.post('/preview', express.json(), previewHandoverHandler);
    app.post('/complete', express.json(), completeHandoverHandler);
    server = createServer(app);
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Owned handover server has no port');
    endpoint = `http://127.0.0.1:${address.port}`;
  });
  afterEach(async () => {
    sessionHandovers.entries.clear();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  });

  const post = (step: string, body: unknown) => fetch(`${endpoint}/${step}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  });

  it('redirects to the sign-in page with the code in the fragment only', async () => {
    const response = await fetch(`${endpoint}/redirect`, { redirect: 'manual' });
    expect(response.status).toBe(302);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('referrer-policy')).toBe('no-referrer');
    const location = new URL(response.headers.get('location')!);
    expect(`${location.origin}${location.pathname}${location.search}`).toBe('http://localhost:3127/login');
    expect(location.hash).toMatch(/^#handover=[A-Za-z0-9_-]{43}$/);
    expect(response.headers.get('location')).not.toContain('owned-session-jwt');
  });

  it('previews the account, then completes once with the session', async () => {
    const location = new URL((await fetch(`${endpoint}/redirect`, { redirect: 'manual' })).headers.get('location')!);
    const code = location.hash.slice('#handover='.length);
    for (let attempt = 0; attempt < 2; attempt++) {
      const preview = await post('preview', { code });
      expect(preview.status).toBe(200);
      expect(preview.headers.get('cache-control')).toBe('no-store');
      expect(await preview.json()).toEqual({ account: 'owned@example.invalid' });
    }
    const complete = await post('complete', { code });
    expect(complete.status).toBe(200);
    expect(complete.headers.get('cache-control')).toBe('no-store');
    expect(await complete.json()).toEqual({ token: 'owned-session-jwt' });
    for (const step of ['complete', 'preview']) {
      const again = await post(step, { code });
      expect(again.status).toBe(400);
      expect(again.headers.get('cache-control')).toBe('no-store');
      expect(await again.json()).toEqual({ error: 'invalid_handover' });
    }
  });

  it('refuses unknown and malformed codes', async () => {
    for (const body of [{}, { code: 'owned-unknown-code' }, { code: 7 }, []]) {
      for (const step of ['preview', 'complete']) {
        const response = await post(step, body);
        expect(response.status).toBe(400);
        expect(await response.json()).toEqual({ error: 'invalid_handover' });
      }
    }
  });
});
