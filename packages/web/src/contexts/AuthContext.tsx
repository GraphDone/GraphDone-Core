import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useLazyQuery, gql } from '@apollo/client';
import { User, Team, AuthContextType } from '../types/auth';
import { getToken, getUserRaw, setSession, setUser, clearSession, isKept } from '../lib/authStorage';

const ME_QUERY = gql`
  query Me {
    me {
      id
      email
      username
      name
      avatar
      role
      isActive
      isEmailVerified
      lastLogin
      team {
        id
        name
        description
      }
    }
  }
`;

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentTeam, setCurrentTeam] = useState<Team | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  
  const [getMe, { data: meData, error: meError }] = useLazyQuery(ME_QUERY);
  
  // Handle ME query results with useEffect
  useEffect(() => {
    if (meData) {
      if (meData.me) {
        setCurrentUser(meData.me);
        setCurrentTeam(meData.me.team);
        // Refresh the cached user so it stays in sync with the server.
        setUser(meData.me);
      } else {
        // ME query returned null, clear stale data
        clearSession();
        setCurrentUser(null);
        setCurrentTeam(null);
      }
      setIsInitializing(false);
    }
  }, [meData]);
  
  useEffect(() => {
    if (!meError) return;
    // Only log the user out on a GENUINE auth failure. A transient network/5xx
    // blip must not wipe the token (that was silently logging guests out).
    const isAuthFailure =
      meError.graphQLErrors?.some((e: { extensions?: { code?: string } }) => e.extensions?.code === 'UNAUTHENTICATED') ||
      (meError.networkError as { statusCode?: number } | null)?.statusCode === 401 ||
      (meError.networkError as { statusCode?: number } | null)?.statusCode === 403;
    if (isAuthFailure) {
      clearSession();
      setCurrentUser(null);
      setCurrentTeam(null);
    } else if (!currentUser) {
      // Transient error — keep the session and hydrate from the cached user so a
      // momentary backend hiccup leaves the app usable instead of bouncing to login.
      const raw = getUserRaw();
      if (raw) {
        try { const u = JSON.parse(raw); setCurrentUser(u); setCurrentTeam(u.team ?? null); } catch { /* corrupt cache — ignore */ }
      }
    }
    setIsInitializing(false);
  }, [meError]);

  // Load saved session (localStorage if "keep me logged in", else sessionStorage)
  // and validate the token on mount.
  useEffect(() => {
    const token = getToken();
    const savedUser = getUserRaw();

    if (token) {
      if (savedUser) {
        try {
          JSON.parse(savedUser);
        } catch (error) {
          // Corrupt cache — drop it; the ME query will repopulate.
          clearSession();
        }
      }
      getMe();
    } else {
      setIsInitializing(false);
    }
  }, [getMe]);

  // keepLoggedIn defaults to the user's last choice (true unless they opted out)
  // so callers that don't pass it (e.g. guest login) honour the preference.
  const login = (user: User, token?: string, keepLoggedIn: boolean = isKept()) => {
    setCurrentUser(user);
    setCurrentTeam(user.team || null);

    if (token) {
      setSession(token, user, keepLoggedIn);
    } else {
      // No new token (e.g. a user refresh) — just update the cached user.
      setUser(user);
    }
  };

  const logout = () => {
    setCurrentUser(null);
    setCurrentTeam(null);
    clearSession();
  };

  const switchUser = (_userId: string) => {
    // This would need to be implemented with proper API calls
    console.warn('switchUser not implemented with real authentication');
  };

  const switchTeam = (_teamId: string) => {
    // This would need to be implemented with proper API calls
    console.warn('switchTeam not implemented with real authentication');
  };

  const value: AuthContextType = {
    currentUser,
    currentTeam,
    availableUsers: [], // Not needed for real auth
    availableTeams: [], // Not needed for real auth
    login,
    logout,
    switchUser,
    switchTeam,
    isAuthenticated: !!currentUser,
    isInitializing
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}