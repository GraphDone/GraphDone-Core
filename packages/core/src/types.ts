export type NodeId = string;
export type EdgeId = string;
export type ContributorId = string;

export enum NodeType {
  OUTCOME = 'OUTCOME',
  TASK = 'TASK',
  MILESTONE = 'MILESTONE',
  IDEA = 'IDEA'
}

export enum NodeStatus {
  PROPOSED = 'PROPOSED',
  ACTIVE = 'ACTIVE',
  IN_PROGRESS = 'IN_PROGRESS',
  BLOCKED = 'BLOCKED',
  COMPLETED = 'COMPLETED',
  ARCHIVED = 'ARCHIVED'
}

export enum ContributorType {
  HUMAN = 'HUMAN',
  AI_AGENT = 'AI_AGENT'
}

export interface SphericalCoordinate {
  radius: number;
  theta: number;
  phi: number;
}

export interface CartesianCoordinate {
  x: number;
  y: number;
  z: number;
}

export interface Priority {
  executive: number;
  individual: number;
  community: number;
  computed: number;
}

export interface Contributor {
  id: ContributorId;
  type: ContributorType;
  name: string;
  avatarUrl?: string;
  capabilities?: string[];
}

export interface GraphNode {
  id: NodeId;
  type: NodeType;
  title: string;
  description?: string;
  position: SphericalCoordinate;
  priority: Priority;
  status: NodeStatus;
  contributors: ContributorId[];
  dependencies: NodeId[];
  dependents: NodeId[];
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, unknown>;
}

export interface GraphEdge {
  id: EdgeId;
  source: NodeId;
  target: NodeId;
  type: EdgeType;
  weight: number;
  metadata?: Record<string, unknown>;
}

export enum EdgeType {
  DEPENDS_ON = 'DEPENDS_ON',
  BLOCKS = 'BLOCKS',
  ENABLES = 'ENABLES',
  RELATES_TO = 'RELATES_TO',
  IS_PART_OF = 'IS_PART_OF',
  FOLLOWS = 'FOLLOWS',
  PARALLEL_WITH = 'PARALLEL_WITH',
  DUPLICATES = 'DUPLICATES',
  CONFLICTS_WITH = 'CONFLICTS_WITH',
  VALIDATES = 'VALIDATES',
  REFERENCES = 'REFERENCES',
  CONTAINS = 'CONTAINS'
}