export interface User {
  id: string;
  name: string;
  email: string;
  username: string;
  avatar?: string;
  role: 'NODE_WATCHER' | 'CONNECTOR' | 'ORIGIN_NODE' | 'PATH_KEEPER' | 'GRAPH_MASTER';
  isActive: boolean;
  isEmailVerified: boolean;
  lastLogin?: string;
  team?: Team;
}

export interface Team {
  id: string;
  name: string;
  description?: string;
  logo?: string;
  isActive: boolean;
}

export interface AuthContextType {
  currentUser: User | null;
  currentTeam: Team | null;
  availableUsers: User[]; // Legacy - empty for real auth
  availableTeams: Team[]; // Legacy - empty for real auth
  login: (user: User, token?: string) => void;
  logout: () => void;
  switchUser: (userId: string) => void; // Legacy
  switchTeam: (teamId: string) => void; // Legacy
  isAuthenticated: boolean;
  isInitializing: boolean;
}