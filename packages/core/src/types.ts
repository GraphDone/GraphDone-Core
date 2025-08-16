export type NodeId = string;
export type EdgeId = string;
export type ContributorId = string;

export enum NodeType {
  OUTCOME = 'outcome',
  TASK = 'task',
  MILESTONE = 'milestone',
  IDEA = 'idea'
}

export enum NodeStatus {
  PROPOSED = 'proposed',
  ACTIVE = 'active',
  IN_PROGRESS = 'in_progress',
  BLOCKED = 'blocked',
  COMPLETED = 'completed',
  ARCHIVED = 'archived'
}

export enum ContributorType {
  HUMAN = 'human',
  AI_AGENT = 'ai_agent'
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
  DEPENDENCY = 'dependency',
  BLOCKS = 'blocks',
  RELATES_TO = 'relates_to',
  CONTAINS = 'contains'
}