import { afterEach, expect, it, vi } from 'vitest';
import { solveChallenge } from 'altcha-lib';
import { randomBytes } from 'node:crypto';
import { CaptchaService, CaptchaCapacityError, verifyCaptcha, verifyAuthCaptcha, captchaRequired, CAPTCHA_ACTIONS } from '../src/utils/captcha';
import { validateProductionSecrets } from '../src/config/secrets';

const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64');
async function solve(challenge: Awaited<ReturnType<CaptchaService['create']>>) {
  const solution = await solveChallenge(challenge.challenge, challenge.salt, challenge.algorithm, challenge.maxnumber).promise;
  if (!solution) throw new Error('Owned challenge was not solved');
  return encode({ ...challenge, number: solution.number });
}
function fixture(options: Partial<ConstructorParameters<typeof CaptchaService>[0]> = {}) {
  return new CaptchaService({ key: randomBytes(32).toString('hex'), maxNumber: 20, ...options });
}

afterEach(() => vi.unstubAllEnvs());

it('rejects arbitrary six-character client codes', async () => {
  expect(await verifyCaptcha('ABC123', 'magic-link')).toBe(false);
});

it('rejects malformed and absent proof', async () => {
  for (const payload of [undefined, null, '', 'not-a-proof', 'e30=']) {
    expect(await verifyCaptcha(payload, 'magic-link')).toBe(false);
  }
});

it('enforces production policy for every action and rejects supplied invalid development proof', async () => {
  vi.stubEnv('NODE_ENV', 'production');
  for (const action of CAPTCHA_ACTIONS) {
    expect(captchaRequired(action)).toBe(true);
    expect(await verifyAuthCaptcha(undefined, action)).toBe(false);
    expect(await verifyAuthCaptcha('ABC123', action)).toBe(false);
  }
  vi.stubEnv('NODE_ENV', 'development');
  expect(await verifyAuthCaptcha(undefined, 'login')).toBe(true);
  expect(await verifyAuthCaptcha(undefined, 'signup')).toBe(true);
  expect(await verifyAuthCaptcha(undefined, 'magic-link')).toBe(false);
  expect(await verifyAuthCaptcha('ABC123', 'login')).toBe(false);
});

it('accepts a signed solution once, bound to its original action', async () => {
  const service = fixture();
  const proof = await solve(await service.create('magic-link'));
  expect(await service.verify(proof, 'reset-password')).toBe(false);
  expect(await service.verify(proof, 'magic-link')).toBe(true);
  expect(await service.verify(proof, 'magic-link')).toBe(false);
});

it('allows exactly one concurrent redemption', async () => {
  const service = fixture();
  const proof = await solve(await service.create('login'));
  const results = await Promise.all(Array.from({ length: 20 }, () => service.verify(proof, 'login')));
  expect(results.filter(Boolean)).toHaveLength(1);
});

it('rejects tampering, foreign signatures, oversized input and out-of-range numbers', async () => {
  const service = fixture();
  const challenge = await service.create('signup');
  const proof = await solve(challenge);
  const parsed = JSON.parse(Buffer.from(proof, 'base64').toString());
  for (const changed of [{ signature: '0'.repeat(64) }, { salt: 'other' }, { algorithm: 'SHA-1' }, { number: -1 }, { number: 21 }, { number: 0.5 }]) {
    expect(await service.verify(encode({ ...parsed, ...changed }), 'signup')).toBe(false);
  }
  expect(await fixture().verify(proof, 'signup')).toBe(false);
  expect(await service.verify('A'.repeat(4097), 'signup')).toBe(false);
  expect(await service.verify(proof, 'signup')).toBe(true);
});

it('expires challenges and never evicts a live proof to admit more work', async () => {
  let now = Date.now();
  const service = fixture({ capacity: 1, ttlMs: 1000, now: () => now });
  const proof = await solve(await service.create('login'));
  await expect(service.create('login')).rejects.toBeInstanceOf(CaptchaCapacityError);
  now += 1000;
  expect(await service.verify(proof, 'login')).toBe(false);
  const fresh = await solve(await service.create('login'));
  expect(await service.verify(fresh, 'login')).toBe(true);
});

it('reserves issuance capacity before asynchronous challenge creation', async () => {
  const service = fixture({ capacity: 2 });
  const results = await Promise.allSettled(Array.from({ length: 20 }, () => service.create('login')));
  expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(2);
  expect(results.filter(result => result.status === 'rejected')).toHaveLength(18);
});

it('rejects the old production HMAC fallback and permits an unset process-local key', () => {
  const environment = { NODE_ENV: 'production', JWT_SECRET: randomBytes(32).toString('hex'), SESSION_SECRET: randomBytes(32).toString('hex') };
  expect(() => validateProductionSecrets(environment)).not.toThrow();
  for (const ALTCHA_HMAC_KEY of ['', 'short', 'your-secret-hmac-key-change-in-production']) {
    expect(() => validateProductionSecrets({ ...environment, ALTCHA_HMAC_KEY })).toThrow(/ALTCHA_HMAC_KEY/);
  }
});
