// Project management specific types and mock data

export type RelationshipType = 
  | 'DEPENDS_ON'      // This node depends on another to be completed
  | 'BLOCKS'          // This node blocks another from starting
  | 'ENABLES'         // This node enables another (similar to depends but softer)
  | 'RELATES_TO'      // General relationship
  | 'PART_OF'         // This node is a part/component of another
  | 'FOLLOWS'         // This node should be done after another (sequence)
  | 'PARALLEL_WITH'   // This node can be done in parallel with another
  | 'DUPLICATES'      // This node duplicates effort of another
  | 'CONFLICTS_WITH'  // This node conflicts with another
  | 'VALIDATES'       // This node validates/tests another

export interface MockNode {
  id: string;
  title: string;
  description?: string;
  type: 'OUTCOME' | 'TASK' | 'MILESTONE' | 'EPIC' | 'BUG' | 'FEATURE';
  status: 'PROPOSED' | 'PLANNED' | 'IN_PROGRESS' | 'BLOCKED' | 'COMPLETED' | 'CANCELLED';
  priority: {
    executive: number;
    individual: number;
    community: number;
    computed: number;
  };
  position: {
    x: number;
    y: number;
    z: number;
  };
  assignee?: string;
  estimatedHours?: number;
  actualHours?: number;
  dueDate?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface MockEdge {
  id: string;
  source: string;
  target: string;
  type: RelationshipType;
  strength: number; // 0-1, how strong the relationship is
  description?: string;
  createdAt: string;
}

// Mock project management data
export const mockProjectNodes: MockNode[] = [
  {
    id: 'node-1',
    title: 'User Authentication System',
    description: 'Implement secure user login and registration',
    type: 'EPIC',
    status: 'IN_PROGRESS',
    priority: { executive: 0.9, individual: 0.8, community: 0.85, computed: 0.85 },
    position: { x: 0, y: 0, z: 0 },
    assignee: 'Alice Johnson',
    estimatedHours: 40,
    actualHours: 25,
    dueDate: '2024-04-15',
    tags: ['security', 'backend', 'critical'],
    createdAt: '2024-03-01T10:00:00Z',
    updatedAt: '2024-03-20T15:30:00Z'
  },
  {
    id: 'node-2',
    title: 'Login API Endpoint',
    description: 'REST API for user authentication',
    type: 'TASK',
    status: 'COMPLETED',
    priority: { executive: 0.8, individual: 0.9, community: 0.7, computed: 0.8 },
    position: { x: -200, y: -100, z: 0 },
    assignee: 'Bob Smith',
    estimatedHours: 8,
    actualHours: 6,
    tags: ['api', 'backend'],
    createdAt: '2024-03-02T09:00:00Z',
    updatedAt: '2024-03-15T11:20:00Z'
  },
  {
    id: 'node-3',
    title: 'Registration Form UI',
    description: 'User-friendly registration interface',
    type: 'TASK',
    status: 'IN_PROGRESS',
    priority: { executive: 0.6, individual: 0.8, community: 0.75, computed: 0.72 },
    position: { x: 200, y: -100, z: 0 },
    assignee: 'Carol Davis',
    estimatedHours: 12,
    actualHours: 8,
    tags: ['ui', 'frontend'],
    createdAt: '2024-03-03T14:00:00Z',
    updatedAt: '2024-03-19T16:45:00Z'
  },
  {
    id: 'node-4',
    title: 'Password Reset Flow',
    description: 'Allow users to reset forgotten passwords',
    type: 'FEATURE',
    status: 'PLANNED',
    priority: { executive: 0.5, individual: 0.6, community: 0.65, computed: 0.58 },
    position: { x: 0, y: 150, z: 0 },
    estimatedHours: 16,
    tags: ['security', 'feature'],
    createdAt: '2024-03-05T11:00:00Z',
    updatedAt: '2024-03-15T13:10:00Z'
  },
  {
    id: 'node-5',
    title: 'Database Schema',
    description: 'User and session tables design',
    type: 'TASK',
    status: 'COMPLETED',
    priority: { executive: 0.9, individual: 0.7, community: 0.8, computed: 0.8 },
    position: { x: -300, y: 0, z: 0 },
    assignee: 'David Wilson',
    estimatedHours: 6,
    actualHours: 4,
    tags: ['database', 'infrastructure'],
    createdAt: '2024-02-28T08:00:00Z',
    updatedAt: '2024-03-10T10:30:00Z'
  },
  {
    id: 'node-6',
    title: 'Security Testing',
    description: 'Penetration testing and vulnerability assessment',
    type: 'TASK',
    status: 'PLANNED',
    priority: { executive: 0.8, individual: 0.5, community: 0.7, computed: 0.67 },
    position: { x: 300, y: 100, z: 0 },
    estimatedHours: 20,
    tags: ['testing', 'security'],
    createdAt: '2024-03-10T15:00:00Z',
    updatedAt: '2024-03-18T09:15:00Z'
  },
  {
    id: 'node-7',
    title: 'Launch Milestone',
    description: 'Authentication system ready for production',
    type: 'MILESTONE',
    status: 'PROPOSED',
    priority: { executive: 0.95, individual: 0.8, community: 0.9, computed: 0.88 },
    position: { x: 0, y: 300, z: 0 },
    dueDate: '2024-04-30',
    tags: ['milestone', 'launch'],
    createdAt: '2024-03-01T10:00:00Z',
    updatedAt: '2024-03-20T15:30:00Z'
  },
  {
    id: 'node-8',
    title: 'Login Bug Fix',
    description: 'Fix session timeout issue',
    type: 'BUG',
    status: 'BLOCKED',
    priority: { executive: 0.7, individual: 0.9, community: 0.8, computed: 0.8 },
    position: { x: 100, y: 50, z: 0 },
    assignee: 'Alice Johnson',
    estimatedHours: 4,
    tags: ['bug', 'urgent'],
    createdAt: '2024-03-18T14:00:00Z',
    updatedAt: '2024-03-20T10:00:00Z'
  }
];

export const mockProjectEdges: MockEdge[] = [
  {
    id: 'edge-1',
    source: 'node-1',
    target: 'node-2',
    type: 'PART_OF',
    strength: 0.9,
    description: 'Login API is part of the auth system',
    createdAt: '2024-03-02T09:00:00Z'
  },
  {
    id: 'edge-2',
    source: 'node-1',
    target: 'node-3',
    type: 'PART_OF',
    strength: 0.8,
    description: 'Registration UI is part of the auth system',
    createdAt: '2024-03-03T14:00:00Z'
  },
  {
    id: 'edge-3',
    source: 'node-5',
    target: 'node-2',
    type: 'DEPENDS_ON',
    strength: 1.0,
    description: 'Login API needs database schema',
    createdAt: '2024-03-02T09:00:00Z'
  },
  {
    id: 'edge-4',
    source: 'node-2',
    target: 'node-3',
    type: 'ENABLES',
    strength: 0.7,
    description: 'Registration UI can use login API patterns',
    createdAt: '2024-03-03T14:00:00Z'
  },
  {
    id: 'edge-5',
    source: 'node-1',
    target: 'node-4',
    type: 'ENABLES',
    strength: 0.6,
    description: 'Auth system enables password reset',
    createdAt: '2024-03-05T11:00:00Z'
  },
  {
    id: 'edge-6',
    source: 'node-1',
    target: 'node-6',
    type: 'DEPENDS_ON',
    strength: 0.8,
    description: 'Security testing depends on auth implementation',
    createdAt: '2024-03-10T15:00:00Z'
  },
  {
    id: 'edge-7',
    source: 'node-6',
    target: 'node-7',
    type: 'DEPENDS_ON',
    strength: 0.9,
    description: 'Launch depends on security testing',
    createdAt: '2024-03-10T15:00:00Z'
  },
  {
    id: 'edge-8',
    source: 'node-1',
    target: 'node-7',
    type: 'DEPENDS_ON',
    strength: 1.0,
    description: 'Launch depends on auth system completion',
    createdAt: '2024-03-01T10:00:00Z'
  },
  {
    id: 'edge-9',
    source: 'node-2',
    target: 'node-8',
    type: 'BLOCKS',
    strength: 0.9,
    description: 'Login bug blocks API reliability',
    createdAt: '2024-03-18T14:00:00Z'
  },
  {
    id: 'edge-10',
    source: 'node-3',
    target: 'node-4',
    type: 'PARALLEL_WITH',
    strength: 0.5,
    description: 'Registration and password reset can be developed in parallel',
    createdAt: '2024-03-05T11:00:00Z'
  }
];

export const relationshipTypeInfo = {
  DEPENDS_ON: {
    color: '#ef4444',
    style: 'solid',
    description: 'Cannot start until dependency is complete',
    weight: 1.0
  },
  BLOCKS: {
    color: '#dc2626',
    style: 'dashed',
    description: 'Prevents progress on dependent item',
    weight: 0.9
  },
  ENABLES: {
    color: '#3b82f6',
    style: 'solid',
    description: 'Makes it easier or possible to do',
    weight: 0.7
  },
  RELATES_TO: {
    color: '#6b7280',
    style: 'dotted',
    description: 'General relationship or similarity',
    weight: 0.3
  },
  PART_OF: {
    color: '#059669',
    style: 'solid',
    description: 'Component or subset of larger item',
    weight: 0.8
  },
  FOLLOWS: {
    color: '#7c3aed',
    style: 'solid',
    description: 'Should be done after (sequence)',
    weight: 0.6
  },
  PARALLEL_WITH: {
    color: '#0891b2',
    style: 'dotted',
    description: 'Can be done at the same time',
    weight: 0.4
  },
  DUPLICATES: {
    color: '#ea580c',
    style: 'dashed',
    description: 'Duplicate effort or conflicting work',
    weight: 0.5
  },
  CONFLICTS_WITH: {
    color: '#be123c',
    style: 'dashed',
    description: 'Incompatible or opposing goals',
    weight: 0.8
  },
  VALIDATES: {
    color: '#16a34a',
    style: 'dotted',
    description: 'Tests or validates functionality',
    weight: 0.6
  }
};