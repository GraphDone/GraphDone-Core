import { clearSession, getToken } from './authStorage';

export const signedOutNavigation = { go: (url: string) => window.location.replace(url) };

export function isSessionRevoked(code: unknown): boolean {
  return code === 'SESSION_REVOKED';
}

export function handleSessionRevoked(requestToken: string | null = getToken()): void {
  const token = getToken();
  if (!token || token === 'local-guest' || token !== requestToken) return;
  clearSession();
  signedOutNavigation.go('/login?error=signed_out');
}
