#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import neo4j from 'neo4j-driver';
import { GraphService } from './services/graph-service.js';
import { startHealthServer, recordAccess, recordClientConnection } from './health-server.js';
import { startMemoryMonitoring, checkMemoryUsage } from './utils/memory-monitor.js';
import {
  UpdatePrioritiesArgs,
  BulkUpdatePrioritiesArgs,
  GetPriorityInsightsArgs,
  GetContributorPrioritiesArgs,
  GetContributorWorkloadArgs,
  GetCollaborationNetworkArgs,
  BulkOperationsArgs,
  CreateGraphArgs,
  ListGraphsArgs,
  GetGraphDetailsArgs,
  UpdateGraphArgs,
  DeleteGraphArgs,
  ArchiveGraphArgs,
  CloneGraphArgs
} from './types/graph.js';

const server = new Server(
  {
    name: 'graphdone-mcp-server',
    version: require('../../../version').VERSION,
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

let graphService: GraphService;

// Initialize Neo4j connection
async function initializeDatabase() {
  const neo4jUri = process.env.NEO4J_URI || 'bolt://localhost:7687';
  const neo4jUser = process.env.NEO4J_USER || 'neo4j';
  const neo4jPassword = process.env.NEO4J_PASSWORD || 'graphdone_password';

  const driver = neo4j.driver(neo4jUri, neo4j.auth.basic(neo4jUser, neo4jPassword));
  
  try {
    await driver.verifyConnectivity();
    console.error('Connected to Neo4j database');
    graphService = new GraphService(driver);
  } catch (error) {
    console.error('Failed to connect to Neo4j:', error);
    process.exit(1);
  }
}

// Define tools
const tools: Tool[] = [
  {
    name: 'browse_graph',
    description: 'Browse and query the GraphDone graph structure',
    inputSchema: {
      type: 'object',
      properties: {
        query_type: {
          type: 'string',
          enum: ['all_nodes', 'by_type', 'by_status', 'by_contributor', 'by_priority', 'dependencies', 'search'],
          description: 'Type of query to perform'
        },
        filters: {
          type: 'object',
          properties: {
            node_type: { type: 'string', description: 'Filter by node type' },
            status: { type: 'string', description: 'Filter by node status' },
            contributor_id: { type: 'string', description: 'Filter by contributor ID' },
            min_priority: { type: 'number', description: 'Minimum priority threshold' },
            node_id: { type: 'string', description: 'Specific node ID for dependencies' },
            search_term: { type: 'string', description: 'Search term for title/description' },
            limit: { type: 'number', default: 50, description: 'Maximum number of results per page' },
            offset: { type: 'number', default: 0, description: 'Number of results to skip (for pagination)' }
          },
          additionalProperties: false
        }
      },
      required: ['query_type'],
      additionalProperties: false
    }
  },
  {
    name: 'create_node',
    description: 'Create a new node in the GraphDone graph',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Node title' },
        description: { type: 'string', description: 'Node description' },
        type: { 
          type: 'string',
          enum: ['OUTCOME', 'EPIC', 'INITIATIVE', 'STORY', 'TASK', 'BUG', 'FEATURE', 'MILESTONE'],
          description: 'Node type'
        },
        status: {
          type: 'string', 
          enum: ['PROPOSED', 'ACTIVE', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED', 'ARCHIVED'],
          default: 'PROPOSED',
          description: 'Node status'
        },
        contributor_ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of contributor IDs'
        },
        metadata: {
          type: 'object',
          description: 'Additional metadata for the node'
        }
      },
      required: ['title', 'type'],
      additionalProperties: false
    }
  },
  {
    name: 'update_node',
    description: 'Update an existing node in the GraphDone graph',
    inputSchema: {
      type: 'object',
      properties: {
        node_id: { type: 'string', description: 'ID of the node to update' },
        title: { type: 'string', description: 'New title' },
        description: { type: 'string', description: 'New description' },
        status: {
          type: 'string',
          enum: ['PROPOSED', 'ACTIVE', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED', 'ARCHIVED'],
          description: 'New status'
        },
        contributor_ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'New array of contributor IDs'
        },
        metadata: {
          type: 'object',
          description: 'Updated metadata'
        }
      },
      required: ['node_id'],
      additionalProperties: false
    }
  },
  {
    name: 'delete_node',
    description: 'Delete a node from the GraphDone graph',
    inputSchema: {
      type: 'object',
      properties: {
        node_id: { type: 'string', description: 'ID of the node to delete' }
      },
      required: ['node_id'],
      additionalProperties: false
    }
  },
  {
    name: 'create_edge',
    description: 'Create a new edge (relationship) between nodes',
    inputSchema: {
      type: 'object',
      properties: {
        source_id: { type: 'string', description: 'Source node ID' },
        target_id: { type: 'string', description: 'Target node ID' },
        type: {
          type: 'string',
          enum: ['DEPENDS_ON', 'BLOCKS', 'RELATES_TO', 'CONTAINS', 'PART_OF'],
          description: 'Edge type'
        },
        weight: { type: 'number', default: 1.0, description: 'Edge weight' },
        metadata: {
          type: 'object',
          description: 'Additional edge metadata'
        }
      },
      required: ['source_id', 'target_id', 'type'],
      additionalProperties: false
    }
  },
  {
    name: 'delete_edge',
    description: 'Delete an edge (relationship) between nodes',
    inputSchema: {
      type: 'object',
      properties: {
        source_id: { type: 'string', description: 'Source node ID' },
        target_id: { type: 'string', description: 'Target node ID' },
        type: {
          type: 'string',
          enum: ['DEPENDS_ON', 'BLOCKS', 'RELATES_TO', 'CONTAINS', 'PART_OF'],
          description: 'Edge type'
        }
      },
      required: ['source_id', 'target_id', 'type'],
      additionalProperties: false
    }
  },
  {
    name: 'get_node_details',
    description: 'Get detailed information about a specific node',
    inputSchema: {
      type: 'object',
      properties: {
        node_id: { type: 'string', description: 'ID of the node to get details for' },
        relationships_limit: { type: 'number', default: 20, description: 'Maximum number of relationships to return' },
        relationships_offset: { type: 'number', default: 0, description: 'Number of relationships to skip (for pagination)' }
      },
      required: ['node_id'],
      additionalProperties: false
    }
  },
  {
    name: 'find_path',
    description: 'Find a path between two nodes in the graph',
    inputSchema: {
      type: 'object',
      properties: {
        start_id: { type: 'string', description: 'Starting node ID' },
        end_id: { type: 'string', description: 'Ending node ID' },
        max_depth: { type: 'number', default: 10, description: 'Maximum path depth' },
        limit: { type: 'number', default: 10, description: 'Maximum number of paths to return' },
        offset: { type: 'number', default: 0, description: 'Number of paths to skip (for pagination)' }
      },
      required: ['start_id', 'end_id'],
      additionalProperties: false
    }
  },
  // NOTE: detect_cycles temporarily disabled due to Neo4j parameter compatibility issue
  // {
  //   name: 'detect_cycles',
  //   description: 'Detect cycles in the graph structure',
  //   inputSchema: {
  //     type: 'object',
  //     properties: {
  //       max_cycles: { type: 'number', description: 'Maximum number of cycles to return (deprecated - use limit instead)' },
  //       limit: { type: 'number', description: 'Maximum number of cycles to return' },
  //       offset: { type: 'number', description: 'Number of cycles to skip (for pagination)' }
  //     },
  //     additionalProperties: false
  //   }
  // }

  // Priority Management Commands
  {
    name: 'update_priorities',
    description: 'Update priority values for a node (executive, individual, community)',
    inputSchema: {
      type: 'object',
      properties: {
        node_id: { type: 'string', description: 'ID of the node to update priorities for' },
        priority_executive: { type: 'number', description: 'Executive/leadership priority (0-1)' },
        priority_individual: { type: 'number', description: 'Individual contributor priority (0-1)' },
        priority_community: { type: 'number', description: 'Community/democratic priority (0-1)' },
        recalculate_computed: { type: 'boolean', default: true, description: 'Whether to recalculate computed priority' }
      },
      required: ['node_id'],
      additionalProperties: false
    }
  },
  {
    name: 'bulk_update_priorities',
    description: 'Update priorities for multiple nodes in batch',
    inputSchema: {
      type: 'object',
      properties: {
        updates: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              node_id: { type: 'string', description: 'Node ID' },
              priority_executive: { type: 'number', description: 'Executive priority (0-1)' },
              priority_individual: { type: 'number', description: 'Individual priority (0-1)' },
              priority_community: { type: 'number', description: 'Community priority (0-1)' }
            },
            required: ['node_id'],
            additionalProperties: false
          }
        },
        recalculate_all: { type: 'boolean', default: true, description: 'Whether to recalculate computed priorities' }
      },
      required: ['updates'],
      additionalProperties: false
    }
  },
  {
    name: 'get_priority_insights',
    description: 'Get priority analysis and insights across the graph',
    inputSchema: {
      type: 'object',
      properties: {
        filters: {
          type: 'object',
          properties: {
            min_priority: { type: 'number', description: 'Minimum priority threshold' },
            priority_type: { type: 'string', enum: ['executive', 'individual', 'community', 'computed'], description: 'Which priority dimension to analyze' },
            node_types: { type: 'array', items: { type: 'string' }, description: 'Filter by node types' },
            status: { type: 'array', items: { type: 'string' }, description: 'Filter by statuses' }
          },
          additionalProperties: false
        },
        include_statistics: { type: 'boolean', default: true, description: 'Include statistical analysis' },
        include_trends: { type: 'boolean', default: false, description: 'Include trend analysis' }
      },
      additionalProperties: false
    }
  },

  // Graph Analytics Commands
  {
    name: 'analyze_graph_health',
    description: 'Analyze overall graph health with metrics and recommendations',
    inputSchema: {
      type: 'object',
      properties: {
        include_metrics: { 
          type: 'array', 
          items: { type: 'string', enum: ['node_distribution', 'priority_balance', 'dependency_health', 'bottlenecks'] },
          default: ['node_distribution', 'priority_balance', 'dependency_health'],
          description: 'Which health metrics to include'
        },
        depth_analysis: { type: 'boolean', default: false, description: 'Whether to perform deep analysis' },
        team_id: { type: 'string', description: 'Filter analysis to specific team' }
      },
      additionalProperties: false
    }
  },
  {
    name: 'get_bottlenecks',
    description: 'Identify workflow bottlenecks and blocking dependencies',
    inputSchema: {
      type: 'object',
      properties: {
        analysis_depth: { type: 'number', default: 5, description: 'Number of top bottlenecks to analyze' },
        include_suggested_resolutions: { type: 'boolean', default: true, description: 'Include suggested solutions' },
        team_id: { type: 'string', description: 'Filter to specific team' }
      },
      additionalProperties: false
    }
  },

  // Advanced Operations
  {
    name: 'bulk_operations',
    description: 'Execute multiple graph operations in batch with optional transaction support',
    inputSchema: {
      type: 'object',
      properties: {
        operations: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              type: { type: 'string', enum: ['create_node', 'update_node', 'create_edge', 'delete_edge'], description: 'Operation type' },
              params: { type: 'object', description: 'Parameters for the operation' }
            },
            required: ['type', 'params'],
            additionalProperties: false
          }
        },
        transaction: { type: 'boolean', default: true, description: 'Execute all operations in a single transaction' },
        rollback_on_error: { type: 'boolean', default: true, description: 'Rollback transaction if any operation fails' }
      },
      required: ['operations'],
      additionalProperties: false
    }
  },
  {
    name: 'get_workload_analysis',
    description: 'Analyze contributor workloads and capacity',
    inputSchema: {
      type: 'object',
      properties: {
        contributor_ids: { type: 'array', items: { type: 'string' }, description: 'Filter to specific contributors' },
        time_window: {
          type: 'object',
          properties: {
            start: { type: 'string', description: 'Start time (ISO 8601)' },
            end: { type: 'string', description: 'End time (ISO 8601)' }
          },
          required: ['start', 'end'],
          additionalProperties: false
        },
        include_capacity: { type: 'boolean', default: false, description: 'Include capacity analysis' },
        include_predictions: { type: 'boolean', default: false, description: 'Include workload predictions' }
      },
      additionalProperties: false
    }
  },

  // Contributor-Focused Commands
  {
    name: 'get_contributor_priorities',
    description: 'Get top priorities for a specific contributor with detailed priority analysis',
    inputSchema: {
      type: 'object',
      properties: {
        contributor_id: { type: 'string', description: 'Contributor ID to analyze' },
        limit: { type: 'number', default: 10, description: 'Number of top priorities to return' },
        priority_type: { 
          type: 'string', 
          enum: ['all', 'executive', 'individual', 'community', 'composite'],
          default: 'composite',
          description: 'Which priority dimension to sort by'
        },
        status_filter: { 
          type: 'array', 
          items: { type: 'string', enum: ['PROPOSED', 'PLANNED', 'ACTIVE', 'IN_PROGRESS', 'BLOCKED'] },
          description: 'Filter by work item status'
        },
        include_dependencies: { type: 'boolean', default: true, description: 'Include dependency information' }
      },
      required: ['contributor_id'],
      additionalProperties: false
    }
  },
  {
    name: 'get_contributor_workload',
    description: 'Get detailed workload analysis for a contributor including capacity, distribution, and trends',
    inputSchema: {
      type: 'object',
      properties: {
        contributor_id: { type: 'string', description: 'Contributor ID to analyze' },
        include_projects: { type: 'boolean', default: true, description: 'Include project breakdown' },
        include_priority_distribution: { type: 'boolean', default: true, description: 'Include priority distribution analysis' },
        include_type_distribution: { type: 'boolean', default: true, description: 'Include work item type distribution' },
        include_timeline: { type: 'boolean', default: false, description: 'Include timeline analysis' },
        time_window_days: { type: 'number', default: 30, description: 'Days to look back for activity analysis' }
      },
      required: ['contributor_id'],
      additionalProperties: false
    }
  },
  {
    name: 'find_contributors_by_project',
    description: 'Find contributors working on specific projects with role and contribution analysis',
    inputSchema: {
      type: 'object',
      properties: {
        project_filter: {
          type: 'object',
          properties: {
            graph_id: { type: 'string', description: 'Specific graph/project ID' },
            graph_name: { type: 'string', description: 'Search by graph/project name (partial match)' },
            node_types: { 
              type: 'array', 
              items: { type: 'string' },
              description: 'Filter to specific node types (PROJECT, EPIC, etc.)' 
            }
          },
          additionalProperties: false
        },
        include_workload: { type: 'boolean', default: true, description: 'Include contributor workload summary' },
        include_expertise: { type: 'boolean', default: false, description: 'Include expertise analysis' },
        active_only: { type: 'boolean', default: true, description: 'Only include active contributors' },
        limit: { type: 'number', default: 50, description: 'Maximum contributors to return' }
      },
      additionalProperties: false
    }
  },
  {
    name: 'get_project_team',
    description: 'Get team composition and collaboration patterns for projects/graphs',
    inputSchema: {
      type: 'object',
      properties: {
        graph_id: { type: 'string', description: 'Graph/project ID' },
        include_roles: { type: 'boolean', default: true, description: 'Analyze contributor roles and responsibilities' },
        include_collaboration: { type: 'boolean', default: true, description: 'Include collaboration network analysis' },
        include_capacity: { type: 'boolean', default: false, description: 'Include team capacity analysis' },
        depth: { type: 'number', default: 1, description: 'Include subgraphs (depth levels)' }
      },
      required: ['graph_id'],
      additionalProperties: false
    }
  },
  {
    name: 'get_contributor_expertise',
    description: 'Analyze contributor expertise based on work history, types, and success patterns',
    inputSchema: {
      type: 'object',
      properties: {
        contributor_id: { type: 'string', description: 'Contributor ID to analyze' },
        include_work_types: { type: 'boolean', default: true, description: 'Analyze expertise by work item types' },
        include_projects: { type: 'boolean', default: true, description: 'Analyze expertise by project domains' },
        include_success_patterns: { type: 'boolean', default: true, description: 'Analyze completion patterns and success metrics' },
        time_window_days: { type: 'number', default: 90, description: 'Days to look back for expertise analysis' },
        min_items_threshold: { type: 'number', default: 3, description: 'Minimum items required to consider expertise' }
      },
      required: ['contributor_id'],
      additionalProperties: false
    }
  },
  {
    name: 'get_collaboration_network',
    description: 'Find collaboration patterns and networks between contributors',
    inputSchema: {
      type: 'object',
      properties: {
        focus_contributor: { type: 'string', description: 'Focus on collaboration patterns for specific contributor' },
        project_scope: { type: 'string', description: 'Limit analysis to specific project/graph' },
        collaboration_strength: { 
          type: 'string', 
          enum: ['all', 'strong', 'moderate', 'weak'],
          default: 'all',
          description: 'Filter by collaboration strength'
        },
        include_network_metrics: { type: 'boolean', default: true, description: 'Include network analysis metrics' },
        include_recommendations: { type: 'boolean', default: true, description: 'Include collaboration recommendations' },
        time_window_days: { type: 'number', default: 60, description: 'Days to look back for collaboration analysis' }
      },
      additionalProperties: false
    }
  },
  {
    name: 'get_contributor_availability',
    description: 'Analyze contributor capacity, availability, and workload balance',
    inputSchema: {
      type: 'object',
      properties: {
        contributor_ids: { 
          type: 'array', 
          items: { type: 'string' },
          description: 'Specific contributors to analyze (empty for all)' 
        },
        include_capacity_analysis: { type: 'boolean', default: true, description: 'Include detailed capacity analysis' },
        include_availability_forecast: { type: 'boolean', default: false, description: 'Include future availability predictions' },
        include_overload_risk: { type: 'boolean', default: true, description: 'Include overload risk assessment' },
        include_recommendations: { type: 'boolean', default: true, description: 'Include workload rebalancing recommendations' },
        forecast_days: { type: 'number', default: 14, description: 'Days ahead to forecast availability' }
      },
      additionalProperties: false
    }
  },

  // Graph Management Tools
  {
    name: 'create_graph',
    description: 'Create a new graph/project container',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Graph name' },
        description: { type: 'string', description: 'Graph description' },
        type: { 
          type: 'string',
          enum: ['PROJECT', 'WORKSPACE', 'SUBGRAPH', 'TEMPLATE'],
          description: 'Graph type',
          default: 'PROJECT'
        },
        status: {
          type: 'string',
          enum: ['ACTIVE', 'ARCHIVED', 'DRAFT', 'LOCKED'],
          description: 'Graph status',
          default: 'ACTIVE'
        },
        teamId: { type: 'string', description: 'Team ID' },
        parentGraphId: { type: 'string', description: 'Parent graph ID for subgraphs' },
        isShared: { type: 'boolean', description: 'Whether graph is shared', default: false },
        settings: { type: 'object', description: 'Graph settings' }
      },
      required: ['name', 'type'],
      additionalProperties: false
    }
  },
  {
    name: 'list_graphs',
    description: 'List available graphs/projects',
    inputSchema: {
      type: 'object',
      properties: {
        teamId: { type: 'string', description: 'Filter by team ID' },
        type: { 
          type: 'string',
          enum: ['PROJECT', 'WORKSPACE', 'SUBGRAPH', 'TEMPLATE'],
          description: 'Filter by graph type'
        },
        status: {
          type: 'string',
          enum: ['ACTIVE', 'ARCHIVED', 'DRAFT', 'LOCKED'],
          description: 'Filter by status'
        },
        includeArchived: { type: 'boolean', description: 'Include archived graphs', default: false },
        limit: { type: 'number', description: 'Maximum number of graphs to return', default: 50 }
      },
      additionalProperties: false
    }
  },
  {
    name: 'get_graph_details',
    description: 'Get detailed information about a specific graph',
    inputSchema: {
      type: 'object',
      properties: {
        graphId: { type: 'string', description: 'Graph ID' }
      },
      required: ['graphId'],
      additionalProperties: false
    }
  },
  {
    name: 'update_graph',
    description: 'Update graph metadata and settings',
    inputSchema: {
      type: 'object',
      properties: {
        graphId: { type: 'string', description: 'Graph ID to update' },
        name: { type: 'string', description: 'New graph name' },
        description: { type: 'string', description: 'New description' },
        status: {
          type: 'string',
          enum: ['ACTIVE', 'ARCHIVED', 'DRAFT', 'LOCKED'],
          description: 'New status'
        },
        isShared: { type: 'boolean', description: 'Update sharing status' },
        settings: { type: 'object', description: 'Updated settings' }
      },
      required: ['graphId'],
      additionalProperties: false
    }
  },
  {
    name: 'delete_graph',
    description: 'Delete a graph (requires confirmation)',
    inputSchema: {
      type: 'object',
      properties: {
        graphId: { type: 'string', description: 'Graph ID to delete' },
        confirmation: { 
          type: 'string', 
          description: 'Type the graph name to confirm deletion'
        },
        deleteNodes: { 
          type: 'boolean', 
          description: 'Also delete all nodes in the graph', 
          default: false 
        }
      },
      required: ['graphId', 'confirmation'],
      additionalProperties: false
    }
  },
  {
    name: 'archive_graph',
    description: 'Archive a graph (soft delete)',
    inputSchema: {
      type: 'object',
      properties: {
        graphId: { type: 'string', description: 'Graph ID to archive' },
        reason: { type: 'string', description: 'Reason for archiving' }
      },
      required: ['graphId'],
      additionalProperties: false
    }
  },
  {
    name: 'clone_graph',
    description: 'Clone an existing graph as a template or new project',
    inputSchema: {
      type: 'object',
      properties: {
        sourceGraphId: { type: 'string', description: 'Source graph ID to clone' },
        newName: { type: 'string', description: 'Name for the cloned graph' },
        includeNodes: { type: 'boolean', description: 'Include all nodes', default: true },
        includeEdges: { type: 'boolean', description: 'Include all edges', default: true },
        teamId: { type: 'string', description: 'Team ID for cloned graph' }
      },
      required: ['sourceGraphId', 'newName'],
      additionalProperties: false
    }
  }
];

// Handle list tools request
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  // Check memory usage before processing request
  checkMemoryUsage();
  
  // Record MCP server access
  recordAccess();

  try {
    switch (name) {
      case 'browse_graph':
        return await graphService.browseGraph(args || {});

      case 'create_node':
        return await graphService.createNode(args || {});

      case 'update_node':
        return await graphService.updateNode(args || {});

      case 'delete_node':
        return await graphService.deleteNode(args || {});

      case 'create_edge':
        return await graphService.createEdge(args || {});

      case 'delete_edge':
        return await graphService.deleteEdge(args || {});

      case 'get_node_details':
        return await graphService.getNodeDetails(args || {});

      case 'find_path':
        return await graphService.findPath(args || {});

      // NOTE: detect_cycles temporarily disabled
      // case 'detect_cycles':
      //   return await graphService.detectCycles(args || {});

      // Priority Management Commands
      case 'update_priorities':
        return await graphService.updatePriorities((args || {}) as UpdatePrioritiesArgs);

      case 'bulk_update_priorities':
        return await graphService.bulkUpdatePriorities((args || {}) as BulkUpdatePrioritiesArgs);

      case 'get_priority_insights':
        return await graphService.getPriorityInsights(args as GetPriorityInsightsArgs);

      // Graph Analytics Commands
      case 'analyze_graph_health':
        return await graphService.analyzeGraphHealth(args as Record<string, unknown>);

      case 'get_bottlenecks':
        return await graphService.getBottlenecks(args as Record<string, unknown>);

      // Advanced Operations
      case 'bulk_operations':
        return await graphService.bulkOperations((args || {}) as BulkOperationsArgs);

      case 'get_workload_analysis':
        return await graphService.getWorkloadAnalysis(args as Record<string, unknown>);

      // Contributor-Focused Commands
      case 'get_contributor_priorities':
        return await graphService.getContributorPriorities((args || {}) as GetContributorPrioritiesArgs);

      case 'get_contributor_workload':
        return await graphService.getContributorWorkload((args || {}) as GetContributorWorkloadArgs);

      case 'find_contributors_by_project':
        return await graphService.findContributorsByProject(args as Record<string, unknown>);

      case 'get_project_team':
        return await graphService.getProjectTeam(args || {});

      case 'get_contributor_expertise':
        return await graphService.getContributorExpertise(args || {});

      case 'get_collaboration_network':
        return await graphService.getCollaborationNetwork(args as GetCollaborationNetworkArgs);

      case 'get_contributor_availability':
        return await graphService.getContributorAvailability(args as Record<string, unknown>);

      // Graph Management Commands - Type assertions needed for MCP dynamic arguments
      case 'create_graph':
        return await graphService.createGraph((args || {}) as CreateGraphArgs);

      case 'list_graphs':
        return await graphService.listGraphs(args as ListGraphsArgs);

      case 'get_graph_details':
        return await graphService.getGraphDetails((args || {}) as GetGraphDetailsArgs);

      case 'update_graph':
        return await graphService.updateGraph((args || {}) as UpdateGraphArgs);

      case 'delete_graph':
        return await graphService.deleteGraph((args || {}) as DeleteGraphArgs);

      case 'archive_graph':
        return await graphService.archiveGraph((args || {}) as ArchiveGraphArgs);

      case 'clone_graph':
        return await graphService.cloneGraph((args || {}) as CloneGraphArgs);

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error executing ${name}: ${error instanceof Error ? error.message : String(error)}`
        }
      ],
      isError: true
    };
  }
});

// Start the server
async function main() {
  try {
    console.error('Initializing GraphDone MCP Server...');
    
    // Start memory monitoring first for security
    startMemoryMonitoring();
    
    await initializeDatabase();
    
    // Start health check server
    const healthPort = parseInt(process.env.MCP_HEALTH_PORT || '3128');
    startHealthServer(healthPort);
    
    console.error('Setting up stdio transport...');
    const transport = new StdioServerTransport();
    
    // Add transport event logging for debugging
    transport.onclose = () => {
      console.error('MCP transport closed');
    };
    
    transport.onerror = (error) => {
      console.error('MCP transport error:', error);
    };
    
    console.error('Connecting to MCP transport...');
    await server.connect(transport);
    
    // Record client connection
    recordClientConnection();
    
    console.error(`GraphDone MCP Server started successfully (health check on port ${healthPort})`);
    console.error('MCP Server ready to receive requests...');
  } catch (error) {
    console.error('Failed to start MCP server:', error);
    throw error;
  }
}

// Start the server
main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});