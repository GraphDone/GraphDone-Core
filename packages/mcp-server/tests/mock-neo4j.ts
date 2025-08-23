import { Driver } from 'neo4j-driver';

// Comprehensive mock for Neo4j driver and session
export function createMockDriver(): Driver {
  // Create a comprehensive mock that handles all known field names
  const createMockRecord = (customFields: Record<string, any> = {}) => ({
    get: (key: string) => {
      // Handle custom overrides first
      if (customFields[key] !== undefined) {
        return customFields[key];
      }
      
      // Handle numeric fields that need toNumber()
      if (['totalItems', 'activeItems', 'projectCount', 'itemCount', 'sharedItems', 'blockedItems', 
           'total', 'totalRelationships', 'dependencyCount', 'completedItems'].includes(key)) {
        return { toNumber: () => 5 };
      }
      
      // Handle average/numeric fields
      if (['avgPriority', 'avgSharedPriority', 'avgPriorityWorkedOn'].includes(key)) {
        return 0.75;
      }
      
      // Handle array fields
      if (['statuses', 'types', 'workTypes', 'sharedWorkTypes', 'activeWorkTypes', 'itemStatuses'].includes(key)) {
        return ['ACTIVE', 'IN_PROGRESS'];
      }
      
      // Handle project-related fields
      if (['projects'].includes(key)) {
        return ['Project 1', 'Project 2'];
      }
      
      // Handle itemDetails as iterable array
      if (key === 'itemDetails') {
        return [
          { type: 'TASK', status: 'COMPLETED', priority: 0.8 },
          { type: 'BUG', status: 'ACTIVE', priority: 0.6 }
        ];
      }
      
      // Handle string fields
      if (['projectName', 'contributorId', 'contributorName', 'contributor1', 'contributor2', 'name1', 'name2'].includes(key)) {
        return 'Test Value';
      }
      
      if (key === 'contributorType') {
        return 'HUMAN';
      }
      
      if (['projectId', 'graphId'].includes(key)) {
        return 'project-123';
      }
      
      // Handle node structures
      if (key === 'n') {
        return { 
          properties: { 
            id: 'test-node-id', 
            title: 'Test Node',
            type: 'TASK',
            status: 'ACTIVE'
          } 
        };
      }
      
      // Handle contributors array
      if (key === 'contributors') {
        return [{ properties: { id: 'contributor-1', name: 'Test Contributor' } }];
      }
      
      // Handle work items
      if (key === 'w') {
        return { 
          properties: { 
            id: 'work-item-1',
            title: 'Test Work Item',
            type: 'TASK',
            status: 'ACTIVE',
            priorityExec: 0.8,
            priorityIndiv: 0.6,
            priorityComm: 0.7,
            priorityComp: 0.7
          } 
        };
      }
      
      // Handle dependencies
      if (key === 'sampleDependencies') {
        return ['Dep 1', 'Dep 2'];
      }

      // Handle Graph-specific fields
      if (key === 'g') {
        return {
          properties: {
            id: 'test-graph-id',
            name: 'Test Graph',
            description: 'A test graph',
            type: 'PROJECT',
            status: 'ACTIVE',
            teamId: 'team-123',
            parentGraphId: null,
            isShared: false,
            settings: '{"theme":"default"}',
            createdAt: { toString: () => '2024-01-01T00:00:00Z' },
            updatedAt: { toString: () => '2024-01-01T12:00:00Z' },
            archivedAt: { toString: () => '2024-01-02T00:00:00Z' },
            archiveReason: 'Test archive reason',
            nodeCount: { toNumber: () => 10 },
            edgeCount: { toNumber: () => 5 },
            clonedFrom: 'source-graph-id'
          }
        };
      }

      // Handle graph count fields
      if (['nodeCount', 'edgeCount', 'deletedCount'].includes(key)) {
        return { toNumber: () => Math.floor(Math.random() * 20) };
      }

      // Handle graph arrays
      if (['nodeTypes', 'nodeStatuses'].includes(key)) {
        return ['TASK', 'BUG', 'FEATURE'];
      }
      
      // Default fallback
      return 'mock-value';
    }
  });

  const mockSession = {
    run: async (query: string, params?: any) => {
      // Handle Graph CREATE operations
      if (query.includes('CREATE') && query.includes('Graph')) {
        return {
          records: [createMockRecord({
            g: {
              properties: {
                id: 'test-graph-id',
                name: params?.name || 'Test Graph',
                description: params?.description || '',
                type: params?.type || 'PROJECT',
                status: params?.status || 'ACTIVE',
                teamId: params?.teamId || null,
                parentGraphId: params?.parentGraphId || null,
                isShared: params?.isShared || false,
                settings: params?.settings || '{}',
                createdAt: { toString: () => '2024-01-01T00:00:00Z' },
                updatedAt: { toString: () => '2024-01-01T12:00:00Z' },
                nodeCount: { toNumber: () => 0 },
                edgeCount: { toNumber: () => 0 }
              }
            }
          })]
        };
      }

      // Handle Graph UPDATE operations  
      if (query.includes('SET') && query.includes('Graph')) {
        const mockGraph = {
          id: params?.graphId || 'test-graph-id',
          name: params?.name || 'Test Graph',
          description: params?.description || 'A test graph',
          type: 'PROJECT',
          status: params?.status || 'ACTIVE',
          teamId: 'team-123',
          isShared: params?.isShared !== undefined ? params.isShared : false,
          settings: params?.settings || '{"theme":"default"}',
          updatedAt: { toString: () => new Date().toISOString() }
        };

        // Special handling for archive operations
        if (query.includes('ARCHIVED')) {
          mockGraph.status = 'ARCHIVED';
          return {
            records: [createMockRecord({
              g: {
                properties: {
                  ...mockGraph,
                  archivedAt: { toString: () => new Date().toISOString() },
                  archiveReason: params?.reason || 'Test archive reason'
                }
              }
            })]
          };
        }

        return {
          records: [createMockRecord({
            g: { properties: mockGraph }
          })]
        };
      }

      // Handle Graph DELETE operations
      if (query.includes('DELETE') && query.includes('Graph')) {
        // First simulate check query
        if (query.includes('count(w) as nodeCount')) {
          const nodeCount = params?.graphId === 'empty-graph-id' ? 0 : 10;
          return {
            records: [{
              get: (key: string) => {
                if (key === 'g') {
                  return { properties: { id: params?.graphId } };
                }
                if (key === 'nodeCount') {
                  return { toNumber: () => nodeCount };
                }
                return 'mock-value';
              }
            }]
          };
        }
        // Then simulate delete query
        return {
          records: [{
            get: (key: string) => {
              if (key === 'deletedCount') {
                return { toNumber: () => 1 };
              }
              return 'mock-value';
            }
          }]
        };
      }

      // Handle Graph MATCH operations (list, details)
      if (query.includes('MATCH') && query.includes('Graph')) {
        const mockGraphs = [
          {
            id: 'test-graph-id',
            name: 'Test Graph',
            description: 'A test graph', 
            type: 'PROJECT',
            status: 'ACTIVE',
            teamId: 'team-123',
            parentGraphId: null,
            isShared: false,
            createdAt: { toString: () => '2024-01-01T00:00:00Z' },
            updatedAt: { toString: () => '2024-01-01T12:00:00Z' },
            nodeCount: { toNumber: () => 10 },
            edgeCount: { toNumber: () => 5 }
          }
        ];

        return {
          records: mockGraphs.map(graph => createMockRecord({
            g: { properties: graph },
            nodeCount: graph.nodeCount,
            edgeCount: graph.edgeCount,
            nodeTypes: ['TASK', 'BUG', 'FEATURE'],
            nodeStatuses: ['ACTIVE', 'IN_PROGRESS', 'COMPLETED']
          }))
        };
      }

      // Handle WorkItem CREATE operations
      if (query.includes('CREATE') && query.includes('WorkItem')) {
        return {
          records: [createMockRecord({
            n: { 
              properties: { 
                id: 'test-node-id', 
                title: params?.title || 'Test Node',
                description: params?.description || '',
                type: params?.type || 'TASK',
                status: params?.status || 'ACTIVE',
                metadata: params?.metadata || {}
              } 
            }
          })]
        };
      }
      
      // Handle clone operations - return 0 for nodeCount/edgeCount
      if (query.includes('count(newW)') || query.includes('count(newR)')) {
        return {
          records: [createMockRecord({
            nodeCount: { toNumber: () => 0 },
            edgeCount: { toNumber: () => 0 }
          })]
        };
      }
      
      // Default response with comprehensive mock
      return {
        records: [createMockRecord()]
      };
    },
    
    close: async () => {},
    
    beginTransaction: () => ({
      run: async (query: string, params?: any) => {
        // Handle clone operations within transaction
        if (query.includes('count(newW)') || query.includes('count(newR)')) {
          return {
            records: [createMockRecord({
              nodeCount: { toNumber: () => 0 },
              edgeCount: { toNumber: () => 0 }
            })]
          };
        }
        
        // Handle source graph lookup
        if (query.includes('MATCH') && query.includes('Graph')) {
          return {
            records: [createMockRecord({
              g: {
                properties: {
                  id: params?.sourceGraphId || 'source-graph-id',
                  name: 'Source Graph',
                  type: 'PROJECT',
                  teamId: 'team-123',
                  isShared: false,
                  settings: {}
                }
              }
            })]
          };
        }
        
        // Handle graph creation within transaction
        if (query.includes('CREATE')) {
          return {
            records: [createMockRecord({
              g: {
                properties: {
                  id: 'new-graph-id',
                  name: params?.newName || 'New Graph'
                }
              }
            })]
          };
        }
        
        // Default transaction response
        return { 
          records: [createMockRecord()]
        };
      },
      commit: async () => {},
      rollback: async () => {},
      close: async () => {}
    })
  };

  return {
    session: () => mockSession,
    close: async () => {},
  } as unknown as Driver;
}