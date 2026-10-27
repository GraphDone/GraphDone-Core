import { describe, expect, it } from 'vitest';
import { googleIdentity, githubIdentity, linkedinIdentity } from '../src/auth/oauth-identity';

describe('provider email evidence', () => {
  it.each([true, false, undefined, 'true'])('requires exact Google verified=true (%s)', verified => {
    const result = googleIdentity({ id: 'google-sub', _json: { sub: 'google-sub', email: 'Owned@Gmail.com', email_verified: verified } });
    expect(result.email).toBe('owned@gmail.com');
    expect(result.canLinkByEmail).toBe(verified === true);
  });

  it('requires Google authority for third-party addresses', () => {
    const profile = { id: 'google-sub', _json: { sub: 'google-sub', email: 'owned@example.invalid', email_verified: true } };
    expect(googleIdentity(profile).canLinkByEmail).toBe(false);
    expect(googleIdentity({ ...profile, _json: { ...profile._json, hd: 'example.invalid' } }).canLinkByEmail).toBe(true);
    expect(() => googleIdentity({ ...profile, id: 'different-sub' })).toThrow('subject mismatch');
  });

  it('selects the sole verified primary GitHub email from authenticated email metadata', () => {
    const result = githubIdentity({ id: '1234', _json: { email: 'unproved@example.invalid' }, emails: [
      { value: 'unproved@example.invalid', primary: false, verified: false },
      { value: 'Owned@example.invalid', primary: true, verified: true },
    ] });
    expect(result.email).toBe('owned@example.invalid');
    expect(result.canLinkByEmail).toBe(true);
  });

  it.each([
    undefined,
    [{ value: 'owned@example.invalid' }],
    [{ value: 'owned@example.invalid', primary: true, verified: false }],
    [{ value: 'owned@example.invalid', primary: true, verified: 'true' }],
    [{ value: 'owned@example.invalid', primary: false, verified: true }],
    [{ value: 'a@example.invalid', primary: true, verified: true }, { value: 'b@example.invalid', primary: true, verified: true }],
  ])('does not infer GitHub verification from incomplete or ambiguous emails', emails => {
    expect(githubIdentity({ id: '1234', emails }).canLinkByEmail).toBe(false);
  });

  it.each([true, false, undefined, 'true'])('requires exact LinkedIn userinfo email verification (%s)', verified => {
    const result = linkedinIdentity('https://www.linkedin.com',
      { id: 'linkedin-sub', _json: { sub: 'linkedin-sub', email: 'owned@example.invalid', email_verified: verified } }, { id: 'linkedin-sub' });
    expect(result.canLinkByEmail).toBe(verified === true);
  });

  it('binds LinkedIn userinfo to the authenticated issuer and ID-token subject', () => {
    const profile = { id: 'linkedin-sub', _json: { sub: 'linkedin-sub', email_verified: true } };
    expect(() => linkedinIdentity('https://www.linkedin.com/oauth', profile, { id: 'linkedin-sub' })).toThrow('issuer');
    expect(() => linkedinIdentity('https://www.linkedin.com', profile, { id: 'different-sub' })).toThrow('subject mismatch');
    expect(linkedinIdentity('https://www.linkedin.com', profile, { id: 'linkedin-sub' }).email).toBeUndefined();
  });
});
