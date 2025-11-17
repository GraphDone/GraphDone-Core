import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useLazyQuery, useMutation, gql } from '@apollo/client';
import { User, Team, AuthContextType } from '../types/auth';

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

const GUEST_LOGIN_MUTATION = gql`
  mutation GuestLogin {
    guestLogin {
      token
      user {
        id
        email
        username
        name
        avatar
        role
        isActive
        isEmailVerified
        team {
          id
          name
          description
        }
      }
    }
  }
`;

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
  autoGuestLogin?: boolean;
}

export function AuthProvider({ children, autoGuestLogin = false }: AuthProviderProps) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentTeam, setCurrentTeam] = useState<Team | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  const [getMe] = useLazyQuery(ME_QUERY, {
    onCompleted: (data) => {
      if (data.me) {
        setCurrentUser(data.me);
        setCurrentTeam(data.me.team);
      } else {
        // ME query returned null, clear stale data
        localStorage.removeItem('authToken');
        localStorage.removeItem('currentUser');
        setCurrentUser(null);
        setCurrentTeam(null);
      }
      setIsInitializing(false);
    },
    onError: (error) => {
      // Token is invalid, clear it
      localStorage.removeItem('authToken');
      localStorage.removeItem('currentUser');
      setCurrentUser(null);
      setCurrentTeam(null);
      setIsInitializing(false);
    }
  });

  const [performGuestLogin] = useMutation(GUEST_LOGIN_MUTATION, {
    onCompleted: (data) => {
      if (data.guestLogin) {
        setCurrentUser(data.guestLogin.user);
        setCurrentTeam(data.guestLogin.user.team || null);
        localStorage.setItem('authToken', data.guestLogin.token);
        localStorage.setItem('currentUser', JSON.stringify(data.guestLogin.user));
      }
      setIsInitializing(false);
    },
    onError: (error) => {
      console.error('Auto guest login failed:', error);
      setIsInitializing(false);
    }
  });

  // Load saved user from localStorage and validate token on mount
  useEffect(() => {
    const token = localStorage.getItem('authToken');
    const savedUser = localStorage.getItem('currentUser');

    if (token && savedUser) {
      try {
        JSON.parse(savedUser);
        // Validate token by fetching current user data
        getMe();
      } catch (error) {
        // Invalid saved data, clear it
        localStorage.removeItem('authToken');
        localStorage.removeItem('currentUser');
        setIsInitializing(false);
      }
    } else if (autoGuestLogin) {
      // Auto-login as guest if no token exists and autoGuestLogin is enabled
      performGuestLogin();
    } else {
      setIsInitializing(false);
    }
  }, [getMe, autoGuestLogin, performGuestLogin]);

  const login = (user: User, token?: string) => {
    setCurrentUser(user);
    setCurrentTeam(user.team || null);
    
    if (token) {
      localStorage.setItem('authToken', token);
    }
    localStorage.setItem('currentUser', JSON.stringify(user));
  };

  const logout = () => {
    setCurrentUser(null);
    setCurrentTeam(null);
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentUser');
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