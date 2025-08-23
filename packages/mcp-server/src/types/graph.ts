// Proper type definitions for GraphDone MCP Server
import { Integer as Neo4jInteger } from 'neo4j-driver';

// Common type for Neo4j values to eliminate any usage
export type Neo4jValue = string | number | boolean | null | undefined | Neo4jInteger | Date | string[] | number[] | Record<string, unknown>;

export type NodeType = 'OUTCOME' | 'EPIC' | 'INITIATIVE' | 'STORY' | 'TASK' | 'BUG' | 'FEATURE' | 'MILESTONE';

export type NodeStatus = 'PROPOSED' | 'ACTIVE' | 'IN_PROGRESS' | 'BLOCKED' | 'COMPLETED' | 'ARCHIVED';

export type EdgeType = 'DEPENDS_ON' | 'BLOCKS' | 'RELATES_TO' | 'CONTAINS' | 'PART_OF';

export type GraphType = 'PROJECT' | 'WORKSPACE' | 'SUBGRAPH' | 'TEMPLATE';

export type GraphStatus = 'ACTIVE' | 'ARCHIVED' | 'DRAFT' | 'LOCKED';

export type PriorityType = 'composite' | 'executive' | 'individual' | 'community';

// Metadata interfaces - specific types instead of Record<string, any>
export interface NodeMetadata {
  tags?: string[];
  labels?: string[];
  complexity?: number;
  estimatedHours?: number;
  actualHours?: number;
  assignedTo?: string[];
  dueDate?: string;
  createdBy?: string;
  externalId?: string;
  [key: string]: unknown; // Allow additional properties but with proper typing
}

export interface EdgeMetadata {
  strength?: number;
  confidence?: number;
  createdBy?: string;
  reason?: string;
  automatic?: boolean;
  [key: string]: unknown;
}

export interface GraphSettings {
  theme?: string;
  visibility?: 'public' | 'private' | 'team';
  autoSave?: boolean;
  notifications?: boolean;
  layout?: 'force' | 'hierarchical' | 'circular';
  defaultNodeType?: NodeType;
  allowExternalContributors?: boolean;
  [key: string]: unknown;
}

// Query parameter interfaces
export interface QueryFilters {
  node_type?: NodeType;
  status?: NodeStatus;
  contributor_id?: string;
  min_priority?: number;
  node_id?: string;
  search_term?: string;
  limit?: number;
  offset?: number;
}

export interface GraphFilters {
  type?: GraphType;
  status?: GraphStatus;
  teamId?: string;
  isShared?: boolean;
  limit?: number;
  offset?: number;
}

// Neo4j response types (using imported Neo4jInteger from driver)

export interface Neo4jDateTime {
  toString(): string;
}

export interface Neo4jRecord<T = Record<string, unknown>> {
  get(key: string): T;
}

export interface Neo4jResult<T = Record<string, unknown>> {
  records: Neo4jRecord<T>[];
}

// API Response types
export interface MCPContent {
  type: 'text';
  text: string;
}

export interface MCPResponse {
  content: MCPContent[];
  isError?: boolean;
}

// Neo4j parameter types - using Neo4jValue for type safety
export interface Neo4jParams {
  [key: string]: Neo4jValue;
}

// Specific parameter interfaces for better type safety
export interface NodeProperties {
  id: string;
  title?: string;
  description?: string;
  type?: NodeType;
  status?: NodeStatus;
  priorityComp?: number;
  positionX?: number;
  positionY?: number;
  positionZ?: number;
  createdAt?: Neo4jDateTime;
  updatedAt?: Neo4jDateTime;
}

export interface GraphProperties {
  id: string;
  name: string;
  description?: string;
  type: GraphType;
  status: GraphStatus;
  teamId?: string;
  parentGraphId?: string;
  isShared: boolean;
  settings: GraphSettings;
  createdAt: Neo4jDateTime;
  updatedAt: Neo4jDateTime;
  nodeCount: Neo4jInteger;
  edgeCount: Neo4jInteger;
  archivedAt?: Neo4jDateTime;
  archiveReason?: string;
  clonedFrom?: string;
}

// Neo4j wrapper types for relationships
export interface Neo4jNode {
  properties: NodeProperties;
}

export interface Neo4jContributor {
  properties: {
    id: string;
    name: string;
    type?: string;
  };
}

export interface Neo4jPathSegment {
  start: Neo4jNode;
  end: Neo4jNode;
  relationship: {
    type: EdgeType;
    properties: EdgeMetadata;
  };
}

export interface Neo4jPath {
  segments: Neo4jPathSegment[];
}

// Bulk operations types
export interface BulkOperationItem {
  operation: 'create' | 'update' | 'delete';
  data: NodeProperties | { node_id: string };
}

export interface BulkOperationParams {
  operations: BulkOperationItem[];
  transaction?: boolean;
  rollback_on_error?: boolean;
}

// Analysis result types - using Neo4jValue for type safety
export interface AnalysisResults {
  [key: string]: Neo4jValue;
}

export interface WorkloadData {
  contributor_id: string;
  active_items: number;
  blocked_items: number;
  avg_priority: number;
  work_types: string[];
  total_items: number;
  in_progress_items: number;
}

export interface CapacityAnalysis {
  total_contributors: number;
  available_capacity: number;
  utilization_rate: number;
  bottlenecks: string[];
}

export interface WorkloadPredictions {
  projected_completion_date?: string;
  capacity_shortage?: boolean;
  recommended_actions: string[];
  completion_trends?: string;
  bottleneck_predictions?: unknown[];
  capacity_recommendations?: unknown[];
}

// MCP Interface Args - exported for index.ts
export interface UpdatePrioritiesArgs {
  node_id: string;
  priority_executive?: number;
  priority_individual?: number;
  priority_community?: number;
  recalculate_computed?: boolean;
}

export interface BulkUpdatePrioritiesArgs {
  updates: Array<{
    node_id: string;
    priority_executive?: number;
    priority_individual?: number;
    priority_community?: number;
  }>;
  recalculate_all?: boolean;
}

export interface GetPriorityInsightsArgs {
  filters?: {
    min_priority?: number;
    priority_type?: 'executive' | 'individual' | 'community' | 'computed';
    node_types?: string[];
    status?: string[];
  };
  include_statistics?: boolean;
  include_trends?: boolean;
}

export interface GetContributorPrioritiesArgs {
  contributor_id: string;
  priority_type?: 'all' | 'executive' | 'individual' | 'community' | 'composite';
  status_filter?: NodeStatus[];
  limit?: number;
  include_dependencies?: boolean;
}

export interface GetContributorWorkloadArgs {
  contributor_id: string;
  include_type_distribution?: boolean;
  include_priority_distribution?: boolean;
  include_projects?: boolean;
  include_timeline?: boolean;
  time_window_days?: number;
}

export interface GetCollaborationNetworkArgs {
  focus_contributor?: string;
  project_scope?: string;
  time_window_days?: number;
  collaboration_strength?: 'all' | 'strong' | 'moderate' | 'weak';
  include_network_metrics?: boolean;
  include_recommendations?: boolean;
}

export interface BulkOperationsArgs {
  operations: Array<{
    type: 'create_node' | 'update_node' | 'create_edge' | 'delete_edge';
    params: Record<string, unknown>;
  }>;
  transaction?: boolean;
  rollback_on_error?: boolean;
}

export interface CreateGraphArgs {
  name: string;
  description?: string;
  type?: GraphType;
  settings?: GraphSettings;
  parentGraphId?: string;
  teamId?: string;
  isShared?: boolean;
}

export interface ListGraphsArgs {
  type?: GraphType;
  status?: GraphStatus;
  teamId?: string;
  isShared?: boolean;
  limit?: number;
  offset?: number;
}

export interface GetGraphDetailsArgs {
  graphId: string;
}

export interface UpdateGraphArgs {
  graphId: string;
  name?: string;
  description?: string;
  type?: GraphType;
  settings?: GraphSettings;
  isShared?: boolean;
  status?: GraphStatus;
}

export interface DeleteGraphArgs {
  graphId: string;
  force?: boolean;
}

export interface ArchiveGraphArgs {
  graphId: string;
  reason?: string;
}

export interface CloneGraphArgs {
  sourceGraphId: string;
  newName: string;
  includeNodes?: boolean;
  includeEdges?: boolean;
  newTeamId?: string;
}