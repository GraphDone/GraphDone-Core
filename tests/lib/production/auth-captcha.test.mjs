import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { productionLoginProof } from './auth-captcha.mjs';

const challenge = { algorithm: 'SHA-256', salt: 'owned?action=login&', maxnumber: 9,
  challenge: createHash('sha256').update('owned?action=login&7').digest('hex'), signature: 'a'.repeat(64) };

test('production proof retains issued identity and solves only the bounded challenge', async () => {
  let url;
  const encoded = await productionLoginProof({ target: 'https://127.0.0.1:1234', request: async target => {
    url = target; return { status: 200, body: challenge };
  } });
  assert.equal(url, 'https://127.0.0.1:1234/api/captcha/challenge?action=login');
  assert.deepEqual(JSON.parse(Buffer.from(encoded, 'base64').toString()), {
    algorithm: challenge.algorithm, challenge: challenge.challenge, salt: challenge.salt, signature: challenge.signature, number: 7,
  });
});

test('invalid, missing, excessive or unsolvable challenges fail without login proof', async () => {
  for (const response of [{ status: 503, body: challenge }, { status: 200 },
    ...[{ algorithm: 'SHA-512' }, { maxnumber: 100001 }, { maxnumber: -1 }, { maxnumber: 1.5 },
      { salt: 'x'.repeat(513) }, { salt: '' }, { challenge: 'bad' }, { signature: '' }, { maxnumber: 3 }]
      .map(change => ({ status: 200, body: { ...challenge, ...change } }))]) {
    await assert.rejects(productionLoginProof({ target: 'owned', request: async () => response }), /Production login/);
  }
});
