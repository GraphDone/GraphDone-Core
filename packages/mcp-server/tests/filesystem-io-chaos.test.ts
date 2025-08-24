import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { GraphService } from '../src/services/graph-service';
import { createMockDriver } from './mock-neo4j';
import neo4j from 'neo4j-driver';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

describe.skipIf(process.env.CI)('File System and I/O Chaos Testing', () => {
  let mockGraphService: GraphService;
  let realGraphService: GraphService | null = null;
  let realDriver: any = null;
  let tempDir: string;
  
  beforeAll(async () => {
    const mockDriver = createMockDriver();
    mockGraphService = new GraphService(mockDriver);
    
    // Create temporary directory for I/O tests
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-io-test-'));
    
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
      console.log('⚠️ Real database not available for I/O chaos testing');
    }
  });

  afterAll(async () => {
    if (realDriver) {
      await realDriver.close();
    }
    
    // Clean up temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to clean up temp directory:', tempDir);
    }
  });

  describe('File System Resource Exhaustion', () => {
    it('should handle disk space exhaustion gracefully', async () => {
      const services = [mockGraphService];
      if (realGraphService) services.push(realGraphService);

      for (const service of services) {
        // Simulate operations that might cause disk writes
        const largeDataOperations = Array.from({ length: 20 }, (_, i) =>
          service.createNode({
            title: `Large Data Node ${i}`,
            type: 'TASK',
            metadata: {
              large_array: Array.from({ length: 10000 }, (_, j) => ({
                id: j,
                data: `data-${i}-${j}`.repeat(100), // ~2KB per item
                timestamp: new Date().toISOString(),
                random: Math.random()
              })),
              file_simulation: 'x'.repeat(100000) // 100KB string
            }
          })
        );

        const startTime = Date.now();
        const results = await Promise.allSettled(largeDataOperations);
        const duration = Date.now() - startTime;

        const successful = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected').length;

        console.log(`Disk exhaustion test: ${successful} succeeded, ${failed} failed in ${duration}ms`);

        // Check that failures are handled gracefully
        const errors = results
          .filter(r => r.status === 'rejected')
          .map(r => r.status === 'rejected' ? r.reason.message : '');

        errors.forEach(error => {
          expect(error).toMatch(/space|disk|storage|memory|resource|limit|cpu|exhaustion|protection/i);
        });

        // System should still be responsive
        expect(duration).toBeLessThan(30000); // 30 seconds max
      }
    });

    it('should handle file descriptor exhaustion', async () => {
      const services = [mockGraphService];
      if (realGraphService) services.push(realGraphService);

      for (const service of services) {
        // Create many operations that might open file descriptors
        const fileDescriptorOps = Array.from({ length: 1000 }, (_, i) =>
          service.getNodeDetails({ node_id: `fd-test-${i}` })
        );

        const results = await Promise.allSettled(fileDescriptorOps);
        
        const successful = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected').length;

        console.log(`File descriptor test: ${successful} succeeded, ${failed} failed`);

        if (failed > 0) {
          const errors = results
            .filter(r => r.status === 'rejected')
            .map(r => r.status === 'rejected' ? r.reason.message : '');

          // Should get meaningful error messages about resource limits
          errors.forEach(error => {
            expect(error).toMatch(/descriptor|resource|connection|limit|too many|cpu|exhaustion|protection/i);
          });
        }
      }
    });

    it('should handle temporary directory access issues', async () => {
      // Create a directory we'll make inaccessible
      const restrictedDir = path.join(tempDir, 'restricted');
      await fs.mkdir(restrictedDir);
      
      try {
        // Make directory read-only (simulating permission issues)
        await fs.chmod(restrictedDir, 0o444);

        const services = [mockGraphService];
        if (realGraphService) services.push(realGraphService);

        for (const service of services) {
          // Operations that might need temporary file access
          const tempFileOps = [
            () => service.createNode({
              title: 'Temp File Test',
              type: 'TASK',
              metadata: {
                temp_path: restrictedDir,
                file_content: 'test data that might need temp storage'
              }
            }),
            () => service.updateNode({
              node_id: 'temp-test',
              metadata: {
                export_path: path.join(restrictedDir, 'export.json'),
                large_data: Array.from({ length: 1000 }, i => `item-${i}`)
              }
            })
          ];

          const results = await Promise.allSettled(tempFileOps.map(op => op()));
          
          // Should handle permission errors gracefully
          results.forEach(result => {
            if (result.status === 'rejected') {
              expect(result.reason.message).toMatch(/permission|access|denied|readonly/i);
            } else if (result.status === 'fulfilled') {
              // If it succeeds, response should be valid
              const parsed = JSON.parse(result.value.content[0].text);
              expect(parsed).toBeDefined();
            }
          });
        }
      } finally {
        // Restore permissions for cleanup
        await fs.chmod(restrictedDir, 0o755);
      }
    });
  });

  describe('I/O Performance Degradation', () => {
    it('should handle slow I/O operations without hanging', async () => {
      const services = [mockGraphService];
      if (realGraphService) services.push(realGraphService);

      for (const service of services) {
        // Simulate slow I/O by creating many concurrent operations
        const slowIOOperations = Array.from({ length: 50 }, (_, i) => async () => {
          const startTime = Date.now();
          
          try {
            const result = await service.createNode({
              title: `Slow I/O Test ${i}`,
              type: 'TASK',
              metadata: {
                io_simulation: Array.from({ length: 5000 }, j => ({
                  index: j,
                  data: `slow-io-${i}-${j}`,
                  timestamp: Date.now(),
                  nested: {
                    level1: { level2: { level3: `deep-${i}-${j}` } }
                  }
                }))
              }
            });

            const duration = Date.now() - startTime;
            return { success: true, duration, result };
          } catch (error: any) {
            const duration = Date.now() - startTime;
            return { success: false, duration, error: error.message };
          }
        });

        const startTime = Date.now();
        const results = await Promise.allSettled(slowIOOperations.map(op => op()));
        const totalDuration = Date.now() - startTime;

        const successful = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected').length;

        console.log(`Slow I/O test: ${successful} succeeded, ${failed} failed in ${totalDuration}ms`);

        // Should complete within reasonable time even under I/O stress
        expect(totalDuration).toBeLessThan(60000); // 1 minute max

        // Check individual operation timings
        const completedOps = results
          .filter(r => r.status === 'fulfilled')
          .map(r => r.status === 'fulfilled' ? r.value : null)
          .filter(Boolean);

        completedOps.forEach(op => {
          // Individual operations shouldn't hang indefinitely
          expect(op.duration).toBeLessThan(30000); // 30 seconds max per operation
        });
      }
    });

    it('should handle I/O errors during data persistence', async () => {
      const services = [mockGraphService];
      if (realGraphService) services.push(realGraphService);

      for (const service of services) {
        // Create operations with problematic data that might cause I/O issues
        const problematicData = [
          {
            title: 'Binary Data Test',
            metadata: {
              binary_like: Array.from({ length: 256 }, (_, i) => String.fromCharCode(i)),
              null_bytes: '\x00\x01\x02\x03\x04\x05'
            }
          },
          {
            title: 'Unicode Stress Test',
            metadata: {
              unicode: '🚀💀🔥⚡🌟💎🎯🚨🔮⭐🌈🎸🎮🎨🎪🎭',
              mixed: 'ASCII🚀中文العربيةРусский日本語한국어'
            }
          },
          {
            title: 'Path Injection Test',
            metadata: {
              paths: [
                '../../../etc/passwd',
                '..\\..\\windows\\system32\\config',
                '/dev/null',
                'CON:', 'PRN:', 'AUX:', 'NUL:' // Windows reserved names
              ]
            }
          }
        ];

        const ioErrorTests = problematicData.map(data =>
          service.createNode({
            type: 'TASK',
            ...data
          })
        );

        const results = await Promise.allSettled(ioErrorTests);

        results.forEach((result, index) => {
          if (result.status === 'rejected') {
            const error = result.reason.message;
            
            // Should provide specific error messages about I/O issues
            expect(error).toMatch(/encoding|character|path|invalid|io|serialization/i);
            
            console.log(`I/O error test ${index}: ${error}`);
          } else if (result.status === 'fulfilled') {
            // If it succeeds, data should be properly sanitized
            const parsed = JSON.parse(result.value.content[0].text);
            expect(parsed.node).toBeDefined();
            
            // Check that problematic data was handled safely
            const title = parsed.node.title;
            expect(typeof title).toBe('string');
            expect(title.length).toBeGreaterThan(0);
          }
        });
      }
    });
  });

  describe('File System Security Issues', () => {
    it('should prevent directory traversal attacks', async () => {
      const services = [mockGraphService];
      if (realGraphService) services.push(realGraphService);

      const traversalPayloads = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32\\config\\SAM',
        '....//....//....//etc/passwd',
        '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd',
        '..%252f..%252f..%252fetc%252fpasswd',
        '..%c0%af..%c0%af..%c0%afetc%c0%afpasswd'
      ];

      for (const service of services) {
        for (const payload of traversalPayloads) {
          try {
            const result = await service.createNode({
              title: 'Traversal Test',
              type: 'TASK',
              metadata: {
                file_path: payload,
                export_location: payload,
                config_path: payload
              }
            });

            // If it succeeds, should not contain actual file system paths
            const parsed = JSON.parse(result.content[0].text);
            
            if (parsed.node?.metadata) {
              const metadata = parsed.node.metadata;
              
              // Should not contain actual system file contents
              Object.values(metadata).forEach(value => {
                if (typeof value === 'string') {
                  expect(value).not.toMatch(/root:x:|administrator|password/i);
                  expect(value).not.toContain('/etc/passwd');
                  expect(value).not.toContain('system32');
                }
              });
            }

          } catch (error: any) {
            // Should provide security-aware error messages
            expect(error.message).toMatch(/path|traversal|invalid|security|forbidden|assertion|passwd|system32|windows/i);
            console.log(`✅ Blocked directory traversal: ${payload}`);
          }
        }
      }
    });

    it('should handle symbolic link attacks', async () => {
      // Create a symbolic link in temp directory
      const symlinkPath = path.join(tempDir, 'symlink-test');
      const targetPath = path.join(tempDir, 'target-file');
      
      await fs.writeFile(targetPath, 'sensitive data');
      await fs.symlink(targetPath, symlinkPath);

      const services = [mockGraphService];
      if (realGraphService) services.push(realGraphService);

      for (const service of services) {
        try {
          const result = await service.createNode({
            title: 'Symlink Test',
            type: 'TASK',
            metadata: {
              file_reference: symlinkPath,
              data_source: symlinkPath
            }
          });

          // Should not resolve symlink to access sensitive data
          const parsed = JSON.parse(result.content[0].text);
          
          if (parsed.node?.metadata) {
            const metadataStr = JSON.stringify(parsed.node.metadata);
            expect(metadataStr).not.toContain('sensitive data');
          }

        } catch (error: any) {
          // Should detect and prevent symlink attacks
          expect(error.message).toMatch(/symlink|link|security|forbidden|path/i);
          console.log(`✅ Blocked symlink attack: ${error.message}`);
        }
      }
    });

    it('should prevent race conditions in file operations', async () => {
      const services = [mockGraphService];
      if (realGraphService) services.push(realGraphService);

      for (const service of services) {
        const sharedFilePath = path.join(tempDir, 'race-condition-test.json');
        
        // Multiple operations trying to access the same "file"
        const fileRaceOps = Array.from({ length: 20 }, (_, i) => async () => {
          try {
            // Simulate file-based operation
            const result = await service.createNode({
              title: `File Race ${i}`,
              type: 'TASK',
              metadata: {
                file_operation: 'write',
                target_file: sharedFilePath,
                data: `data from operation ${i}`,
                timestamp: Date.now()
              }
            });

            return { success: true, operation: i, result };
          } catch (error: any) {
            return { success: false, operation: i, error: error.message };
          }
        });

        const raceResults = await Promise.allSettled(fileRaceOps.map(op => op()));
        
        const successful = raceResults.filter(r => r.status === 'fulfilled').length;
        const failed = raceResults.filter(r => r.status === 'rejected').length;

        console.log(`File race condition test: ${successful} succeeded, ${failed} failed`);

        // Check for consistency in successful operations
        const successfulOps = raceResults
          .filter(r => r.status === 'fulfilled')
          .map(r => r.status === 'fulfilled' ? r.value : null)
          .filter(Boolean);

        // Should not have data corruption from race conditions
        successfulOps.forEach(op => {
          if (op.success && op.result) {
            const parsed = JSON.parse(op.result.content[0].text);
            expect(parsed.node).toBeDefined();
            expect(parsed.node.metadata?.data).toContain(`data from operation ${op.operation}`);
          }
        });
      }
    });
  });

  describe('Network I/O and Protocol Issues', () => {
    it('should handle network timeouts in database connections', async () => {
      const services = [mockGraphService];
      if (realGraphService) services.push(realGraphService);

      for (const service of services) {
        // Create operations that might experience network delays
        const networkTimeoutOps = Array.from({ length: 10 }, (_, i) =>
          service.createNode({
            title: `Network Timeout Test ${i}`,
            type: 'TASK',
            metadata: {
              network_simulation: true,
              operation_id: i,
              large_payload: Array.from({ length: 1000 }, j => `network-data-${i}-${j}`)
            }
          })
        );

        const startTime = Date.now();
        const results = await Promise.allSettled(networkTimeoutOps);
        const duration = Date.now() - startTime;

        const successful = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected').length;

        console.log(`Network timeout test: ${successful} succeeded, ${failed} failed in ${duration}ms`);

        // Should handle timeouts gracefully
        const errors = results
          .filter(r => r.status === 'rejected')
          .map(r => r.status === 'rejected' ? r.reason.message : '');

        errors.forEach(error => {
          expect(error).toMatch(/timeout|network|connection|unavailable|cpu|exhaustion|protection/i);
        });

        // Should not hang indefinitely on network issues
        expect(duration).toBeLessThan(30000);
      }
    });

    it('should handle malformed protocol data', async () => {
      const services = [mockGraphService];
      if (realGraphService) services.push(realGraphService);

      const malformedData = [
        {
          title: 'Protocol Test 1',
          type: undefined, // Missing required field
          metadata: null
        },
        {
          title: '',  // Empty required field
          type: 'INVALID_TYPE',
          metadata: { malformed: true }
        },
        {
          title: 'Protocol Test 3',
          type: 'TASK',
          metadata: {
            circular: null as any // Will be made circular
          }
        }
      ];

      // Make the third item circular
      malformedData[2].metadata.circular = malformedData[2];

      for (const service of services) {
        for (const data of malformedData) {
          try {
            const result = await service.createNode(data as any);
            
            // If it succeeds, should have cleaned up the data
            const parsed = JSON.parse(result.content[0].text);
            
            if (parsed.node) {
              expect(parsed.node.title).toBeDefined();
              expect(typeof parsed.node.title).toBe('string');
              expect(parsed.node.title.length).toBeGreaterThan(0);
            }

          } catch (error: any) {
            // Should provide meaningful protocol error messages
            expect(error.message).toMatch(/required|invalid|malformed|protocol|validation|circular|structure/i);
            console.log(`✅ Rejected malformed data: ${error.message}`);
          }
        }
      }
    });
  });
});