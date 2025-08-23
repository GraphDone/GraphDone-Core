import { describe, it, expect, beforeAll } from 'vitest';
import { GraphService } from '../src/services/graph-service';
import { createMockDriver } from './mock-neo4j';

describe('Graph Management Operations', () => {
  let graphService: GraphService;

  beforeAll(() => {
    const mockDriver = createMockDriver();
    graphService = new GraphService(mockDriver);
  });

  describe('createGraph', () => {
    it('should create a new graph with minimal parameters', async () => {
      const result = await graphService.createGraph({
        name: 'Test Project',
        type: 'PROJECT'
      });

      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(Array.isArray(result.content)).toBe(true);
      expect(result.content.length).toBeGreaterThan(0);

      const content = JSON.parse(result.content[0].text);
      expect(content.graph).toBeDefined();
      expect(content.graph.name).toBe('Test Project');
      expect(content.graph.type).toBe('PROJECT');
      expect(content.graph.status).toBe('ACTIVE');
      expect(content.graph.id).toBeDefined();
    });

    it('should create a new graph with all parameters', async () => {
      const result = await graphService.createGraph({
        name: 'Comprehensive Project',
        description: 'A test project with all options',
        type: 'WORKSPACE',
        status: 'DRAFT',
        teamId: 'team-123',
        parentGraphId: 'parent-456',
        isShared: true,
        settings: { theme: 'dark', autoSave: true }
      });

      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      
      const content = JSON.parse(result.content[0].text);
      expect(content.graph).toBeDefined();
      expect(content.graph.name).toBe('Comprehensive Project');
      expect(content.graph.description).toBe('A test project with all options');
      expect(content.graph.type).toBe('WORKSPACE');
      expect(content.graph.status).toBe('DRAFT');
      expect(content.graph.teamId).toBe('team-123');
      expect(content.graph.parentGraphId).toBe('parent-456');
      expect(content.graph.isShared).toBe(true);
      expect(content.graph.settings).toEqual({ theme: 'dark', autoSave: true });
    });

    it('should use default values when optional parameters are not provided', async () => {
      const result = await graphService.createGraph({
        name: 'Default Project'
      });

      const content = JSON.parse(result.content[0].text);
      expect(content.graph.type).toBe('PROJECT');
      expect(content.graph.status).toBe('ACTIVE');
      expect(content.graph.isShared).toBe(false);
      expect(content.graph.description).toBe('');
      expect(content.graph.settings).toEqual({});
    });
  });

  describe('listGraphs', () => {
    it('should list graphs without filters', async () => {
      const result = await graphService.listGraphs();

      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      
      const content = JSON.parse(result.content[0].text);
      expect(content.graphs).toBeDefined();
      expect(Array.isArray(content.graphs)).toBe(true);
      expect(content.total).toBeDefined();
      expect(content.limit).toBe(50);
      expect(content.offset).toBe(0);
    });

    it('should list graphs with type filter', async () => {
      const result = await graphService.listGraphs({
        type: 'PROJECT',
        limit: 10,
        offset: 5
      });

      expect(result).toBeDefined();
      const content = JSON.parse(result.content[0].text);
      expect(content.graphs).toBeDefined();
      expect(content.limit).toBe(10);
      expect(content.offset).toBe(5);
    });

    it('should list graphs with status filter', async () => {
      const result = await graphService.listGraphs({
        status: 'ACTIVE',
        teamId: 'team-123',
        isShared: true
      });

      expect(result).toBeDefined();
      const content = JSON.parse(result.content[0].text);
      expect(content.graphs).toBeDefined();
    });

    it('should handle pagination correctly', async () => {
      const result = await graphService.listGraphs({
        limit: 25,
        offset: 50
      });

      expect(result).toBeDefined();
      const content = JSON.parse(result.content[0].text);
      expect(content.limit).toBe(25);
      expect(content.offset).toBe(50);
    });
  });

  describe('getGraphDetails', () => {
    it('should get details for existing graph', async () => {
      const result = await graphService.getGraphDetails({
        graphId: 'test-graph-id'
      });

      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      
      const content = JSON.parse(result.content[0].text);
      expect(content.graph).toBeDefined();
      expect(content.graph.id).toBeDefined();
      expect(content.graph.name).toBeDefined();
      expect(content.graph.nodeCount).toBeDefined();
      expect(content.graph.edgeCount).toBeDefined();
      expect(content.graph.nodeTypes).toBeDefined();
      expect(content.graph.nodeStatuses).toBeDefined();
    });

    it('should include comprehensive graph statistics', async () => {
      const result = await graphService.getGraphDetails({
        graphId: 'detailed-graph-id'
      });

      const content = JSON.parse(result.content[0].text);
      expect(content.graph.createdAt).toBeDefined();
      expect(content.graph.updatedAt).toBeDefined();
      expect(content.graph.type).toBeDefined();
      expect(content.graph.status).toBeDefined();
    });
  });

  describe('updateGraph', () => {
    it('should update graph name', async () => {
      const result = await graphService.updateGraph({
        graphId: 'test-graph-id',
        name: 'Updated Project Name'
      });

      expect(result).toBeDefined();
      const content = JSON.parse(result.content[0].text);
      expect(content.graph).toBeDefined();
      expect(content.graph.updatedAt).toBeDefined();
    });

    it('should update graph description and status', async () => {
      const result = await graphService.updateGraph({
        graphId: 'test-graph-id',
        description: 'Updated description',
        status: 'ARCHIVED'
      });

      expect(result).toBeDefined();
      const content = JSON.parse(result.content[0].text);
      expect(content.graph).toBeDefined();
    });

    it('should update sharing settings', async () => {
      const result = await graphService.updateGraph({
        graphId: 'test-graph-id',
        isShared: true,
        settings: { visibility: 'public', notifications: true }
      });

      expect(result).toBeDefined();
      const content = JSON.parse(result.content[0].text);
      expect(content.graph).toBeDefined();
    });

    it('should handle partial updates', async () => {
      const result = await graphService.updateGraph({
        graphId: 'test-graph-id',
        name: 'Only Name Updated'
      });

      expect(result).toBeDefined();
      const content = JSON.parse(result.content[0].text);
      expect(content.graph.updatedAt).toBeDefined();
    });
  });

  describe('deleteGraph', () => {
    it('should require force flag for non-empty graph', async () => {
      await expect(async () => {
        await graphService.deleteGraph({
          graphId: 'populated-graph-id'
        });
      }).rejects.toThrow('Use force=true to delete anyway');
    });

    it('should force delete graph with nodes', async () => {
      const result = await graphService.deleteGraph({
        graphId: 'populated-graph-id',
        force: true
      });

      expect(result).toBeDefined();
      const content = JSON.parse(result.content[0].text);
      expect(content.success).toBe(true);
      expect(content.deletedNodes).toBeDefined();
    });

    it('should include deletion statistics', async () => {
      const result = await graphService.deleteGraph({
        graphId: 'test-graph-id',
        force: true
      });

      const content = JSON.parse(result.content[0].text);
      expect(content.success).toBe(true);
      expect(content.message).toContain('deleted successfully');
      expect(typeof content.deletedNodes).toBe('number');
    });
  });

  describe('archiveGraph', () => {
    it('should archive graph without reason', async () => {
      const result = await graphService.archiveGraph({
        graphId: 'test-graph-id'
      });

      expect(result).toBeDefined();
      const content = JSON.parse(result.content[0].text);
      expect(content.success).toBe(true);
      expect(content.message).toContain('archived successfully');
      expect(content.graph).toBeDefined();
      expect(content.graph.status).toBe('ARCHIVED');
    });

    it('should archive graph with custom reason', async () => {
      const result = await graphService.archiveGraph({
        graphId: 'test-graph-id',
        reason: 'Project completed successfully'
      });

      expect(result).toBeDefined();
      const content = JSON.parse(result.content[0].text);
      expect(content.success).toBe(true);
      expect(content.graph.archiveReason).toBe('Project completed successfully');
      expect(content.graph.archivedAt).toBeDefined();
    });

    it('should include archive metadata', async () => {
      const result = await graphService.archiveGraph({
        graphId: 'metadata-graph-id',
        reason: 'Regulatory compliance'
      });

      const content = JSON.parse(result.content[0].text);
      expect(content.graph.id).toBe('metadata-graph-id');
      expect(content.graph.name).toBeDefined();
      expect(content.graph.status).toBe('ARCHIVED');
      expect(content.graph.archivedAt).toBeDefined();
    });
  });

  describe('cloneGraph', () => {
    it('should clone graph with new name', async () => {
      const result = await graphService.cloneGraph({
        sourceGraphId: 'source-graph-id',
        newName: 'Cloned Project'
      });

      expect(result).toBeDefined();
      const content = JSON.parse(result.content[0].text);
      expect(content.success).toBe(true);
      expect(content.message).toContain('cloned successfully');
      expect(content.newGraph).toBeDefined();
      expect(content.newGraph.name).toBe('Cloned Project');
      expect(content.newGraph.sourceGraphId).toBe('source-graph-id');
    });

    it('should clone graph with nodes and edges', async () => {
      const result = await graphService.cloneGraph({
        sourceGraphId: 'populated-graph-id',
        newName: 'Full Clone',
        includeNodes: true,
        includeEdges: true,
        teamId: 'new-team-123'
      });

      expect(result).toBeDefined();
      const content = JSON.parse(result.content[0].text);
      expect(content.newGraph.clonedNodes).toBeDefined();
      expect(content.newGraph.clonedEdges).toBeDefined();
      expect(typeof content.newGraph.clonedNodes).toBe('number');
      expect(typeof content.newGraph.clonedEdges).toBe('number');
    });

    it('should clone graph with nodes only', async () => {
      const result = await graphService.cloneGraph({
        sourceGraphId: 'node-graph-id',
        newName: 'Nodes Only Clone',
        includeNodes: true,
        includeEdges: false
      });

      expect(result).toBeDefined();
      const content = JSON.parse(result.content[0].text);
      expect(content.newGraph.clonedNodes).toBeGreaterThanOrEqual(0);
      expect(content.newGraph.clonedEdges).toBe(0);
    });

    it('should clone empty graph structure only', async () => {
      const result = await graphService.cloneGraph({
        sourceGraphId: 'structure-graph-id',
        newName: 'Structure Only Clone',
        includeNodes: false,
        includeEdges: false
      });

      expect(result).toBeDefined();
      const content = JSON.parse(result.content[0].text);
      expect(content.newGraph.clonedNodes).toBe(0);
      expect(content.newGraph.clonedEdges).toBe(0);
    });

    it('should handle team assignment in clones', async () => {
      const result = await graphService.cloneGraph({
        sourceGraphId: 'team-graph-id',
        newName: 'Team Clone',
        teamId: 'target-team-456'
      });

      expect(result).toBeDefined();
      const content = JSON.parse(result.content[0].text);
      expect(content.success).toBe(true);
      expect(content.newGraph.id).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should validate required parameters and reject empty names', async () => {
      await expect(async () => {
        await graphService.createGraph({
          name: '',
          type: 'PROJECT'
        });
      }).rejects.toThrow('Graph name is required and cannot be empty');
    });

    it('should handle invalid graph type', async () => {
      const result = await graphService.createGraph({
        name: 'Invalid Type Test',
        // @ts-ignore - Testing invalid type
        type: 'INVALID_TYPE'
      });

      expect(result).toBeDefined();
    });

    it('should handle invalid status', async () => {
      const result = await graphService.updateGraph({
        graphId: 'test-id',
        // @ts-ignore - Testing invalid status
        status: 'INVALID_STATUS'
      });

      expect(result).toBeDefined();
    });
  });

  describe('Integration Scenarios', () => {
    it('should create, update, and archive graph workflow', async () => {
      // Create graph
      const createResult = await graphService.createGraph({
        name: 'Workflow Test',
        type: 'PROJECT'
      });
      expect(createResult).toBeDefined();

      // Update graph
      const updateResult = await graphService.updateGraph({
        graphId: 'workflow-test-id',
        description: 'Updated in workflow'
      });
      expect(updateResult).toBeDefined();

      // Archive graph
      const archiveResult = await graphService.archiveGraph({
        graphId: 'workflow-test-id',
        reason: 'Workflow test completed'
      });
      expect(archiveResult).toBeDefined();
    });

    it('should clone and modify graph workflow', async () => {
      // Clone graph
      const cloneResult = await graphService.cloneGraph({
        sourceGraphId: 'template-graph-id',
        newName: 'Clone Workflow Test',
        includeNodes: true
      });
      expect(cloneResult).toBeDefined();

      // Update cloned graph
      const updateResult = await graphService.updateGraph({
        graphId: 'cloned-graph-id',
        name: 'Modified Clone'
      });
      expect(updateResult).toBeDefined();
    });

    it('should list and filter graphs effectively', async () => {
      // List all graphs
      const allResult = await graphService.listGraphs();
      expect(allResult).toBeDefined();

      // Filter by type
      const typeResult = await graphService.listGraphs({
        type: 'PROJECT'
      });
      expect(typeResult).toBeDefined();

      // Filter by status and team
      const complexResult = await graphService.listGraphs({
        status: 'ACTIVE',
        teamId: 'test-team',
        isShared: false
      });
      expect(complexResult).toBeDefined();
    });
  });
});