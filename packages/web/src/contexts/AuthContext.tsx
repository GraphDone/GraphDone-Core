import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, Team, AuthContextType } from '../types/auth';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Mock data for demonstration
const mockUsers: User[] = [
  {
    id: 'user-1',
    name: 'Alice Johnson',
    email: 'alice@graphdone.com',
    avatar: '👩‍💼',
    role: 'admin',
    teamId: 'team-1'
  },
  {
    id: 'user-2',
    name: 'Bob Smith',
    email: 'bob@graphdone.com',
    avatar: '👨‍💻',
    role: 'member',
    teamId: 'team-1'
  },
  {
    id: 'user-3',
    name: 'Carol Davis',
    email: 'carol@graphdone.com',
    avatar: '👩‍🎨',
    role: 'member',
    teamId: 'team-1'
  },
  {
    id: 'user-4',
    name: 'David Wilson',
    email: 'david@graphdone.com',
    avatar: '👨‍🔬',
    role: 'viewer',
    teamId: 'team-2'
  },
  {
    id: 'user-5',
    name: 'Eva Martinez',
    email: 'eva@graphdone.com',
    avatar: '👩‍🚀',
    role: 'admin',
    teamId: 'team-2'
  }
];

const mockTeams: Team[] = [
  {
    id: 'team-1',
    name: 'Product Team',
    description: 'Building the next generation features',
    memberCount: 8
  },
  {
    id: 'team-2',
    name: 'Research Team',
    description: 'Exploring new technologies and approaches',
    memberCount: 5
  },
  {
    id: 'team-3',
    name: 'Design Team',
    description: 'Creating beautiful and intuitive experiences',
    memberCount: 4
  }
];

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentTeam, setCurrentTeam] = useState<Team | null>(null);

  // Load saved user from localStorage on mount
  useEffect(() => {
    const savedUserId = localStorage.getItem('currentUserId');
    if (savedUserId) {
      const user = mockUsers.find(u => u.id === savedUserId);
      if (user) {
        setCurrentUser(user);
        const team = mockTeams.find(t => t.id === user.teamId);
        setCurrentTeam(team || null);
      }
    }
  }, []);

  const login = (user: User) => {
    setCurrentUser(user);
    const team = mockTeams.find(t => t.id === user.teamId);
    setCurrentTeam(team || null);
    localStorage.setItem('currentUserId', user.id);
  };

  const logout = () => {
    setCurrentUser(null);
    setCurrentTeam(null);
    localStorage.removeItem('currentUserId');
  };

  const switchUser = (userId: string) => {
    const user = mockUsers.find(u => u.id === userId);
    if (user) {
      login(user);
    }
  };

  const switchTeam = (teamId: string) => {
    const team = mockTeams.find(t => t.id === teamId);
    if (team) {
      setCurrentTeam(team);
      // Find a user in this team or keep current user
      const teamUser = mockUsers.find(u => u.teamId === teamId);
      if (teamUser && teamUser.id !== currentUser?.id) {
        setCurrentUser(teamUser);
        localStorage.setItem('currentUserId', teamUser.id);
      }
    }
  };

  const value: AuthContextType = {
    currentUser,
    currentTeam,
    availableUsers: mockUsers,
    availableTeams: mockTeams,
    login,
    logout,
    switchUser,
    switchTeam,
    isAuthenticated: !!currentUser
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