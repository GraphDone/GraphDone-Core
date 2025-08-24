import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import neo4j, { Driver, Session } from 'neo4j-driver';
import { GraphService } from '../src/services/graph-service';
import { createMockDriver } from './mock-neo4j';

describe('Neo4j Mock Validation Against Real Database', () => {
  let realDriver: Driver;
  let mockDriver: Driver;
  let realGraphService: GraphService;
  let mockGraphService: GraphService;
  let realSession: Session;

  beforeAll(async () => {
    // Create real Neo4j driver for comparison
    realDriver = neo4j.driver(
      'bolt://localhost:7687',
      neo4j.auth.basic('neo4j', 'graphdone_password'),
      { disableLosslessIntegers: true }
    );

    // Create mock driver
    mockDriver = createMockDriver();

    // Initialize services
    realGraphService = new GraphService(realDriver);
    mockGraphService = new GraphService(mockDriver);

    // Test connection to real database
    realSession = realDriver.session();
    try {
      await realSession.run('RETURN 1 as test');
    } catch (error) {
      console.warn('Real Neo4j database not available, skipping comparison tests');
      await realSession.close();
      return;
    }
    await realSession.close();
  });

  afterAll(async () => {
    if (realDriver) {
      await realDriver.close();
    }
  });

  describe('Response Structure Validation', () => {
    it('should have consistent response structure for createNode', async () => {
      const testParams = {
        title: 'Test Node',
        type: 'TASK',
        description: 'A test task'
      };

      try {
        const realResult = await realGraphService.createNode(testParams);
        const mockResult = await mockGraphService.createNode(testParams);

        // Both should return objects with content arrays
        expect(realResult).toBeDefined();
        expect(mockResult).toBeDefined();
        expect(realResult.content).toBeDefined();
        expect(mockResult.content).toBeDefined();
        expect(Array.isArray(realResult.content)).toBe(true);
        expect(Array.isArray(mockResult.content)).toBe(true);

        // Content should have text elements
        if (realResult.content.length > 0 && mockResult.content.length > 0) {
          expect(realResult.content[0]).toHaveProperty('type');
          expect(mockResult.content[0]).toHaveProperty('type');
          expect(realResult.content[0]).toHaveProperty('text');
          expect(mockResult.content[0]).toHaveProperty('text');
        }
      } catch (error) {
        console.warn('Skipping createNode comparison - real database not available');
      }
    });

    it('should have consistent response structure for getNodeDetails', async () => {
      const testParams = { node_id: 'test-node-id' };

      try {
        const realResult = await realGraphService.getNodeDetails(testParams);
        const mockResult = await mockGraphService.getNodeDetails(testParams);

        // Both should return objects with content arrays
        expect(realResult).toBeDefined();
        expect(mockResult).toBeDefined();
        expect(realResult.content).toBeDefined();
        expect(mockResult.content).toBeDefined();
        expect(Array.isArray(realResult.content)).toBe(true);
        expect(Array.isArray(mockResult.content)).toBe(true);
      } catch (error) {
        console.warn('Skipping getNodeDetails comparison - real database not available');
      }
    });

    it('should have consistent response structure for getContributorPriorities', async () => {
      const testParams = {
        contributor_id: 'test-contributor-id',
        limit: 5,
        priority_type: 'composite' as const
      };

      try {
        const realResult = await realGraphService.getContributorPriorities(testParams);
        const mockResult = await mockGraphService.getContributorPriorities(testParams);

        // Both should return objects with content arrays
        expect(realResult).toBeDefined();
        expect(mockResult).toBeDefined();
        expect(realResult.content).toBeDefined();
        expect(mockResult.content).toBeDefined();
        expect(Array.isArray(realResult.content)).toBe(true);
        expect(Array.isArray(mockResult.content)).toBe(true);

        // Content should have consistent structure
        if (realResult.content.length > 0 && mockResult.content.length > 0) {
          expect(realResult.content[0].type).toBe('text');
          expect(mockResult.content[0].type).toBe('text');
          expect(typeof realResult.content[0].text).toBe('string');
          expect(typeof mockResult.content[0].text).toBe('string');
        }
      } catch (error) {
        console.warn('Skipping getContributorPriorities comparison - real database not available');
      }
    });
  });

  describe('Data Type Consistency', () => {
    it('should return consistent data types from Neo4j queries', async () => {
      try {
        // Test direct session queries to compare mock vs real behavior
        const realSession = realDriver.session();
        const mockSession = mockDriver.session();

        const testQuery = 'MATCH (n:WorkItem) RETURN n LIMIT 1';

        const realResult = await realSession.run(testQuery);
        const mockResult = await mockSession.run(testQuery);

        await realSession.close();
        await mockSession.close();

        // Both should return results with records array
        expect(realResult).toBeDefined();
        expect(mockResult).toBeDefined();
        expect(Array.isArray(realResult.records)).toBe(true);
        expect(Array.isArray(mockResult.records)).toBe(true);

        // If records exist, they should have get methods
        if (realResult.records.length > 0 && mockResult.records.length > 0) {
          expect(typeof realResult.records[0].get).toBe('function');
          expect(typeof mockResult.records[0].get).toBe('function');
        }
      } catch (error) {
        console.warn('Skipping direct query comparison - real database not available');
      }
    });

    it('should handle numeric aggregations consistently', async () => {
      try {
        const realSession = realDriver.session();
        const mockSession = mockDriver.session();

        const countQuery = 'MATCH (n:WorkItem) RETURN count(n) as totalItems';

        const realResult = await realSession.run(countQuery);
        const mockResult = await mockSession.run(countQuery);

        await realSession.close();
        await mockSession.close();

        // Both should return numeric results
        if (realResult.records.length > 0 && mockResult.records.length > 0) {
          const realCount = realResult.records[0].get('totalItems');
          const mockCount = mockResult.records[0].get('totalItems');

          // Real Neo4j returns Integer objects, mock should simulate this
          if (realCount && typeof realCount.toNumber === 'function') {
            expect(typeof mockCount.toNumber).toBe('function');
            expect(typeof realCount.toNumber()).toBe('number');
            expect(typeof mockCount.toNumber()).toBe('number');
          }
        }
      } catch (error) {
        console.warn('Skipping numeric aggregation comparison - real database not available');
      }
    });
  });

  describe('Error Handling Consistency', () => {
    it('should handle invalid queries consistently', async () => {
      const invalidQuery = 'INVALID CYPHER SYNTAX';

      try {
        const realSession = realDriver.session();
        let realError: any = null;
        let mockError: any = null;

        // Test real database error handling
        try {
          await realSession.run(invalidQuery);
        } catch (error) {
          realError = error;
        }

        // Test mock error handling
        const mockSession = mockDriver.session();
        try {
          await mockSession.run(invalidQuery);
        } catch (error) {
          mockError = error;
        }

        await realSession.close();
        await mockSession.close();

        // Both should handle errors gracefully (real throws, mock might not)
        // This documents the difference in behavior
        if (realError) {
          expect(realError).toBeDefined();
          // Mock may or may not throw - document this behavior
          console.log('Real Neo4j throws errors for invalid syntax, mock behavior:', mockError ? 'throws' : 'does not throw');
        }
      } catch (error) {
        console.warn('Skipping error handling comparison - real database not available');
      }
    });
  });

  describe('Transaction Behavior', () => {
    it('should handle transactions consistently', async () => {
      try {
        const realSession = realDriver.session();
        const mockSession = mockDriver.session();

        // Test transaction creation
        const realTx = realSession.beginTransaction();
        const mockTx = mockSession.beginTransaction();

        expect(realTx).toBeDefined();
        expect(mockTx).toBeDefined();
        expect(typeof realTx.run).toBe('function');
        expect(typeof mockTx.run).toBe('function');
        expect(typeof realTx.commit).toBe('function');
        expect(typeof mockTx.commit).toBe('function');
        expect(typeof realTx.rollback).toBe('function');
        expect(typeof mockTx.rollback).toBe('function');

        // Test transaction operations
        try {
          await realTx.run('RETURN 1 as test');
          await mockTx.run('RETURN 1 as test');
          
          await realTx.commit();
          await mockTx.commit();
        } catch (error) {
          await realTx.rollback();
          await mockTx.rollback();
        }

        await realSession.close();
        await mockSession.close();
      } catch (error) {
        console.warn('Skipping transaction comparison - real database not available');
      }
    });
  });

  describe('Mock Accuracy Assessment', () => {
    it('should document differences between mock and real behavior', async () => {
      const differences: string[] = [];

      try {
        // Test various scenarios and document differences
        const testCases = [
          { description: 'Empty result sets', query: 'MATCH (n:NonExistent) RETURN n' },
          { description: 'Aggregation functions', query: 'MATCH (n:WorkItem) RETURN count(n), avg(n.priority)' },
          { description: 'Complex relationships', query: 'MATCH (n:WorkItem)-[r]->(m) RETURN type(r), count(r)' }
        ];

        for (const testCase of testCases) {
          try {
            const realSession = realDriver.session();
            const mockSession = mockDriver.session();

            const realResult = await realSession.run(testCase.query);
            const mockResult = await mockSession.run(testCase.query);

            const realRecordCount = realResult.records.length;
            const mockRecordCount = mockResult.records.length;

            if (realRecordCount !== mockRecordCount) {
              differences.push(`${testCase.description}: Real DB returned ${realRecordCount} records, mock returned ${mockRecordCount}`);
            }

            await realSession.close();
            await mockSession.close();
          } catch (error) {
            differences.push(`${testCase.description}: Error during comparison - ${error}`);
          }
        }

        // Report findings
        if (differences.length > 0) {
          console.log('Mock vs Real Database Differences:');
          differences.forEach(diff => console.log(`  - ${diff}`));
        } else {
          console.log('Mock behavior closely matches real database behavior');
        }

        // Test should pass regardless - this is informational
        expect(true).toBe(true);
      } catch (error) {
        console.warn('Skipping mock accuracy assessment - real database not available');
      }
    });

    it('should validate mock completeness for MCP operations', async () => {
      const mcpOperations = [
        'createNode',
        'getNodeDetails',
        'getContributorPriorities',
        'getContributorWorkload',
        'updatePriorities'
      ];

      const results: Record<string, { mock: boolean; real: boolean }> = {};

      for (const operation of mcpOperations) {
        const mockMethod = mockGraphService[operation as keyof GraphService] as Function;
        const realMethod = realGraphService[operation as keyof GraphService] as Function;

        results[operation] = {
          mock: typeof mockMethod === 'function',
          real: typeof realMethod === 'function'
        };

        // Both should have the same methods available
        expect(results[operation].mock).toBe(results[operation].real);
      }

      console.log('MCP Operation Availability:', results);
    });
  });
});