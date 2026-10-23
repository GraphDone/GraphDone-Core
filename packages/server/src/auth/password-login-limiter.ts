import { createHash } from 'node:crypto';
import { isIP } from 'node:net';
import { ipKeyGenerator } from 'express-rate-limit';

type Outcome = 'success' | 'failure' | 'cancel';
type Entry = { failures: number; pending: number; resetAt: number };
type Attempt = { finish: (outcome: Outcome) => void };

export class PasswordLoginLimitError extends Error {
  constructor(readonly retryAfter: number) {
    super('Too many failed login attempts. Please try again later.');
  }
}

class AttemptBuckets {
  private entries = new Map<string, Entry>();
  private nextSweep = 0;

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly maxEntries: number,
    private readonly clearOnSuccess: boolean,
    private readonly now: () => number,
  ) {}

  reserve(identity: string): Attempt {
    const now = this.now();
    if (now >= this.nextSweep || this.entries.size >= this.maxEntries) {
      for (const [key, entry] of this.entries) {
        if (entry.pending === 0 && entry.resetAt <= now) this.entries.delete(key);
      }
      this.nextSweep = now + Math.min(this.windowMs, 60_000);
    }
    const key = createHash('sha256').update(identity).digest('hex');
    let entry = this.entries.get(key);
    if (!entry) {
      if (this.entries.size >= this.maxEntries) {
        let earliestReset = now + this.windowMs;
        for (const current of this.entries.values()) earliestReset = Math.min(earliestReset, current.resetAt);
        throw new PasswordLoginLimitError(Math.max(1, Math.ceil((earliestReset - now) / 1000)));
      }
      entry = { failures: 0, pending: 0, resetAt: now + this.windowMs };
      this.entries.set(key, entry);
    }
    this.refresh(entry, now);
    if (entry.failures + entry.pending >= this.limit) {
      throw new PasswordLoginLimitError(Math.max(1, Math.ceil((entry.resetAt - now) / 1000)));
    }
    entry.pending += 1;
    let finished = false;
    return {
      finish: outcome => {
        if (finished) return;
        finished = true;
        this.refresh(entry, this.now());
        entry.pending -= 1;
        if (outcome === 'failure') entry.failures += 1;
        if (outcome === 'success' && this.clearOnSuccess) entry.failures = 0;
        if (entry.pending === 0 && entry.failures === 0) this.entries.delete(key);
      },
    };
  }

  private refresh(entry: Entry, now: number) {
    if (entry.resetAt <= now) {
      entry.failures = 0;
      entry.resetAt = now + this.windowMs;
    }
  }
}

export class PasswordLoginLimiter {
  private readonly accounts: AttemptBuckets;
  private readonly ips: AttemptBuckets;

  constructor({ windowMs = 15 * 60 * 1000, accountLimit = 5, ipLimit = 20, maxEntries = 10_000, now = Date.now } = {}) {
    this.accounts = new AttemptBuckets(accountLimit, windowMs, maxEntries, true, now);
    this.ips = new AttemptBuckets(ipLimit, windowMs, maxEntries, false, now);
  }

  reserveIp(address: string): Attempt {
    return this.ips.reserve(isIP(address) ? ipKeyGenerator(address, 56) : 'unknown');
  }

  reserveAccount(identity: string): Attempt {
    return this.accounts.reserve(identity);
  }
}

export const passwordLoginLimiter = new PasswordLoginLimiter({ now: () => Date.now() });
