export interface Graph {
  id: string;
  name: string;
  description?: string;
  type: 'PROJECT' | 'WORKSPACE' | 'SUBGRAPH' | 'TEMPLATE';
  status: 'ACTIVE' | 'ARCHIVED' | 'DRAFT';
  parentGraphId?: string;
  teamId: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  
  // Hierarchy
  children?: Graph[];
  parent?: Graph;
  depth: number;
  path: string[]; // Array of parent graph IDs
  
  // Permissions and sharing
  permissions: GraphPermissions;
  isShared: boolean;
  shareSettings: ShareSettings;
  
  // Metadata
  nodeCount: number;
  edgeCount: number;
  contributorCount: number;
  lastActivity: string;
  
  // Display settings
  settings: GraphSettings;
}

export interface GraphPermissions {
  owner: string;
  admins: string[];
  editors: string[];
  viewers: string[];
  teamPermission: 'NONE' | 'VIEW' | 'EDIT' | 'ADMIN';
}

export interface ShareSettings {
  isPublic: boolean;
  allowTeamAccess: boolean;
  allowCopying: boolean;
  allowForking: boolean;
  shareLink?: string;
  expiresAt?: string;
}

export interface GraphSettings {
  theme: 'light' | 'dark' | 'auto';
  layout: 'force' | 'hierarchical' | 'circular' | 'grid';
  showPriorities: boolean;
  showDependencies: boolean;
  autoLayout: boolean;
  zoomLevel: number;
  centerNode?: string;
}

export interface GraphHierarchy {
  id: string;
  name: string;
  type: Graph['type'];
  children: GraphHierarchy[];
  nodeCount: number;
  isShared: boolean;
  permissions: 'OWNER' | 'ADMIN' | 'EDIT' | 'VIEW';
}

export interface CreateGraphInput {
  name: string;
  description?: string;
  type: Graph['type'];
  parentGraphId?: string;
  teamId: string;
  templateId?: string;
  copyFromGraphId?: string;
}

export interface GraphContextType {
  // Current graph state
  currentGraph: Graph | null;
  availableGraphs: Graph[];
  graphHierarchy: GraphHierarchy[];
  
  // Loading states
  isLoading: boolean;
  isCreating: boolean;
  
  // Actions
  selectGraph: (graphId: string) => Promise<void>;
  createGraph: (input: CreateGraphInput) => Promise<Graph>;
  updateGraph: (graphId: string, updates: Partial<Graph>) => Promise<Graph>;
  deleteGraph: (graphId: string) => Promise<void>;
  duplicateGraph: (graphId: string, name: string) => Promise<Graph>;
  
  // Hierarchy management
  moveGraph: (graphId: string, newParentId?: string) => Promise<void>;
  getGraphPath: (graphId: string) => Graph[];
  getGraphChildren: (graphId: string) => Graph[];
  
  // Sharing and permissions
  shareGraph: (graphId: string, settings: Partial<ShareSettings>) => Promise<void>;
  updatePermissions: (graphId: string, permissions: Partial<GraphPermissions>) => Promise<void>;
  joinSharedGraph: (shareLink: string) => Promise<Graph>;
  
  // Utilities
  canEditGraph: (graphId: string) => boolean;
  canDeleteGraph: (graphId: string) => boolean;
  canShareGraph: (graphId: string) => boolean;
  refreshGraphs: () => Promise<void>;
}