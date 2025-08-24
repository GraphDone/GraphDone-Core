// Test tools definition - subset of actual tools for testing
export const testTools = [
  {
    name: 'browse_graph',
    description: 'Browse and query the GraphDone graph structure',
    inputSchema: {
      type: 'object',
      properties: {
        query_type: { 
          type: 'string', 
          enum: ['all_nodes', 'by_type', 'by_status', 'by_contributor', 'by_priority', 'dependencies', 'search'],
          default: 'all_nodes'
        }
      }
    }
  },
  {
    name: 'create_node',
    description: 'Create a new node in the GraphDone graph',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Node title' },
        type: { type: 'string', description: 'Node type' },
        description: { type: 'string', description: 'Node description' }
      },
      required: ['title', 'type']
    }
  },
  {
    name: 'update_node',
    description: 'Update an existing node in the GraphDone graph',
    inputSchema: {
      type: 'object',
      properties: {
        node_id: { type: 'string', description: 'Node ID' },
        title: { type: 'string', description: 'Node title' }
      },
      required: ['node_id']
    }
  },
  {
    name: 'delete_node',
    description: 'Delete a node from the GraphDone graph',
    inputSchema: {
      type: 'object',
      properties: {
        node_id: { type: 'string', description: 'Node ID' }
      },
      required: ['node_id']
    }
  },
  {
    name: 'get_contributor_priorities',
    description: 'Get top priorities for a specific contributor with detailed priority analysis',
    inputSchema: {
      type: 'object',
      properties: {
        contributor_id: { type: 'string', description: 'Contributor ID to analyze' },
        limit: { type: 'number', default: 10 },
        priority_type: { 
          type: 'string', 
          enum: ['all', 'executive', 'individual', 'community', 'composite'],
          default: 'composite'
        }
      },
      required: ['contributor_id']
    }
  },
  {
    name: 'get_contributor_workload',
    description: 'Get detailed workload analysis for a contributor',
    inputSchema: {
      type: 'object',
      properties: {
        contributor_id: { type: 'string', description: 'Contributor ID' }
      },
      required: ['contributor_id']
    }
  },
  {
    name: 'find_contributors_by_project',
    description: 'Find contributors working on specific projects',
    inputSchema: {
      type: 'object',
      properties: {
        project_filter: {
          type: 'object',
          properties: {
            graph_name: { type: 'string' }
          }
        }
      }
    }
  }
];