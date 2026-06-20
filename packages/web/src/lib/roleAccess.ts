export type Role = string | null | undefined;

// Single source of truth for role-gated routes — used by BOTH the router guard
// (RequireRole) and the sidebar nav, so they can never drift. Mirrors the
// server-side authorization (the Worker independently enforces "Admins only.").
export const canAccessAdmin = (role: Role): boolean => role === 'ADMIN';

export const canAccessBackend = (role: Role): boolean => role !== 'GUEST' && role !== 'VIEWER';
