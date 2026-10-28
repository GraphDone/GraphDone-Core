export interface OAuthIdentity {
  provider: string;
  providerId: string;
  email?: string;
  name: string;
  avatar?: string;
  emailVerified: boolean;
  canLinkByEmail: boolean;
}

function subject(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || value.length > 255) throw new Error('Invalid provider identity');
  return value;
}

function email(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return undefined;
  return value.toLowerCase();
}

function name(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, 200) : fallback;
}

export function googleIdentity(profile: any): OAuthIdentity {
  const claims = profile?._json;
  const providerId = subject(claims?.sub);
  if (providerId !== profile.id) throw new Error('Provider subject mismatch');
  const address = email(claims.email);
  const emailVerified = claims.email_verified === true;
  const authoritative = address?.endsWith('@gmail.com') ||
    (typeof claims.hd === 'string' && claims.hd.trim().length > 0);
  return { provider: 'google', providerId, email: address,
    name: name(profile.displayName, 'Google user'),
    emailVerified, canLinkByEmail: emailVerified && !!authoritative };
}

export function githubIdentity(profile: any): OAuthIdentity {
  const providerId = subject(profile?.id);
  const candidates = Array.isArray(profile.emails)
    ? profile.emails.filter((entry: any) => entry.primary === true && entry.verified === true && email(entry.value)) : [];
  const address = candidates.length === 1 ? email(candidates[0].value) : undefined;
  return { provider: 'github', providerId, email: address,
    name: name(profile.displayName || profile.username, 'GitHub user'),
    emailVerified: !!address, canLinkByEmail: !!address };
}

export function linkedinIdentity(issuer: string, userInfo: any, idProfile: any): OAuthIdentity {
  if (issuer !== 'https://www.linkedin.com') throw new Error('Invalid provider issuer');
  const providerId = subject(idProfile?.id);
  const claims = userInfo?._json;
  if (subject(claims?.sub) !== providerId || userInfo.id !== providerId) throw new Error('Provider subject mismatch');
  const address = email(claims.email);
  const emailVerified = claims.email_verified === true;
  return { provider: 'linkedin', providerId, email: address,
    name: name(userInfo.displayName, 'LinkedIn user'), emailVerified, canLinkByEmail: emailVerified };
}

export function validateOAuthIdentity(identity: OAuthIdentity): void {
  if (!['google', 'github', 'linkedin'].includes(identity.provider)) throw new Error('Invalid provider identity');
  subject(identity.providerId);
  if (identity.email !== undefined && email(identity.email) !== identity.email) throw new Error('Invalid provider email');
}
