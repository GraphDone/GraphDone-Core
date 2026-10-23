import assert from 'node:assert/strict';
import test from 'node:test';
import { verifySqliteRecreation } from './sqlite-recreation.mjs';

const env = { ADMIN_PASSWORD: 'private-test-fixture-password', TEST_ADMIN_USERNAME: 'admin' };
const composeArgs = ['compose', '--project-name', 'owned-test', '--file', '/private/owned.json'];
const acknowledged = id => ({ status: 200, body: { data: { login: { user: { id, username: 'admin' } } } } });

test('recreation waits for an acknowledged login and keeps its original identity', async () => {
  const commands = [];
  const result = await verifySqliteRecreation({
    composeArgs, env, target: 'https://127.0.0.1:1234',
    request: async () => acknowledged('owned-id'),
    command: async (...args) => { commands.push(args); },
  });
  assert.deepEqual(result, { status: 'passed', stableAdminId: true, loginAfterRecreation: true });
  assert.equal(commands.length, 1);
  assert.deepEqual(commands[0][2], [...composeArgs, 'up', '--detach', '--no-deps', '--force-recreate', 'graphdone-api']);
});

test('a newly bootstrapped replacement account fails even when login works', async () => {
  let requests = 0;
  await assert.rejects(verifySqliteRecreation({
    composeArgs, env, target: 'https://127.0.0.1:1234',
    request: async () => acknowledged(++requests === 1 ? 'original-id' : 'replacement-id'),
    command: async () => {},
  }), /identity changed/);
});

test('an HTTP 200 GraphQL error cannot establish the persistence baseline', async () => {
  let recreated = false;
  await assert.rejects(verifySqliteRecreation({
    composeArgs, env, target: 'https://127.0.0.1:1234',
    request: async () => ({ status: 200, body: { errors: [{ message: 'Invalid credentials' }] } }),
    command: async () => { recreated = true; },
  }), /GraphQL errors/);
  assert.equal(recreated, false);
});

test('failed container recreation cannot claim successful persistence', async () => {
  await assert.rejects(verifySqliteRecreation({
    composeArgs, env, target: 'https://127.0.0.1:1234',
    request: async () => acknowledged('owned-id'),
    command: async () => { throw new Error('container recreation failed'); },
  }), /container recreation failed/);
});
