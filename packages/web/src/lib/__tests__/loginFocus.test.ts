import { describe, it, expect } from 'vitest';
import { magicLinkFocusTarget, hasEnteredEmail } from '../loginFocus';

describe('magicLinkFocusTarget', () => {
  it('focuses the email field when passwordless is active and no email entered', () => {
    expect(magicLinkFocusTarget({ active: true, magicLinkSent: false, hasEmail: false })).toBe('email');
  });

  it('focuses the captcha when passwordless is active and an email is already present', () => {
    expect(magicLinkFocusTarget({ active: true, magicLinkSent: false, hasEmail: true })).toBe('captcha');
  });

  it('focuses nothing while passwordless mode is inactive (password mode)', () => {
    expect(magicLinkFocusTarget({ active: false, magicLinkSent: false, hasEmail: false })).toBe('none');
    expect(magicLinkFocusTarget({ active: false, magicLinkSent: false, hasEmail: true })).toBe('none');
  });

  it('focuses nothing once the magic link has been sent (success view, no inputs)', () => {
    expect(magicLinkFocusTarget({ active: true, magicLinkSent: true, hasEmail: true })).toBe('none');
  });
});

describe('hasEnteredEmail', () => {
  it('is false for empty, whitespace, null, or undefined', () => {
    expect(hasEnteredEmail('')).toBe(false);
    expect(hasEnteredEmail('   ')).toBe(false);
    expect(hasEnteredEmail(null)).toBe(false);
    expect(hasEnteredEmail(undefined)).toBe(false);
  });

  it('is true once a non-whitespace value is present', () => {
    expect(hasEnteredEmail('a')).toBe(true);
    expect(hasEnteredEmail(' john@example.com ')).toBe(true);
  });
});
