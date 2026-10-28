import { createHash } from 'node:crypto';

export async function productionLoginProof({ target, request }) {
  const response = await request(`${target}/api/captcha/challenge?action=login`);
  const challenge = response.body;
  if (response.status !== 200 || challenge?.algorithm !== 'SHA-256'
    || !Number.isSafeInteger(challenge.maxnumber) || challenge.maxnumber < 0 || challenge.maxnumber > 100000
    || typeof challenge.salt !== 'string' || !challenge.salt.length || challenge.salt.length > 512
    || !/^[a-f0-9]{64}$/.test(challenge.challenge || '') || !/^[a-f0-9]{64}$/.test(challenge.signature || '')) {
    throw new Error('Production login requires a bounded server-issued CAPTCHA challenge.');
  }
  for (let number = 0; number <= challenge.maxnumber; number++) {
    if (createHash('sha256').update(challenge.salt + number).digest('hex') === challenge.challenge) {
      return Buffer.from(JSON.stringify({ algorithm: challenge.algorithm, challenge: challenge.challenge,
        salt: challenge.salt, signature: challenge.signature, number })).toString('base64');
    }
  }
  throw new Error('Production login CAPTCHA could not be solved within its advertised bound.');
}
