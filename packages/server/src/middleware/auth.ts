import { verifyToken } from '../utils/auth.js';
import { sqliteAuthStore } from '../auth/sqlite-auth.js';

export interface AuthUser {
  userId: string;
  email: string;
  role: string;
  authVersion: number;
}

export function extractUserFromToken(authHeader?: string): AuthUser | null {
  if (!authHeader) {
    return null;
  }

  const token = authHeader.replace('Bearer ', '');
  if (!token) {
    return null;
  }

  try {
    const decoded = verifyToken(token);
    const authVersion = decoded?.authVersion === undefined ? 0 : decoded.authVersion;
    if (!decoded || typeof decoded.userId !== 'string' || typeof decoded.email !== 'string'
      || typeof decoded.role !== 'string' || !Number.isSafeInteger(authVersion) || authVersion < 0) return null;
    return {
      authVersion,
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role
    };
  } catch (error) {
    return null;
  }
}

export async function resolveActiveAuthUser(authHeader?: string): Promise<AuthUser | null> {
  const claims = extractUserFromToken(authHeader);
  if (!claims) return null;
  const account = await sqliteAuthStore.findUserById(claims.userId);
  if (account?.isActive && account.authVersion === claims.authVersion) {
    return { userId: account.id, email: account.email, role: account.role, authVersion: account.authVersion };
  }
  if (!account && claims.role === 'GUEST' && claims.authVersion === 0
    && /^guest-[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(claims.userId)) return claims;
  return null;
}

export function requireAuth(user: AuthUser | null | undefined): AuthUser {
  if (!user) {
    throw new Error('Authentication required');
  }
  return user;
}

export function requireRole(user: AuthUser | null | undefined, allowedRoles: string[]): AuthUser {
  const authenticatedUser = requireAuth(user);
  
  if (!allowedRoles.includes(authenticatedUser.role)) {
    throw new Error('Insufficient permissions');
  }
  
  return authenticatedUser;
}