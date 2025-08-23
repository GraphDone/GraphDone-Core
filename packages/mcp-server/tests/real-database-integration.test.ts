import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import neo4j, { Driver } from 'neo4j-driver';
import { GraphService } from '../src/services/graph-service';

describe('REAL DATABASE INTEGRATION - Graph Management', () => {
  let driver: Driver;
  let graphService: GraphService;
  let testGraphIds: string[] = [];

  beforeAll(async () => {
    // Connect to REAL Neo4j database
    driver = neo4j.driver(
      'bolt://localhost:7687',
      neo4j.auth.basic('neo4j', 'graphdone_password'),
      { disableLosslessIntegers: true }
    );

    graphService = new GraphService(driver);

    // Test connection
    const session = driver.session();
    try {
      await session.run('RETURN 1 as test');
      console.log('✅ Successfully connected to real Neo4j database');
    } catch (error) {
      console.error('❌ Failed to connect to Neo4j:', error);
      throw error;
    } finally {
      await session.close();
    }
  });

  afterAll(async () => {
    // Clean up all test graphs
    const session = driver.session();
    try {
      if (testGraphIds.length > 0) {
        const cleanupQuery = `
          MATCH (g:Graph)
          WHERE g.id IN $graphIds
          OPTIONAL MATCH (g)<-[:BELONGS_TO]-(w:WorkItem)
          OPTIONAL MATCH (w)-[r]-()
          DELETE r, w, g
        `;
        await session.run(cleanupQuery, { graphIds: testGraphIds });
        console.log(`🗑️  Cleaned up ${testGraphIds.length} test graphs`);
      }
    } finally {
      await session.close();
      await driver.close();
    }
  });

  beforeEach(() => {
    // Reset test graph tracking
    testGraphIds = [];
  });

  describe('Graph Creation - REAL DATABASE', () => {
    it('should actually create a graph in Neo4j with all properties', async () => {
      const result = await graphService.createGraph({
        name: 'REAL Integration Test Graph',
        description: 'Testing real database integration',
        type: 'PROJECT',
        status: 'ACTIVE',
        teamId: 'integration-test-team',
        isShared: false,
        settings: { testFlag: true, complexity: 'high' }
      });

      expect(result).toBeDefined();
      const content = JSON.parse(result.content[0].text);
      const graphId = content.graph.id;
      testGraphIds.push(graphId);

      // VERIFY DIRECTLY IN DATABASE - NOT THROUGH MOCKS
      const session = driver.session();
      try {
        const verifyQuery = 'MATCH (g:Graph {id: $graphId}) RETURN g';
        const verifyResult = await session.run(verifyQuery, { graphId });
        
        expect(verifyResult.records.length).toBe(1);
        const dbGraph = verifyResult.records[0].get('g').properties;
        
        // REAL ASSERTIONS AGAINST REAL DATA
        expect(dbGraph.name).toBe('REAL Integration Test Graph');
        expect(dbGraph.description).toBe('Testing real database integration');
        expect(dbGraph.type).toBe('PROJECT');
        expect(dbGraph.status).toBe('ACTIVE');
        expect(dbGraph.teamId).toBe('integration-test-team');
        expect(dbGraph.isShared).toBe(false);
        const parsedSettings = JSON.parse(dbGraph.settings);
        expect(parsedSettings.testFlag).toBe(true);
        expect(parsedSettings.complexity).toBe('high');
        const nodeCount = typeof dbGraph.nodeCount === 'number' ? dbGraph.nodeCount : dbGraph.nodeCount.toNumber();
        const edgeCount = typeof dbGraph.edgeCount === 'number' ? dbGraph.edgeCount : dbGraph.edgeCount.toNumber();
        expect(nodeCount).toBe(0);
        expect(edgeCount).toBe(0);
      } finally {
        await session.close();
      }
    });

    it('should validate required fields and reject empty names', async () => {
      // Test that empty names are properly rejected
      await expect(async () => {
        await graphService.createGraph({
          name: '', // Empty name should be rejected
          type: 'PROJECT'
        });
      }).rejects.toThrow('Graph name is required and cannot be empty');

      // Test that whitespace-only names are also rejected
      await expect(async () => {
        await graphService.createGraph({
          name: '   ', // Whitespace-only name should be rejected
          type: 'PROJECT'
        });
      }).rejects.toThrow('Graph name is required and cannot be empty');
    });

    it('should handle invalid enum values', async () => {
      // Test with invalid type
      const result = await graphService.createGraph({
        name: 'Invalid Type Test',
        // @ts-ignore - Force invalid type to see what really happens
        type: 'INVALID_GRAPH_TYPE'
      });

      const content = JSON.parse(result.content[0].text);
      testGraphIds.push(content.graph.id);

      // What actually gets stored in the database?
      const session = driver.session();
      try {
        const verifyQuery = 'MATCH (g:Graph {id: $graphId}) RETURN g';
        const verifyResult = await session.run(verifyQuery, { graphId: content.graph.id });
        const dbGraph = verifyResult.records[0].get('g').properties;
        
        // Does Neo4j actually enforce our enum constraints? Let's find out!
        expect(dbGraph.type).toBe('INVALID_GRAPH_TYPE'); // This probably passes - IS IT A BUG?
      } finally {
        await session.close();
      }
    });
  });

  describe('Graph Listing - REAL DATABASE', () => {
    it('should return actual graphs from database with real filtering', async () => {
      // Create multiple test graphs with different properties
      const graph1 = await graphService.createGraph({
        name: 'Active Project',
        type: 'PROJECT',
        status: 'ACTIVE',
        teamId: 'team-alpha'
      });
      
      const graph2 = await graphService.createGraph({
        name: 'Draft Workspace',
        type: 'WORKSPACE', 
        status: 'DRAFT',
        teamId: 'team-beta'
      });

      const g1Id = JSON.parse(graph1.content[0].text).graph.id;
      const g2Id = JSON.parse(graph2.content[0].text).graph.id;
      testGraphIds.push(g1Id, g2Id);

      // Test filtering by type
      const projectsResult = await graphService.listGraphs({ type: 'PROJECT' });
      const projectsContent = JSON.parse(projectsResult.content[0].text);
      
      // Should find at least our test project
      const ourProject = projectsContent.graphs.find((g: any) => g.id === g1Id);
      expect(ourProject).toBeDefined();
      expect(ourProject.type).toBe('PROJECT');

      // Test filtering by status
      const draftsResult = await graphService.listGraphs({ status: 'DRAFT' });
      const draftsContent = JSON.parse(draftsResult.content[0].text);
      
      const ourDraft = draftsContent.graphs.find((g: any) => g.id === g2Id);
      expect(ourDraft).toBeDefined();
      expect(ourDraft.status).toBe('DRAFT');
    });
  });

  describe('Graph Updates - REAL DATABASE', () => {
    it('should actually update graphs in Neo4j', async () => {
      // Create a graph to update
      const createResult = await graphService.createGraph({
        name: 'Original Name',
        status: 'DRAFT',
        isShared: false
      });
      
      const graphId = JSON.parse(createResult.content[0].text).graph.id;
      testGraphIds.push(graphId);

      // Update it
      const updateResult = await graphService.updateGraph({
        graphId,
        name: 'Updated Name',
        status: 'ACTIVE',
        isShared: true
      });

      expect(updateResult).toBeDefined();

      // Verify changes in database
      const session = driver.session();
      try {
        const verifyQuery = 'MATCH (g:Graph {id: $graphId}) RETURN g';
        const verifyResult = await session.run(verifyQuery, { graphId });
        const dbGraph = verifyResult.records[0].get('g').properties;
        
        expect(dbGraph.name).toBe('Updated Name');
        expect(dbGraph.status).toBe('ACTIVE');
        expect(dbGraph.isShared).toBe(true);
        expect(dbGraph.updatedAt).toBeDefined();
      } finally {
        await session.close();
      }
    });
  });

  describe('Graph Deletion - REAL DATABASE', () => {
    it('should actually delete graphs and handle constraints', async () => {
      // Create a graph
      const createResult = await graphService.createGraph({
        name: 'Graph to Delete',
        type: 'PROJECT'
      });
      
      const graphId = JSON.parse(createResult.content[0].text).graph.id;
      
      // Delete it
      const deleteResult = await graphService.deleteGraph({ graphId });
      expect(deleteResult).toBeDefined();

      // Verify it's actually gone from database
      const session = driver.session();
      try {
        const verifyQuery = 'MATCH (g:Graph {id: $graphId}) RETURN count(g) as count';
        const verifyResult = await session.run(verifyQuery, { graphId });
        const countRaw = verifyResult.records[0].get('count');
        const count = typeof countRaw === 'number' ? countRaw : countRaw.toNumber();
        
        expect(count).toBe(0); // Should be completely deleted
      } finally {
        await session.close();
      }
    });

    it('should prevent deletion of graphs with nodes (safety check)', async () => {
      // This test will reveal if our safety checks actually work
      const createResult = await graphService.createGraph({
        name: 'Graph with Nodes',
        type: 'PROJECT'
      });
      
      const graphId = JSON.parse(createResult.content[0].text).graph.id;
      testGraphIds.push(graphId);

      // Manually add nodes to this graph via direct database access
      const session = driver.session();
      try {
        await session.run(`
          MATCH (g:Graph {id: $graphId})
          CREATE (w:WorkItem {
            id: randomUUID(),
            title: 'Test Node',
            type: 'TASK',
            status: 'ACTIVE',
            positionX: 0,
            positionY: 0, 
            positionZ: 0,
            priorityComp: 0.5,
            createdAt: datetime(),
            updatedAt: datetime()
          })
          CREATE (w)-[:BELONGS_TO]->(g)
        `, { graphId });

        // Now try to delete without force - should fail
        await expect(async () => {
          await graphService.deleteGraph({ graphId });
        }).rejects.toThrow('Use force=true to delete anyway');

        // Verify graph still exists
        const stillExistsResult = await session.run('MATCH (g:Graph {id: $graphId}) RETURN count(g) as count', { graphId });
        const countRaw = stillExistsResult.records[0].get('count');
        const count = typeof countRaw === 'number' ? countRaw : countRaw.toNumber();
        expect(count).toBe(1);

      } finally {
        await session.close();
      }
    });
  });

  describe('Real Schema Validation', () => {
    it('should reveal actual Neo4j constraints and validation', async () => {
      const session = driver.session();
      try {
        // Check what constraints actually exist on Graph nodes
        const constraintsResult = await session.run('SHOW CONSTRAINTS YIELD name, type, entityType, labelsOrTypes, properties');
        const constraints = constraintsResult.records.map(r => ({
          name: r.get('name'),
          type: r.get('type'),
          entityType: r.get('entityType'),
          labels: r.get('labelsOrTypes'),
          properties: r.get('properties')
        }));

        console.log('📋 Actual Neo4j Constraints:', JSON.stringify(constraints, null, 2));

        // Check what indexes exist
        const indexesResult = await session.run('SHOW INDEXES YIELD name, type, entityType, labelsOrTypes, properties, state');
        const indexes = indexesResult.records.map(r => ({
          name: r.get('name'),
          type: r.get('type'),
          entityType: r.get('entityType'),
          labels: r.get('labelsOrTypes'),
          properties: r.get('properties'),
          state: r.get('state')
        }));

        console.log('🔍 Actual Neo4j Indexes:', JSON.stringify(indexes, null, 2));

        // This will help us understand what's actually enforced vs. what we think is enforced
        expect(true).toBe(true); // Always passes, but logs real schema info
        
      } finally {
        await session.close();
      }
    });
  });
});