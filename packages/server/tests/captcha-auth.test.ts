import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import sqlite3 from 'sqlite3';
import express from 'express';
import { createServer, type Server } from 'node:http';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@as-integrations/express4';
import { solveChallenge } from 'altcha-lib';
import { sqliteAuthStore } from '../src/auth/sqlite-auth';
import { sqliteAuthResolvers } from '../src/resolvers/sqlite-auth';
import { authOnlyTypeDefs } from '../src/schema/auth-only-schema';
import { createCaptchaChallenge, type CaptchaAction } from '../src/utils/captcha';
import { createCaptchaChallengeLimiter } from '../src/utils/captcha-rate-limit';

let database: sqlite3.Database;
let server: Server;
let apollo: ApolloServer;
let endpoint: string;
let account: { id: string; email: string };
const password = 'OwnedCaptchaFixture!94';
const store = sqliteAuthStore as unknown as { db: sqlite3.Database | null; initialized: boolean };

async function proof(action: CaptchaAction) {
  const challenge = await createCaptchaChallenge(action);
  const solution = await solveChallenge(challenge.challenge, challenge.salt, challenge.algorithm, challenge.maxnumber).promise;
  if (!solution) throw new Error('Could not solve owned challenge');
  return Buffer.from(JSON.stringify({ ...challenge, number: solution.number })).toString('base64');
}

async function request(operation: 'login' | 'signup', input: Record<string, unknown>) {
  const response = await fetch(endpoint, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query: `mutation($input:${operation === 'login' ? 'LoginInput' : 'SignupInput'}!){renamed:${operation}(input:$input){token user{id}}}`, variables: { input } }),
  });
  return response.json();
}

beforeAll(async () => {
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('ADMIN_EMAIL', 'captcha-seed@example.invalid');
  vi.stubEnv('ADMIN_PASSWORD', 'OwnedSeedPassword!94');
  vi.spyOn(console, 'log').mockImplementation(() => {});
  database = await new Promise((resolve, reject) => {
    const connection = new sqlite3.Database(':memory:', error => error ? reject(error) : resolve(connection));
  });
  store.db = database; store.initialized = false;
  await sqliteAuthStore.initialize();
  account = await sqliteAuthStore.createUser({ email: 'captcha-login@example.invalid', username: 'captcha-login', name: 'Owned CAPTCHA fixture', password, role: 'USER' });
  apollo = new ApolloServer({ typeDefs: authOnlyTypeDefs, resolvers: { Mutation: {
    login: sqliteAuthResolvers.Mutation.login, signup: sqliteAuthResolvers.Mutation.signup,
  } } });
  await apollo.start();
  const app = express();
  app.set('trust proxy', 2);
  app.get('/challenge-budget', createCaptchaChallengeLimiter(), (_req, res) => res.json({ allowed: true }));
  app.use('/graphql', express.json(), expressMiddleware(apollo, { context: async ({ req }) => ({ req }) }));
  server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Expected an owned HTTP listener');
  endpoint = `http://127.0.0.1:${address.port}/graphql`;
});

afterAll(async () => {
  if (apollo) await apollo.stop();
  if (server) await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  if (database) await new Promise<void>((resolve, reject) => database.close(error => error ? reject(error) : resolve()));
  store.db = null; store.initialized = false;
  vi.restoreAllMocks(); vi.unstubAllEnvs();
});

describe('production CAPTCHA at the actual HTTP GraphQL boundary', () => {
  it('cannot rotate forwarded IPs to bypass the socket issuance budget with trust proxy enabled', async () => {
    for (let attempt = 0; attempt < 31; attempt++) {
      const response = await fetch(endpoint.replace('/graphql', '/challenge-budget'), {
        headers: { 'x-forwarded-for': `198.51.100.${attempt + 1}` },
      });
      expect(response.status).toBe(attempt < 30 ? 200 : 429);
    }
  });
  it('refuses missing and forged proofs despite a correct password', async () => {
    for (const captchaPayload of [undefined, 'ABC123']) {
      const result = await request('login', { emailOrUsername: account.email, password, captchaPayload });
      expect(result.errors?.[0]?.extensions.code).toBe('CAPTCHA_FAILED');
      expect(result.data).toBeNull();
    }
  });

  it('accepts a valid proof once and rejects a proof for another action', async () => {
    const input = { emailOrUsername: account.email, password };
    const wrong = await request('login', { ...input, captchaPayload: await proof('signup') });
    expect(wrong.errors?.[0]?.extensions.code).toBe('CAPTCHA_FAILED');
    const captchaPayload = await proof('login');
    const accepted = await request('login', { ...input, captchaPayload });
    expect(accepted.errors).toBeUndefined();
    expect(accepted.data.renamed.user.id).toBe(account.id);
    expect(typeof accepted.data.renamed.token).toBe('string');
    const replay = await request('login', { ...input, captchaPayload });
    expect(replay.errors?.[0]?.extensions.code).toBe('CAPTCHA_FAILED');
    expect(replay.data).toBeNull();
  }, 20000);

  it('does not create an account without a valid signup proof', async () => {
    const input = { email: 'captcha-signup@example.invalid', username: 'captcha-signup', password, name: 'Owned signup' };
    for (const captchaPayload of [undefined, 'ABC123']) {
      const result = await request('signup', { ...input, captchaPayload });
      expect(result.errors?.[0]?.extensions.code).toBe('CAPTCHA_FAILED');
      expect(await sqliteAuthStore.findUserByEmailOrUsername(input.email)).toBeNull();
    }
    const accepted = await request('signup', { ...input, captchaPayload: await proof('signup') });
    expect(accepted.errors).toBeUndefined();
    expect(accepted.data.renamed.user.id).toBeTruthy();
    expect((await sqliteAuthStore.findUserByEmailOrUsername(input.email))?.id).toBe(accepted.data.renamed.user.id);
  }, 20000);
});
