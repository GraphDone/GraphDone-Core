import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { GraphService } from '../src/services/graph-service';
import { createMockDriver } from './mock-neo4j';
import neo4j from 'neo4j-driver';
import { Worker } from 'worker_threads';
import { EventEmitter } from 'events';

describe('Resource Exhaustion Chaos Testing', () => {
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
      console.log('⚠️ Real database not available for resource exhaustion chaos testing');
    }
  });

  afterAll(async () => {
    if (realDriver) {
      await realDriver.close();
    }
  });

  describe('Memory Exhaustion Attacks', () => {
    it('should prevent heap memory exhaustion', async () => {
      const services = [mockGraphService];
      if (realGraphService) services.push(realGraphService);

      for (const service of services) {
        const initialMemory = process.memoryUsage();
        let peakMemory = initialMemory.heapUsed;
        
        // Gradual memory exhaustion attempt
        const memoryLimits = [1, 2, 4, 8, 16, 32, 64, 128]; // MB increments
        
        for (const limitMB of memoryLimits) {
          const targetSize = limitMB * 1024 * 1024; // Convert to bytes
          
          try {
            const result = await service.createNode({
              title: `Memory Test ${limitMB}MB`,
              type: 'TASK',
              metadata: {
                memory_bomb: {
                  target_size_mb: limitMB,
                  data_array: Array.from({ length: Math.min(targetSize / 100, 500000) }, (_, i) => {
                    return {
                      index: i,
                      data: 'x'.repeat(Math.min(100, targetSize / 500000)),
                      timestamp: Date.now(),
                      padding: Array.from({ length: Math.min(10, targetSize / 1000000) }, j => `pad-${i}-${j}`)
                    };
                  }),
                  string_bomb: 'memory-test-'.repeat(Math.min(targetSize / 100, 100000)),
                  buffer_simulation: Buffer.alloc(Math.min(targetSize / 10, 10 * 1024 * 1024)).toString('base64')
                }
              }
            });

            const currentMemory = process.memoryUsage().heapUsed;
            peakMemory = Math.max(peakMemory, currentMemory);
            
            // Should handle large data gracefully
            const parsed = JSON.parse(result.content[0].text);
            expect(parsed.node).toBeDefined();
            
            console.log(`${limitMB}MB test: passed, memory: ${Math.round(currentMemory / 1024 / 1024)}MB`);

          } catch (error: any) {
            // Should provide memory-related error messages
            expect(error.message).toMatch(/memory|heap|size|limit|resource|allocation/i);
            
            console.log(`✅ ${limitMB}MB blocked: ${error.message}`);
            break; // Stop testing larger sizes once we hit the limit
          }
        }

        const finalMemory = process.memoryUsage();
        const totalIncrease = peakMemory - initialMemory.heapUsed;
        
        console.log(`Memory exhaustion test: peak increase ${Math.round(totalIncrease / 1024 / 1024)}MB`);
        
        // Should not consume unlimited memory
        const reasonableLimit = 512 * 1024 * 1024; // 512MB
        expect(totalIncrease).toBeLessThan(reasonableLimit);
      }
    });

    it('should handle stack overflow attempts', async () => {
      const services = [mockGraphService];
      if (realGraphService) services.push(realGraphService);

      for (const service of services) {
        // Test recursive structures that could cause stack overflow
        const generateDeepNesting = (depth: number): any => {
          if (depth <= 0) return { value: 'base', depth: 0 };
          
          return {
            value: `level-${depth}`,
            depth,
            nested: generateDeepNesting(depth - 1),
            siblings: depth > 5 ? [] : Array.from({ length: 2 }, (_, i) => 
              generateDeepNesting(Math.max(0, depth - 3))
            ),
            metadata: {
              level: depth,
              path: Array.from({ length: depth }, (_, i) => `path-${depth - i}`),
              data: `deep-data-${depth}`.repeat(Math.min(depth, 10))
            }
          };
        };

        const stackTests = [
          { name: 'Deep recursion', depth: 1000 },
          { name: 'Medium recursion', depth: 500 },
          { name: 'Moderate recursion', depth: 100 }
        ];

        for (const test of stackTests) {
          try {
            const result = await service.createNode({
              title: `Stack Test ${test.depth}`,
              type: 'TASK',
              metadata: {
                stack_test: test.name,
                depth: test.depth,
                recursive_structure: generateDeepNesting(test.depth)
              }
            });

            // If it succeeds, should have handled the recursion safely
            const parsed = JSON.parse(result.content[0].text);
            expect(parsed.node).toBeDefined();
            
            console.log(`${test.name} (${test.depth}): handled safely`);

          } catch (error: any) {
            // Should catch stack overflow attempts
            expect(error.message).toMatch(/stack|recursion|depth|overflow|nesting|deep/i);
            
            console.log(`✅ ${test.name} blocked: ${error.message}`);
          }
        }
      }
    });

    it('should prevent buffer overflow attacks', async () => {
      const services = [mockGraphService];
      if (realGraphService) services.push(realGraphService);

      const bufferAttacks = [
        {
          name: 'Large string buffer',
          data: {
            title: 'Buffer Test 1',
            type: 'TASK',
            metadata: {
              buffer_overflow: 'A'.repeat(10 * 1024 * 1024), // 10MB string
              string_bomb: Array.from({ length: 100000 }, i => `overflow-${i}`).join(''),
              unicode_bomb: '🚀'.repeat(1000000) // Unicode characters
            }
          }
        },
        {
          name: 'Binary buffer overflow',
          data: {
            title: 'Buffer Test 2',
            type: 'TASK',
            metadata: {
              binary_data: Buffer.from(Array.from({ length: 5 * 1024 * 1024 }, () => 
                Math.floor(Math.random() * 256)
              )).toString('base64'),
              null_bytes: '\x00'.repeat(1000000),
              control_chars: Array.from({ length: 10000 }, (_, i) => 
                String.fromCharCode(i % 32)
              ).join('')
            }
          }
        },
        {
          name: 'Array buffer overflow',
          data: {
            title: 'Buffer Test 3',
            type: 'TASK', 
            metadata: {
              huge_array: Array.from({ length: 1000000 }, i => ({
                index: i,
                data: `array-item-${i}`,
                padding: 'x'.repeat(100)
              })),
              nested_arrays: Array.from({ length: 1000 }, i => 
                Array.from({ length: 1000 }, j => `nested-${i}-${j}`)
              )
            }
          }
        }
      ];

      for (const service of services) {
        for (const attack of bufferAttacks) {
          const startTime = Date.now();
          const startMemory = process.memoryUsage().heapUsed;

          try {
            const result = await service.createNode(attack.data);
            const duration = Date.now() - startTime;
            const memoryUsed = process.memoryUsage().heapUsed - startMemory;

            // Should handle large buffers within limits
            expect(duration).toBeLessThan(30000); // 30 seconds max
            expect(memoryUsed).toBeLessThan(200 * 1024 * 1024); // 200MB max

            const parsed = JSON.parse(result.content[0].text);
            expect(parsed.node).toBeDefined();

            console.log(`${attack.name}: handled in ${duration}ms, ${Math.round(memoryUsed / 1024 / 1024)}MB`);

          } catch (error: any) {
            const duration = Date.now() - startTime;
            
            // Should detect buffer overflow attempts
            expect(duration).toBeLessThan(30000);
            expect(error.message).toMatch(/buffer|size|overflow|limit|memory|too large|cpu|exhaustion|protection/i);

            console.log(`✅ ${attack.name} blocked: ${error.message}`);
          }
        }
      }
    });
  });

  describe('CPU Resource Exhaustion', () => {
    it('should prevent CPU-intensive computation attacks', async () => {
      const services = [mockGraphService];
      if (realGraphService) services.push(realGraphService);

      for (const service of services) {
        const cpuAttacks = [
          {
            name: 'Cryptographic workload',
            operation: async () => {
              const data = {
                title: 'CPU Attack 1',
                type: 'TASK',
                metadata: {
                  crypto_work: Array.from({ length: 10000 }, i => {
                    // Simulate expensive hash computation
                    let hash = i;
                    for (let j = 0; j < 1000; j++) {
                      hash = (hash * 31 + j) % 1000007;
                    }
                    return hash;
                  }),
                  prime_generation: Array.from({ length: 1000 }, i => {
                    // Simulate prime finding
                    const candidates = [];
                    for (let n = i * 100; n < (i + 1) * 100; n++) {
                      let isPrime = true;
                      for (let j = 2; j <= Math.sqrt(n); j++) {
                        if (n % j === 0) {
                          isPrime = false;
                          break;
                        }
                      }
                      if (isPrime) candidates.push(n);
                    }
                    return candidates;
                  })
                }
              };
              
              return service.createNode(data);
            }
          },
          {
            name: 'Sorting attack',
            operation: async () => {
              const data = {
                title: 'CPU Attack 2',
                type: 'TASK',
                metadata: {
                  sorting_work: Array.from({ length: 1000 }, () => {
                    // Generate and sort large arrays
                    const arr = Array.from({ length: 10000 }, () => Math.random());
                    return arr.sort().slice(0, 100); // Return subset to avoid memory issues
                  }),
                  nested_sorting: Array.from({ length: 100 }, i => 
                    Array.from({ length: 100 }, j => ({ 
                      value: Math.random(), 
                      computed: Math.pow(i + j, 3) 
                    }))
                  ).sort((a, b) => a[0].computed - b[0].computed)
                }
              };
              
              return service.createNode(data);
            }
          },
          {
            name: 'Regex complexity bomb',
            operation: async () => {
              const data = {
                title: 'CPU Attack 3',
                type: 'TASK',
                metadata: {
                  regex_bomb: {
                    // Patterns that could cause catastrophic backtracking
                    patterns: [
                      '(a+)+b',
                      '(a|a)*b',
                      'a?a?a?a?a?a?a?a?a?a?a?a?a?a?a?a?a?a?a?a?aaaaaaaaaaaaaaaaaaaa'
                    ],
                    test_strings: Array.from({ length: 100 }, (_, i) => 
                      'a'.repeat(i + 100) + 'X'
                    ),
                    complexity_bomb: 'a'.repeat(10000) + 'b'
                  }
                }
              };
              
              return service.createNode(data);
            }
          }
        ];

        for (const attack of cpuAttacks) {
          const startTime = Date.now();
          
          try {
            const result = await attack.operation();
            const duration = Date.now() - startTime;

            // Should complete within reasonable CPU time limits
            expect(duration).toBeLessThan(15000); // 15 seconds max

            const parsed = JSON.parse(result.content[0].text);
            expect(parsed.node).toBeDefined();

            console.log(`${attack.name}: completed in ${duration}ms`);

          } catch (error: any) {
            const duration = Date.now() - startTime;
            
            // Should detect CPU exhaustion attempts
            expect(duration).toBeLessThan(15000);
            expect(error.message).toMatch(/cpu|computation|timeout|complex|resource|limit/i);

            console.log(`✅ ${attack.name} blocked: ${error.message}`);
          }
        }
      }
    });

    it('should handle infinite loop detection', async () => {
      const services = [mockGraphService];
      if (realGraphService) services.push(realGraphService);

      for (const service of services) {
        // Simulate operations that could cause infinite loops
        const infiniteLoopTests = [
          {
            name: 'Circular reference processing',
            data: (() => {
              const circular: any = {
                title: 'Infinite Loop Test 1',
                type: 'TASK',
                metadata: {
                  circular_test: true,
                  self_ref: null as any
                }
              };
              circular.metadata.self_ref = circular;
              return circular;
            })()
          },
          {
            name: 'Mutual recursion',
            data: {
              title: 'Infinite Loop Test 2',
              type: 'TASK',
              metadata: {
                mutual_recursion: {
                  a: { ref_b: null as any },
                  b: { ref_a: null as any }
                }
              }
            }
          }
        ];

        // Set up mutual recursion
        const mutualTest = infiniteLoopTests[1].data.metadata.mutual_recursion;
        mutualTest.a.ref_b = mutualTest.b;
        mutualTest.b.ref_a = mutualTest.a;

        for (const test of infiniteLoopTests) {
          const startTime = Date.now();

          try {
            const result = await service.createNode(test.data);
            const duration = Date.now() - startTime;

            // Should handle circular references without infinite loops
            expect(duration).toBeLessThan(5000); // 5 seconds max

            const parsed = JSON.parse(result.content[0].text);
            expect(parsed.node).toBeDefined();

            // Should not contain actual circular references in JSON
            expect(() => JSON.stringify(parsed)).not.toThrow();

            console.log(`${test.name}: handled safely in ${duration}ms`);

          } catch (error: any) {
            const duration = Date.now() - startTime;

            // Should detect circular references quickly
            expect(duration).toBeLessThan(5000);
            expect(error.message).toMatch(/circular|infinite|recursion|loop|reference/i);

            console.log(`✅ ${test.name} blocked: ${error.message}`);
          }
        }
      }
    });
  });

  describe('Network Resource Exhaustion', () => {
    it('should handle connection pool exhaustion', async () => {
      const services = [mockGraphService];
      if (realGraphService) services.push(realGraphService);

      for (const service of services) {
        // Create many simultaneous connections
        const connectionBombOps = Array.from({ length: 200 }, (_, i) => async () => {
          try {
            const result = await service.createNode({
              title: `Connection Bomb ${i}`,
              type: 'TASK',
              metadata: {
                connection_id: i,
                timestamp: Date.now(),
                data: `connection-data-${i}`.repeat(10)
              }
            });

            return { success: true, connection: i, result };
          } catch (error: any) {
            return { success: false, connection: i, error: error.message };
          }
        });

        const startTime = Date.now();
        const results = await Promise.allSettled(
          connectionBombOps.map(op => op())
        );
        const duration = Date.now() - startTime;

        const successful = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected').length;

        console.log(`Connection bomb test: ${successful} succeeded, ${failed} failed in ${duration}ms`);

        // Should handle connection limits gracefully
        const connectionErrors = results
          .filter(r => r.status === 'rejected')
          .map(r => r.status === 'rejected' ? r.reason : null)
          .filter(Boolean);

        if (connectionErrors.length > 0) {
          connectionErrors.forEach(error => {
            if (error.message) {
              expect(error.message).toMatch(/connection|pool|limit|resource|timeout/i);
            }
          });
        }

        // Should not hang indefinitely
        expect(duration).toBeLessThan(60000); // 1 minute max
      }
    });

    it('should prevent bandwidth exhaustion attacks', async () => {
      const services = [mockGraphService];
      if (realGraphService) services.push(realGraphService);

      for (const service of services) {
        // Simulate high-bandwidth operations
        const bandwidthAttacks = [
          {
            name: 'Large payload upload',
            data: {
              title: 'Bandwidth Attack 1',
              type: 'TASK',
              metadata: {
                large_payload: Array.from({ length: 50000 }, i => ({
                  id: i,
                  data: `bandwidth-test-${i}`.repeat(20),
                  timestamp: Date.now(),
                  binary_data: Buffer.from(Array.from({ length: 1000 }, j => 
                    Math.floor(Math.random() * 256)
                  )).toString('base64'),
                  nested: {
                    level1: { level2: { value: `nested-${i}`.repeat(5) } }
                  }
                }))
              }
            }
          },
          {
            name: 'Repeated large transfers',
            operations: Array.from({ length: 20 }, i => () =>
              service.createNode({
                title: `Bandwidth Repeat ${i}`,
                type: 'TASK',
                metadata: {
                  transfer_id: i,
                  large_data: 'bandwidth-data-'.repeat(100000),
                  binary_chunk: Buffer.alloc(500000).toString('base64')
                }
              })
            )
          }
        ];

        for (const attack of bandwidthAttacks) {
          const startTime = Date.now();

          try {
            if (attack.data) {
              // Single large operation
              const result = await service.createNode(attack.data);
              const duration = Date.now() - startTime;

              expect(duration).toBeLessThan(30000); // 30 seconds max
              
              const parsed = JSON.parse(result.content[0].text);
              expect(parsed.node).toBeDefined();

              console.log(`${attack.name}: handled in ${duration}ms`);

            } else if (attack.operations) {
              // Multiple operations
              const results = await Promise.allSettled(
                attack.operations.map(op => op())
              );
              const duration = Date.now() - startTime;

              const successful = results.filter(r => r.status === 'fulfilled').length;
              const failed = results.filter(r => r.status === 'rejected').length;

              console.log(`${attack.name}: ${successful} succeeded, ${failed} failed in ${duration}ms`);

              expect(duration).toBeLessThan(60000); // 1 minute max
            }

          } catch (error: any) {
            const duration = Date.now() - startTime;

            expect(duration).toBeLessThan(30000);
            expect(error.message).toMatch(/bandwidth|size|limit|too large|resource|timeout/i);

            console.log(`✅ ${attack.name} blocked: ${error.message}`);
          }
        }
      }
    });
  });

  describe('File System Resource Exhaustion', () => {
    it('should prevent disk space exhaustion', async () => {
      const services = [mockGraphService];
      if (realGraphService) services.push(realGraphService);

      for (const service of services) {
        // Operations that might consume excessive disk space
        const diskExhaustionTests = [
          {
            name: 'Log explosion',
            data: {
              title: 'Disk Attack 1',
              type: 'TASK',
              metadata: {
                log_bomb: Array.from({ length: 100000 }, i => ({
                  timestamp: new Date().toISOString(),
                  level: 'INFO',
                  message: `Log entry ${i} with extensive details about operation`.repeat(10),
                  stack_trace: Array.from({ length: 50 }, j => 
                    `at function${j} (file${j}.js:${j}:${j})`
                  ).join('\n'),
                  metadata: {
                    user_id: `user-${i}`,
                    session_id: `session-${i}`,
                    request_data: `request-data-${i}`.repeat(100)
                  }
                }))
              }
            }
          },
          {
            name: 'Backup explosion',
            data: {
              title: 'Disk Attack 2', 
              type: 'TASK',
              metadata: {
                backup_data: {
                  full_backup: Array.from({ length: 10000 }, i => ({
                    file_path: `/backup/file-${i}.data`,
                    content: `file-content-${i}`.repeat(1000),
                    metadata: {
                      size: 1000 * `file-content-${i}`.length,
                      checksum: `checksum-${i}`,
                      timestamp: Date.now()
                    }
                  })),
                  incremental_backups: Array.from({ length: 100 }, i =>
                    Array.from({ length: 1000 }, j => ({
                      change_id: `${i}-${j}`,
                      diff_data: `diff-${i}-${j}`.repeat(100)
                    }))
                  )
                }
              }
            }
          }
        ];

        for (const test of diskExhaustionTests) {
          const startTime = Date.now();

          try {
            const result = await service.createNode(test.data);
            const duration = Date.now() - startTime;

            // Should handle large data within reasonable time
            expect(duration).toBeLessThan(45000); // 45 seconds max

            const parsed = JSON.parse(result.content[0].text);
            expect(parsed.node).toBeDefined();

            console.log(`${test.name}: handled in ${duration}ms`);

          } catch (error: any) {
            const duration = Date.now() - startTime;

            expect(duration).toBeLessThan(45000);
            expect(error.message).toMatch(/disk|space|storage|size|limit|resource|invalid|string|length/i);

            console.log(`✅ ${test.name} blocked: ${error.message}`);
          }
        }
      }
    });

    it('should handle file descriptor exhaustion', async () => {
      const services = [mockGraphService];
      if (realGraphService) services.push(realGraphService);

      for (const service of services) {
        // Operations that might open many file descriptors
        const fileDescriptorOps = Array.from({ length: 1000 }, (_, i) =>
          service.createNode({
            title: `FD Test ${i}`,
            type: 'TASK',
            metadata: {
              file_operation: true,
              file_id: i,
              file_metadata: {
                name: `file-${i}.data`,
                size: Math.random() * 1000000,
                permissions: '644',
                owner: `user-${i % 100}`,
                created: new Date().toISOString()
              }
            }
          })
        );

        const startTime = Date.now();
        const results = await Promise.allSettled(fileDescriptorOps);
        const duration = Date.now() - startTime;

        const successful = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected').length;

        console.log(`File descriptor test: ${successful} succeeded, ${failed} failed in ${duration}ms`);

        // Should handle file descriptor limits gracefully
        const fdErrors = results
          .filter(r => r.status === 'rejected')
          .map(r => r.status === 'rejected' ? r.reason.message : '');

        if (fdErrors.length > 0) {
          fdErrors.forEach(error => {
            expect(error).toMatch(/descriptor|file|resource|limit|too many|open/i);
          });
        }

        // Should complete within reasonable time
        expect(duration).toBeLessThan(30000); // 30 seconds max
      }
    });
  });

  describe('Event Loop and Thread Exhaustion', () => {
    it('should prevent event loop blocking', async () => {
      const services = [mockGraphService];
      if (realGraphService) services.push(realGraphService);

      for (const service of services) {
        // Operations that could block the event loop
        const eventLoopBlockers = [
          {
            name: 'Synchronous heavy computation',
            operation: async () => {
              const data = {
                title: 'Event Loop Blocker 1',
                type: 'TASK',
                metadata: {
                  sync_computation: (() => {
                    const result = [];
                    // Simulate blocking computation
                    const start = Date.now();
                    while (Date.now() - start < 1000 && result.length < 100000) {
                      result.push(Math.random() * Math.random());
                    }
                    return result;
                  })(),
                  blocking_data: 'computed-synchronously'
                }
              };
              
              return service.createNode(data);
            }
          },
          {
            name: 'Many synchronous operations',
            operation: async () => {
              const operations = Array.from({ length: 50 }, i =>
                service.createNode({
                  title: `Sync Op ${i}`,
                  type: 'TASK',
                  metadata: {
                    operation_id: i,
                    sync_work: Array.from({ length: 1000 }, j => j * i),
                    blocking_computation: (() => {
                      let sum = 0;
                      for (let k = 0; k < 10000; k++) {
                        sum += Math.sin(k + i);
                      }
                      return sum;
                    })()
                  }
                })
              );

              return Promise.all(operations);
            }
          }
        ];

        for (const blocker of eventLoopBlockers) {
          const startTime = Date.now();
          const otherEventLoopWork = [];

          // Start some other async work to test if event loop is blocked
          for (let i = 0; i < 10; i++) {
            otherEventLoopWork.push(
              new Promise(resolve => {
                const start = Date.now();
                setImmediate(() => resolve(Date.now() - start));
              })
            );
          }

          try {
            const [blockerResult, ...eventLoopTimes] = await Promise.all([
              blocker.operation(),
              ...otherEventLoopWork
            ] as Promise<any>[]);

            const duration = Date.now() - startTime;
            const avgEventLoopDelay = (eventLoopTimes as number[]).reduce((a, b) => a + b, 0) / eventLoopTimes.length;

            console.log(`${blocker.name}: completed in ${duration}ms, avg event loop delay: ${avgEventLoopDelay}ms`);

            // Should not block event loop excessively
            expect(avgEventLoopDelay).toBeLessThan(100); // 100ms max delay
            expect(duration).toBeLessThan(30000); // 30 seconds max total

            // Results should be valid
            if (Array.isArray(blockerResult)) {
              blockerResult.forEach(result => {
                const parsed = JSON.parse(result.content[0].text);
                expect(parsed.node).toBeDefined();
              });
            } else {
              const parsed = JSON.parse(blockerResult.content[0].text);
              expect(parsed.node).toBeDefined();
            }

          } catch (error: any) {
            const duration = Date.now() - startTime;

            expect(duration).toBeLessThan(30000);
            expect(error.message).toMatch(/event loop|blocking|timeout|resource|computation/i);

            console.log(`✅ ${blocker.name} handled: ${error.message}`);
          }
        }
      }
    });

    it('should handle worker thread exhaustion', async () => {
      // This test simulates what might happen if the system tried to spawn many workers
      const services = [mockGraphService];
      if (realGraphService) services.push(realGraphService);

      for (const service of services) {
        try {
          // Simulate worker-intensive operations
          const workerSimulationOps = Array.from({ length: 100 }, (_, i) =>
            service.createNode({
              title: `Worker Simulation ${i}`,
              type: 'TASK',
              metadata: {
                worker_simulation: true,
                worker_id: i,
                heavy_task: {
                  computation: Array.from({ length: 1000 }, j => Math.pow(i + j, 2)),
                  data_processing: `worker-data-${i}`.repeat(1000),
                  parallel_work: Array.from({ length: 10 }, k => ({
                    task_id: `${i}-${k}`,
                    result: Math.random() * (i + k)
                  }))
                }
              }
            })
          );

          const startTime = Date.now();
          const results = await Promise.allSettled(workerSimulationOps);
          const duration = Date.now() - startTime;

          const successful = results.filter(r => r.status === 'fulfilled').length;
          const failed = results.filter(r => r.status === 'rejected').length;

          console.log(`Worker simulation test: ${successful} succeeded, ${failed} failed in ${duration}ms`);

          // Should handle worker simulation within limits
          expect(duration).toBeLessThan(60000); // 1 minute max

          const workerErrors = results
            .filter(r => r.status === 'rejected')
            .map(r => r.status === 'rejected' ? r.reason.message : '');

          if (workerErrors.length > 0) {
            workerErrors.forEach(error => {
              expect(error).toMatch(/worker|thread|resource|limit|spawn|process/i);
            });
          }

        } catch (error: any) {
          expect(error.message).toMatch(/worker|thread|resource|limit|exhaustion/i);
          console.log(`✅ Worker exhaustion prevented: ${error.message}`);
        }
      }
    });
  });
});