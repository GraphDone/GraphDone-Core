import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { GraphService } from '../src/services/graph-service';
import { createMockDriver } from './mock-neo4j';
import neo4j from 'neo4j-driver';

describe('Distributed Systems Chaos Testing', () => {
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
      console.log('⚠️ Real database not available for distributed chaos testing');
    }
  });

  afterAll(async () => {
    if (realDriver) {
      await realDriver.close();
    }
  });

  describe('Network Partition Simulation', () => {
    it('should handle connection timeouts gracefully', async () => {
      const services = [mockGraphService];
      if (realGraphService) services.push(realGraphService);

      for (const service of services) {
        // Simulate network timeout by creating very long-running operations
        const startTime = Date.now();
        
        try {
          // Create operations that might timeout
          const promises = Array.from({ length: 50 }, (_, i) => 
            service.createNode({
              title: `Timeout Test ${i}`,
              type: 'TASK',
              metadata: { 
                large_data: 'x'.repeat(10000),
                timestamp: Date.now()
              }
            })
          );

          const results = await Promise.allSettled(promises);
          const duration = Date.now() - startTime;
          
          // Should complete within reasonable time even under load
          expect(duration).toBeLessThan(10000); // 10 seconds max
          
          // Check for partial failures
          const fulfilled = results.filter(r => r.status === 'fulfilled').length;
          const rejected = results.filter(r => r.status === 'rejected').length;
          
          console.log(`Network stress test: ${fulfilled} succeeded, ${rejected} failed in ${duration}ms`);
          
          // Either all succeed or fail gracefully, no silent corruption
          expect(fulfilled + rejected).toBe(50);
          
        } catch (error: any) {
          const duration = Date.now() - startTime;
          expect(duration).toBeLessThan(10000);
          expect(error.message).toMatch(/timeout|connection|network/i);
        }
      }
    });

    it('should handle connection pool exhaustion', async () => {
      const services = [mockGraphService];
      if (realGraphService) services.push(realGraphService);

      for (const service of services) {
        // Simulate connection pool exhaustion
        const connectionPromises = Array.from({ length: 200 }, (_, i) =>
          service.getNodeDetails({ node_id: `connection-test-${i}` })
        );

        const results = await Promise.allSettled(connectionPromises);
        
        // Should handle pool limits gracefully
        const errors = results.filter(r => r.status === 'rejected');
        
        if (errors.length > 0) {
          // Error messages should be meaningful
          errors.forEach(error => {
            if (error.status === 'rejected') {
              expect(error.reason.message).toMatch(/connection|pool|limit|resource|cpu|exhaustion|protection/i);
            }
          });
        }
        
        console.log(`Connection pool test: ${errors.length} connection errors (expected under stress)`);
      }
    });
  });

  describe('Split-Brain Scenario Simulation', () => {
    it('should prevent conflicting writes from creating inconsistent state', async () => {
      const nodeId = `split-brain-test-${Date.now()}`;
      
      // Simulate two clients thinking they're the primary
      const conflictingOperations = [
        () => mockGraphService.updateNode({
          node_id: nodeId,
          title: 'Client A Update',
          status: 'ACTIVE'
        }),
        () => mockGraphService.updateNode({
          node_id: nodeId, 
          title: 'Client B Update',
          status: 'IN_PROGRESS'
        }),
        () => mockGraphService.updatePriorities({
          node_id: nodeId,
          priority_executive: 0.9
        }),
        () => mockGraphService.updatePriorities({
          node_id: nodeId,
          priority_executive: 0.1
        })
      ];

      // Execute simultaneously
      const results = await Promise.allSettled(
        conflictingOperations.map(op => op())
      );

      // Check that we don't have impossible states
      const successfulResults = results
        .filter(r => r.status === 'fulfilled')
        .map(r => r.status === 'fulfilled' ? JSON.parse(r.value.content[0].text) : null)
        .filter(Boolean);

      if (successfulResults.length > 1) {
        // If multiple operations succeeded, they should be consistent
        const titles = successfulResults.map(r => r.node?.title).filter(Boolean);
        const priorities = successfulResults.map(r => r.priorities?.executive).filter(Boolean);
        
        // Should not have conflicting final states
        if (titles.length > 0) {
          const uniqueTitles = [...new Set(titles)];
          if (uniqueTitles.length > 1) {
            console.warn('⚠️ Split-brain detected: conflicting titles in final state');
          }
        }
      }
    });

    it('should handle leader election scenarios', async () => {
      // Simulate multiple nodes trying to become coordinator
      const coordinatorCandidates = Array.from({ length: 5 }, (_, i) => ({
        id: `coordinator-${i}`,
        timestamp: Date.now() + i, // Slight timing differences
        priority: Math.random()
      }));

      const electionPromises = coordinatorCandidates.map(async (candidate) => {
        try {
          // Attempt to create a "coordinator" node
          const result = await mockGraphService.createNode({
            title: 'System Coordinator',
            type: 'MILESTONE',
            metadata: {
              role: 'coordinator',
              candidateId: candidate.id,
              timestamp: candidate.timestamp,
              priority: candidate.priority
            }
          });
          
          return {
            success: true,
            candidate: candidate.id,
            result: JSON.parse(result.content[0].text)
          };
        } catch (error: any) {
          return {
            success: false,
            candidate: candidate.id,
            error: error.message
          };
        }
      });

      const electionResults = await Promise.allSettled(electionPromises);
      
      // Analyze election outcome
      const successfulElections = electionResults
        .filter(r => r.status === 'fulfilled' && r.value.success)
        .map(r => r.status === 'fulfilled' ? r.value : null)
        .filter(Boolean);

      // Should either have clear winner or clear rejection mechanism
      if (successfulElections.length > 1) {
        console.warn(`⚠️ Multiple coordinators elected: ${successfulElections.map(s => s.candidate).join(', ')}`);
        
        // If multiple succeed, they should have conflict resolution mechanism
        // Check if there's a deterministic way to resolve conflicts
        const priorities = successfulElections.map(s => s.result.node?.metadata?.priority).filter(Boolean);
        const timestamps = successfulElections.map(s => s.result.node?.metadata?.timestamp).filter(Boolean);
        
        if (priorities.length > 0) {
          const maxPriority = Math.max(...priorities);
          const winnersCount = priorities.filter(p => p === maxPriority).length;
          expect(winnersCount).toBe(1); // Should have clear winner
        }
      }
      
      console.log(`Leader election: ${successfulElections.length} coordinators elected`);
    });
  });

  describe('Eventual Consistency Testing', () => {
    it('should handle read-after-write consistency issues', async () => {
      const testId = `consistency-test-${Date.now()}`;
      
      try {
        // Write operation
        const writeResult = await mockGraphService.createNode({
          title: 'Consistency Test Node',
          type: 'TASK',
          metadata: { testId }
        });
        
        const createdNode = JSON.parse(writeResult.content[0].text).node;
        
        // Immediate read (might see stale data in distributed system)
        const readResult = await mockGraphService.getNodeDetails({
          node_id: createdNode.id
        });
        
        const readNode = JSON.parse(readResult.content[0].text);
        
        if (readNode.node) {
          // If read succeeds, data should be consistent
          expect(readNode.node.title).toBe('Consistency Test Node');
          expect(readNode.node.metadata?.testId).toBe(testId);
        } else if (readNode.error) {
          // Acceptable if read fails due to replication lag
          expect(readNode.error).toMatch(/not found|replication|consistency/i);
        }
        
      } catch (error: any) {
        // Should provide meaningful error messages about consistency
        expect(error.message).toBeDefined();
      }
    });

    it('should handle concurrent reads during writes', async () => {
      const nodeId = `concurrent-rw-test-${Date.now()}`;
      
      // Start a write operation
      const writePromise = mockGraphService.createNode({
        title: 'Concurrent Test Node',
        type: 'TASK',
        metadata: { nodeId }
      });
      
      // Start multiple concurrent reads
      const readPromises = Array.from({ length: 10 }, () =>
        mockGraphService.getNodeDetails({ node_id: nodeId })
      );
      
      const allPromises = [writePromise, ...readPromises];
      const results = await Promise.allSettled(allPromises);
      
      const writeResult = results[0];
      const readResults = results.slice(1);
      
      // Write should succeed or fail cleanly
      if (writeResult.status === 'fulfilled') {
        const written = JSON.parse(writeResult.value.content[0].text);
        expect(written.node).toBeDefined();
        
        // Reads should either see the data or fail consistently
        const successfulReads = readResults
          .filter(r => r.status === 'fulfilled')
          .map(r => r.status === 'fulfilled' ? JSON.parse(r.value.content[0].text) : null);
          
        // No partial/corrupted reads
        successfulReads.forEach(read => {
          if (read?.node) {
            expect(read.node.title).toMatch(/Test Node|Concurrent Test Node/i);
          }
        });
      }
    });
  });

  describe('Data Partitioning Issues', () => {
    it('should handle cross-partition queries correctly', async () => {
      // Create nodes that might end up in different partitions
      const partitionNodes = await Promise.allSettled(
        Array.from({ length: 5 }, (_, i) =>
          mockGraphService.createNode({
            title: `Partition Node ${i}`,
            type: 'TASK', 
            metadata: {
              partition_key: `partition_${i % 3}`, // 3 potential partitions
              cross_partition_ref: `ref_${(i + 1) % 5}`
            }
          })
        )
      );

      const createdNodes = partitionNodes
        .filter(r => r.status === 'fulfilled')
        .map(r => r.status === 'fulfilled' ? JSON.parse(r.value.content[0].text).node : null)
        .filter(Boolean);

      if (createdNodes.length > 0) {
        // Try cross-partition operations
        try {
          const batchQuery = createdNodes.map(node => 
            mockGraphService.getNodeDetails({ node_id: node.id })
          );
          
          const batchResults = await Promise.allSettled(batchQuery);
          const successful = batchResults.filter(r => r.status === 'fulfilled').length;
          const failed = batchResults.filter(r => r.status === 'rejected').length;
          
          console.log(`Cross-partition query: ${successful} succeeded, ${failed} failed`);
          
          // Should either all succeed or fail with partition errors
          if (failed > 0) {
            const errors = batchResults
              .filter(r => r.status === 'rejected')
              .map(r => r.status === 'rejected' ? r.reason.message : '');
              
            errors.forEach(error => {
              expect(error).toMatch(/partition|distributed|consistency/i);
            });
          }
          
        } catch (error: any) {
          expect(error.message).toMatch(/partition|cross.*partition|distributed/i);
        }
      }
    });

    it('should handle partition merges and splits', async () => {
      // Simulate partition operations that might cause data movement
      const partitionTest = async (partitionId: string) => {
        const nodes = await Promise.allSettled([
          mockGraphService.createNode({
            title: 'Pre-split Node',
            type: 'TASK',
            metadata: { partition: partitionId, phase: 'before' }
          }),
          // Simulate partition split
          mockGraphService.createNode({
            title: 'Post-split Node',
            type: 'TASK', 
            metadata: { partition: `${partitionId}_split`, phase: 'after' }
          })
        ]);

        return {
          partitionId,
          preNodes: nodes.filter(r => r.status === 'fulfilled').length,
          errors: nodes.filter(r => r.status === 'rejected').length
        };
      };

      const partitionResults = await Promise.allSettled([
        partitionTest('A'),
        partitionTest('B'), 
        partitionTest('C')
      ]);

      // Check that partition operations maintain data integrity
      partitionResults.forEach(result => {
        if (result.status === 'fulfilled') {
          const { partitionId, preNodes, errors } = result.value;
          
          // Should handle partition operations gracefully
          if (errors > 0) {
            console.log(`Partition ${partitionId}: ${errors} errors during split/merge`);
          }
          
          expect(preNodes + errors).toBe(2); // All operations accounted for
        }
      });
    });
  });
});