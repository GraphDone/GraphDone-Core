export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: 'admin' | 'member' | 'viewer';
  teamId: string;
}

export interface Team {
  id: string;
  name: string;
  description?: string;
  memberCount: number;
}

export interface AuthContextType {
  currentUser: User | null;
  currentTeam: Team | null;
  availableUsers: User[];
  availableTeams: Team[];
  login: (user: User) => void;
  logout: () => void;
  switchUser: (userId: string) => void;
  switchTeam: (teamId: string) => void;
  isAuthenticated: boolean;
}