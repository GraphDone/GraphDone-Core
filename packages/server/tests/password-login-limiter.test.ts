import { describe, expect, it } from 'vitest';
import { PasswordLoginLimiter, PasswordLoginLimitError } from '../src/auth/password-login-limiter';

describe('bounded password-login accounting', () => {
  it('fails closed at capacity without evicting blocked accounts and reclaims expired entries', () => {
    let now = 0;
    const limiter = new PasswordLoginLimiter({ accountLimit: 1, maxEntries: 2, windowMs: 1000, now: () => now });
    limiter.reserveAccount('first').finish('failure');
    limiter.reserveAccount('second').finish('failure');
    expect(() => limiter.reserveAccount('third')).toThrow(PasswordLoginLimitError);
    expect(() => limiter.reserveAccount('first')).toThrow(PasswordLoginLimitError);
    now = 1000;
    expect(() => limiter.reserveAccount('third').finish('success')).not.toThrow();
  });

  it('releases successful/cancelled slots and settles each reservation once', () => {
    const limiter = new PasswordLoginLimiter({ accountLimit: 1, maxEntries: 1 });
    const first = limiter.reserveAccount('first');
    expect(() => limiter.reserveAccount('second')).toThrow(PasswordLoginLimitError);
    first.finish('success');
    first.finish('failure');
    const second = limiter.reserveAccount('second');
    second.finish('cancel');
    second.finish('cancel');
    expect(() => limiter.reserveAccount('third').finish('failure')).not.toThrow();
    expect(() => limiter.reserveAccount('third')).toThrow(PasswordLoginLimitError);
  });

  it('retains in-flight slots across expiry and charges late failures to the new window', () => {
    let now = 0;
    const limiter = new PasswordLoginLimiter({ accountLimit: 1, maxEntries: 1, windowMs: 1000, now: () => now });
    const pending = limiter.reserveAccount('first');
    now = 1000;
    expect(() => limiter.reserveAccount('second')).toThrow(PasswordLoginLimitError);
    expect(() => limiter.reserveAccount('first')).toThrow(PasswordLoginLimitError);
    pending.finish('failure');
    expect(() => limiter.reserveAccount('first')).toThrow(PasswordLoginLimitError);
    now = 2000;
    expect(() => limiter.reserveAccount('second').finish('success')).not.toThrow();
  });

  it('does not clear other pending attempts when a valid login succeeds', () => {
    const limiter = new PasswordLoginLimiter({ accountLimit: 2 });
    const success = limiter.reserveAccount('first');
    const failure = limiter.reserveAccount('first');
    success.finish('success');
    failure.finish('failure');
    limiter.reserveAccount('first').finish('failure');
    expect(() => limiter.reserveAccount('first')).toThrow(PasswordLoginLimitError);
  });

  it('groups IPv4-mapped addresses and retains IP failures across successful logins', () => {
    const limiter = new PasswordLoginLimiter({ ipLimit: 2 });
    limiter.reserveIp('198.51.100.5').finish('failure');
    limiter.reserveIp('::ffff:198.51.100.5').finish('success');
    limiter.reserveIp('::ffff:c633:6405').finish('failure');
    expect(() => limiter.reserveIp('198.51.100.5')).toThrow(PasswordLoginLimitError);
  });

  it('uses a shared bounded bucket when no trustworthy IP is available', () => {
    const limiter = new PasswordLoginLimiter({ ipLimit: 2, maxEntries: 1 });
    limiter.reserveIp('unknown').finish('failure');
    limiter.reserveIp('untrusted:port').finish('failure');
    expect(() => limiter.reserveIp('')).toThrow(PasswordLoginLimitError);
  });
});
