import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import passport from 'passport';
import { configureOAuthStrategies } from '../src/auth/oauth-strategies';
import { sqliteAuthStore } from '../src/auth/sqlite-auth';

beforeEach(() => {
  for (const provider of ['GOOGLE', 'GITHUB', 'LINKEDIN']) {
    vi.stubEnv(`${provider}_CLIENT_ID`, '');
    vi.stubEnv(`${provider}_CLIENT_SECRET`, '');
  }
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

function strategyFor(provider: string) {
  vi.stubEnv(`${provider.toUpperCase()}_CLIENT_ID`, 'owned-client');
  vi.stubEnv(`${provider.toUpperCase()}_CLIENT_SECRET`, 'owned-client-secret');
  const authenticator = new passport.Passport();
  configureOAuthStrategies(authenticator);
  return (authenticator as any)._strategy(provider);
}

async function authorize(strategy: any) {
  const session = {};
  const url = await new Promise<string>((resolve, reject) => {
    strategy.redirect = resolve;
    strategy.error = reject;
    strategy.authenticate({ query: {}, session, headers: { host: 'localhost' }, connection: {} }, {});
  });
  const state = new URL(url).searchParams.get('state');
  expect(state).toBeTruthy();
  return { session, state };
}

function callback(strategy: any, session: object, state: string | null) {
  return new Promise<{ user?: unknown; failed?: boolean }>((resolve, reject) => {
    strategy.success = (user: unknown) => resolve({ user });
    strategy.fail = () => resolve({ failed: true });
    strategy.error = reject;
    strategy.authenticate({ query: { code: 'owned-code', state }, session, headers: { host: 'localhost' }, connection: {} }, {});
  });
}

describe('actual Passport provider flows', () => {
  it.each(['google', 'github', 'linkedin'])('requires session-bound state before %s token exchange', async provider => {
    const strategy = strategyFor(provider);
    const { session } = await authorize(strategy);
    const exchange = vi.fn();
    strategy._oauth2.getOAuthAccessToken = exchange;
    expect(await callback(strategy, session, 'wrong-state')).toEqual({ failed: true });
    expect(exchange).not.toHaveBeenCalled();
  });

  it.each(['google', 'github', 'linkedin'])('loads and checks real %s profile parsing before account lookup', async provider => {
    const strategy = strategyFor(provider);
    const { session, state } = await authorize(strategy);
    const store = vi.spyOn(sqliteAuthStore, 'findOrCreateUserFromOAuth').mockResolvedValue({ id: 'owned-user' } as any);
    const claims = { iss: 'https://www.linkedin.com', sub: 'owned-subject', aud: 'owned-client',
      exp: Math.floor(Date.now() / 1000) + 300, iat: Math.floor(Date.now() / 1000) };
    const idToken = ['eyJhbGciOiJSUzI1NiJ9', Buffer.from(JSON.stringify(claims)).toString('base64url'), 'owned-signature'].join('.');
    strategy._oauth2.getOAuthAccessToken = vi.fn((_code, _options, done) => setImmediate(() => done(null, 'owned-access-token', 'owned-refresh-token', { id_token: idToken })));
    const request = vi.fn((url: string, _token: string, done: (...args: any[]) => void) => {
      const data = url.includes('/user/emails') ? [{ email: 'owned@gmail.com', primary: true, verified: true }] :
        { ...claims, id: 'owned-subject', email: 'owned@gmail.com', email_verified: true, name: 'Owned user' };
      setImmediate(() => done(null, JSON.stringify(data), {}));
    });
    strategy._oauth2.get = request;
    const fetchProfile = vi.fn(async (url: string) => {
      await new Promise<void>(resolve => setImmediate(resolve));
      const data = url.includes('/user/emails') ? [{ email: 'owned@gmail.com', primary: true, verified: true }] :
        { ...claims, id: 'owned-subject', email: 'owned@gmail.com', email_verified: true, name: 'Owned user' };
      return new Response(JSON.stringify(data), { headers: { 'content-type': 'application/json' } });
    });
    vi.stubGlobal('fetch', fetchProfile);
    expect(await callback(strategy, session, state)).toEqual({ user: { id: 'owned-user' } });
    expect(store).toHaveBeenCalledTimes(1);
    expect(store.mock.calls[0][0]).toMatchObject({ provider, providerId: 'owned-subject', email: 'owned@gmail.com', emailVerified: true, canLinkByEmail: true });
    expect(store.mock.calls[0][0]).not.toHaveProperty('accessToken');
    expect(store.mock.calls[0][0]).not.toHaveProperty('refreshToken');
    expect(store.mock.calls[0][0]).not.toHaveProperty('profile');
    if (provider === 'github') expect(fetchProfile.mock.calls.some(([url]) => url === 'https://api.github.com/user/emails?per_page=100')).toBe(true);
    if (provider === 'linkedin') expect(fetchProfile.mock.calls.some(([url]) => url === 'https://api.linkedin.com/v2/userinfo')).toBe(true);
    if (provider !== 'google') expect(request).not.toHaveBeenCalled();
    expect(await callback(strategy, session, state)).toEqual({ failed: true });
    expect(store).toHaveBeenCalledTimes(1);
  });

  it('fails startup for a partially configured provider without requiring other providers', () => {
    vi.stubEnv('GITHUB_CLIENT_ID', 'owned-client');
    expect(() => configureOAuthStrategies(new passport.Passport())).toThrow('GitHub OAuth client secret required');
  });

  for (const provider of ['github', 'linkedin']) {
    it.each(['malformed', 'http-error', 'content-type', 'oversized', 'aborted'])('fails closed on asynchronous %s ' + provider + ' profile responses', async failure => {
      const strategy = strategyFor(provider);
      const { session, state } = await authorize(strategy);
      const store = vi.spyOn(sqliteAuthStore, 'findOrCreateUserFromOAuth');
      const claims = { iss: 'https://www.linkedin.com', sub: 'owned-subject', aud: 'owned-client',
        exp: Math.floor(Date.now() / 1000) + 300, iat: Math.floor(Date.now() / 1000) };
      const idToken = ['eyJhbGciOiJSUzI1NiJ9', Buffer.from(JSON.stringify(claims)).toString('base64url'), 'owned-signature'].join('.');
      strategy._oauth2.getOAuthAccessToken = (_code: unknown, _options: unknown, done: (...args: any[]) => void) =>
        setImmediate(() => done(null, 'owned-access-token', '', { id_token: idToken }));
      vi.stubGlobal('fetch', vi.fn(async (_url: string, options: RequestInit) => {
        expect(options.redirect).toBe('error');
        expect(options.signal).toBeInstanceOf(AbortSignal);
        await new Promise<void>(resolve => setImmediate(resolve));
        if (failure === 'aborted') throw new DOMException('Owned timeout', 'AbortError');
        return new Response(failure === 'oversized' ? 'x'.repeat(65537) : '<invalid>', {
          status: failure === 'http-error' ? 503 : 200,
          headers: { 'content-type': failure === 'content-type' ? 'text/html' : 'application/json' },
        });
      }));
      await expect(callback(strategy, session, state)).rejects.toThrow('Provider profile unavailable');
      expect(store).not.toHaveBeenCalled();
    });
  }
});
