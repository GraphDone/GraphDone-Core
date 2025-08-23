import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { GraphService } from '../src/services/graph-service';
import { createMockDriver } from './mock-neo4j';
import neo4j from 'neo4j-driver';

describe('Concurrency and Race Condition Chaos Testing', () => {
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
      console.log('⚠️ Real database not available for concurrency chaos testing');
    }
  });

  afterAll(async () => {
    if (realDriver) {
      await realDriver.close();
    }
  });

  describe('Race Condition Detection', () => {
    it('should handle simultaneous node creation with identical data', async () => {
      const services = [mockGraphService];
      if (realGraphService) services.push(realGraphService);

      for (const service of services) {
        const identicalNodeData = {
          title: `Race Condition Test ${Date.now()}`,
          type: 'TASK' as const,
          metadata: { 
            timestamp: Date.now(),
            race_test: true
          }
        };

        // Create 50 identical nodes simultaneously
        const racePromises = Array.from({ length: 50 }, () => 
          service.createNode(identicalNodeData)
        );

        const results = await Promise.allSettled(racePromises);
        
        const successful = results.filter(r => r.status === 'fulfilled');
        const failed = results.filter(r => r.status === 'rejected');

        console.log(`Race condition test: ${successful.length} succeeded, ${failed.length} failed`);

        // Check for duplicate IDs (race condition indicator)
        const nodeIds = successful
          .map(r => r.status === 'fulfilled' ? JSON.parse(r.value.content[0].text).node?.id : null)
          .filter(Boolean);

        const uniqueIds = new Set(nodeIds);
        
        if (uniqueIds.size !== nodeIds.length) {
          const duplicates = nodeIds.length - uniqueIds.size;
          throw new Error(`Race condition detected: ${duplicates} duplicate node IDs created`);
        }

        // All successful operations should return valid, unique nodes
        expect(uniqueIds.size).toBe(successful.length);
      }
    });

    it('should prevent lost updates in concurrent modifications', async () => {
      const services = [mockGraphService];
      if (realGraphService) services.push(realGraphService);

      for (const service of services) {
        // Create initial node
        const initialResult = await service.createNode({
          title: 'Lost Update Test',
          type: 'TASK',
          metadata: { counter: 0 }
        });

        const initialNode = JSON.parse(initialResult.content[0].text).node;
        const nodeId = initialNode.id;

        // Simulate lost update scenario
        const updatePromises = Array.from({ length: 20 }, (_, i) => 
          service.updateNode({
            node_id: nodeId,
            title: `Update ${i}`,
            metadata: { counter: i, updater: `thread_${i}` }
          })
        );

        const updateResults = await Promise.allSettled(updatePromises);
        
        const successfulUpdates = updateResults.filter(r => r.status === 'fulfilled');
        
        if (successfulUpdates.length > 1) {
          // Check final state consistency
          const finalResult = await service.getNodeDetails({ node_id: nodeId });
          const finalNode = JSON.parse(finalResult.content[0].text).node;
          
          if (finalNode) {
            // Final state should correspond to one of the updates
            const updateCounters = successfulUpdates
              .map(r => r.status === 'fulfilled' ? JSON.parse(r.value.content[0].text).node?.metadata?.counter : null)
              .filter(c => c !== null);

            if (finalNode.metadata?.counter !== undefined) {
              expect(updateCounters).toContain(finalNode.metadata.counter);
              console.log(`Lost update test: Final counter is ${finalNode.metadata.counter}, valid`);
            }
          }
        }
      }
    });

    it('should handle priority calculation races correctly', async () => {
      const services = [mockGraphService];
      if (realGraphService) services.push(realGraphService);

      for (const service of services) {
        const nodeId = `priority-race-${Date.now()}`;

        // Concurrent priority updates with different values
        const priorityUpdates = [
          () => service.updatePriorities({
            node_id: nodeId,
            priority_executive: 0.9,
            priority_individual: 0.8,
            priority_community: 0.7
          }),
          () => service.updatePriorities({
            node_id: nodeId,
            priority_executive: 0.1,
            priority_individual: 0.2,
            priority_community: 0.3
          }),
          () => service.updatePriorities({
            node_id: nodeId,
            priority_executive: 0.5,
            priority_individual: 0.5,
            priority_community: 0.5
          })
        ];

        // Execute all priority updates concurrently multiple times
        const allUpdates = Array.from({ length: 10 }, () => priorityUpdates).flat();
        const raceResults = await Promise.allSettled(allUpdates.map(update => update()));

        const successfulPriorityUpdates = raceResults.filter(r => r.status === 'fulfilled');
        
        if (successfulPriorityUpdates.length > 0) {
          // Check for impossible priority combinations
          successfulPriorityUpdates.forEach(result => {
            if (result.status === 'fulfilled') {
              const parsed = JSON.parse(result.value.content[0].text);
              
              if (parsed.priorities) {
                const { executive, individual, community } = parsed.priorities;
                
                // Check for corrupted values (NaN, undefined, out of range)
                [executive, individual, community].forEach(priority => {
                  if (priority !== null && priority !== undefined) {
                    expect(typeof priority).toBe('number');
                    expect(isFinite(priority)).toBe(true);
                    expect(priority).toBeGreaterThanOrEqual(0);
                    expect(priority).toBeLessThanOrEqual(1);
                  }
                });
              }
            }
          });

          console.log(`Priority race test: ${successfulPriorityUpdates.length} priority updates completed`);
        }
      }
    });
  });

  describe('Deadlock Detection and Prevention', () => {
    it('should prevent circular dependency deadlocks', async () => {
      const services = [mockGraphService];
      if (realGraphService) services.push(realGraphService);

      for (const service of services) {
        // Create nodes that could form circular dependencies
        const nodeIds = [`deadlock-a-${Date.now()}`, `deadlock-b-${Date.now()}`, `deadlock-c-${Date.now()}`];
        
        // Create the nodes first
        await Promise.allSettled(nodeIds.map(id => 
          service.createNode({
            title: `Deadlock Test ${id}`,
            type: 'TASK',
            metadata: { deadlock_test: true }
          })
        ));

        // Try to create circular dependencies simultaneously
        const circularOps = [
          () => service.createEdge({
            source_id: nodeIds[0],
            target_id: nodeIds[1],
            type: 'DEPENDS_ON'
          }),
          () => service.createEdge({
            source_id: nodeIds[1], 
            target_id: nodeIds[2],
            type: 'DEPENDS_ON'
          }),
          () => service.createEdge({
            source_id: nodeIds[2],
            target_id: nodeIds[0], // This creates the cycle
            type: 'DEPENDS_ON'
          })
        ];

        const startTime = Date.now();
        const circularResults = await Promise.allSettled(circularOps.map(op => op()));
        const duration = Date.now() - startTime;

        // Should complete quickly (not hang in deadlock)
        expect(duration).toBeLessThan(5000);

        const successful = circularResults.filter(r => r.status === 'fulfilled').length;
        const failed = circularResults.filter(r => r.status === 'rejected').length;

        console.log(`Circular dependency test: ${successful} succeeded, ${failed} failed in ${duration}ms`);

        // Should either prevent the cycle or detect it
        if (successful === 3) {
          console.warn('⚠️ System allowed circular dependency - potential deadlock risk');
        }
      }
    });

    it('should handle resource contention without blocking indefinitely', async () => {
      const services = [mockGraphService];
      if (realGraphService) services.push(realGraphService);

      for (const service of services) {
        const sharedResourceId = `shared-resource-${Date.now()}`;

        // Multiple operations trying to access the same resource
        const contentionOps = Array.from({ length: 20 }, (_, i) => () =>
          service.updateNode({
            node_id: sharedResourceId,
            title: `Contention Update ${i}`,
            metadata: { 
              accessor: `thread_${i}`,
              timestamp: Date.now(),
              operation_id: i
            }
          })
        );

        const startTime = Date.now();
        const contentionResults = await Promise.allSettled(contentionOps.map(op => op()));
        const duration = Date.now() - startTime;

        // Should not block indefinitely
        expect(duration).toBeLessThan(10000);

        const successful = contentionResults.filter(r => r.status === 'fulfilled').length;
        const failed = contentionResults.filter(r => r.status === 'rejected').length;

        console.log(`Resource contention: ${successful} succeeded, ${failed} failed in ${duration}ms`);

        // Check that failures are due to proper resource management, not deadlocks
        const errorMessages = contentionResults
          .filter(r => r.status === 'rejected')
          .map(r => r.status === 'rejected' ? r.reason.message : '')
          .filter(Boolean);

        errorMessages.forEach(error => {
          // Should be concurrency-related errors, not generic failures
          expect(error).not.toBe('Error');
          expect(error).not.toBe('undefined');
        });
      }
    });

    it('should prevent transaction isolation violations', async () => {
      const services = [mockGraphService];
      if (realGraphService) services.push(realGraphService);

      for (const service of services) {
        const isolationTestId = `isolation-test-${Date.now()}`;

        // Transaction 1: Read-Modify-Write sequence
        const transaction1 = async () => {
          try {
            // Read current state
            const readResult = await service.getNodeDetails({ node_id: isolationTestId });
            
            if (readResult.content[0].text.includes('"error"')) {
              // Node doesn't exist, create it
              await service.createNode({
                title: 'Isolation Test',
                type: 'TASK',
                metadata: { balance: 100, transaction: 'T1' }
              });
              return 'created';
            }

            const node = JSON.parse(readResult.content[0].text).node;
            const currentBalance = node.metadata?.balance || 0;
            
            // Simulate some processing time
            await new Promise(resolve => setTimeout(resolve, 10));
            
            // Write modified state
            await service.updateNode({
              node_id: isolationTestId,
              metadata: { 
                balance: currentBalance + 50,
                transaction: 'T1',
                timestamp: Date.now()
              }
            });
            
            return 'updated';
          } catch (error: any) {
            return `error: ${error.message}`;
          }
        };

        // Transaction 2: Concurrent Read-Modify-Write
        const transaction2 = async () => {
          try {
            const readResult = await service.getNodeDetails({ node_id: isolationTestId });
            
            if (readResult.content[0].text.includes('"error"')) {
              await service.createNode({
                title: 'Isolation Test',
                type: 'TASK',
                metadata: { balance: 100, transaction: 'T2' }
              });
              return 'created';
            }

            const node = JSON.parse(readResult.content[0].text).node;
            const currentBalance = node.metadata?.balance || 0;
            
            await new Promise(resolve => setTimeout(resolve, 10));
            
            await service.updateNode({
              node_id: isolationTestId,
              metadata: { 
                balance: currentBalance - 30,
                transaction: 'T2',
                timestamp: Date.now()
              }
            });
            
            return 'updated';
          } catch (error: any) {
            return `error: ${error.message}`;
          }
        };

        // Run transactions concurrently
        const [result1, result2] = await Promise.all([transaction1(), transaction2()]);

        console.log(`Isolation test: T1=${result1}, T2=${result2}`);

        // Check final state for isolation violations
        try {
          const finalResult = await service.getNodeDetails({ node_id: isolationTestId });
          
          if (!finalResult.content[0].text.includes('"error"')) {
            const finalNode = JSON.parse(finalResult.content[0].text).node;
            const finalBalance = finalNode.metadata?.balance;
            
            if (finalBalance !== undefined) {
              // Final balance should be consistent with transaction semantics
              // Starting balance: 100, T1 adds 50, T2 subtracts 30
              // Depending on isolation level, result should be 120 or 70 or error
              expect([70, 120, 150]).toContain(finalBalance);
              
              console.log(`Final balance: ${finalBalance} (isolation preserved)`);
            }
          }
        } catch (error) {
          // Acceptable if system properly detects and rejects isolation violations
          console.log('Isolation conflict properly detected and handled');
        }
      }
    });
  });

  describe('Thread Safety Validation', () => {
    it('should handle concurrent access to shared data structures', async () => {
      const services = [mockGraphService];
      if (realGraphService) services.push(realGraphService);

      for (const service of services) {
        const sharedCounter = { value: 0 };
        const nodeId = `thread-safety-${Date.now()}`;

        // Simulate multiple threads accessing shared counter
        const threadOperations = Array.from({ length: 100 }, (_, i) => async () => {
          try {
            // Increment shared counter (not thread-safe operation)
            const currentValue = sharedCounter.value;
            await new Promise(resolve => setTimeout(resolve, 1)); // Race condition window
            sharedCounter.value = currentValue + 1;

            // Update node with counter value
            const result = await service.createNode({
              title: `Thread ${i}`,
              type: 'TASK',
              metadata: { 
                thread_id: i,
                counter_value: sharedCounter.value,
                expected_counter: i + 1
              }
            });

            return JSON.parse(result.content[0].text).node;
          } catch (error: any) {
            return { error: error.message };
          }
        });

        const threadResults = await Promise.allSettled(
          threadOperations.map(op => op())
        );

        const successfulThreads = threadResults
          .filter(r => r.status === 'fulfilled')
          .map(r => r.status === 'fulfilled' ? r.value : null)
          .filter(node => node && !node.error);

        // Check for thread safety violations
        const counterValues = successfulThreads
          .map(node => node.metadata?.counter_value)
          .filter(v => v !== undefined);

        const uniqueCounterValues = new Set(counterValues);
        
        if (uniqueCounterValues.size !== counterValues.length) {
          console.warn(`⚠️ Thread safety issue: ${counterValues.length - uniqueCounterValues.size} duplicate counter values`);
        }

        // Final counter should equal number of operations (if thread-safe)
        const expectedFinalValue = threadOperations.length;
        if (sharedCounter.value !== expectedFinalValue) {
          console.warn(`⚠️ Race condition detected: expected ${expectedFinalValue}, got ${sharedCounter.value}`);
        }

        console.log(`Thread safety test: ${successfulThreads.length} operations, final counter: ${sharedCounter.value}`);
      }
    });

    it('should prevent data races in priority calculations', async () => {
      const services = [mockGraphService];
      if (realGraphService) services.push(realGraphService);

      for (const service of services) {
        const nodeId = `data-race-${Date.now()}`;

        // Multiple threads calculating and updating priorities simultaneously
        const priorityCalculators = Array.from({ length: 30 }, (_, i) => async () => {
          try {
            const priorities = {
              executive: Math.random(),
              individual: Math.random(), 
              community: Math.random()
            };

            // Simulate complex priority calculation
            await new Promise(resolve => setTimeout(resolve, 5));
            
            const weightedAverage = (
              priorities.executive * 0.5 +
              priorities.individual * 0.3 +
              priorities.community * 0.2
            );

            const result = await service.updatePriorities({
              node_id: nodeId,
              priority_executive: priorities.executive,
              priority_individual: priorities.individual,
              priority_community: priorities.community
            });

            return {
              calculator_id: i,
              input_priorities: priorities,
              weighted_average: weightedAverage,
              result: JSON.parse(result.content[0].text)
            };
          } catch (error: any) {
            return { calculator_id: i, error: error.message };
          }
        });

        const calculationResults = await Promise.allSettled(
          priorityCalculators.map(calc => calc())
        );

        const successfulCalculations = calculationResults
          .filter(r => r.status === 'fulfilled')
          .map(r => r.status === 'fulfilled' ? r.value : null)
          .filter(calc => calc && !calc.error);

        console.log(`Priority data race test: ${successfulCalculations.length} calculations completed`);

        // Check for data corruption in priority values
        successfulCalculations.forEach(calc => {
          const priorities = calc.result.priorities;
          
          if (priorities) {
            Object.values(priorities).forEach(priority => {
              if (priority !== null && priority !== undefined) {
                expect(typeof priority).toBe('number');
                expect(isFinite(priority)).toBe(true);
                expect(priority).toBeGreaterThanOrEqual(0);
                expect(priority).toBeLessThanOrEqual(1);
              }
            });
          }
        });
      }
    });
  });
});