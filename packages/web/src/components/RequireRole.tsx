import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import type { Role } from '../lib/roleAccess';

// Router-level role guard: if the current user's role fails `can`, redirect home
// instead of mounting the protected page. Defense-in-depth on top of each page's
// own check and the server-side (Worker) authorization.
export function RequireRole({ can, children }: { can: (role: Role) => boolean; children: ReactNode }) {
  const { currentUser } = useAuth();
  if (!can(currentUser?.role)) return <Navigate to="/" replace />;
  return <>{children}</>;
}
