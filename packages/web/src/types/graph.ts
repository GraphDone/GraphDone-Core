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
  tags?: string[];
  defaultRole?: string;
  
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
  edgeCount: number;
  isShared: boolean;
  permissions: 'OWNER' | 'ADMIN' | 'EDIT' | 'VIEW';
}

export interface WorkItem {
  id: string;
  title: string;
  description?: string;
  type: string;
  status: string;
  priorityExec?: number;
  priorityIndiv?: number;
  priorityComm?: number;
  priorityComp?: number;
  dueDate?: string;
  tags?: string[];
  assignedTo?: {
    id: string;
    name: string;
    username: string;
  } | string;
  owner?: {
    id: string;
    name: string;
    username: string;
  };
  createdAt?: string;
  updatedAt?: string;
  // Additional fields that may exist in InteractiveGraphVisualization's WorkItem
  positionX?: number;
  positionY?: number;
  positionZ?: number;
  teamId?: string;
  userId?: string;
  dependencies?: WorkItem[];
  dependents?: WorkItem[];
  priority?: {
    executive: number;
    individual: number;
    community: number;
    computed: number;
  };
}

export type RelationshipType = 
  | 'DEPENDS_ON'      // This node depends on another to be completed
  | 'BLOCKS'          // This node blocks another from starting
  | 'ENABLES'         // This node enables another (similar to depends but softer)
  | 'RELATES_TO'      // General relationship
  | 'IS_PART_OF'      // This node is a part/component of another
  | 'FOLLOWS'         // This node should be done after another (sequence)
  | 'PARALLEL_WITH'   // This node can be done in parallel with another
  | 'DUPLICATES'      // This node duplicates effort of another
  | 'CONFLICTS_WITH'  // This node conflicts with another
  | 'VALIDATES'       // This node validates/tests another
  | 'REFERENCES'      // This node references another node
  | 'CONTAINS'        // This node contains another node

export interface WorkItemEdge {
  id: string;
  source: string;
  target: string;
  type: RelationshipType;
  strength?: number;
  description?: string;
}

export interface CreateGraphInput {
  name: string;
  description?: string;
  type: Graph['type'];
  parentGraphId?: string;
  teamId: string;
  createdBy: string;
  templateId?: string;
  copyFromGraphId?: string;
  tags?: string[];
  defaultRole?: string;
  isShared?: boolean;
  status?: 'ACTIVE' | 'ARCHIVED' | 'DRAFT';
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