// Project management specific types and mock data

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
  | 'REFERENCES'      // This node references another
  | 'CONTAINS'        // This node contains another

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
  contributor?: string;
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
    id: 'epic-1',
    title: 'User Authentication System',
    description: 'Complete user authentication and authorization system',
    type: 'EPIC',
    status: 'IN_PROGRESS',
    priority: { executive: 0.9, individual: 0.8, community: 0.85, computed: 0.85 },
    position: { x: 0, y: 0, z: 0 },
    contributor: 'Alice Johnson',
    estimatedHours: 120,
    actualHours: 80,
    dueDate: '2025-09-30',
    tags: ['security', 'backend', 'critical'],
    createdAt: '2025-08-01T10:00:00Z',
    updatedAt: '2025-08-17T15:30:00Z'
  },
  {
    id: 'feature-1',
    title: 'Login & Registration',
    description: 'Basic login and user registration functionality',
    type: 'FEATURE',
    status: 'COMPLETED',
    priority: { executive: 0.8, individual: 0.9, community: 0.7, computed: 0.8 },
    position: { x: -200, y: -100, z: 0 },
    contributor: 'Bob Smith',
    estimatedHours: 40,
    actualHours: 38,
    dueDate: '2025-08-25',
    tags: ['auth', 'frontend', 'backend'],
    createdAt: '2025-08-05T09:00:00Z',
    updatedAt: '2025-08-25T11:20:00Z'
  },
  {
    id: 'task-1',
    title: 'Database Schema Design',
    description: 'Design user and session tables with security considerations',
    type: 'TASK',
    status: 'COMPLETED',
    priority: { executive: 0.9, individual: 0.7, community: 0.8, computed: 0.8 },
    position: { x: -300, y: 0, z: 0 },
    contributor: 'David Wilson',
    estimatedHours: 16,
    actualHours: 14,
    dueDate: '2025-08-15',
    tags: ['database', 'infrastructure'],
    createdAt: '2025-08-01T08:00:00Z',
    updatedAt: '2025-08-15T10:30:00Z'
  },
  {
    id: 'task-2',
    title: 'Frontend Login Components',
    description: 'React components for login and registration forms',
    type: 'TASK',
    status: 'IN_PROGRESS',
    priority: { executive: 0.6, individual: 0.8, community: 0.75, computed: 0.72 },
    position: { x: 200, y: -100, z: 0 },
    contributor: 'Carol Davis',
    estimatedHours: 24,
    actualHours: 16,
    dueDate: '2025-09-05',
    tags: ['ui', 'frontend', 'react'],
    createdAt: '2025-08-10T14:00:00Z',
    updatedAt: '2025-08-17T16:45:00Z'
  },
  {
    id: 'feature-2',
    title: 'Password Reset System',
    description: 'Email-based password reset with secure tokens',
    type: 'FEATURE',
    status: 'PLANNED',
    priority: { executive: 0.5, individual: 0.6, community: 0.65, computed: 0.58 },
    position: { x: 0, y: 150, z: 0 },
    contributor: 'Bob Smith',
    estimatedHours: 32,
    dueDate: '2025-09-20',
    tags: ['security', 'email', 'tokens'],
    createdAt: '2025-08-05T11:00:00Z',
    updatedAt: '2025-08-15T13:10:00Z'
  },
  {
    id: 'epic-2',
    title: 'E-commerce Platform',
    description: 'Complete online shopping platform with cart and checkout',
    type: 'EPIC',
    status: 'PLANNED',
    priority: { executive: 0.85, individual: 0.9, community: 0.8, computed: 0.85 },
    position: { x: 400, y: 0, z: 0 },
    contributor: 'Emma Rodriguez',
    estimatedHours: 200,
    dueDate: '2025-12-15',
    tags: ['ecommerce', 'shopping', 'payments'],
    createdAt: '2025-08-01T10:00:00Z',
    updatedAt: '2025-08-17T15:30:00Z'
  },
  {
    id: 'feature-3',
    title: 'Product Catalog',
    description: 'Product browsing, search, and filtering functionality',
    type: 'FEATURE',
    status: 'IN_PROGRESS',
    priority: { executive: 0.7, individual: 0.8, community: 0.75, computed: 0.75 },
    position: { x: 300, y: -200, z: 0 },
    contributor: 'Michael Chen',
    estimatedHours: 48,
    actualHours: 12,
    dueDate: '2025-10-15',
    tags: ['catalog', 'search', 'frontend'],
    createdAt: '2025-08-15T09:00:00Z',
    updatedAt: '2025-08-17T14:20:00Z'
  },
  {
    id: 'feature-4',
    title: 'Shopping Cart & Checkout',
    description: 'Add to cart, modify quantities, and secure checkout process',
    type: 'FEATURE',
    status: 'PROPOSED',
    priority: { executive: 0.8, individual: 0.7, community: 0.75, computed: 0.75 },
    position: { x: 500, y: -100, z: 0 },
    estimatedHours: 64,
    dueDate: '2025-11-30',
    tags: ['cart', 'checkout', 'payments'],
    createdAt: '2025-08-01T10:00:00Z',
    updatedAt: '2025-08-17T15:30:00Z'
  },
  {
    id: 'task-3',
    title: 'Payment Gateway Integration',
    description: 'Integrate Stripe for secure payment processing',
    type: 'TASK',
    status: 'PLANNED',
    priority: { executive: 0.9, individual: 0.8, community: 0.85, computed: 0.85 },
    position: { x: 450, y: 100, z: 0 },
    contributor: 'Sarah Kim',
    estimatedHours: 40,
    dueDate: '2025-11-15',
    tags: ['payments', 'stripe', 'security'],
    createdAt: '2025-08-10T11:00:00Z',
    updatedAt: '2025-08-17T09:30:00Z'
  },
  {
    id: 'task-4',
    title: 'Security Testing',
    description: 'Comprehensive security audit and penetration testing',
    type: 'TASK',
    status: 'PLANNED',
    priority: { executive: 0.8, individual: 0.5, community: 0.7, computed: 0.67 },
    position: { x: 300, y: 100, z: 0 },
    contributor: 'Alex Thompson',
    estimatedHours: 32,
    dueDate: '2025-10-30',
    tags: ['testing', 'security', 'audit'],
    createdAt: '2025-08-10T15:00:00Z',
    updatedAt: '2025-08-17T09:15:00Z'
  },
  {
    id: 'milestone-1',
    title: 'Authentication MVP Launch',
    description: 'Basic authentication system ready for production',
    type: 'MILESTONE',
    status: 'PLANNED',
    priority: { executive: 0.95, individual: 0.8, community: 0.9, computed: 0.88 },
    position: { x: 0, y: 300, z: 0 },
    dueDate: '2025-09-30',
    tags: ['milestone', 'launch', 'mvp'],
    createdAt: '2025-08-01T10:00:00Z',
    updatedAt: '2025-08-17T15:30:00Z'
  },
  {
    id: 'milestone-2',
    title: 'E-commerce Beta Release',
    description: 'Full e-commerce platform ready for beta testing',
    type: 'MILESTONE',
    status: 'PROPOSED',
    priority: { executive: 0.9, individual: 0.8, community: 0.85, computed: 0.85 },
    position: { x: 400, y: 300, z: 0 },
    dueDate: '2025-12-15',
    tags: ['milestone', 'beta', 'ecommerce'],
    createdAt: '2025-08-01T10:00:00Z',
    updatedAt: '2025-08-17T15:30:00Z'
  },
  {
    id: 'bug-1',
    title: 'Session Timeout Issue',
    description: 'Users getting logged out unexpectedly',
    type: 'BUG',
    status: 'BLOCKED',
    priority: { executive: 0.7, individual: 0.9, community: 0.8, computed: 0.8 },
    position: { x: 100, y: 50, z: 0 },
    contributor: 'Alice Johnson',
    estimatedHours: 8,
    actualHours: 3,
    dueDate: '2025-08-25',
    tags: ['bug', 'urgent', 'session'],
    createdAt: '2025-08-16T14:00:00Z',
    updatedAt: '2025-08-17T10:00:00Z'
  },
  {
    id: 'task-5',
    title: 'API Rate Limiting',
    description: 'Implement rate limiting for API endpoints',
    type: 'TASK',
    status: 'BLOCKED',
    priority: { executive: 0.6, individual: 0.7, community: 0.65, computed: 0.65 },
    position: { x: 150, y: 200, z: 0 },
    contributor: 'Michael Chen',
    estimatedHours: 20,
    actualHours: 5,
    dueDate: '2025-09-10',
    tags: ['api', 'security', 'backend'],
    createdAt: '2025-08-12T09:00:00Z',
    updatedAt: '2025-08-17T14:00:00Z'
  },
  {
    id: 'epic-3',
    title: 'Mobile App Development',
    description: 'React Native mobile app for iOS and Android',
    type: 'EPIC',
    status: 'PROPOSED',
    priority: { executive: 0.6, individual: 0.7, community: 0.65, computed: 0.65 },
    position: { x: -400, y: 200, z: 0 },
    estimatedHours: 300,
    dueDate: '2026-03-31',
    tags: ['mobile', 'react-native', 'ios', 'android'],
    createdAt: '2025-08-01T10:00:00Z',
    updatedAt: '2025-08-17T15:30:00Z'
  }
];

export const mockProjectEdges: MockEdge[] = [
  // Database schema must be completed before any auth features
  {
    id: 'edge-1',
    source: 'task-1',
    target: 'feature-1',
    type: 'DEPENDS_ON',
    strength: 1.0,
    description: 'Login features need database schema',
    createdAt: '2025-08-01T09:00:00Z'
  },
  {
    id: 'edge-2',
    source: 'task-1',
    target: 'feature-2',
    type: 'DEPENDS_ON',
    strength: 1.0,
    description: 'Password reset needs database schema',
    createdAt: '2025-08-01T09:00:00Z'
  },
  // Auth epic contains login and password reset features
  {
    id: 'edge-3',
    source: 'feature-1',
    target: 'epic-1',
    type: 'IS_PART_OF',
    strength: 0.9,
    description: 'Login is part of auth system',
    createdAt: '2025-08-01T10:00:00Z'
  },
  {
    id: 'edge-4',
    source: 'feature-2',
    target: 'epic-1',
    type: 'IS_PART_OF',
    strength: 0.8,
    description: 'Password reset is part of auth system',
    createdAt: '2025-08-01T10:00:00Z'
  },
  {
    id: 'edge-5',
    source: 'task-2',
    target: 'epic-1',
    type: 'IS_PART_OF',
    strength: 0.7,
    description: 'Frontend components part of auth system',
    createdAt: '2025-08-10T14:00:00Z'
  },
  // Frontend depends on completed login feature
  {
    id: 'edge-6',
    source: 'feature-1',
    target: 'task-2',
    type: 'DEPENDS_ON',
    strength: 0.8,
    description: 'Frontend components need login API',
    createdAt: '2025-08-10T14:00:00Z'
  },
  // Bug blocking login reliability
  {
    id: 'edge-7',
    source: 'bug-1',
    target: 'feature-1',
    type: 'BLOCKS',
    strength: 0.9,
    description: 'Session bug affects login reliability',
    createdAt: '2025-08-16T14:00:00Z'
  },
  // Auth system must be complete before milestone
  {
    id: 'edge-8',
    source: 'epic-1',
    target: 'milestone-1',
    type: 'DEPENDS_ON',
    strength: 1.0,
    description: 'MVP launch needs auth system',
    createdAt: '2025-08-01T10:00:00Z'
  },
  // E-commerce features and dependencies
  {
    id: 'edge-9',
    source: 'feature-3',
    target: 'epic-2',
    type: 'IS_PART_OF',
    strength: 0.9,
    description: 'Product catalog part of e-commerce',
    createdAt: '2025-08-15T09:00:00Z'
  },
  {
    id: 'edge-10',
    source: 'feature-4',
    target: 'epic-2',
    type: 'IS_PART_OF',
    strength: 0.9,
    description: 'Shopping cart part of e-commerce',
    createdAt: '2025-08-01T10:00:00Z'
  },
  {
    id: 'edge-11',
    source: 'task-3',
    target: 'epic-2',
    type: 'IS_PART_OF',
    strength: 0.8,
    description: 'Payment integration part of e-commerce',
    createdAt: '2025-08-10T11:00:00Z'
  },
  // Catalog must be ready before checkout
  {
    id: 'edge-12',
    source: 'feature-3',
    target: 'feature-4',
    type: 'DEPENDS_ON',
    strength: 0.8,
    description: 'Checkout needs product catalog',
    createdAt: '2025-08-15T09:00:00Z'
  },
  // Payment gateway needed for checkout
  {
    id: 'edge-13',
    source: 'task-3',
    target: 'feature-4',
    type: 'DEPENDS_ON',
    strength: 1.0,
    description: 'Checkout needs payment processing',
    createdAt: '2025-08-10T11:00:00Z'
  },
  // Auth system needed for e-commerce (user accounts)
  {
    id: 'edge-14',
    source: 'epic-1',
    target: 'epic-2',
    type: 'DEPENDS_ON',
    strength: 0.7,
    description: 'E-commerce needs user authentication',
    createdAt: '2025-08-01T10:00:00Z'
  },
  // Security testing before e-commerce launch
  {
    id: 'edge-15',
    source: 'task-4',
    target: 'epic-2',
    type: 'VALIDATES',
    strength: 0.8,
    description: 'Security testing validates e-commerce',
    createdAt: '2025-08-10T15:00:00Z'
  },
  // E-commerce completion needed for beta milestone
  {
    id: 'edge-16',
    source: 'epic-2',
    target: 'milestone-2',
    type: 'DEPENDS_ON',
    strength: 1.0,
    description: 'Beta release needs e-commerce platform',
    createdAt: '2025-08-01T10:00:00Z'
  },
  // Security testing blocks beta release
  {
    id: 'edge-17',
    source: 'task-4',
    target: 'milestone-2',
    type: 'DEPENDS_ON',
    strength: 0.9,
    description: 'Beta release needs security validation',
    createdAt: '2025-08-10T15:00:00Z'
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
  IS_PART_OF: {
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
  },
  REFERENCES: {
    color: '#6366f1',
    style: 'dotted',
    description: 'References or cites another',
    weight: 0.4
  },
  CONTAINS: {
    color: '#3b82f6',
    style: 'solid',
    description: 'Contains or encompasses another',
    weight: 0.7
  }
};