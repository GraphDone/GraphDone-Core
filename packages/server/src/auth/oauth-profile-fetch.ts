import { githubIdentity, linkedinIdentity, type OAuthIdentity } from './oauth-identity.js';

async function providerJSON(url: string, accessToken: string): Promise<any> {
  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
      redirect: 'error', signal: AbortSignal.timeout(5000),
    });
    if (!response.ok || !response.body || !response.headers.get('content-type')?.includes('application/json')) {
      throw new Error('Invalid provider response');
    }
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 65536) throw new Error('Provider response too large');
        chunks.push(value);
      }
    } finally { await reader.cancel().catch(() => {}); }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch { throw new Error('Provider profile unavailable'); }
}

export async function fetchGitHubIdentity(accessToken: string): Promise<OAuthIdentity> {
  const profile = await providerJSON('https://api.github.com/user', accessToken);
  const emails = await providerJSON('https://api.github.com/user/emails?per_page=100', accessToken);
  if (!profile || !Array.isArray(emails)) throw new Error('Invalid provider profile');
  const id = typeof profile.id === 'number' && Number.isSafeInteger(profile.id) ? String(profile.id) : profile.id;
  return githubIdentity({ id, displayName: profile.name, username: profile.login,
    emails: emails.map(entry => ({ value: entry?.email, primary: entry?.primary, verified: entry?.verified })) });
}

export async function fetchLinkedInIdentity(issuer: string, idProfile: unknown, accessToken: string): Promise<OAuthIdentity> {
  const profile = await providerJSON('https://api.linkedin.com/v2/userinfo', accessToken);
  return linkedinIdentity(issuer, { id: profile?.sub, displayName: profile?.name, _json: profile }, idProfile);
}
