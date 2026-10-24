import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildASTSchema, graphql, type GraphQLSchema } from 'graphql';
import sqlite3 from 'sqlite3';
import bcrypt from 'bcryptjs';
import express from 'express';
import { createServer, type Server } from 'node:http';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@as-integrations/express4';
import { sqliteAuthStore } from '../src/auth/sqlite-auth';
import { sqliteAuthResolvers } from '../src/resolvers/sqlite-auth';
import { authOnlyTypeDefs } from '../src/schema/auth-only-schema';

let database: sqlite3.Database;
let schema: GraphQLSchema;
let server: Server;
let apollo: ApolloServer;
let endpoint: string;
let now = 1_900_000_000_000;
let caseNumber = 0;
let account: { id: string; email: string; username: string };
const password = 'disposable-login-fixture';
const windowMs = 15 * 60 * 1000;
const store = sqliteAuthStore as unknown as { db: sqlite3.Database | null; initialized: boolean };

function execute(emailOrUsername: string, candidate: string, ip = '198.51.100.8', alias = 'attempt', headers: Record<string, string> = {}) {
  return graphql({
    schema,
    source: `mutation($input: LoginInput!) { ${alias}: login(input: $input) { token user { id } } }`,
    variableValues: { input: { emailOrUsername, password: candidate } },
    contextValue: { req: { ip, headers } },
  });
}

beforeAll(async () => {
  vi.stubEnv('ADMIN_EMAIL', 'login-seed@example.invalid');
  vi.stubEnv('ADMIN_PASSWORD', 'disposable-seed-only');
  database = await new Promise((resolve, reject) => {
    const connection = new sqlite3.Database(':memory:', error => error ? reject(error) : resolve(connection));
  });
  store.db = database;
  store.initialized = false;
  await sqliteAuthStore.initialize();
  schema = buildASTSchema(authOnlyTypeDefs);
  schema.getMutationType()!.getFields().login.resolve = sqliteAuthResolvers.Mutation.login;
  apollo = new ApolloServer({ typeDefs: authOnlyTypeDefs, resolvers: { Mutation: { login: sqliteAuthResolvers.Mutation.login } } });
  await apollo.start();
  const app = express();
  app.use('/graphql', express.json(), expressMiddleware(apollo, { context: async ({ req }) => ({ req }) }));
  server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Expected an owned loopback listener');
  endpoint = `http://127.0.0.1:${address.port}/graphql`;
});

beforeEach(async () => {
  now += windowMs * 2;
  vi.spyOn(Date, 'now').mockImplementation(() => now);
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  caseNumber += 1;
  account = { id: `fixture-user-${caseNumber}`, email: `fixture-${caseNumber}@example.invalid`, username: `fixture-${caseNumber}` };
  const hash = await bcrypt.hash(password, 4);
  await new Promise<void>((resolve, reject) => database.run(
    'INSERT INTO users (id,email,username,name,role,passwordHash,createdAt,updatedAt,isActive,isEmailVerified) VALUES(?,?,?,?,?,?,?,?,1,1)',
    [account.id, account.email, account.username, 'Disposable login fixture', 'USER', hash, new Date().toISOString(), new Date().toISOString()],
    error => error ? reject(error) : resolve(),
  ));
});

afterEach(() => vi.restoreAllMocks());

afterAll(async () => {
  if (apollo) await apollo.stop();
  if (server) await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  if (database) await new Promise<void>((resolve, reject) => database.close(error => error ? reject(error) : resolve()));
  store.db = null;
  store.initialized = false;
  vi.unstubAllEnvs();
});

describe('password login limits at the GraphQL resolver boundary', () => {
  it('returns a real HTTP429 for a blocked aliased password mutation', async () => {
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const response = await fetch(endpoint, {
        method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': `203.0.113.${attempt + 1}` },
        body: JSON.stringify({
          query: `mutation($input:LoginInput!){alias${attempt}:login(input:$input){token}}`,
          variables: { input: { emailOrUsername: account.email, password: attempt === 5 ? password : 'wrong' } },
        }),
      });
      const body = await response.json();
      expect(body.errors[0].extensions.code).toBe(attempt === 5 ? 'RATE_LIMIT_EXCEEDED' : 'UNAUTHENTICATED');
      expect(body.data).toBeNull();
      if (attempt === 5) {
        expect(response.status).toBe(429);
        expect(body.errors[0].extensions.retryAfter).toBe(900);
      }
    }
  });

  it('allows repeated successful direct logins without browser state', async () => {
    for (let attempt = 0; attempt < 45; attempt += 1) {
      const result = await execute(account.email, password);
      expect(result.errors).toBeUndefined();
      expect(result.data?.attempt).toMatchObject({ user: { id: account.id } });
    }
  });

  it('limits failed aliases across email, username, casing, and source IPs', async () => {
    const validate = vi.spyOn(sqliteAuthStore, 'validatePassword');
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const identifier = attempt % 2 ? account.username.toUpperCase() : account.email.toUpperCase();
      const result = await execute(identifier, 'wrong', `198.51.100.${attempt + 1}`, `alias${attempt}`);
      expect(result.errors?.[0]?.extensions.code).toBe('UNAUTHENTICATED');
    }
    const blocked = await execute(account.email, password, '203.0.113.9', 'differentAlias');
    expect(blocked.errors?.[0]?.extensions).toMatchObject({ code: 'RATE_LIMIT_EXCEEDED', retryAfter: 900, rateLimitExceeded: true });
    expect(blocked.errors?.[0]?.path).toEqual(['differentAlias']);
    expect(validate).toHaveBeenCalledTimes(5);
  });

  it('counts every invoked alias independently of the operation name', async () => {
    const first = await graphql({
      schema,
      source: 'mutation Multiplex($good:LoginInput!,$bad:LoginInput!) { accepted:login(input:$good){token} refused:login(input:$bad){token} unreached:login(input:$bad){token} }',
      variableValues: { good: { emailOrUsername: account.email, password }, bad: { emailOrUsername: account.email, password: 'wrong' } },
      contextValue: { req: { ip: '198.51.100.8' } },
    });
    expect(first.errors?.[0]?.path).toEqual(['refused']);
    for (let attempt = 0; attempt < 4; attempt += 1) {
      expect((await execute(account.email, 'wrong', '198.51.100.8', `next${attempt}`)).errors?.[0]?.extensions.code).toBe('UNAUTHENTICATED');
    }
    expect((await execute(account.email, 'wrong', '198.51.100.8', 'lastAlias')).errors?.[0]?.extensions.code).toBe('RATE_LIMIT_EXCEEDED');
  });

  it('reserves account capacity before concurrent password checks finish', async () => {
    const validate = vi.spyOn(sqliteAuthStore, 'validatePassword');
    const results = await Promise.all(Array.from({ length: 12 }, (_, index) => execute(account.email, 'wrong', `203.0.113.${index + 1}`)));
    expect(results.filter(result => result.errors?.[0]?.extensions.code === 'UNAUTHENTICATED')).toHaveLength(5);
    expect(results.filter(result => result.errors?.[0]?.extensions.code === 'RATE_LIMIT_EXCEEDED')).toHaveLength(7);
    expect(validate).toHaveBeenCalledTimes(5);
  });

  it('limits unknown-account spraying by IP without trusting forwarded headers', async () => {
    const lookup = vi.spyOn(sqliteAuthStore, 'findUserByEmailOrUsername');
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const result = await execute(`missing-${attempt}@example.invalid`, 'wrong', '198.51.100.8', 'attempt', { 'x-forwarded-for': `203.0.113.${attempt + 1}` });
      expect(result.errors?.[0]?.extensions.code).toBe('UNAUTHENTICATED');
    }
    const blocked = await execute(account.email, password);
    expect(blocked.errors?.[0]?.extensions.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(lookup).toHaveBeenCalledTimes(20);
  });

  it('preserves IP failures across a successful login and recovers after the window', async () => {
    for (let attempt = 0; attempt < 19; attempt += 1) await execute(`missing-${attempt}@example.invalid`, 'wrong');
    expect((await execute(account.email, password)).errors).toBeUndefined();
    expect((await execute('last-missing@example.invalid', 'wrong')).errors?.[0]?.extensions.code).toBe('UNAUTHENTICATED');
    expect((await execute(account.email, password)).errors?.[0]?.extensions.code).toBe('RATE_LIMIT_EXCEEDED');
    now += windowMs;
    expect((await execute(account.email, password)).errors).toBeUndefined();
  });

  it('clears account failures after success and restores blocked accounts after expiry', async () => {
    for (let attempt = 0; attempt < 4; attempt += 1) await execute(account.email, 'wrong');
    expect((await execute(account.email, password)).errors).toBeUndefined();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect((await execute(account.username, 'wrong')).errors?.[0]?.extensions.code).toBe('UNAUTHENTICATED');
    }
    expect((await execute(account.email, password)).errors?.[0]?.extensions.code).toBe('RATE_LIMIT_EXCEEDED');
    now += windowMs;
    expect((await execute(account.email, password)).errors).toBeUndefined();
  });

  it('groups rotating IPv6 interface addresses within the same /56', async () => {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      expect((await execute(`missing-${attempt}@example.invalid`, 'wrong', `2001:db8:abcd:1200::${attempt + 1}`)).errors?.[0]?.extensions.code).toBe('UNAUTHENTICATED');
    }
    expect((await execute(account.email, password, '2001:db8:abcd:12ff::99')).errors?.[0]?.extensions.code).toBe('RATE_LIMIT_EXCEEDED');
  });

  it('releases pending capacity when the authentication store fails', async () => {
    const lookup = vi.spyOn(sqliteAuthStore, 'findUserByEmailOrUsername');
    for (let attempt = 0; attempt < 25; attempt += 1) {
      lookup.mockRejectedValueOnce(new Error('fixture storage failure'));
      expect((await execute(account.email, password)).errors?.[0]?.extensions.code).toBe('INTERNAL_SERVER_ERROR');
    }
    expect((await execute(account.email, password)).errors).toBeUndefined();
  });
});
