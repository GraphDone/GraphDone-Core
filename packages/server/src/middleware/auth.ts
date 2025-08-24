import { verifyToken } from '../resolvers/auth';

export interface AuthUser {
  userId: string;
  email: string;
  role: string;
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
    return {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role
    };
  } catch (error) {
    return null;
  }
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