import { randomBytes } from 'node:crypto';
import { createChallenge, verifySolution } from 'altcha-lib';

export const CAPTCHA_ACTIONS = ['login', 'signup', 'magic-link', 'forgot-password', 'reset-password'] as const;
export type CaptchaAction = typeof CAPTCHA_ACTIONS[number];
export function isCaptchaAction(value: unknown): value is CaptchaAction {
  return typeof value === 'string' && CAPTCHA_ACTIONS.some(action => action === value);
}

/** Development quick-login remains available; production policy never comes
 * from a request or browser setting. Supplied proofs are checked in every mode. */
export function captchaRequired(action: CaptchaAction): boolean {
  return !['development', 'test'].includes(process.env.NODE_ENV || '') || !['login', 'signup'].includes(action);
}

export class CaptchaCapacityError extends Error {}

export class CaptchaService {
  private readonly issued = new Map<string, { action: CaptchaAction; expires: number; salt: string; signature: string }>();
  private pending = 0;

  constructor(private readonly options: {
    key: string;
    now?: () => number;
    ttlMs?: number;
    capacity?: number;
    maxNumber?: number;
  }) {}

  private now(): number { return this.options.now?.() ?? Date.now(); }
  private prune(): void {
    const now = this.now();
    for (const [id, entry] of this.issued) if (entry.expires <= now) this.issued.delete(id);
  }

  async create(action: CaptchaAction) {
    if (!isCaptchaAction(action)) throw new Error('Invalid CAPTCHA action');
    this.prune();
    if (this.issued.size + this.pending >= (this.options.capacity ?? 5000)) {
      throw new CaptchaCapacityError('Verification is busy. Please try again shortly.');
    }
    this.pending += 1;
    try {
      const expires = this.now() + (this.options.ttlMs ?? 300000);
      const challenge = await createChallenge({
        hmacKey: this.options.key, algorithm: 'SHA-256',
        maxNumber: this.options.maxNumber ?? 100000,
        saltLength: 16, expires: new Date(expires), params: { action },
      });
      this.issued.set(challenge.challenge, { action, expires, salt: challenge.salt, signature: challenge.signature });
      return challenge;
    } finally { this.pending -= 1; }
  }

  async verify(payload: unknown, action: CaptchaAction): Promise<boolean> {
    if (!isCaptchaAction(action) || typeof payload !== 'string' || !payload || payload.length > 4096) return false;
    this.prune();
    try {
      const proof = JSON.parse(Buffer.from(payload, 'base64').toString('utf8'));
      if (!proof || proof.algorithm !== 'SHA-256' || !Number.isSafeInteger(proof.number) || proof.number < 0 ||
          proof.number > (this.options.maxNumber ?? 100000) || typeof proof.challenge !== 'string') return false;
      const entry = this.issued.get(proof.challenge);
      if (!entry || entry.action !== action || entry.salt !== proof.salt || entry.signature !== proof.signature) return false;
      if (!await verifySolution(proof, this.options.key, false)) return false;
      if (entry.expires <= this.now() || this.issued.get(proof.challenge) !== entry) return false;
      return this.issued.delete(proof.challenge);
    } catch { return false; }
  }
}

let service: CaptchaService | undefined;
function getService(): CaptchaService {
  if (!service) {
    const configured = process.env.ALTCHA_HMAC_KEY?.trim();
    if (configured !== undefined && (configured.length < 32 || configured === 'your-secret-hmac-key-change-in-production')) {
      throw new Error('ALTCHA_HMAC_KEY must be a random secret of at least 32 characters, or unset for a process-local key.');
    }
    // Outstanding proofs are invalid after restart, matching the bounded ledger.
    service = new CaptchaService({ key: configured ?? randomBytes(32).toString('hex') });
  }
  return service;
}

export async function verifyCaptcha(payload: unknown, action: CaptchaAction): Promise<boolean> {
  return getService().verify(payload, action);
}

export async function verifyAuthCaptcha(payload: unknown, action: CaptchaAction): Promise<boolean> {
  if ((payload === undefined || payload === null || payload === '') && !captchaRequired(action)) return true;
  return verifyCaptcha(payload, action);
}

export async function createCaptchaChallenge(action: CaptchaAction) {
  return getService().create(action);
}
