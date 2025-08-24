import { describe, it, expect, beforeAll } from 'vitest';
import { GraphService } from '../src/services/graph-service';
import { createMockDriver } from './mock-neo4j';

describe('MCP Server Core Functionality', () => {
  let graphService: GraphService;

  beforeAll(() => {
    const mockDriver = createMockDriver();
    graphService = new GraphService(mockDriver);
  });

  describe('Graph Service Initialization', () => {
    it('should initialize with a valid driver', () => {
      expect(graphService).toBeDefined();
      expect(graphService).toBeInstanceOf(GraphService);
    });
  });

  describe('Basic Node Operations', () => {
    it('should handle create_node with valid input', async () => {
      const result = await graphService.createNode({
        title: 'Test Node',
        type: 'TASK',
        description: 'A test task'
      });
      
      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(Array.isArray(result.content)).toBe(true);
    });

    it('should handle get_node_details with valid input', async () => {
      const result = await graphService.getNodeDetails({
        node_id: 'test-node-id'
      });
      
      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
    });
  });

  describe('Contributor-Focused Operations', () => {
    it('should handle get_contributor_priorities with valid input', async () => {
      const result = await graphService.getContributorPriorities({
        contributor_id: 'test-contributor-id',
        limit: 5,
        priority_type: 'composite'
      });
      
      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe('text');
    });

    it('should handle get_contributor_workload with valid input', async () => {
      const result = await graphService.getContributorWorkload({
        contributor_id: 'test-contributor-id',
        include_projects: true
      });
      
      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
    });

    it('should handle find_contributors_by_project with valid input', async () => {
      const result = await graphService.findContributorsByProject({
        project_filter: {
          graph_name: 'Test Project'
        },
        limit: 10
      });
      
      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
    });

    it('should handle get_project_team with valid input', async () => {
      const result = await graphService.getProjectTeam({
        graph_id: 'test-graph-id',
        include_roles: true
      });
      
      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
    });

    it('should handle get_contributor_expertise with valid input', async () => {
      const result = await graphService.getContributorExpertise({
        contributor_id: 'test-contributor-id',
        include_work_types: true,
        time_window_days: 90
      });
      
      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
    });

    it('should handle get_collaboration_network with valid input', async () => {
      const result = await graphService.getCollaborationNetwork({
        focus_contributor: 'test-contributor-id',
        collaboration_strength: 'all'
      });
      
      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
    });

    it('should handle get_contributor_availability with valid input', async () => {
      const result = await graphService.getContributorAvailability({
        contributor_ids: ['test-contributor-id'],
        include_capacity_analysis: true
      });
      
      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
    });
  });

  describe('Priority Management Operations', () => {
    it('should handle update_priorities with valid input', async () => {
      const result = await graphService.updatePriorities({
        node_id: 'test-node-id',
        executive: 0.8,
        individual: 0.6,
        community: 0.7
      });
      
      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
    });

    it('should handle bulk_update_priorities with valid input', async () => {
      const result = await graphService.bulkUpdatePriorities({
        updates: [
          {
            node_id: 'test-node-1',
            executive: 0.8
          },
          {
            node_id: 'test-node-2',
            community: 0.9
          }
        ]
      });
      
      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
    });

    it('should handle get_priority_insights with valid input', async () => {
      const result = await graphService.getPriorityInsights({
        include_statistics: true,
        include_trends: false
      });
      
      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
    });
  });

  describe('Graph Analytics Operations', () => {
    it('should handle analyze_graph_health with valid input', async () => {
      const result = await graphService.analyzeGraphHealth({
        include_metrics: ['node_distribution', 'priority_balance'],
        depth_analysis: false
      });
      
      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
    });

    it('should handle get_bottlenecks with valid input', async () => {
      const result = await graphService.getBottlenecks({
        analysis_depth: 5,
        include_suggested_resolutions: true
      });
      
      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
    });

    it('should handle get_workload_analysis with valid input', async () => {
      const result = await graphService.getWorkloadAnalysis({
        contributor_ids: ['test-contributor-id'],
        time_window: {
          start: '2024-01-01T00:00:00Z',
          end: '2024-12-31T23:59:59Z'
        }
      });
      
      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
    });
  });

  describe('Bulk Operations', () => {
    it('should handle bulk_operations with valid input', async () => {
      const result = await graphService.bulkOperations({
        operations: [
          {
            type: 'create_node',
            params: {
              title: 'Bulk Node 1',
              type: 'TASK'
            }
          },
          {
            type: 'create_node',
            params: {
              title: 'Bulk Node 2',
              type: 'STORY'
            }
          }
        ],
        transaction: true
      });
      
      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
    });
  });
});