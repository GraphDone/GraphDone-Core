import { Driver, Session, int } from 'neo4j-driver';
import {
  NodeType,
  NodeStatus,
  EdgeType,
  GraphType,
  GraphStatus,
  NodeMetadata,
  EdgeMetadata,
  GraphSettings,
  Neo4jValue,
  QueryFilters,
  GraphFilters,
  MCPResponse,
  Neo4jParams,
  Neo4jNode,
  Neo4jContributor,
  Neo4jPathSegment,
  AnalysisResults,
  WorkloadData,
  CapacityAnalysis,
  WorkloadPredictions
} from '../types/graph.js';
import {
  sanitizeString,
  sanitizeNodeId,
  sanitizeMetadata,
  sanitizeNodeType,
  sanitizeNodeStatus,
  sanitizePriority,
  validateBulkOperation,
  validateMemoryUsage
} from '../utils/sanitizer.js';
import {
  generateUniqueNodeId,
  generateUniqueEdgeId,
  generateUniqueGraphId,
  validateIdFormat,
  detectIdCollisions
} from '../utils/id-generator.js';

export interface PaginationInfo {
  total_count: number;
  current_page: number;
  total_pages: number;
  has_next_page: boolean;
  has_previous_page: boolean;
  limit: number;
  offset: number;
}

export interface BrowseGraphArgs {
  query_type?: 'all_nodes' | 'by_type' | 'by_status' | 'by_contributor' | 'by_priority' | 'dependencies' | 'search';
  filters?: QueryFilters;
}

export interface CreateNodeArgs {
  title?: string;
  description?: string;
  type?: NodeType;
  status?: NodeStatus;
  contributor_ids?: string[];
  metadata?: NodeMetadata;
}

export interface UpdateNodeArgs {
  node_id?: string;
  title?: string;
  description?: string;
  status?: NodeStatus;
  contributor_ids?: string[];
  metadata?: NodeMetadata;
}

export interface DeleteNodeArgs {
  node_id?: string;
}

export interface CreateEdgeArgs {
  source_id?: string;
  target_id?: string;
  type?: EdgeType;
  weight?: number;
  metadata?: EdgeMetadata;
}

export interface DeleteEdgeArgs {
  source_id?: string;
  target_id?: string;
  type?: EdgeType;
}

export interface GetNodeDetailsArgs {
  node_id?: string;
  relationships_limit?: number;
  relationships_offset?: number;
}

export interface FindPathArgs {
  start_id?: string;
  end_id?: string;
  max_depth?: number;
  limit?: number;
  offset?: number;
}

export interface DetectCyclesArgs {
  max_cycles?: number;
  limit?: number;
  offset?: number;
}

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

export interface AnalyzeGraphHealthArgs {
  include_metrics?: string[];
  depth_analysis?: boolean;
  team_id?: string;
}

export interface GetBottlenecksArgs {
  analysis_depth?: number;
  include_suggested_resolutions?: boolean;
  team_id?: string;
}

export interface BulkOperationsArgs {
  operations: Array<{
    type: 'create_node' | 'update_node' | 'create_edge' | 'delete_edge';
    params: CreateNodeArgs | UpdateNodeArgs | CreateEdgeArgs | DeleteEdgeArgs;
  }>;
  transaction?: boolean;
  rollback_on_error?: boolean;
}

export interface GetWorkloadAnalysisArgs {
  contributor_ids?: string[];
  time_window?: { start: string; end: string };
  include_capacity?: boolean;
  include_predictions?: boolean;
}

export interface CreateGraphArgs {
  name: string;
  description?: string;
  type?: GraphType;
  status?: GraphStatus;
  teamId?: string;
  parentGraphId?: string;
  isShared?: boolean;
  settings?: GraphSettings;
}

export interface UpdateGraphArgs {
  graphId: string;
  name?: string;
  description?: string;
  status?: GraphStatus;
  isShared?: boolean;
  settings?: GraphSettings;
}

export interface DeleteGraphArgs {
  graphId: string;
  force?: boolean;
}

export interface GetGraphDetailsArgs {
  graphId: string;
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
  teamId?: string;
}

export class GraphService {
  constructor(private driver: Driver) {}

  private async withSession<T>(work: (session: Session) => Promise<T>): Promise<T> {
    const session = this.driver.session();
    try {
      return await work(session);
    } finally {
      await session.close();
    }
  }

  private createPaginationInfo(totalCount: number, limit: number, offset: number): PaginationInfo {
    const currentPage = Math.floor(offset / limit) + 1;
    const totalPages = Math.ceil(totalCount / limit);
    
    return {
      total_count: totalCount,
      current_page: currentPage,
      total_pages: totalPages,
      has_next_page: currentPage < totalPages,
      has_previous_page: currentPage > 1,
      limit,
      offset
    };
  }

  async browseGraph(args: BrowseGraphArgs) {
    return this.withSession(async (session) => {
      const { query_type = 'all_nodes', filters = {} } = args;
      const limit = Math.floor(filters.limit || 50);
      const offset = Math.floor(filters.offset || 0);

      let query = '';
      let countQuery = '';
      let params: Neo4jParams = { 
        limit: int(limit),
        offset: int(offset)
      };

      switch (query_type) {
        case 'all_nodes':
          countQuery = `MATCH (n:WorkItem) RETURN count(n) as total`;
          query = `
            MATCH (n:WorkItem)
            RETURN n
            ORDER BY n.updatedAt DESC
            SKIP $offset
            LIMIT $limit
          `;
          break;

        case 'by_type':
          if (!filters.node_type) {
            throw new Error('node_type filter is required for by_type query');
          }
          countQuery = `MATCH (n:WorkItem) WHERE n.type = $node_type RETURN count(n) as total`;
          query = `
            MATCH (n:WorkItem)
            WHERE n.type = $node_type
            RETURN n
            ORDER BY n.updatedAt DESC
            SKIP $offset
            LIMIT $limit
          `;
          params.node_type = filters.node_type;
          break;

        case 'by_status':
          if (!filters.status) {
            throw new Error('status filter is required for by_status query');
          }
          countQuery = `MATCH (n:WorkItem) WHERE n.status = $status RETURN count(n) as total`;
          query = `
            MATCH (n:WorkItem)
            WHERE n.status = $status
            RETURN n
            ORDER BY n.updatedAt DESC
            SKIP $offset
            LIMIT $limit
          `;
          params.status = filters.status;
          break;

        case 'by_contributor':
          if (!filters.contributor_id) {
            throw new Error('contributor_id filter is required for by_contributor query');
          }
          countQuery = `MATCH (n:WorkItem)-[:WORKED_ON_BY]->(c:Contributor) WHERE c.id = $contributor_id RETURN count(n) as total`;
          query = `
            MATCH (n:WorkItem)-[:WORKED_ON_BY]->(c:Contributor)
            WHERE c.id = $contributor_id
            RETURN n
            ORDER BY n.updatedAt DESC
            SKIP $offset
            LIMIT $limit
          `;
          params.contributor_id = filters.contributor_id;
          break;

        case 'by_priority':
          const minPriority = filters.min_priority || 0;
          countQuery = `MATCH (n:WorkItem) WHERE n.priorityComputed >= $min_priority RETURN count(n) as total`;
          query = `
            MATCH (n:WorkItem)
            WHERE n.priorityComputed >= $min_priority
            RETURN n
            ORDER BY n.priorityComputed DESC
            SKIP $offset
            LIMIT $limit
          `;
          params.min_priority = minPriority;
          break;

        case 'dependencies':
          if (!filters.node_id) {
            throw new Error('node_id filter is required for dependencies query');
          }
          query = `
            MATCH (n:WorkItem {id: $node_id})
            OPTIONAL MATCH (n)-[r1:DEPENDS_ON]->(dep:WorkItem)
            OPTIONAL MATCH (dependent:WorkItem)-[r2:DEPENDS_ON]->(n)
            RETURN n, 
                   COLLECT(DISTINCT dep) as dependencies,
                   COLLECT(DISTINCT dependent) as dependents
          `;
          params.node_id = filters.node_id;
          break;

        case 'search':
          if (!filters.search_term) {
            throw new Error('search_term filter is required for search query');
          }
          countQuery = `MATCH (n:WorkItem) WHERE n.title CONTAINS $search_term OR n.description CONTAINS $search_term RETURN count(n) as total`;
          query = `
            MATCH (n:WorkItem)
            WHERE n.title CONTAINS $search_term OR n.description CONTAINS $search_term
            RETURN n
            ORDER BY n.updatedAt DESC
            SKIP $offset
            LIMIT $limit
          `;
          params.search_term = filters.search_term;
          break;

        default:
          throw new Error(`Unknown query_type: ${query_type}`);
      }

      // Execute count query first (except for dependencies which returns one specific result)
      let totalCount = 0;
      if (query_type !== 'dependencies') {
        const countResult = await session.run(countQuery, params);
        totalCount = countResult.records[0]?.get('total').toNumber() || 0;
      }

      const result = await session.run(query, params);
      
      if (query_type === 'dependencies') {
        const record = result.records[0];
        if (!record) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                error: 'Node not found',
                node_id: filters.node_id
              }, null, 2)
            }]
          };
        }

        const node = record.get('n').properties;
        const dependencies = record.get('dependencies').map((dep: Neo4jNode) => dep.properties);
        const dependents = record.get('dependents').map((dep: Neo4jNode) => dep.properties);

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              query_type,
              node,
              dependencies,
              dependents,
              dependencies_count: dependencies.length,
              dependents_count: dependents.length
            }, null, 2)
          }]
        };
      }

      const nodes = result.records.map(record => record.get('n').properties);
      const pagination = this.createPaginationInfo(totalCount, limit, offset);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            query_type,
            filters,
            count: nodes.length,
            nodes,
            pagination
          }, null, 2)
        }]
      };
    });
  }

  async createNode(args: CreateNodeArgs) {
    return this.withSession(async (session) => {
      // Validate memory usage before processing
      validateMemoryUsage(args, 10); // 10MB limit
      
      // Sanitize and validate all inputs
      const title = sanitizeString(args.title || 'Untitled Node', 500);
      const description = sanitizeString(args.description || '', 2000);
      const type = sanitizeNodeType(args.type || 'TASK');
      const status = sanitizeNodeStatus(args.status || 'PROPOSED');
      const contributor_ids = Array.isArray(args.contributor_ids) ? 
        args.contributor_ids.map(id => sanitizeNodeId(id)).slice(0, 50) : // Limit contributors
        [];
      const metadata = sanitizeMetadata(args.metadata || {});
      
      // Validate bulk operation if multiple contributors
      if (contributor_ids.length > 0) {
        validateBulkOperation(contributor_ids.length, 50);
      }

      // Generate truly unique ID to prevent race conditions
      const id = generateUniqueNodeId();
      const now = new Date().toISOString();

      const query = `
        CREATE (n:WorkItem {
          id: $id,
          title: $title,
          description: $description,
          type: $type,
          status: $status,
          createdAt: $now,
          updatedAt: $now,
          priorityExecutive: 0,
          priorityIndividual: 0,
          priorityCommunity: 0,
          priorityComputed: 0,
          sphericalRadius: 1.0,
          sphericalTheta: 0,
          sphericalPhi: 0,
          metadata: $metadata
        })
        RETURN n
      `;

      const params = {
        id,
        title,
        description,
        type,
        status,
        now,
        metadata: JSON.stringify(metadata)
      };

      const result = await session.run(query, params);
      const rawNode = result.records[0].get('n').properties;
      
      // Parse metadata back from JSON string for data integrity
      const node = {
        ...rawNode,
        metadata: rawNode.metadata ? JSON.parse(rawNode.metadata) : {}
      };

      // Create relationships to contributors if specified
      if (contributor_ids.length > 0) {
        for (const contributorId of contributor_ids) {
          await session.run(`
            MATCH (n:WorkItem {id: $nodeId})
            MERGE (c:Contributor {id: $contributorId})
            MERGE (n)-[:WORKED_ON_BY]->(c)
          `, { nodeId: id, contributorId });
        }
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            message: 'Node created successfully',
            node
          }, null, 2)
        }]
      };
    });
  }

  async updateNode(args: UpdateNodeArgs) {
    return this.withSession(async (session) => {
      // Validate memory usage before processing
      validateMemoryUsage(args, 10); // 10MB limit
      
      const { node_id, ...updates } = args;
      
      if (!node_id) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ error: 'node_id is required for updating a node' })
          }],
          isError: true
        };
      }
      
      // Sanitize node ID
      const sanitizedNodeId = sanitizeNodeId(node_id);
      
      // Build the SET clause dynamically based on provided fields
      const setClause: string[] = ['n.updatedAt = $now'];
      const params: Neo4jParams = { 
        node_id: sanitizedNodeId, 
        now: new Date().toISOString() 
      };

      if (updates.title !== undefined) {
        setClause.push('n.title = $title');
        params.title = sanitizeString(updates.title, 500);
      }
      if (updates.description !== undefined) {
        setClause.push('n.description = $description');
        params.description = sanitizeString(updates.description, 2000);
      }
      if (updates.status !== undefined) {
        setClause.push('n.status = $status');
        params.status = sanitizeNodeStatus(updates.status);
      }
      if (updates.type !== undefined) {
        setClause.push('n.type = $type');
        params.type = sanitizeNodeType(updates.type);
      }
      if (updates.metadata !== undefined) {
        setClause.push('n.metadata = $metadata');
        params.metadata = JSON.stringify(sanitizeMetadata(updates.metadata));
      }

      const query = `
        MATCH (n:WorkItem {id: $node_id})
        SET ${setClause.join(', ')}
        RETURN n
      `;

      const result = await session.run(query, params);
      
      if (result.records.length === 0) {
        return {
          content: [{
            type: 'text',
            text: 'Node not found'
          }],
          isError: true
        };
      }

      const rawNode = result.records[0].get('n').properties;
      
      // Parse metadata back from JSON string for data integrity
      const node = {
        ...rawNode,
        metadata: rawNode.metadata ? JSON.parse(rawNode.metadata) : {}
      };

      // Update contributor relationships if specified
      if (updates.contributor_ids !== undefined) {
        // Remove existing relationships
        await session.run(`
          MATCH (n:WorkItem {id: $node_id})-[r:WORKED_ON_BY]->()
          DELETE r
        `, { node_id });

        // Create new relationships
        for (const contributorId of updates.contributor_ids) {
          await session.run(`
            MATCH (n:WorkItem {id: $nodeId})
            MERGE (c:Contributor {id: $contributorId})
            MERGE (n)-[:WORKED_ON_BY]->(c)
          `, { nodeId: node_id, contributorId });
        }
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            message: 'Node updated successfully',
            node
          }, null, 2)
        }]
      };
    });
  }

  async deleteNode(args: DeleteNodeArgs) {
    return this.withSession(async (session) => {
      const { node_id } = args;

      // First check if node exists and get its relationships
      const checkQuery = `
        MATCH (n:WorkItem {id: $node_id})
        OPTIONAL MATCH (n)-[r]-()
        RETURN n, COUNT(r) as relationshipCount
      `;

      const checkResult = await session.run(checkQuery, { node_id });
      
      if (checkResult.records.length === 0) {
        return {
          content: [{
            type: 'text',
            text: 'Node not found'
          }],
          isError: true
        };
      }

      const relationshipCount = checkResult.records[0].get('relationshipCount').toNumber();

      // Delete the node and all its relationships
      const deleteQuery = `
        MATCH (n:WorkItem {id: $node_id})
        DETACH DELETE n
        RETURN $node_id as deletedId
      `;

      await session.run(deleteQuery, { node_id });

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            message: 'Node deleted successfully',
            deletedId: node_id,
            removedRelationships: relationshipCount
          }, null, 2)
        }]
      };
    });
  }

  async createEdge(args: CreateEdgeArgs) {
    return this.withSession(async (session) => {
      const { source_id, target_id, type, weight = 1.0, metadata = {} } = args;

      // Check if both nodes exist
      const checkQuery = `
        MATCH (source:WorkItem {id: $source_id})
        MATCH (target:WorkItem {id: $target_id})
        RETURN source, target
      `;

      const checkResult = await session.run(checkQuery, { source_id, target_id });
      
      if (checkResult.records.length === 0) {
        return {
          content: [{
            type: 'text',
            text: 'One or both nodes not found'
          }],
          isError: true
        };
      }

      // Create the relationship
      const createQuery = `
        MATCH (source:WorkItem {id: $source_id})
        MATCH (target:WorkItem {id: $target_id})
        MERGE (source)-[r:${type} {
          weight: $weight,
          metadata: $metadata,
          createdAt: $now
        }]->(target)
        RETURN r, source, target
      `;

      const params = {
        source_id,
        target_id,
        weight,
        metadata: JSON.stringify(metadata),
        now: new Date().toISOString()
      };

      const result = await session.run(createQuery, params);
      const relationship = result.records[0].get('r').properties;
      const source = result.records[0].get('source').properties;
      const target = result.records[0].get('target').properties;

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            message: 'Edge created successfully',
            edge: {
              type,
              source: { id: source.id, title: source.title },
              target: { id: target.id, title: target.title },
              properties: relationship
            }
          }, null, 2)
        }]
      };
    });
  }

  async deleteEdge(args: DeleteEdgeArgs) {
    return this.withSession(async (session) => {
      const { source_id, target_id, type } = args;

      const deleteQuery = `
        MATCH (source:WorkItem {id: $source_id})-[r:${type}]->(target:WorkItem {id: $target_id})
        DELETE r
        RETURN source, target
      `;

      const result = await session.run(deleteQuery, { source_id, target_id });
      
      if (result.records.length === 0) {
        return {
          content: [{
            type: 'text',
            text: 'Edge not found'
          }],
          isError: true
        };
      }

      const source = result.records[0].get('source').properties;
      const target = result.records[0].get('target').properties;

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            message: 'Edge deleted successfully',
            deleted_edge: {
              type,
              source: { id: source.id, title: source.title },
              target: { id: target.id, title: target.title }
            }
          }, null, 2)
        }]
      };
    });
  }

  async getNodeDetails(args: GetNodeDetailsArgs) {
    return this.withSession(async (session) => {
      const { node_id, relationships_limit = 20, relationships_offset = 0 } = args;
      
      // Sanitize node ID input
      const sanitizedNodeId = sanitizeNodeId(node_id);
      
      // Ensure all numeric values are properly converted to integers with limits
      const relationshipsLimitInt = Math.min(Math.max(1, Math.floor(Number(relationships_limit) || 20)), 100); // Max 100 relationships
      const relationshipsOffsetInt = Math.max(0, Math.floor(Number(relationships_offset) || 0));

      // First get the node and basic info
      const nodeQuery = `
        MATCH (n:WorkItem {id: $node_id})
        OPTIONAL MATCH (n)-[:WORKED_ON_BY]->(c:Contributor)
        RETURN n, COLLECT(DISTINCT c) as contributors
      `;

      // Count relationships
      const relCountQuery = `
        MATCH (n:WorkItem {id: $node_id})
        OPTIONAL MATCH (n)-[rel]-(related:WorkItem)
        RETURN count(DISTINCT rel) as totalRelationships
      `;

      // Get relationships with pagination
      const relationshipsQuery = `
        MATCH (n:WorkItem {id: $node_id})
        OPTIONAL MATCH (n)-[rel]-(related:WorkItem)
        RETURN rel, related, 
               CASE WHEN startNode(rel) = n THEN 'outgoing' ELSE 'incoming' END as direction
        ORDER BY type(rel), related.title
        SKIP $relationships_offset
        LIMIT $relationships_limit
      `;

      // Execute queries with sanitized node ID
      const nodeResult = await session.run(nodeQuery, { node_id: sanitizedNodeId });
      const relCountResult = await session.run(relCountQuery, { node_id: sanitizedNodeId });
      const relationshipsResult = await session.run(relationshipsQuery, { 
        node_id: sanitizedNodeId, 
        relationships_offset: int(relationshipsOffsetInt),
        relationships_limit: int(relationshipsLimitInt)
      });

      if (nodeResult.records.length === 0) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              error: 'Node not found',
              node_id: sanitizedNodeId
            }, null, 2)
          }],
          isError: true
        };
      }

      const nodeRecord = nodeResult.records[0];
      const rawNode = nodeRecord.get('n').properties;
      const contributors = nodeRecord.get('contributors').map((c: Neo4jContributor) => c.properties);
      
      // Parse metadata back from JSON string to object for data integrity
      const node = {
        ...rawNode,
        metadata: rawNode.metadata ? JSON.parse(rawNode.metadata) : {}
      };
      
      const totalRelationships = relCountResult.records[0]?.get('totalRelationships').toNumber() || 0;
      
      const relationships = relationshipsResult.records.map(record => {
        const rel = record.get('rel');
        const related = record.get('related');
        const direction = record.get('direction');
        
        return {
          type: rel.type,
          direction,
          target_node: related.properties,
          relationship_properties: rel.properties
        };
      });

      // Separate dependencies and dependents for backward compatibility
      const dependencies = relationships
        .filter(r => r.type === 'DEPENDS_ON' && r.direction === 'outgoing')
        .map(r => ({ node: r.target_node, relationship: r.relationship_properties }));
        
      const dependents = relationships
        .filter(r => r.type === 'DEPENDS_ON' && r.direction === 'incoming')
        .map(r => ({ node: r.target_node, relationship: r.relationship_properties }));

      const relationshipsPagination = this.createPaginationInfo(
        totalRelationships, 
        relationshipsLimitInt, 
        relationshipsOffsetInt
      );

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            node,
            contributors,
            dependencies,
            dependents,
            relationships,
            relationships_pagination: relationshipsPagination,
            stats: {
              contributor_count: contributors.length,
              dependency_count: dependencies.length,
              dependent_count: dependents.length,
              total_relationships: totalRelationships,
              relationships_shown: relationships.length
            }
          }, null, 2)
        }]
      };
    });
  }

  async findPath(args: FindPathArgs) {
    return this.withSession(async (session) => {
      const { start_id, end_id, max_depth = 10, limit = 10, offset = 0 } = args;
      
      // Ensure all numeric values are properly converted to integers
      const maxDepthInt = typeof max_depth === 'number' ? Math.floor(max_depth) : parseInt(String(max_depth), 10) || 10;
      const limitInt = typeof limit === 'number' ? Math.floor(limit) : parseInt(String(limit), 10) || 10;
      const offsetInt = typeof offset === 'number' ? Math.floor(offset) : parseInt(String(offset), 10) || 0;

      // Count query to get total number of paths
      const countQuery = `
        MATCH path = allShortestPaths((start:WorkItem {id: $start_id})-[*1..${maxDepthInt}]-(end:WorkItem {id: $end_id}))
        RETURN count(path) as total
      `;

      const query = `
        MATCH path = allShortestPaths((start:WorkItem {id: $start_id})-[*1..${maxDepthInt}]-(end:WorkItem {id: $end_id}))
        RETURN path, length(path) as pathLength
        ORDER BY pathLength ASC
        SKIP $offset
        LIMIT $limit
      `;

      // Get total count first
      const countResult = await session.run(countQuery, { start_id, end_id });
      const totalCount = countResult.records[0]?.get('total').toNumber() || 0;

      const result = await session.run(query, { 
        start_id, 
        end_id, 
        offset: int(offsetInt), 
        limit: int(limitInt) 
      });
      
      if (totalCount === 0) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              message: 'No path found between the specified nodes',
              start_id,
              end_id,
              max_depth,
              total_paths: 0,
              pagination: this.createPaginationInfo(0, limitInt, offsetInt)
            }, null, 2)
          }]
        };
      }

      const paths = result.records.map(record => {
        const path = record.get('path');
        const pathLength = record.get('pathLength').toNumber();
        
        const nodes = path.segments.map((segment: Neo4jPathSegment, index: number) => {
          if (index === 0) {
            return [segment.start.properties, segment.end.properties];
          } else {
            return segment.end.properties;
          }
        }).flat();

        const relationships = path.segments.map((segment: Neo4jPathSegment) => ({
          type: segment.relationship.type,
          properties: segment.relationship.properties
        }));

        return { nodes, relationships, length: pathLength };
      });

      const pagination = this.createPaginationInfo(totalCount, limitInt, offsetInt);

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            message: `Found ${totalCount} total path(s), showing ${paths.length} on page ${pagination.current_page}`,
            start_id,
            end_id,
            max_depth,
            count: paths.length,
            paths,
            pagination
          }, null, 2)
        }]
      };
    });
  }

  async detectCycles(args: DetectCyclesArgs) {
    return this.withSession(async (session) => {
      // Get values, defaulting to reasonable values if not provided
      const limit = Math.floor(Number(args.limit || args.max_cycles || 10));
      const offset = Math.floor(Number(args.offset || 0));

      // Count query for total cycles
      const countQuery = `
        MATCH path = (n:WorkItem)-[:DEPENDS_ON*2..10]->(n)
        RETURN count(path) as total
      `;

      // Main query with pagination using parameterized queries
      const query = `
        MATCH path = (n:WorkItem)-[:DEPENDS_ON*2..10]->(n)
        RETURN path, length(path) as cycleLength
        ORDER BY cycleLength ASC
        SKIP $offset
        LIMIT $limit
      `;

      // Get total count first
      const countResult = await session.run(countQuery);
      const totalCount = countResult.records[0]?.get('total').toNumber() || 0;

      const result = await session.run(query, { 
        offset: int(offset), 
        limit: int(limit) 
      });
      
      const cycles = result.records.map(record => {
        const path = record.get('path');
        const cycleLength = record.get('cycleLength').toNumber();
        
        const nodes = path.segments.map((segment: Neo4jPathSegment, index: number) => {
          if (index === 0) {
            return [segment.start.properties, segment.end.properties];
          } else {
            return segment.end.properties;
          }
        }).flat();

        return { nodes, length: cycleLength };
      });

      const pagination = this.createPaginationInfo(totalCount, limit, offset);

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            message: `Found ${totalCount} total cycle(s), showing ${cycles.length} on page ${pagination.current_page}`,
            count: cycles.length,
            cycles,
            pagination,
            note: "Cycles can indicate circular dependencies that may need attention"
          }, null, 2)
        }]
      };
    });
  }

  async updatePriorities(args: UpdatePrioritiesArgs) {
    return this.withSession(async (session) => {
      const { 
        node_id, 
        priority_executive, 
        priority_individual, 
        priority_community, 
        recalculate_computed = true 
      } = args;

      // Sanitize node ID
      const sanitizedNodeId = sanitizeNodeId(node_id);

      const updates: string[] = [];
      const params: Neo4jParams = { node_id: sanitizedNodeId };

      if (priority_executive !== undefined) {
        const sanitizedPriority = sanitizePriority(priority_executive);
        if (sanitizedPriority !== null) {
          updates.push('n.priorityExec = $priority_executive');
          params.priority_executive = sanitizedPriority;
        }
      }

      if (priority_individual !== undefined) {
        const sanitizedPriority = sanitizePriority(priority_individual);
        if (sanitizedPriority !== null) {
          updates.push('n.priorityIndiv = $priority_individual');
          params.priority_individual = sanitizedPriority;
        }
      }

      if (priority_community !== undefined) {
        const sanitizedPriority = sanitizePriority(priority_community);
        if (sanitizedPriority !== null) {
          updates.push('n.priorityComm = $priority_community');
          params.priority_community = sanitizedPriority;
        }
      }

      if (recalculate_computed) {
        updates.push('n.priorityComp = (n.priorityExec * 0.4 + n.priorityIndiv * 0.3 + n.priorityComm * 0.3)');
        updates.push('n.radius = (1 - n.priorityComp)');
      }

      if (updates.length === 0) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              error: "No priority values provided to update"
            }, null, 2)
          }]
        };
      }

      updates.push('n.updatedAt = datetime()');

      const query = `
        MATCH (n:WorkItem {id: $node_id})
        SET ${updates.join(', ')}
        RETURN n
      `;

      const result = await session.run(query, params);

      if (result.records.length === 0) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              error: `Node with id '${node_id}' not found`
            }, null, 2)
          }]
        };
      }

      const rawUpdatedNode = result.records[0].get('n').properties;
      
      // Parse metadata back from JSON string for data integrity
      const updatedNode = {
        ...rawUpdatedNode,
        metadata: rawUpdatedNode.metadata ? JSON.parse(rawUpdatedNode.metadata) : {}
      };

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            message: "Priorities updated successfully",
            node_id,
            updated_priorities: {
              executive: updatedNode.priorityExec,
              individual: updatedNode.priorityIndiv,
              community: updatedNode.priorityComm,
              computed: updatedNode.priorityComp
            },
            new_radius: updatedNode.radius
          }, null, 2)
        }]
      };
    });
  }

  async bulkUpdatePriorities(args: BulkUpdatePrioritiesArgs) {
    return this.withSession(async (session) => {
      const { updates, recalculate_all = true } = args;

      if (!updates || updates.length === 0) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              error: "No updates provided"
            }, null, 2)
          }]
        };
      }

      const results = [];

      for (const update of updates) {
        const { node_id, priority_executive, priority_individual, priority_community } = update;
        
        const updateParts: string[] = [];
        const params: Neo4jParams = { node_id };

        if (priority_executive !== undefined) {
          updateParts.push('n.priorityExec = $priority_executive');
          params.priority_executive = Math.max(0, Math.min(1, priority_executive));
        }

        if (priority_individual !== undefined) {
          updateParts.push('n.priorityIndiv = $priority_individual');
          params.priority_individual = Math.max(0, Math.min(1, priority_individual));
        }

        if (priority_community !== undefined) {
          updateParts.push('n.priorityComm = $priority_community');
          params.priority_community = Math.max(0, Math.min(1, priority_community));
        }

        if (recalculate_all) {
          updateParts.push('n.priorityComp = (n.priorityExec * 0.4 + n.priorityIndiv * 0.3 + n.priorityComm * 0.3)');
          updateParts.push('n.radius = (1 - n.priorityComp)');
        }

        updateParts.push('n.updatedAt = datetime()');

        if (updateParts.length > 1) { // More than just updatedAt
          const query = `
            MATCH (n:WorkItem {id: $node_id})
            SET ${updateParts.join(', ')}
            RETURN n.id as id, n.priorityExec as exec, n.priorityIndiv as indiv, n.priorityComm as comm, n.priorityComp as comp
          `;

          try {
            const result = await session.run(query, params);
            if (result.records.length > 0) {
              const record = result.records[0];
              results.push({
                node_id,
                success: true,
                priorities: {
                  executive: record.get('exec'),
                  individual: record.get('indiv'),
                  community: record.get('comm'),
                  computed: record.get('comp')
                }
              });
            } else {
              results.push({
                node_id,
                success: false,
                error: "Node not found"
              });
            }
          } catch (error) {
            results.push({
              node_id,
              success: false,
              error: error instanceof Error ? error.message : String(error)
            });
          }
        }
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            message: `Bulk priority update completed`,
            total_updates: updates.length,
            successful_updates: results.filter(r => r.success).length,
            failed_updates: results.filter(r => !r.success).length,
            results
          }, null, 2)
        }]
      };
    });
  }

  async getPriorityInsights(args: GetPriorityInsightsArgs) {
    return this.withSession(async (session) => {
      const { filters = {}, include_statistics = true, include_trends = false } = args;
      const { min_priority, priority_type, node_types, status } = filters;

      let whereClause = 'WHERE 1=1';
      const params: Neo4jParams = {};

      if (min_priority !== undefined) {
        const priorityField = priority_type === 'executive' ? 'priorityExec' 
                            : priority_type === 'individual' ? 'priorityIndiv'
                            : priority_type === 'community' ? 'priorityComm'
                            : 'priorityComp';
        whereClause += ` AND n.${priorityField} >= $min_priority`;
        params.min_priority = min_priority;
      }

      if (node_types && node_types.length > 0) {
        whereClause += ` AND n.type IN $node_types`;
        params.node_types = node_types;
      }

      if (status && status.length > 0) {
        whereClause += ` AND n.status IN $status`;
        params.status = status;
      }

      const queries = [];

      // Basic count and distribution
      if (include_statistics) {
        queries.push({
          name: 'statistics',
          query: `
            MATCH (n:WorkItem)
            ${whereClause}
            RETURN 
              count(n) as total_nodes,
              avg(n.priorityExec) as avg_executive,
              avg(n.priorityIndiv) as avg_individual, 
              avg(n.priorityComm) as avg_community,
              avg(n.priorityComp) as avg_computed,
              max(n.priorityComp) as max_priority,
              min(n.priorityComp) as min_priority,
              collect(DISTINCT n.type) as node_types,
              collect(DISTINCT n.status) as statuses
          `
        });

        // Priority distribution by type
        queries.push({
          name: 'type_distribution',
          query: `
            MATCH (n:WorkItem)
            ${whereClause}
            RETURN 
              n.type as node_type,
              count(n) as count,
              avg(n.priorityComp) as avg_priority,
              max(n.priorityComp) as max_priority,
              min(n.priorityComp) as min_priority
            ORDER BY avg_priority DESC
          `
        });

        // Priority distribution by status
        queries.push({
          name: 'status_distribution',
          query: `
            MATCH (n:WorkItem)
            ${whereClause}
            RETURN 
              n.status as status,
              count(n) as count,
              avg(n.priorityComp) as avg_priority
            ORDER BY avg_priority DESC
          `
        });
      }

      const results: AnalysisResults = {};

      for (const { name, query } of queries) {
        try {
          const result = await session.run(query, params);
          
          if (name === 'statistics') {
            const record = result.records[0];
            results[name] = {
              total_nodes: record?.get('total_nodes').toNumber() || 0,
              averages: {
                executive: record?.get('avg_executive') || 0,
                individual: record?.get('avg_individual') || 0,
                community: record?.get('avg_community') || 0,
                computed: record?.get('avg_computed') || 0
              },
              range: {
                max_priority: record?.get('max_priority') || 0,
                min_priority: record?.get('min_priority') || 0
              },
              node_types: record?.get('node_types') || [],
              statuses: record?.get('statuses') || []
            };
          } else {
            results[name] = result.records.map(record => {
              const obj: Record<string, Neo4jValue> = {};
              record.keys.forEach((key) => {
                const keyStr = String(key);
                const value = record.get(keyStr);
                obj[keyStr] = typeof value?.toNumber === 'function' ? value.toNumber() : value;
              });
              return obj;
            });
          }
        } catch (error) {
          results[name] = { error: error instanceof Error ? error.message : String(error) };
        }
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            message: "Priority insights analysis completed",
            filters,
            insights: results,
            metadata: {
              include_statistics,
              include_trends,
              timestamp: new Date().toISOString()
            }
          }, null, 2)
        }]
      };
    });
  }

  async analyzeGraphHealth(args: AnalyzeGraphHealthArgs) {
    return this.withSession(async (session) => {
      const { 
        include_metrics = ['node_distribution', 'priority_balance', 'dependency_health'], 
        depth_analysis = false, 
        team_id 
      } = args;

      const results: AnalysisResults = {};
      const whereClause = team_id ? 'WHERE n.teamId = $team_id' : '';
      const params = team_id ? { team_id } : {};

      if (include_metrics.includes('node_distribution')) {
        const query = `
          MATCH (n:WorkItem)
          ${whereClause}
          RETURN 
            count(n) as total_nodes,
            collect(DISTINCT n.type) as node_types,
            collect(DISTINCT n.status) as statuses,
            avg(size((n)-[:DEPENDS_ON]->())) as avg_dependencies,
            max(size((n)-[:DEPENDS_ON]->())) as max_dependencies,
            count(CASE WHEN size((n)-[:DEPENDS_ON]->()) = 0 THEN 1 END) as isolated_nodes
        `;

        try {
          const result = await session.run(query, params);
          const record = result.records[0];
          results.node_distribution = {
            total_nodes: record?.get('total_nodes').toNumber() || 0,
            node_types: record?.get('node_types') || [],
            statuses: record?.get('statuses') || [],
            dependency_stats: {
              avg_dependencies: record?.get('avg_dependencies') || 0,
              max_dependencies: record?.get('max_dependencies').toNumber() || 0,
              isolated_nodes: record?.get('isolated_nodes').toNumber() || 0
            }
          };
        } catch (error) {
          results.node_distribution = { error: error instanceof Error ? error.message : String(error) };
        }
      }

      if (include_metrics.includes('priority_balance')) {
        const query = `
          MATCH (n:WorkItem)
          ${whereClause}
          WITH 
            avg(n.priorityExec) as avg_exec,
            avg(n.priorityIndiv) as avg_indiv,
            avg(n.priorityComm) as avg_comm,
            stdev(n.priorityComp) as stdev_computed,
            count(CASE WHEN n.priorityComp > 0.8 THEN 1 END) as high_priority,
            count(CASE WHEN n.priorityComp < 0.2 THEN 1 END) as low_priority,
            count(n) as total
          RETURN 
            avg_exec, avg_indiv, avg_comm, stdev_computed,
            high_priority, low_priority, total,
            (toFloat(high_priority) / total) as high_priority_ratio,
            (toFloat(low_priority) / total) as low_priority_ratio
        `;

        try {
          const result = await session.run(query, params);
          const record = result.records[0];
          results.priority_balance = {
            averages: {
              executive: record?.get('avg_exec') || 0,
              individual: record?.get('avg_indiv') || 0,
              community: record?.get('avg_comm') || 0
            },
            distribution: {
              standard_deviation: record?.get('stdev_computed') || 0,
              high_priority_count: record?.get('high_priority').toNumber() || 0,
              low_priority_count: record?.get('low_priority').toNumber() || 0,
              high_priority_ratio: record?.get('high_priority_ratio') || 0,
              low_priority_ratio: record?.get('low_priority_ratio') || 0
            }
          };
        } catch (error) {
          results.priority_balance = { error: error instanceof Error ? error.message : String(error) };
        }
      }

      if (include_metrics.includes('dependency_health')) {
        const query = `
          MATCH (n:WorkItem)
          ${whereClause}
          OPTIONAL MATCH (n)-[:DEPENDS_ON]->(dep:WorkItem)
          WITH n, collect(dep) as dependencies
          RETURN 
            count(n) as total_nodes,
            avg(size(dependencies)) as avg_deps_per_node,
            count(CASE WHEN size(dependencies) > 5 THEN 1 END) as heavily_dependent,
            count(CASE WHEN size(dependencies) = 0 THEN 1 END) as independent_nodes,
            max(size(dependencies)) as max_dependencies
        `;

        try {
          const result = await session.run(query, params);
          const record = result.records[0];
          const totalNodes = record?.get('total_nodes').toNumber() || 0;
          results.dependency_health = {
            total_nodes: totalNodes,
            avg_dependencies_per_node: record?.get('avg_deps_per_node') || 0,
            heavily_dependent_nodes: record?.get('heavily_dependent').toNumber() || 0,
            independent_nodes: record?.get('independent_nodes').toNumber() || 0,
            max_dependencies: record?.get('max_dependencies').toNumber() || 0,
            dependency_ratio: totalNodes > 0 ? (record?.get('heavily_dependent').toNumber() || 0) / totalNodes : 0
          };
        } catch (error) {
          results.dependency_health = { error: error instanceof Error ? error.message : String(error) };
        }
      }

      if (include_metrics.includes('bottlenecks') || depth_analysis) {
        const query = `
          MATCH (n:WorkItem)
          ${whereClause}
          OPTIONAL MATCH (n)<-[:DEPENDS_ON]-(dependent:WorkItem)
          WITH n, count(dependent) as dependent_count
          WHERE dependent_count > 3
          RETURN 
            n.id as node_id,
            n.title as title,
            n.type as type,
            n.status as status,
            n.priorityComp as priority,
            dependent_count
          ORDER BY dependent_count DESC
          LIMIT 10
        `;

        try {
          const result = await session.run(query, params);
          results.potential_bottlenecks = result.records.map(record => ({
            node_id: record.get('node_id'),
            title: record.get('title'),
            type: record.get('type'),
            status: record.get('status'),
            priority: record.get('priority'),
            dependent_count: record.get('dependent_count').toNumber()
          }));
        } catch (error) {
          results.potential_bottlenecks = { error: error instanceof Error ? error.message : String(error) };
        }
      }

      // Calculate overall health score
      let healthScore = 1.0;
      const healthFactors = [];

      if (results.priority_balance && !results.priority_balance.error) {
        const stdDev = results.priority_balance.distribution.standard_deviation;
        if (stdDev > 0.3) {
          healthScore -= 0.1;
          healthFactors.push("High priority variance detected");
        }
      }

      if (results.dependency_health && !results.dependency_health.error) {
        const depRatio = results.dependency_health.dependency_ratio;
        if (depRatio > 0.2) {
          healthScore -= 0.15;
          healthFactors.push("Too many heavily dependent nodes");
        }
      }

      if (results.potential_bottlenecks && Array.isArray(results.potential_bottlenecks)) {
        if (results.potential_bottlenecks.length > 5) {
          healthScore -= 0.1;
          healthFactors.push("Multiple potential bottlenecks detected");
        }
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            message: "Graph health analysis completed",
            overall_health_score: Math.max(0, healthScore),
            health_factors: healthFactors,
            metrics: results,
            recommendations: this.generateHealthRecommendations(results),
            metadata: {
              team_id,
              include_metrics,
              depth_analysis,
              timestamp: new Date().toISOString()
            }
          }, null, 2)
        }]
      };
    });
  }

  private generateHealthRecommendations(results: AnalysisResults): string[] {
    const recommendations = [];

    if (results.priority_balance && !results.priority_balance.error) {
      const { distribution } = results.priority_balance;
      if (distribution.high_priority_ratio > 0.3) {
        recommendations.push("Consider reviewing high-priority items - too many items marked as high priority may indicate poor prioritization");
      }
      if (distribution.low_priority_ratio > 0.5) {
        recommendations.push("Many items have low priority - consider archiving or re-evaluating completed/stale items");
      }
    }

    if (results.dependency_health && !results.dependency_health.error) {
      const { avg_dependencies_per_node, dependency_ratio } = results.dependency_health;
      if (avg_dependencies_per_node > 3) {
        recommendations.push("High average dependencies per node - consider simplifying dependencies to reduce complexity");
      }
      if (dependency_ratio > 0.15) {
        recommendations.push("Many nodes have heavy dependencies - this may create bottlenecks and slow progress");
      }
    }

    if (results.potential_bottlenecks && Array.isArray(results.potential_bottlenecks)) {
      if (results.potential_bottlenecks.length > 0) {
        recommendations.push(`${results.potential_bottlenecks.length} potential bottlenecks detected - focus on completing these high-dependency items`);
      }
    }

    if (recommendations.length === 0) {
      recommendations.push("Graph health looks good! Continue monitoring as the project grows");
    }

    return recommendations;
  }

  async getBottlenecks(args: GetBottlenecksArgs) {
    return this.withSession(async (session) => {
      const { 
        analysis_depth = 5, 
        include_suggested_resolutions = true, 
        team_id 
      } = args;

      const whereClause = team_id ? 'WHERE n.teamId = $team_id' : '';
      const params = team_id ? { team_id, analysis_depth: int(analysis_depth) } : { analysis_depth: int(analysis_depth) };

      // Find nodes that many other nodes depend on
      const bottleneckQuery = `
        MATCH (n:WorkItem)
        ${whereClause}
        OPTIONAL MATCH (n)<-[:DEPENDS_ON]-(dependent:WorkItem)
        WITH n, collect(dependent) as dependents, count(dependent) as dependent_count
        WHERE dependent_count > 0
        RETURN 
          n.id as node_id,
          n.title as title,
          n.type as type,
          n.status as status,
          n.priorityComp as priority,
          dependent_count,
          [d IN dependents | {id: d.id, title: d.title, status: d.status}] as dependent_nodes
        ORDER BY dependent_count DESC
        LIMIT $analysis_depth
      `;

      // Find blocked chains
      const blockedChainQuery = `
        MATCH (blocked:WorkItem {status: 'BLOCKED'})
        ${whereClause ? whereClause.replace('n.teamId', 'blocked.teamId') : ''}
        OPTIONAL MATCH (blocked)-[:DEPENDS_ON]->(blocker:WorkItem)
        WHERE blocker.status IN ['PROPOSED', 'PLANNED', 'IN_PROGRESS']
        RETURN 
          blocked.id as blocked_id,
          blocked.title as blocked_title,
          collect({
            id: blocker.id,
            title: blocker.title,
            status: blocker.status,
            priority: blocker.priorityComp
          }) as blocking_items
        LIMIT $analysis_depth
      `;

      const results: AnalysisResults = {};

      try {
        const bottleneckResult = await session.run(bottleneckQuery, params);
        results.high_dependency_bottlenecks = bottleneckResult.records.map(record => ({
          node_id: record.get('node_id'),
          title: record.get('title'),
          type: record.get('type'),
          status: record.get('status'),
          priority: record.get('priority'),
          dependent_count: record.get('dependent_count').toNumber(),
          dependent_nodes: record.get('dependent_nodes'),
          bottleneck_severity: this.calculateBottleneckSeverity(
            record.get('dependent_count').toNumber(),
            record.get('status'),
            record.get('priority')
          )
        }));
      } catch (error) {
        results.high_dependency_bottlenecks = { error: error instanceof Error ? error.message : String(error) };
      }

      try {
        const blockedResult = await session.run(blockedChainQuery, params);
        results.blocked_chains = blockedResult.records.map(record => ({
          blocked_id: record.get('blocked_id'),
          blocked_title: record.get('blocked_title'),
          blocking_items: record.get('blocking_items'),
          chain_length: record.get('blocking_items').length
        }));
      } catch (error) {
        results.blocked_chains = { error: error instanceof Error ? error.message : String(error) };
      }

      let resolutions: Array<{type: string, description: string, target?: string}> = [];
      if (include_suggested_resolutions) {
        resolutions = this.generateBottleneckResolutions(results);
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            message: "Bottleneck analysis completed",
            bottlenecks: results,
            suggested_resolutions: resolutions,
            summary: {
              high_dependency_count: Array.isArray(results.high_dependency_bottlenecks) ? results.high_dependency_bottlenecks.length : 0,
              blocked_chains_count: Array.isArray(results.blocked_chains) ? results.blocked_chains.length : 0,
              total_bottlenecks: (Array.isArray(results.high_dependency_bottlenecks) ? results.high_dependency_bottlenecks.length : 0) + 
                                (Array.isArray(results.blocked_chains) ? results.blocked_chains.length : 0)
            },
            metadata: {
              analysis_depth,
              team_id,
              timestamp: new Date().toISOString()
            }
          }, null, 2)
        }]
      };
    });
  }

  private calculateBottleneckSeverity(dependentCount: number, status: string, priority: number): 'low' | 'medium' | 'high' | 'critical' {
    let score = 0;
    
    // Dependent count factor
    if (dependentCount > 10) score += 3;
    else if (dependentCount > 5) score += 2;
    else if (dependentCount > 2) score += 1;
    
    // Status factor
    if (status === 'BLOCKED') score += 3;
    else if (status === 'PROPOSED') score += 2;
    else if (status === 'IN_PROGRESS') score += 1;
    
    // Priority factor
    if (priority > 0.8) score += 2;
    else if (priority > 0.5) score += 1;
    
    if (score >= 7) return 'critical';
    if (score >= 5) return 'high';
    if (score >= 3) return 'medium';
    return 'low';
  }

  private generateBottleneckResolutions(results: AnalysisResults): Array<{type: string, description: string, target?: string}> {
    const resolutions = [];

    if (Array.isArray(results.high_dependency_bottlenecks)) {
      for (const bottleneck of results.high_dependency_bottlenecks) {
        if (bottleneck.bottleneck_severity === 'critical' || bottleneck.bottleneck_severity === 'high') {
          if (bottleneck.status === 'PROPOSED') {
            resolutions.push({
              type: 'priority_boost',
              description: `Increase priority of "${bottleneck.title}" to unblock ${bottleneck.dependent_count} dependent items`,
              target: bottleneck.node_id
            });
          } else if (bottleneck.status === 'BLOCKED') {
            resolutions.push({
              type: 'resolve_blocker',
              description: `Focus on resolving blockers for "${bottleneck.title}" as it affects ${bottleneck.dependent_count} other items`,
              target: bottleneck.node_id
            });
          }
        }
      }
    }

    if (Array.isArray(results.blocked_chains)) {
      for (const chain of results.blocked_chains) {
        if (chain.chain_length > 1) {
          resolutions.push({
            type: 'break_dependency_chain',
            description: `Consider breaking dependency chain for "${chain.blocked_title}" - has ${chain.chain_length} blocking items`,
            target: chain.blocked_id
          });
        }
      }
    }

    return resolutions;
  }

  async bulkOperations(args: BulkOperationsArgs) {
    return this.withSession(async (session) => {
      const { operations, transaction = true, rollback_on_error = true } = args;

      if (!operations || operations.length === 0) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              error: "No operations provided"
            }, null, 2)
          }]
        };
      }

      // Validate bulk operation limits
      validateBulkOperation(operations.length, 100);

      // Check for ID collisions in create operations
      const createNodeIds: string[] = [];
      operations.forEach(op => {
        if (op.type === 'create_node' && op.params?.id) {
          createNodeIds.push(op.params.id);
        }
      });

      if (createNodeIds.length > 0) {
        const collisions = detectIdCollisions(createNodeIds);
        if (collisions.length > 0) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                error: `ID collisions detected in bulk operation`,
                collisions
              }, null, 2)
            }],
            isError: true
          };
        }
      }

      const results = [];
      let successCount = 0;
      let errorCount = 0;

      if (transaction) {
        // Execute all operations in a single transaction
        const tx = session.beginTransaction();
        
        try {
          for (const operation of operations) {
            try {
              const result = await this.executeBulkOperation(tx, operation);
              results.push({
                operation_type: operation.type,
                success: true,
                result
              });
              successCount++;
            } catch (error) {
              results.push({
                operation_type: operation.type,
                success: false,
                error: error instanceof Error ? error.message : String(error)
              });
              errorCount++;
              
              if (rollback_on_error) {
                await tx.rollback();
                return {
                  content: [{
                    type: 'text',
                    text: JSON.stringify({
                      message: "Bulk operations failed - transaction rolled back",
                      error: `Operation ${operation.type} failed: ${error instanceof Error ? error.message : String(error)}`,
                      completed_operations: successCount,
                      failed_operations: errorCount,
                      results
                    }, null, 2)
                  }]
                };
              }
            }
          }
          
          await tx.commit();
        } catch (error) {
          await tx.rollback();
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                message: "Bulk operations failed - transaction rolled back",
                error: error instanceof Error ? error.message : String(error),
                results
              }, null, 2)
            }]
          };
        }
      } else {
        // Execute operations individually
        for (const operation of operations) {
          try {
            const result = await this.executeBulkOperation(session, operation);
            results.push({
              operation_type: operation.type,
              success: true,
              result
            });
            successCount++;
          } catch (error) {
            results.push({
              operation_type: operation.type,
              success: false,
              error: error instanceof Error ? error.message : String(error)
            });
            errorCount++;
          }
        }
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            message: "Bulk operations completed",
            total_operations: operations.length,
            successful_operations: successCount,
            failed_operations: errorCount,
            transaction_used: transaction,
            results
          }, null, 2)
        }]
      };
    });
  }

  private async executeBulkOperation(sessionOrTx: Session, operation: { type: string; params: Record<string, Neo4jValue> }) {
    const { type, params } = operation;

    switch (type) {
      case 'create_node':
        return await this.executeBulkCreateNode(sessionOrTx, params);
      case 'update_node':
        return await this.executeBulkUpdateNode(sessionOrTx, params);
      case 'create_edge':
        return await this.executeBulkCreateEdge(sessionOrTx, params);
      case 'delete_edge':
        return await this.executeBulkDeleteEdge(sessionOrTx, params);
      default:
        throw new Error(`Unsupported bulk operation type: ${type}`);
    }
  }

  private async executeBulkCreateNode(sessionOrTx: Session, params: Record<string, Neo4jValue>) {
    const {
      title = 'Untitled Node',
      description = '',
      type = 'TASK',
      status = 'PROPOSED',
      metadata = {}
    } = params;

    // Generate truly unique ID to prevent race conditions
    const id = generateUniqueNodeId();
    const now = new Date().toISOString();

    const query = `
      CREATE (n:WorkItem {
        id: $id,
        title: $title,
        description: $description,
        type: $type,
        status: $status,
        createdAt: $now,
        updatedAt: $now,
        priorityExecutive: 0,
        priorityIndividual: 0,
        priorityCommunity: 0,
        priorityComputed: 0,
        sphericalRadius: 1.0,
        sphericalTheta: 0,
        sphericalPhi: 0,
        metadata: $metadata
      })
      RETURN n.id as id
    `;

    const result = await sessionOrTx.run(query, {
      id, title, description, type, status, now, metadata: JSON.stringify(metadata)
    });

    return { node_id: result.records[0].get('id') };
  }

  private async executeBulkUpdateNode(sessionOrTx: Session, params: Record<string, Neo4jValue>) {
    const { node_id, ...updateFields } = params;
    
    const updates = [];
    const queryParams: Neo4jParams = { node_id };

    Object.entries(updateFields).forEach(([key, value]) => {
      if (value !== undefined) {
        updates.push(`n.${key} = $${key}`);
        queryParams[key] = value;
      }
    });

    if (updates.length === 0) {
      throw new Error("No fields to update");
    }

    updates.push('n.updatedAt = datetime()');

    const query = `
      MATCH (n:WorkItem {id: $node_id})
      SET ${updates.join(', ')}
      RETURN n.id as id
    `;

    const result = await sessionOrTx.run(query, queryParams);
    
    if (result.records.length === 0) {
      throw new Error(`Node with id '${node_id}' not found`);
    }

    return { node_id };
  }

  private async executeBulkCreateEdge(sessionOrTx: Session, params: Record<string, Neo4jValue>) {
    const { source_id, target_id, type = 'DEPENDS_ON', weight = 1.0, metadata = {} } = params;

    const query = `
      MATCH (source:WorkItem {id: $source_id})
      MATCH (target:WorkItem {id: $target_id})
      CREATE (source)-[r:${type} {
        weight: $weight,
        metadata: $metadata,
        createdAt: datetime()
      }]->(target)
      RETURN r
    `;

    const result = await sessionOrTx.run(query, {
      source_id,
      target_id,
      weight,
      metadata: JSON.stringify(metadata)
    });

    if (result.records.length === 0) {
      throw new Error("Failed to create edge - nodes may not exist");
    }

    return { source_id, target_id, type };
  }

  private async executeBulkDeleteEdge(sessionOrTx: Session, params: Record<string, Neo4jValue>) {
    const { source_id, target_id, type } = params;

    const query = `
      MATCH (source:WorkItem {id: $source_id})-[r:${type}]->(target:WorkItem {id: $target_id})
      DELETE r
      RETURN count(r) as deleted_count
    `;

    const result = await sessionOrTx.run(query, { source_id, target_id });
    const deletedCount = result.records[0]?.get('deleted_count').toNumber() || 0;

    if (deletedCount === 0) {
      throw new Error(`Edge not found: ${source_id} -[${type}]-> ${target_id}`);
    }

    return { source_id, target_id, type, deleted: true };
  }

  async getWorkloadAnalysis(args: GetWorkloadAnalysisArgs) {
    return this.withSession(async (session) => {
      const { 
        contributor_ids, 
        time_window, 
        include_capacity = false, 
        include_predictions = false 
      } = args;

      let whereClause = '';
      const params: Neo4jParams = {};

      if (contributor_ids && contributor_ids.length > 0) {
        whereClause += 'WHERE n.assignedTo IN $contributor_ids';
        params.contributor_ids = contributor_ids;
      }

      if (time_window) {
        const timeFilter = contributor_ids && contributor_ids.length > 0 ? 'AND' : 'WHERE';
        whereClause += ` ${timeFilter} n.createdAt >= datetime($start_time) AND n.createdAt <= datetime($end_time)`;
        params.start_time = time_window.start;
        params.end_time = time_window.end;
      }

      const workloadQuery = `
        MATCH (n:WorkItem)
        ${whereClause}
        RETURN 
          n.assignedTo as contributor_id,
          count(n) as total_items,
          count(CASE WHEN n.status = 'IN_PROGRESS' THEN 1 END) as in_progress_items,
          count(CASE WHEN n.status = 'COMPLETED' THEN 1 END) as completed_items,
          count(CASE WHEN n.status = 'BLOCKED' THEN 1 END) as blocked_items,
          avg(n.priorityComp) as avg_priority,
          collect(DISTINCT n.type) as work_types,
          collect(DISTINCT n.status) as statuses
        ORDER BY total_items DESC
      `;

      const priorityDistributionQuery = `
        MATCH (n:WorkItem)
        ${whereClause}
        RETURN 
          n.assignedTo as contributor_id,
          count(CASE WHEN n.priorityComp > 0.8 THEN 1 END) as high_priority,
          count(CASE WHEN n.priorityComp BETWEEN 0.5 AND 0.8 THEN 1 END) as medium_priority,
          count(CASE WHEN n.priorityComp < 0.5 THEN 1 END) as low_priority
      `;

      const results: AnalysisResults = {};

      try {
        const workloadResult = await session.run(workloadQuery, params);
        const priorityResult = await session.run(priorityDistributionQuery, params);

        const workloadMap = new Map();
        workloadResult.records.forEach(record => {
          const contributorId = record.get('contributor_id');
          if (contributorId) {
            workloadMap.set(contributorId, {
              contributor_id: contributorId,
              total_items: record.get('total_items').toNumber(),
              in_progress_items: record.get('in_progress_items').toNumber(),
              completed_items: record.get('completed_items').toNumber(),
              blocked_items: record.get('blocked_items').toNumber(),
              avg_priority: record.get('avg_priority'),
              work_types: record.get('work_types'),
              statuses: record.get('statuses')
            });
          }
        });

        // Merge priority distribution data
        priorityResult.records.forEach(record => {
          const contributorId = record.get('contributor_id');
          if (contributorId && workloadMap.has(contributorId)) {
            const existing = workloadMap.get(contributorId);
            existing.priority_distribution = {
              high_priority: record.get('high_priority').toNumber(),
              medium_priority: record.get('medium_priority').toNumber(),
              low_priority: record.get('low_priority').toNumber()
            };
          }
        });

        results.contributor_workloads = Array.from(workloadMap.values());

        // Calculate summary statistics
        const totalItems = results.contributor_workloads.reduce((sum: number, c: Record<string, Neo4jValue>) => sum + (c.total_items as number), 0);
        const avgItemsPerContributor = results.contributor_workloads.length > 0 
          ? totalItems / results.contributor_workloads.length 
          : 0;

        results.summary = {
          total_contributors: results.contributor_workloads.length,
          total_items: totalItems,
          avg_items_per_contributor: avgItemsPerContributor,
          most_loaded_contributor: results.contributor_workloads[0]?.contributor_id,
          workload_distribution: {
            heavily_loaded: results.contributor_workloads.filter((c: Record<string, Neo4jValue>) => (c.total_items as number) > avgItemsPerContributor * 1.5).length,
            moderately_loaded: results.contributor_workloads.filter((c: Record<string, Neo4jValue>) => (c.total_items as number) >= avgItemsPerContributor * 0.5 && (c.total_items as number) <= avgItemsPerContributor * 1.5).length,
            lightly_loaded: results.contributor_workloads.filter((c: Record<string, Neo4jValue>) => (c.total_items as number) < avgItemsPerContributor * 0.5).length
          }
        };

      } catch (error) {
        results.error = error instanceof Error ? error.message : String(error);
      }

      // Add capacity analysis if requested
      if (include_capacity && !results.error) {
        results.capacity_analysis = this.generateCapacityAnalysis(results.contributor_workloads);
      }

      // Add predictions if requested
      if (include_predictions && !results.error) {
        results.predictions = this.generateWorkloadPredictions(results.contributor_workloads);
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            message: "Workload analysis completed",
            analysis: results,
            metadata: {
              contributor_ids,
              time_window,
              include_capacity,
              include_predictions,
              timestamp: new Date().toISOString()
            }
          }, null, 2)
        }]
      };
    });
  }

  private generateCapacityAnalysis(workloads: WorkloadData[]): CapacityAnalysis {
    const analysis: {
      overloaded_contributors: Array<Record<string, Neo4jValue>>;
      underutilized_contributors: Array<Record<string, Neo4jValue>>;
      balanced_contributors: Array<Record<string, Neo4jValue>>;
      recommendations: string[];
    } = {
      overloaded_contributors: [],
      underutilized_contributors: [],
      balanced_contributors: [],
      recommendations: []
    };

    const avgWorkload = workloads.reduce((sum, w) => sum + w.total_items, 0) / workloads.length;

    for (const workload of workloads) {
      const loadRatio = workload.total_items / avgWorkload;
      const blockedRatio = workload.total_items > 0 ? workload.blocked_items / workload.total_items : 0;

      if (loadRatio > 1.5 || blockedRatio > 0.3) {
        analysis.overloaded_contributors.push({
          ...workload,
          load_ratio: loadRatio,
          blocked_ratio: blockedRatio
        });
      } else if (loadRatio < 0.5) {
        analysis.underutilized_contributors.push({
          ...workload,
          load_ratio: loadRatio
        });
      } else {
        analysis.balanced_contributors.push({
          ...workload,
          load_ratio: loadRatio
        });
      }
    }

    // Generate recommendations
    if (analysis.overloaded_contributors.length > 0 && analysis.underutilized_contributors.length > 0) {
      analysis.recommendations.push("Consider redistributing work from overloaded to underutilized contributors");
    }

    if (analysis.overloaded_contributors.some((c: Record<string, Neo4jValue>) => (c.blocked_ratio as number) > 0.2)) {
      analysis.recommendations.push("Focus on unblocking items for overloaded contributors to improve throughput");
    }

    return {
      total_contributors: workloads.length,
      available_capacity: analysis.underutilized_contributors.length / workloads.length,
      utilization_rate: analysis.balanced_contributors.length / workloads.length,
      bottlenecks: analysis.overloaded_contributors.map((c: Record<string, Neo4jValue>) => c.contributor_id),
      ...analysis
    } as CapacityAnalysis;
  }

  private generateWorkloadPredictions(workloads: WorkloadData[]): WorkloadPredictions {
    return {
      completion_trends: "Prediction analysis would require historical data - implement with time-series data",
      recommended_actions: [
        "Implement historical data tracking for accurate predictions",
        "Monitor blocked item ratios across contributors",
        "Establish work-in-progress limits"
      ],
      bottleneck_predictions: workloads
        .filter(w => w.blocked_items > w.total_items * 0.2)
        .map(w => ({
          contributor_id: w.contributor_id,
          predicted_issue: "High blocked item ratio may indicate future bottlenecks"
        })),
      capacity_recommendations: workloads
        .filter(w => w.in_progress_items > 5)
        .map(w => ({
          contributor_id: w.contributor_id,
          recommendation: "Consider limiting work in progress to improve focus"
        }))
    };
  }

  // Contributor-Focused Methods
  async getContributorPriorities(args: {
    contributor_id: string;
    limit?: number;
    priority_type?: 'all' | 'executive' | 'individual' | 'community' | 'composite';
    status_filter?: string[];
    include_dependencies?: boolean;
  }) {
    const limit = args.limit || 10;
    const priorityType = args.priority_type || 'composite';
    const statusFilter = args.status_filter || ['PROPOSED', 'PLANNED', 'ACTIVE', 'IN_PROGRESS', 'BLOCKED'];
    
    let orderBy = 'w.priorityComp DESC';
    switch (priorityType) {
      case 'executive': orderBy = 'w.priorityExec DESC'; break;
      case 'individual': orderBy = 'w.priorityIndiv DESC'; break;
      case 'community': orderBy = 'w.priorityComm DESC'; break;
      case 'all': orderBy = '(w.priorityExec + w.priorityIndiv + w.priorityComm) DESC'; break;
    }

    const session = this.driver.session();
    try {
      const query = `
        MATCH (c:Contributor {id: $contributorId})-[:CONTRIBUTES_TO]->(w:WorkItem)
        WHERE w.status IN $statusFilter
        OPTIONAL MATCH (w)-[:DEPENDS_ON]->(dep:WorkItem)
        RETURN w,
               count(dep) as dependencyCount,
               collect(DISTINCT dep.title)[0..3] as sampleDependencies
        ORDER BY ${orderBy}
        LIMIT $limit
      `;
      
      const result = await session.run(query, {
        contributorId: args.contributor_id,
        statusFilter,
        limit: int(limit)
      });

      const priorities = result.records.map(record => {
        const workItem = record.get('w').properties;
        return {
          id: workItem.id,
          title: workItem.title,
          type: workItem.type,
          status: workItem.status,
          priorities: {
            executive: workItem.priorityExec,
            individual: workItem.priorityIndiv,
            community: workItem.priorityComm,
            composite: workItem.priorityComp
          },
          dependency_count: record.get('dependencyCount').toNumber(),
          sample_dependencies: args.include_dependencies ? record.get('sampleDependencies') : []
        };
      });

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            contributor_id: args.contributor_id,
            priority_type: priorityType,
            total_items: priorities.length,
            priorities
          }, null, 2)
        }]
      };
    } finally {
      await session.close();
    }
  }

  async getContributorWorkload(args: {
    contributor_id: string;
    include_projects?: boolean;
    include_priority_distribution?: boolean;
    include_type_distribution?: boolean;
    include_timeline?: boolean;
    time_window_days?: number;
  }) {
    const session = this.driver.session();
    try {
      // Get basic workload stats
      const workloadQuery = `
        MATCH (c:Contributor {id: $contributorId})-[:CONTRIBUTES_TO]->(w:WorkItem)
        OPTIONAL MATCH (w)-[:BELONGS_TO]->(g:Graph)
        RETURN 
          count(w) as totalItems,
          count(DISTINCT g.id) as projectCount,
          collect(DISTINCT w.status) as statuses,
          collect(DISTINCT w.type) as types,
          avg(w.priorityComp) as avgPriority,
          sum(CASE WHEN w.status IN ['ACTIVE', 'IN_PROGRESS'] THEN 1 ELSE 0 END) as activeItems
      `;

      const workloadResult = await session.run(workloadQuery, {
        contributorId: args.contributor_id
      });

      const workloadStats = workloadResult.records[0];
      
      let projectBreakdown: Record<string, Neo4jValue> = {};
      if (args.include_projects) {
        const projectQuery = `
          MATCH (c:Contributor {id: $contributorId})-[:CONTRIBUTES_TO]->(w:WorkItem)-[:BELONGS_TO]->(g:Graph)
          RETURN g.name as projectName, 
                 count(w) as itemCount,
                 collect(w.status) as itemStatuses,
                 avg(w.priorityComp) as avgPriority
        `;
        const projectResult = await session.run(projectQuery, {
          contributorId: args.contributor_id
        });

        projectBreakdown = projectResult.records.reduce((acc: Record<string, Neo4jValue>, record) => {
          acc[record.get('projectName')] = {
            item_count: record.get('itemCount').toNumber(),
            statuses: record.get('itemStatuses'),
            avg_priority: record.get('avgPriority')
          };
          return acc;
        }, {});
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            contributor_id: args.contributor_id,
            workload_summary: {
              total_items: workloadStats.get('totalItems').toNumber(),
              active_items: workloadStats.get('activeItems').toNumber(),
              project_count: workloadStats.get('projectCount').toNumber(),
              avg_priority: workloadStats.get('avgPriority'),
              status_distribution: workloadStats.get('statuses'),
              type_distribution: workloadStats.get('types')
            },
            project_breakdown: args.include_projects ? projectBreakdown : null
          }, null, 2)
        }]
      };
    } finally {
      await session.close();
    }
  }

  async findContributorsByProject(args: {
    project_filter?: {
      graph_id?: string;
      graph_name?: string;
      node_types?: string[];
    };
    include_workload?: boolean;
    include_expertise?: boolean;
    active_only?: boolean;
    limit?: number;
  }) {
    const session = this.driver.session();
    try {
      let whereClause = '';
      const params: Record<string, Neo4jValue> = { limit: int(args.limit || 50) };

      if (args.project_filter?.graph_id) {
        whereClause += ' AND g.id = $graphId';
        params.graphId = args.project_filter.graph_id;
      }
      if (args.project_filter?.graph_name) {
        whereClause += ' AND toLower(g.name) CONTAINS toLower($graphName)';
        params.graphName = args.project_filter.graph_name;
      }
      if (args.project_filter?.node_types?.length) {
        whereClause += ' AND w.type IN $nodeTypes';
        params.nodeTypes = args.project_filter.node_types;
      }
      if (args.active_only) {
        whereClause += ' AND w.status IN ["ACTIVE", "IN_PROGRESS", "PLANNED"]';
      }

      const query = `
        MATCH (c:Contributor)-[:CONTRIBUTES_TO]->(w:WorkItem)-[:BELONGS_TO]->(g:Graph)
        WHERE 1=1 ${whereClause}
        RETURN c.id as contributorId,
               c.name as contributorName,
               c.type as contributorType,
               g.name as projectName,
               g.id as projectId,
               count(w) as itemCount,
               collect(DISTINCT w.status) as statuses,
               collect(DISTINCT w.type) as workTypes,
               avg(w.priorityComp) as avgPriority
        ORDER BY itemCount DESC
        LIMIT $limit
      `;

      const result = await session.run(query, params);

      const contributors = result.records.map(record => ({
        contributor: {
          id: record.get('contributorId'),
          name: record.get('contributorName'),
          type: record.get('contributorType')
        },
        project: {
          id: record.get('projectId'),
          name: record.get('projectName')
        },
        workload: {
          item_count: record.get('itemCount').toNumber(),
          statuses: record.get('statuses'),
          work_types: record.get('workTypes'),
          avg_priority: record.get('avgPriority')
        }
      }));

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            contributors,
            total_found: contributors.length,
            filters_applied: args.project_filter
          }, null, 2)
        }]
      };
    } finally {
      await session.close();
    }
  }

  async getProjectTeam(args: {
    graph_id: string;
    include_roles?: boolean;
    include_collaboration?: boolean;
    include_capacity?: boolean;
    depth?: number;
  }) {
    const session = this.driver.session();
    try {
      const query = `
        MATCH (g:Graph {id: $graphId})<-[:BELONGS_TO]-(w:WorkItem)<-[:CONTRIBUTES_TO]-(c:Contributor)
        RETURN c.id as contributorId,
               c.name as contributorName,
               c.type as contributorType,
               count(w) as itemCount,
               collect(DISTINCT w.type) as workTypes,
               collect(DISTINCT w.status) as statuses,
               avg(w.priorityComp) as avgPriority,
               sum(CASE WHEN w.status IN ['ACTIVE', 'IN_PROGRESS'] THEN 1 ELSE 0 END) as activeItems
        ORDER BY itemCount DESC
      `;

      const result = await session.run(query, {
        graphId: args.graph_id
      });

      const teamMembers = result.records.map(record => ({
        contributor: {
          id: record.get('contributorId'),
          name: record.get('contributorName'),
          type: record.get('contributorType')
        },
        contribution: {
          total_items: record.get('itemCount').toNumber(),
          active_items: record.get('activeItems').toNumber(),
          work_types: record.get('workTypes'),
          statuses: record.get('statuses'),
          avg_priority: record.get('avgPriority')
        }
      }));

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            project_id: args.graph_id,
            team_size: teamMembers.length,
            team_members: teamMembers,
            team_summary: {
              total_contributors: teamMembers.length,
              total_items: teamMembers.reduce((sum, member) => sum + member.contribution.total_items, 0),
              active_items: teamMembers.reduce((sum, member) => sum + member.contribution.active_items, 0)
            }
          }, null, 2)
        }]
      };
    } finally {
      await session.close();
    }
  }

  async getContributorExpertise(args: {
    contributor_id: string;
    include_work_types?: boolean;
    include_projects?: boolean;
    include_success_patterns?: boolean;
    time_window_days?: number;
    min_items_threshold?: number;
  }) {
    const session = this.driver.session();
    try {
      const timeWindow = args.time_window_days || 90;
      const minThreshold = args.min_items_threshold || 3;
      
      const query = `
        MATCH (c:Contributor {id: $contributorId})-[:CONTRIBUTES_TO]->(w:WorkItem)
        WHERE w.updatedAt > datetime() - duration({days: $timeWindow})
        OPTIONAL MATCH (w)-[:BELONGS_TO]->(g:Graph)
        RETURN 
          collect(DISTINCT w.type) as workTypes,
          collect(DISTINCT g.name) as projects,
          count(w) as totalItems,
          sum(CASE WHEN w.status = 'COMPLETED' THEN 1 ELSE 0 END) as completedItems,
          avg(w.priorityComp) as avgPriorityWorkedOn,
          collect({type: w.type, status: w.status, priority: w.priorityComp}) as itemDetails
      `;

      const result = await session.run(query, {
        contributorId: args.contributor_id,
        timeWindow: int(timeWindow)
      });

      const record = result.records[0];
      if (!record) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ error: 'Contributor not found or no recent activity' }, null, 2)
          }]
        };
      }

      const itemDetails = record.get('itemDetails');
      const workTypeExpertise: Record<string, Record<string, Neo4jValue>> = {};
      
      if (args.include_work_types) {
        itemDetails.forEach((item: Record<string, Neo4jValue>) => {
          if (!workTypeExpertise[item.type]) {
            workTypeExpertise[item.type] = { count: 0, completed: 0, avgPriority: 0 };
          }
          workTypeExpertise[item.type].count++;
          if (item.status === 'COMPLETED') {
            workTypeExpertise[item.type].completed++;
          }
          workTypeExpertise[item.type].avgPriority += item.priority;
        });

        Object.keys(workTypeExpertise).forEach(type => {
          const expertise = workTypeExpertise[type];
          expertise.avgPriority = expertise.avgPriority / expertise.count;
          expertise.completionRate = expertise.completed / expertise.count;
          expertise.expertiseLevel = expertise.count >= minThreshold ? 
            (expertise.completionRate > 0.8 ? 'Expert' : 'Proficient') : 'Beginner';
        });
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            contributor_id: args.contributor_id,
            analysis_period_days: timeWindow,
            overall_stats: {
              total_items: record.get('totalItems').toNumber(),
              completed_items: record.get('completedItems').toNumber(),
              completion_rate: record.get('completedItems').toNumber() / record.get('totalItems').toNumber(),
              avg_priority_level: record.get('avgPriorityWorkedOn')
            },
            work_type_expertise: args.include_work_types ? workTypeExpertise : null,
            project_domains: args.include_projects ? record.get('projects') : null
          }, null, 2)
        }]
      };
    } finally {
      await session.close();
    }
  }

  async getCollaborationNetwork(args: {
    focus_contributor?: string;
    project_scope?: string;
    collaboration_strength?: 'all' | 'strong' | 'moderate' | 'weak';
    include_network_metrics?: boolean;
    include_recommendations?: boolean;
    time_window_days?: number;
  }) {
    const session = this.driver.session();
    try {
      const timeWindow = args.time_window_days || 60;
      
      let query = `
        MATCH (c1:Contributor)-[:CONTRIBUTES_TO]->(w:WorkItem)<-[:CONTRIBUTES_TO]-(c2:Contributor)
        WHERE c1.id <> c2.id
      `;
      
      const params: Record<string, Neo4jValue> = { timeWindow: int(timeWindow) };
      
      if (args.focus_contributor) {
        query += ' AND (c1.id = $focusContributor OR c2.id = $focusContributor)';
        params.focusContributor = args.focus_contributor;
      }
      
      if (args.project_scope) {
        query += ' AND (w)-[:BELONGS_TO]->(:Graph {id: $projectScope})';
        params.projectScope = args.project_scope;
      }

      query += `
        RETURN c1.id as contributor1, c1.name as name1,
               c2.id as contributor2, c2.name as name2,
               count(w) as sharedItems,
               collect(DISTINCT w.type) as sharedWorkTypes,
               avg(w.priorityComp) as avgSharedPriority
        ORDER BY sharedItems DESC
        LIMIT 100
      `;

      const result = await session.run(query, params);

      const collaborations = result.records.map(record => {
        const sharedItems = record.get('sharedItems').toNumber();
        let strength = 'weak';
        if (sharedItems >= 10) strength = 'strong';
        else if (sharedItems >= 5) strength = 'moderate';

        return {
          contributor1: {
            id: record.get('contributor1'),
            name: record.get('name1')
          },
          contributor2: {
            id: record.get('contributor2'),
            name: record.get('name2')
          },
          collaboration: {
            shared_items: sharedItems,
            strength,
            shared_work_types: record.get('sharedWorkTypes'),
            avg_shared_priority: record.get('avgSharedPriority')
          }
        };
      });

      // Filter by collaboration strength if specified
      const filteredCollaborations = args.collaboration_strength && args.collaboration_strength !== 'all'
        ? collaborations.filter(c => c.collaboration.strength === args.collaboration_strength)
        : collaborations;

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            collaboration_network: filteredCollaborations,
            network_summary: {
              total_collaborations: filteredCollaborations.length,
              strongest_collaboration: filteredCollaborations[0] || null,
              analysis_scope: {
                focus_contributor: args.focus_contributor,
                project_scope: args.project_scope,
                time_window_days: timeWindow
              }
            }
          }, null, 2)
        }]
      };
    } finally {
      await session.close();
    }
  }

  async getContributorAvailability(args: {
    contributor_ids?: string[];
    include_capacity_analysis?: boolean;
    include_availability_forecast?: boolean;
    include_overload_risk?: boolean;
    include_recommendations?: boolean;
    forecast_days?: number;
  }) {
    const session = this.driver.session();
    try {
      let query = `
        MATCH (c:Contributor)
      `;
      
      const params: Record<string, Neo4jValue> = {};
      
      if (args.contributor_ids?.length) {
        query += ' WHERE c.id IN $contributorIds';
        params.contributorIds = args.contributor_ids;
      }

      query += `
        OPTIONAL MATCH (c)-[:CONTRIBUTES_TO]->(w:WorkItem)
        WHERE w.status IN ['ACTIVE', 'IN_PROGRESS', 'BLOCKED']
        RETURN c.id as contributorId, c.name as contributorName,
               count(w) as activeItems,
               sum(CASE WHEN w.status = 'BLOCKED' THEN 1 ELSE 0 END) as blockedItems,
               avg(w.priorityComp) as avgActivePriority,
               collect(w.type) as activeWorkTypes
        ORDER BY activeItems DESC
      `;

      const result = await session.run(query, params);

      const availability = result.records.map(record => {
        const activeItems = record.get('activeItems').toNumber();
        const blockedItems = record.get('blockedItems').toNumber();
        
        // Simple capacity assessment based on active items
        let capacity = 'available';
        let overloadRisk = 'low';
        
        if (activeItems >= 15) {
          capacity = 'overloaded';
          overloadRisk = 'high';
        } else if (activeItems >= 10) {
          capacity = 'at_capacity';
          overloadRisk = 'medium';
        } else if (activeItems >= 5) {
          capacity = 'busy';
          overloadRisk = 'low';
        }

        const recommendations = [];
        if (args.include_recommendations) {
          if (capacity === 'overloaded') {
            recommendations.push('Consider redistributing some work items to other team members');
          }
          if (blockedItems > 0) {
            recommendations.push(`Help unblock ${blockedItems} blocked items to improve throughput`);
          }
          if (activeItems === 0) {
            recommendations.push('Available for new assignments');
          }
        }

        return {
          contributor: {
            id: record.get('contributorId'),
            name: record.get('contributorName')
          },
          availability: {
            active_items: activeItems,
            blocked_items: blockedItems,
            capacity_status: capacity,
            overload_risk: args.include_overload_risk ? overloadRisk : undefined,
            avg_priority_working_on: record.get('avgActivePriority'),
            active_work_types: record.get('activeWorkTypes')
          },
          recommendations: args.include_recommendations ? recommendations : undefined
        };
      });

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            availability_analysis: availability,
            summary: {
              total_contributors: availability.length,
              available_contributors: availability.filter(a => a.availability.capacity_status === 'available').length,
              overloaded_contributors: availability.filter(a => a.availability.capacity_status === 'overloaded').length,
              total_active_items: availability.reduce((sum, a) => sum + a.availability.active_items, 0)
            }
          }, null, 2)
        }]
      };
    } finally {
      await session.close();
    }
  }

  async createGraph(args: CreateGraphArgs): Promise<MCPResponse> {
    // Validate required fields
    if (!args.name || args.name.trim().length === 0) {
      throw new Error('Graph name is required and cannot be empty');
    }

    const session = this.driver.session();
    try {
      const query = `
        CREATE (g:Graph {
          id: randomUUID(),
          name: $name,
          description: $description,
          type: $type,
          status: $status,
          teamId: $teamId,
          parentGraphId: $parentGraphId,
          isShared: $isShared,
          settings: $settings,
          createdAt: datetime(),
          updatedAt: datetime(),
          nodeCount: 0,
          edgeCount: 0
        })
        RETURN g
      `;

      const params = {
        name: args.name,
        description: args.description || '',
        type: args.type || 'PROJECT',
        status: args.status || 'ACTIVE',
        teamId: args.teamId || null,
        parentGraphId: args.parentGraphId || null,
        isShared: args.isShared || false,
        settings: JSON.stringify(args.settings || {})
      };

      const result = await session.run(query, params);
      const graph = result.records[0]?.get('g').properties;

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            graph: {
              id: graph.id,
              name: graph.name,
              description: graph.description,
              type: graph.type,
              status: graph.status,
              teamId: graph.teamId,
              parentGraphId: graph.parentGraphId,
              isShared: graph.isShared,
              settings: JSON.parse(graph.settings),
              createdAt: graph.createdAt.toString(),
              nodeCount: typeof graph.nodeCount === 'number' ? graph.nodeCount : graph.nodeCount.toNumber(),
              edgeCount: typeof graph.edgeCount === 'number' ? graph.edgeCount : graph.edgeCount.toNumber()
            }
          }, null, 2)
        }]
      };
    } finally {
      await session.close();
    }
  }

  async listGraphs(filters?: GraphFilters): Promise<MCPResponse> {
    const session = this.driver.session();
    try {
      let whereConditions: string[] = [];
      const params: Neo4jParams = {};

      if (filters?.type) {
        whereConditions.push('g.type = $type');
        params.type = filters.type;
      }
      if (filters?.status) {
        whereConditions.push('g.status = $status');
        params.status = filters.status;
      }
      if (filters?.teamId) {
        whereConditions.push('g.teamId = $teamId');
        params.teamId = filters.teamId;
      }
      if (filters?.isShared !== undefined) {
        whereConditions.push('g.isShared = $isShared');
        params.isShared = filters.isShared;
      }

      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
      const limit = filters?.limit || 50;
      const offset = filters?.offset || 0;

      const query = `
        MATCH (g:Graph)
        ${whereClause}
        RETURN g
        ORDER BY g.updatedAt DESC
        SKIP $offset
        LIMIT $limit
      `;

      params.offset = int(offset);
      params.limit = int(limit);

      const result = await session.run(query, params);
      const graphs = result.records.map(record => {
        const g = record.get('g').properties;
        return {
          id: g.id,
          name: g.name,
          description: g.description,
          type: g.type,
          status: g.status,
          teamId: g.teamId,
          parentGraphId: g.parentGraphId,
          isShared: g.isShared,
          createdAt: g.createdAt.toString(),
          updatedAt: g.updatedAt.toString(),
          nodeCount: typeof g.nodeCount === 'number' ? g.nodeCount : g.nodeCount.toNumber(),
          edgeCount: typeof g.edgeCount === 'number' ? g.edgeCount : g.edgeCount.toNumber()
        };
      });

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            graphs,
            total: graphs.length,
            limit,
            offset
          }, null, 2)
        }]
      };
    } finally {
      await session.close();
    }
  }

  async getGraphDetails(args: GetGraphDetailsArgs): Promise<MCPResponse> {
    const session = this.driver.session();
    try {
      const query = `
        MATCH (g:Graph {id: $graphId})
        OPTIONAL MATCH (g)<-[:BELONGS_TO]-(w:WorkItem)
        OPTIONAL MATCH (w)-[e:DEPENDS_ON|BLOCKS|RELATES_TO|CONTAINS|PART_OF]-(:WorkItem)
        RETURN g,
               count(DISTINCT w) as nodeCount,
               count(DISTINCT e) as edgeCount,
               collect(DISTINCT w.type) as nodeTypes,
               collect(DISTINCT w.status) as nodeStatuses
      `;

      const result = await session.run(query, { graphId: args.graphId });
      
      if (result.records.length === 0) {
        throw new Error(`Graph with ID ${args.graphId} not found`);
      }

      const record = result.records[0];
      const g = record.get('g').properties;
      const nodeCount = record.get('nodeCount').toNumber();
      const edgeCount = record.get('edgeCount').toNumber();
      const nodeTypes = record.get('nodeTypes');
      const nodeStatuses = record.get('nodeStatuses');

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            graph: {
              id: g.id,
              name: g.name,
              description: g.description,
              type: g.type,
              status: g.status,
              teamId: g.teamId,
              parentGraphId: g.parentGraphId,
              isShared: g.isShared,
              settings: g.settings,
              createdAt: g.createdAt.toString(),
              updatedAt: g.updatedAt.toString(),
              nodeCount,
              edgeCount,
              nodeTypes,
              nodeStatuses
            }
          }, null, 2)
        }]
      };
    } finally {
      await session.close();
    }
  }

  async updateGraph(args: UpdateGraphArgs): Promise<MCPResponse> {
    const session = this.driver.session();
    try {
      const updateFields: string[] = [];
      const params: Neo4jParams = { graphId: args.graphId };

      if (args.name !== undefined) {
        updateFields.push('g.name = $name');
        params.name = args.name;
      }
      if (args.description !== undefined) {
        updateFields.push('g.description = $description');
        params.description = args.description;
      }
      if (args.status !== undefined) {
        updateFields.push('g.status = $status');
        params.status = args.status;
      }
      if (args.isShared !== undefined) {
        updateFields.push('g.isShared = $isShared');
        params.isShared = args.isShared;
      }
      if (args.settings !== undefined) {
        updateFields.push('g.settings = $settings');
        params.settings = JSON.stringify(args.settings);
      }

      updateFields.push('g.updatedAt = datetime()');

      const query = `
        MATCH (g:Graph {id: $graphId})
        SET ${updateFields.join(', ')}
        RETURN g
      `;

      const result = await session.run(query, params);
      
      if (result.records.length === 0) {
        throw new Error(`Graph with ID ${args.graphId} not found`);
      }

      const g = result.records[0].get('g').properties;

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            graph: {
              id: g.id,
              name: g.name,
              description: g.description,
              type: g.type,
              status: g.status,
              teamId: g.teamId,
              isShared: g.isShared,
              settings: JSON.parse(g.settings),
              updatedAt: g.updatedAt.toString()
            }
          }, null, 2)
        }]
      };
    } finally {
      await session.close();
    }
  }

  async deleteGraph(args: DeleteGraphArgs): Promise<MCPResponse> {
    const session = this.driver.session();
    try {
      // First check if graph exists and has nodes
      const checkQuery = `
        MATCH (g:Graph {id: $graphId})
        OPTIONAL MATCH (g)<-[:BELONGS_TO]-(w:WorkItem)
        RETURN g, count(w) as nodeCount
      `;

      const checkResult = await session.run(checkQuery, { graphId: args.graphId });
      
      if (checkResult.records.length === 0) {
        throw new Error(`Graph with ID ${args.graphId} not found`);
      }

      const nodeCountRaw = checkResult.records[0].get('nodeCount');
      const nodeCount = typeof nodeCountRaw === 'number' ? nodeCountRaw : nodeCountRaw.toNumber();
      
      if (nodeCount > 0 && !args.force) {
        throw new Error(`Graph contains ${nodeCount} nodes. Use force=true to delete anyway.`);
      }

      // Delete graph and all related nodes/edges
      const deleteQuery = `
        MATCH (g:Graph {id: $graphId})
        OPTIONAL MATCH (g)<-[:BELONGS_TO]-(w:WorkItem)
        OPTIONAL MATCH (w)-[e]-()
        DELETE e, w, g
        RETURN count(*) as deletedCount
      `;

      await session.run(deleteQuery, { graphId: args.graphId });

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            message: `Graph deleted successfully`,
            deletedNodes: nodeCount,
            graphId: args.graphId
          }, null, 2)
        }]
      };
    } finally {
      await session.close();
    }
  }

  async archiveGraph(args: ArchiveGraphArgs): Promise<MCPResponse> {
    const session = this.driver.session();
    try {
      const query = `
        MATCH (g:Graph {id: $graphId})
        SET g.status = 'ARCHIVED',
            g.archivedAt = datetime(),
            g.archiveReason = $reason,
            g.updatedAt = datetime()
        RETURN g
      `;

      const result = await session.run(query, { 
        graphId: args.graphId, 
        reason: args.reason || 'Archived via API' 
      });
      
      if (result.records.length === 0) {
        throw new Error(`Graph with ID ${args.graphId} not found`);
      }

      const g = result.records[0].get('g').properties;

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            message: `Graph archived successfully`,
            graph: {
              id: g.id,
              name: g.name,
              status: g.status,
              archivedAt: g.archivedAt.toString(),
              archiveReason: g.archiveReason
            }
          }, null, 2)
        }]
      };
    } finally {
      await session.close();
    }
  }

  async cloneGraph(args: CloneGraphArgs): Promise<MCPResponse> {
    const session = this.driver.session();
    try {
      const tx = session.beginTransaction();

      try {
        // First get the source graph
        const sourceQuery = `
          MATCH (g:Graph {id: $sourceGraphId})
          RETURN g
        `;

        const sourceResult = await tx.run(sourceQuery, { sourceGraphId: args.sourceGraphId });
        
        if (sourceResult.records.length === 0) {
          throw new Error(`Source graph with ID ${args.sourceGraphId} not found`);
        }

        const sourceGraph = sourceResult.records[0].get('g').properties;

        // Create new graph
        const createGraphQuery = `
          CREATE (g:Graph {
            id: randomUUID(),
            name: $newName,
            description: $description,
            type: $type,
            status: 'ACTIVE',
            teamId: $teamId,
            isShared: $isShared,
            settings: $settings,
            createdAt: datetime(),
            updatedAt: datetime(),
            nodeCount: 0,
            edgeCount: 0,
            clonedFrom: $sourceGraphId
          })
          RETURN g
        `;

        const newGraph = await tx.run(createGraphQuery, {
          newName: args.newName,
          description: `Cloned from: ${sourceGraph.name}`,
          type: sourceGraph.type,
          teamId: args.teamId || sourceGraph.teamId,
          isShared: sourceGraph.isShared,
          settings: sourceGraph.settings,
          sourceGraphId: args.sourceGraphId
        });

        const newGraphId = newGraph.records[0].get('g').properties.id;
        let clonedNodes = 0;
        let clonedEdges = 0;

        // Clone nodes if requested
        if (args.includeNodes !== false) {
          const cloneNodesQuery = `
            MATCH (g:Graph {id: $newGraphId})
            MATCH (source:Graph {id: $sourceGraphId})<-[:BELONGS_TO]-(w:WorkItem)
            CREATE (newW:WorkItem {
              id: randomUUID(),
              title: w.title,
              description: w.description,
              type: w.type,
              status: 'PROPOSED',
              positionX: w.positionX,
              positionY: w.positionY,
              positionZ: w.positionZ,
              priorityComp: w.priorityComp,
              createdAt: datetime(),
              updatedAt: datetime()
            })
            CREATE (newW)-[:BELONGS_TO]->(g)
            WITH w, newW
            SET newW.originalId = w.id
            RETURN count(newW) as nodeCount
          `;

          const nodesResult = await tx.run(cloneNodesQuery, { 
            newGraphId, 
            sourceGraphId: args.sourceGraphId 
          });
          clonedNodes = nodesResult.records[0].get('nodeCount').toNumber();

          // Clone edges if requested
          if (args.includeEdges !== false && clonedNodes > 0) {
            const cloneEdgesQuery = `
              MATCH (newG:Graph {id: $newGraphId})<-[:BELONGS_TO]-(newW:WorkItem)
              MATCH (sourceG:Graph {id: $sourceGraphId})<-[:BELONGS_TO]-(sourceW:WorkItem)
              WHERE sourceW.id = newW.originalId
              MATCH (sourceW)-[r:DEPENDS_ON|BLOCKS|RELATES_TO|CONTAINS|PART_OF]->(targetW:WorkItem)-[:BELONGS_TO]->(sourceG)
              MATCH (newG)<-[:BELONGS_TO]-(newTargetW:WorkItem)
              WHERE newTargetW.originalId = targetW.id
              CREATE (newW)-[newR:DEPENDS_ON {
                type: r.type,
                weight: r.weight,
                metadata: r.metadata
              }]->(newTargetW)
              RETURN count(newR) as edgeCount
            `;

            const edgesResult = await tx.run(cloneEdgesQuery, { 
              newGraphId, 
              sourceGraphId: args.sourceGraphId 
            });
            clonedEdges = edgesResult.records[0].get('edgeCount').toNumber();
          }

          // Update counts and clean up temporary originalId properties
          const updateQuery = `
            MATCH (g:Graph {id: $newGraphId})
            SET g.nodeCount = $nodeCount, g.edgeCount = $edgeCount
            WITH g
            MATCH (g)<-[:BELONGS_TO]-(w:WorkItem)
            REMOVE w.originalId
            RETURN g
          `;

          await tx.run(updateQuery, { 
            newGraphId, 
            nodeCount: int(clonedNodes), 
            edgeCount: int(clonedEdges) 
          });
        }

        await tx.commit();

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: `Graph cloned successfully`,
              newGraph: {
                id: newGraphId,
                name: args.newName,
                sourceGraphId: args.sourceGraphId,
                clonedNodes,
                clonedEdges
              }
            }, null, 2)
          }]
        };

      } catch (error) {
        await tx.rollback();
        throw error;
      }
    } finally {
      await session.close();
    }
  }
}