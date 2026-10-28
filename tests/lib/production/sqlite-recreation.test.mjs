import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { verifySqliteRecreation } from './sqlite-recreation.mjs';

const env = { ADMIN_PASSWORD: 'private-test-fixture-password', TEST_ADMIN_USERNAME: 'admin' };
const composeArgs = ['compose', '--project-name', 'owned-test', '--file', '/private/owned.json'];
const withCaptcha = request => async (url, options) => url.endsWith('/api/captcha/challenge?action=login')
  ? { status: 200, body: { algorithm: 'SHA-256', salt: 'owned', maxnumber: 0,
    challenge: createHash('sha256').update('owned0').digest('hex'), signature: 'a'.repeat(64) } }
  : request(url, options);
const acknowledged = id => ({ status: 200, body: { data: { login: { user: { id, username: 'admin' } } } } });

test('recreation waits for an acknowledged login and keeps its original identity', async () => {
  const commands = [];
  const result = await verifySqliteRecreation({
    composeArgs, env, target: 'https://127.0.0.1:1234',
    request: withCaptcha(async () => acknowledged('owned-id')),
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
    request: withCaptcha(async () => acknowledged(++requests === 1 ? 'original-id' : 'replacement-id')),
    command: async () => {},
  }), /identity changed/);
});

test('an HTTP 200 GraphQL error cannot establish the persistence baseline', async () => {
  let recreated = false;
  await assert.rejects(verifySqliteRecreation({
    composeArgs, env, target: 'https://127.0.0.1:1234',
    request: withCaptcha(async () => ({ status: 200, body: { errors: [{ message: 'Invalid credentials' }] } })),
    command: async () => { recreated = true; },
  }), /GraphQL errors/);
  assert.equal(recreated, false);
});

test('failed container recreation cannot claim successful persistence', async () => {
  await assert.rejects(verifySqliteRecreation({
    composeArgs, env, target: 'https://127.0.0.1:1234',
    request: withCaptcha(async () => acknowledged('owned-id')),
    command: async () => { throw new Error('container recreation failed'); },
  }), /container recreation failed/);
});


test('production recreation obtains fresh login proofs before and after restart', async () => {
  let issued = 0, consumed = 0;
  let challenge;
  const result = await verifySqliteRecreation({
    composeArgs, env, target: 'https://127.0.0.1:1234', command: async () => { challenge = undefined; },
    request: async (url, options = {}) => {
      if (url.endsWith('/api/captcha/challenge?action=login')) {
        const salt = `owned-${++issued}?action=login&`;
        challenge = { algorithm: 'SHA-256', salt, maxnumber: 9,
          challenge: createHash('sha256').update(salt + 7).digest('hex'), signature: 'b'.repeat(64) };
        return { status: 200, body: challenge };
      }
      const proof = JSON.parse(Buffer.from(options.body.variables.input.captchaPayload || '', 'base64').toString() || '{}');
      if (!challenge || proof.number !== 7 || proof.challenge !== challenge.challenge || proof.signature !== challenge.signature) {
        return { status: 200, body: { errors: [{ message: 'Fresh server proof required' }] } };
      }
      challenge = undefined;
      consumed++;
      return acknowledged('owned-id');
    },
  });
  assert.equal(result.stableAdminId, true);
  assert.equal(issued, 2);
  assert.equal(consumed, 2);
});
