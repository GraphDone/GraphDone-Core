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
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

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
    strategy._oauth2.getOAuthAccessToken = vi.fn((_code, _options, done) => done(null, 'owned-access-token', 'owned-refresh-token', { id_token: idToken }));
    const request = vi.fn((url: string, _token: string, done: (...args: any[]) => void) => {
      const data = url.includes('/user/emails') ? [{ email: 'owned@gmail.com', primary: true, verified: true }] :
        { ...claims, id: 'owned-subject', email: 'owned@gmail.com', email_verified: true, name: 'Owned user' };
      done(null, JSON.stringify(data), {});
    });
    strategy._oauth2.get = request;
    expect(await callback(strategy, session, state)).toEqual({ user: { id: 'owned-user' } });
    expect(store).toHaveBeenCalledTimes(1);
    expect(store.mock.calls[0][0]).toMatchObject({ provider, providerId: 'owned-subject', email: 'owned@gmail.com', emailVerified: true, canLinkByEmail: true });
    expect(store.mock.calls[0][0]).not.toHaveProperty('accessToken');
    expect(store.mock.calls[0][0]).not.toHaveProperty('refreshToken');
    expect(store.mock.calls[0][0]).not.toHaveProperty('profile');
    if (provider === 'github') expect(request.mock.calls.some(([url]) => url.includes('/user/emails'))).toBe(true);
    if (provider === 'linkedin') expect(request.mock.calls.some(([url]) => url === 'https://api.linkedin.com/v2/userinfo')).toBe(true);
    expect(await callback(strategy, session, state)).toEqual({ failed: true });
    expect(store).toHaveBeenCalledTimes(1);
  });

  it('fails startup for a partially configured provider without requiring other providers', () => {
    vi.stubEnv('GITHUB_CLIENT_ID', 'owned-client');
    expect(() => configureOAuthStrategies(new passport.Passport())).toThrow('GitHub OAuth client secret required');
  });
});
