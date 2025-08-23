import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { GraphService } from '../src/services/graph-service';
import { createMockDriver } from './mock-neo4j';
import neo4j from 'neo4j-driver';

describe('Performance Degradation Chaos Testing', () => {
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
      console.log('⚠️ Real database not available for performance chaos testing');
    }
  });

  afterAll(async () => {
    if (realDriver) {
      await realDriver.close();
    }
  });

  describe('CPU Exhaustion Scenarios', () => {
    it('should handle computationally expensive operations', async () => {
      const services = [mockGraphService];
      if (realGraphService) services.push(realGraphService);

      for (const service of services) {
        const startTime = Date.now();
        const startMemory = process.memoryUsage();
        
        // Create operations with expensive computational overhead
        const expensiveOperations = Array.from({ length: 10 }, (_, i) =>
          service.createNode({
            title: `CPU Intensive ${i}`,
            type: 'TASK',
            metadata: {
              // Complex nested structures that might cause expensive parsing/validation
              deep_structure: Array.from({ length: 1000 }, (_, j) => ({
                level1: {
                  level2: {
                    level3: {
                      level4: {
                        computation: Math.pow(j, 3) + Math.sqrt(j * i),
                        data: `expensive-computation-${i}-${j}`.repeat(10),
                        nested_array: Array.from({ length: 50 }, k => k * j * i),
                        timestamp: Date.now(),
                        hash: Buffer.from(`${i}-${j}-${Date.now()}`).toString('base64')
                      }
                    }
                  }
                }
              })),
              // Large string operations
              string_processing: Array.from({ length: 500 }, j => 
                `string-${i}-${j}`.repeat(20)
              ).join('|'),
              // Mathematical operations
              prime_factors: Array.from({ length: 100 }, j => {
                let n = j + i * 100;
                const factors = [];
                for (let k = 2; k <= Math.sqrt(n); k++) {
                  while (n % k === 0) {
                    factors.push(k);
                    n /= k;
                  }
                }
                if (n > 1) factors.push(n);
                return factors;
              })
            }
          })
        );

        const results = await Promise.allSettled(expensiveOperations);
        const endTime = Date.now();
        const endMemory = process.memoryUsage();
        
        const duration = endTime - startTime;
        const memoryIncrease = endMemory.heapUsed - startMemory.heapUsed;

        const successful = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected').length;

        console.log(`CPU intensive test: ${successful} succeeded, ${failed} failed in ${duration}ms`);
        console.log(`Memory increase: ${Math.round(memoryIncrease / 1024 / 1024)}MB`);

        // Should complete within reasonable time even with expensive operations
        expect(duration).toBeLessThan(60000); // 1 minute max

        // Memory usage should not grow excessively
        const reasonableMemoryLimit = 500 * 1024 * 1024; // 500MB
        if (memoryIncrease > reasonableMemoryLimit) {
          console.warn(`⚠️ Excessive memory usage: ${Math.round(memoryIncrease / 1024 / 1024)}MB`);
        }

        // Check for CPU-related errors
        const errors = results
          .filter(r => r.status === 'rejected')
          .map(r => r.status === 'rejected' ? r.reason.message : '');

        errors.forEach(error => {
          expect(error).toMatch(/cpu|computation|timeout|resource|memory|limit/i);
        });
      }
    });

    it('should prevent algorithmic complexity attacks', async () => {
      const services = [mockGraphService];
      if (realGraphService) services.push(realGraphService);

      for (const service of services) {
        // Test operations that could trigger O(n²) or worse complexity
        const complexityAttacks = [
          {
            name: 'Nested loop trigger',
            data: {
              title: 'Complexity Attack 1',
              type: 'TASK',
              metadata: {
                nested_data: Array.from({ length: 200 }, i => 
                  Array.from({ length: 200 }, j => `item-${i}-${j}`)
                ),
                cross_references: Array.from({ length: 500 }, i => 
                  Array.from({ length: 500 }, j => ({ from: i, to: j }))
                )
              }
            }
          },
          {
            name: 'Recursive structure trigger',
            data: {
              title: 'Complexity Attack 2', 
              type: 'TASK',
              metadata: {
                recursive_tree: generateDeepTree(12, 5) // 5^12 potential nodes
              }
            }
          },
          {
            name: 'Regex complexity trigger',
            data: {
              title: 'Complexity Attack 3',
              type: 'TASK',
              metadata: {
                regex_bomb: 'a'.repeat(1000) + 'X', // Could trigger catastrophic backtracking
                pattern_matching: Array.from({ length: 1000 }, (_, i) => 
                  `(a+)+b${i}`
                )
              }
            }
          }
        ];

        for (const attack of complexityAttacks) {
          const startTime = Date.now();
          
          try {
            const result = await service.createNode(attack.data);
            const duration = Date.now() - startTime;
            
            // Should complete quickly even with complex data
            expect(duration).toBeLessThan(10000); // 10 seconds max
            
            // Response should be valid
            const parsed = JSON.parse(result.content[0].text);
            expect(parsed.node).toBeDefined();
            
            console.log(`${attack.name}: handled in ${duration}ms`);

          } catch (error: any) {
            const duration = Date.now() - startTime;
            
            // Even errors should be fast
            expect(duration).toBeLessThan(10000);
            expect(error.message).toMatch(/complexity|timeout|resource|limit|size/i);
            
            console.log(`✅ ${attack.name} blocked: ${error.message}`);
          }
        }
      }

      function generateDeepTree(depth: number, branching: number): any {
        if (depth <= 0) return { value: 'leaf', timestamp: Date.now() };
        
        return {
          value: `node-depth-${depth}`,
          children: Array.from({ length: branching }, (_, i) => 
            generateDeepTree(depth - 1, branching)
          ),
          metadata: {
            depth,
            branching,
            total_nodes: Math.pow(branching, depth)
          }
        };
      }
    });
  });

  describe('Memory Pressure Scenarios', () => {
    it('should handle memory pressure without crashing', async () => {
      const services = [mockGraphService];
      if (realGraphService) services.push(realGraphService);

      for (const service of services) {
        const initialMemory = process.memoryUsage();
        const memoryPressureOps = [];
        
        // Generate operations that consume increasing amounts of memory
        for (let i = 0; i < 20; i++) {
          const memorySize = Math.pow(2, i + 10); // Start at 1KB, double each time
          
          memoryPressureOps.push(
            service.createNode({
              title: `Memory Pressure ${i}`,
              type: 'TASK',
              metadata: {
                memory_test: true,
                size_bytes: memorySize,
                data_blob: Array.from({ length: Math.min(memorySize / 10, 10000) }, j => 
                  `memory-data-${i}-${j}`.repeat(10)
                ),
                buffer_simulation: 'x'.repeat(Math.min(memorySize, 100000))
              }
            })
          );
        }

        const results = await Promise.allSettled(memoryPressureOps);
        const finalMemory = process.memoryUsage();
        const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

        const successful = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected').length;

        console.log(`Memory pressure test: ${successful} succeeded, ${failed} failed`);
        console.log(`Memory increase: ${Math.round(memoryIncrease / 1024 / 1024)}MB`);

        // Should handle memory pressure gracefully
        const memoryErrors = results
          .filter(r => r.status === 'rejected')
          .map(r => r.status === 'rejected' ? r.reason.message : '');

        memoryErrors.forEach(error => {
          expect(error).toMatch(/memory|heap|allocation|size|limit|resource/i);
        });

        // Should not consume unlimited memory
        const memoryLimitMB = 1000; // 1GB limit
        if (memoryIncrease > memoryLimitMB * 1024 * 1024) {
          console.warn(`⚠️ Memory consumption exceeded ${memoryLimitMB}MB limit`);
        }
      }
    });

    it('should handle memory fragmentation scenarios', async () => {
      const services = [mockGraphService];
      if (realGraphService) services.push(realGraphService);

      for (const service of services) {
        // Create operations with varying memory allocation patterns
        const fragmentationPatterns = [
          // Many small allocations
          Array.from({ length: 1000 }, (_, i) => ({
            title: `Small Alloc ${i}`,
            type: 'TASK',
            metadata: { small_data: `data-${i}`.repeat(5) }
          })),
          // Few large allocations
          Array.from({ length: 5 }, (_, i) => ({
            title: `Large Alloc ${i}`,
            type: 'TASK', 
            metadata: { large_data: Array.from({ length: 10000 }, j => `large-${i}-${j}`) }
          })),
          // Mixed allocation sizes
          Array.from({ length: 100 }, (_, i) => ({
            title: `Mixed Alloc ${i}`,
            type: 'TASK',
            metadata: { 
              mixed_data: Array.from({ length: Math.random() * 1000 }, j => `mixed-${i}-${j}`)
            }
          }))
        ].flat();

        const startTime = Date.now();
        const results = await Promise.allSettled(
          fragmentationPatterns.map(pattern => service.createNode(pattern))
        );
        const duration = Date.now() - startTime;

        const successful = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected').length;

        console.log(`Memory fragmentation test: ${successful} succeeded, ${failed} failed in ${duration}ms`);

        // Should handle various allocation patterns
        expect(duration).toBeLessThan(30000); // 30 seconds max
        expect(successful + failed).toBe(fragmentationPatterns.length);
      }
    });
  });

  describe('I/O Performance Degradation', () => {
    it('should handle I/O bottlenecks gracefully', async () => {
      const services = [mockGraphService];
      if (realGraphService) services.push(realGraphService);

      for (const service of services) {
        // Create I/O intensive operations
        const ioBoundOperations = Array.from({ length: 30 }, (_, i) =>
          service.createNode({
            title: `I/O Bound ${i}`,
            type: 'TASK',
            metadata: {
              io_intensive: true,
              operation_id: i,
              // Large serializable data
              serialization_test: {
                arrays: Array.from({ length: 1000 }, j => 
                  Array.from({ length: 10 }, k => `io-${i}-${j}-${k}`)
                ),
                objects: Array.from({ length: 500 }, j => ({
                  id: `${i}-${j}`,
                  data: `io-data-${i}-${j}`.repeat(20),
                  timestamp: Date.now(),
                  nested: {
                    level1: { level2: { value: `nested-${i}-${j}` } }
                  }
                })),
                strings: Array.from({ length: 100 }, j => 
                  `io-string-${i}-${j}`.repeat(50)
                )
              }
            }
          })
        );

        const startTime = Date.now();
        const results = await Promise.allSettled(ioBoundOperations);
        const duration = Date.now() - startTime;

        const successful = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected').length;

        console.log(`I/O bottleneck test: ${successful} succeeded, ${failed} failed in ${duration}ms`);

        // Should complete within reasonable time despite I/O load
        expect(duration).toBeLessThan(45000); // 45 seconds max

        // Check for I/O related errors
        const ioErrors = results
          .filter(r => r.status === 'rejected')
          .map(r => r.status === 'rejected' ? r.reason.message : '');

        ioErrors.forEach(error => {
          expect(error).toMatch(/io|timeout|serialization|write|read|disk|storage/i);
        });
      }
    });

    it('should prevent I/O amplification attacks', async () => {
      const services = [mockGraphService];
      if (realGraphService) services.push(realGraphService);

      for (const service of services) {
        // Operations that could trigger excessive I/O amplification
        const amplificationAttacks = [
          {
            name: 'Decompression bomb simulation',
            data: {
              title: 'Amplification Test 1',
              type: 'TASK',
              metadata: {
                compressed_simulation: 'small_input',
                expansion_factor: 10000,
                decompressed_size: Array.from({ length: 10000 }, i => `expanded-${i}`)
              }
            }
          },
          {
            name: 'Reference expansion',
            data: {
              title: 'Amplification Test 2',
              type: 'TASK',
              metadata: {
                references: Array.from({ length: 1000 }, i => `ref-${i}`),
                expanded_refs: Array.from({ length: 1000 }, i => 
                  Array.from({ length: 100 }, j => `expanded-ref-${i}-${j}`)
                )
              }
            }
          },
          {
            name: 'Recursive expansion',
            data: {
              title: 'Amplification Test 3',
              type: 'TASK',
              metadata: {
                recursive_expansion: generateRecursiveExpansion(8, 10)
              }
            }
          }
        ];

        for (const attack of amplificationAttacks) {
          const startTime = Date.now();
          const startMemory = process.memoryUsage().heapUsed;

          try {
            const result = await service.createNode(attack.data);
            const duration = Date.now() - startTime;
            const memoryUsed = process.memoryUsage().heapUsed - startMemory;

            // Should not cause excessive I/O amplification
            expect(duration).toBeLessThan(15000); // 15 seconds max
            expect(memoryUsed).toBeLessThan(100 * 1024 * 1024); // 100MB max

            const parsed = JSON.parse(result.content[0].text);
            expect(parsed.node).toBeDefined();

            console.log(`${attack.name}: handled in ${duration}ms, ${Math.round(memoryUsed / 1024 / 1024)}MB`);

          } catch (error: any) {
            const duration = Date.now() - startTime;
            
            // Should fail quickly if amplification is detected
            expect(duration).toBeLessThan(15000);
            expect(error.message).toMatch(/amplification|expansion|size|limit|resource/i);

            console.log(`✅ ${attack.name} blocked: ${error.message}`);
          }
        }

        function generateRecursiveExpansion(depth: number, factor: number): any {
          if (depth <= 0) {
            return { value: 'base', data: 'x'.repeat(100) };
          }

          return {
            value: `depth-${depth}`,
            expansions: Array.from({ length: factor }, (_, i) => 
              generateRecursiveExpansion(depth - 1, factor)
            ),
            metadata: {
              depth,
              factor,
              estimated_size: Math.pow(factor, depth) * 100
            }
          };
        }
      }
    });
  });

  describe('Database Performance Degradation', () => {
    it('should handle query complexity explosions', async () => {
      const services = [mockGraphService];
      if (realGraphService) services.push(realGraphService);

      for (const service of services) {
        // Operations that might generate complex queries
        const complexQueryOps = [
          {
            name: 'Deep relationship traversal',
            operation: () => service.createNode({
              title: 'Complex Query Test 1',
              type: 'TASK',
              metadata: {
                relationships: Array.from({ length: 100 }, i => ({
                  type: 'RELATES_TO',
                  target: `node-${i}`,
                  weight: Math.random(),
                  properties: {
                    created: Date.now(),
                    data: `rel-data-${i}`.repeat(10)
                  }
                }))
              }
            })
          },
          {
            name: 'Many-to-many relationships',
            operation: () => service.createNode({
              title: 'Complex Query Test 2',
              type: 'TASK',
              metadata: {
                many_to_many: {
                  sources: Array.from({ length: 50 }, i => `source-${i}`),
                  targets: Array.from({ length: 50 }, i => `target-${i}`),
                  mappings: Array.from({ length: 2500 }, i => ({
                    source: `source-${i % 50}`,
                    target: `target-${Math.floor(i / 50)}`,
                    properties: { weight: Math.random() }
                  }))
                }
              }
            })
          },
          {
            name: 'Complex filtering conditions',
            operation: () => service.createNode({
              title: 'Complex Query Test 3',
              type: 'TASK',
              metadata: {
                complex_filters: {
                  conditions: Array.from({ length: 200 }, i => ({
                    field: `field_${i % 20}`,
                    operator: ['=', '>', '<', 'CONTAINS', 'STARTS_WITH'][i % 5],
                    value: `value-${i}`,
                    logical: i % 2 === 0 ? 'AND' : 'OR'
                  })),
                  nested_conditions: Array.from({ length: 50 }, i => ({
                    group: Array.from({ length: 10 }, j => ({
                      condition: `nested-${i}-${j}`,
                      value: Math.random()
                    }))
                  }))
                }
              }
            })
          }
        ];

        for (const queryOp of complexQueryOps) {
          const startTime = Date.now();

          try {
            const result = await queryOp.operation();
            const duration = Date.now() - startTime;

            // Should handle complex queries within reasonable time
            expect(duration).toBeLessThan(20000); // 20 seconds max

            const parsed = JSON.parse(result.content[0].text);
            expect(parsed.node).toBeDefined();

            console.log(`${queryOp.name}: completed in ${duration}ms`);

          } catch (error: any) {
            const duration = Date.now() - startTime;

            // Should fail fast if query is too complex
            expect(duration).toBeLessThan(20000);
            expect(error.message).toMatch(/query|complexity|timeout|resource|database/i);

            console.log(`✅ ${queryOp.name} limited: ${error.message}`);
          }
        }
      }
    });

    it('should prevent database connection exhaustion', async () => {
      const services = [mockGraphService];
      if (realGraphService) services.push(realGraphService);

      for (const service of services) {
        // Create many concurrent database operations
        const connectionStressOps = Array.from({ length: 100 }, (_, i) => async () => {
          try {
            const operations = [
              () => service.createNode({
                title: `Connection Stress ${i}`,
                type: 'TASK',
                metadata: { connection_test: i }
              }),
              () => service.getNodeDetails({ node_id: `stress-${i}` }),
              () => service.updatePriorities({
                node_id: `stress-${i}`,
                priority_executive: Math.random()
              }),
              () => service.listGraphs({ limit: 5 })
            ];

            const randomOp = operations[i % operations.length];
            const result = await randomOp();
            
            return { success: true, operation: i, result };
          } catch (error: any) {
            return { success: false, operation: i, error: error.message };
          }
        });

        const startTime = Date.now();
        const results = await Promise.allSettled(
          connectionStressOps.map(op => op())
        );
        const duration = Date.now() - startTime;

        const successful = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected').length;

        console.log(`Connection stress test: ${successful} succeeded, ${failed} failed in ${duration}ms`);

        // Should handle connection stress gracefully
        const connectionErrors = results
          .filter(r => r.status === 'rejected')
          .map(r => r.status === 'rejected' ? r.reason : null)
          .filter(Boolean);

        connectionErrors.forEach(error => {
          if (error.message) {
            expect(error.message).toMatch(/connection|pool|resource|limit|database|timeout/i);
          }
        });

        // Should complete within reasonable time
        expect(duration).toBeLessThan(60000); // 1 minute max
      }
    });
  });
});