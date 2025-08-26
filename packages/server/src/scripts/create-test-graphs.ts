import neo4j from 'neo4j-driver';
import { v4 as uuidv4 } from 'uuid';

const driver = neo4j.driver('bolt://localhost:7687', neo4j.auth.basic('neo4j', 'graphdone_password'));

async function createTestGraphs() {
  console.log('🌱 Creating test graphs...');
  const session = driver.session();

  try {
    // Create test graphs
    const testGraphs = [
      {
        id: uuidv4(),
        name: 'Main Project',
        description: 'Primary project workspace for GraphDone development',
        type: 'PROJECT',
        teamId: 'team-1',
        createdBy: 'contrib-1',
        status: 'ACTIVE',
        isShared: true,
        nodeCount: 15,
        edgeCount: 8,
        contributorCount: 3,
        depth: 0,
        path: [],
        tags: ['development', 'core'],
        lastActivity: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        settings: JSON.stringify({
          theme: 'dark',
          layout: 'force',
          showPriorities: true,
          showDependencies: true,
          autoLayout: true,
          zoomLevel: 1.0
        }),
        permissions: JSON.stringify({
          owner: 'contrib-1',
          admins: ['contrib-1'],
          editors: ['contrib-2'],
          viewers: [],
          teamPermission: 'EDIT'
        }),
        shareSettings: JSON.stringify({
          isPublic: false,
          allowTeamAccess: true,
          allowCopying: false,
          allowForking: false
        })
      },
      {
        id: uuidv4(),
        name: 'UI Components',
        description: 'Component library and design system',
        type: 'WORKSPACE',
        teamId: 'team-1',
        createdBy: 'contrib-2',
        status: 'ACTIVE',
        isShared: false,
        nodeCount: 8,
        edgeCount: 5,
        contributorCount: 2,
        depth: 0,
        path: [],
        tags: ['frontend', 'components'],
        lastActivity: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        settings: JSON.stringify({
          theme: 'light',
          layout: 'hierarchical',
          showPriorities: true,
          showDependencies: true,
          autoLayout: false,
          zoomLevel: 1.2
        }),
        permissions: JSON.stringify({
          owner: 'contrib-2',
          admins: ['contrib-2'],
          editors: ['contrib-1'],
          viewers: ['contrib-3'],
          teamPermission: 'VIEW'
        }),
        shareSettings: JSON.stringify({
          isPublic: false,
          allowTeamAccess: true,
          allowCopying: true,
          allowForking: false
        })
      },
      {
        id: uuidv4(),
        name: 'API Documentation',
        description: 'GraphQL API docs and examples',
        type: 'TEMPLATE',
        teamId: 'team-1',
        createdBy: 'contrib-1',
        status: 'DRAFT',
        isShared: true,
        nodeCount: 12,
        edgeCount: 6,
        contributorCount: 1,
        depth: 0,
        path: [],
        tags: ['documentation', 'api'],
        lastActivity: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        settings: JSON.stringify({
          theme: 'light',
          layout: 'force',
          showPriorities: false,
          showDependencies: true,
          autoLayout: true,
          zoomLevel: 0.8
        }),
        permissions: JSON.stringify({
          owner: 'contrib-1',
          admins: ['contrib-1'],
          editors: [],
          viewers: ['contrib-2', 'contrib-3'],
          teamPermission: 'VIEW'
        }),
        shareSettings: JSON.stringify({
          isPublic: true,
          allowTeamAccess: true,
          allowCopying: true,
          allowForking: true
        })
      }
    ];

    // Insert graphs using Cypher
    for (const graph of testGraphs) {
      await session.run(`
        CREATE (g:Graph {
          id: $id,
          name: $name,
          description: $description,
          type: $type,
          teamId: $teamId,
          createdBy: $createdBy,
          status: $status,
          isShared: $isShared,
          nodeCount: $nodeCount,
          edgeCount: $edgeCount,
          contributorCount: $contributorCount,
          depth: $depth,
          path: $path,
          tags: $tags,
          lastActivity: $lastActivity,
          createdAt: $createdAt,
          updatedAt: $updatedAt,
          settings: $settings,
          permissions: $permissions,
          shareSettings: $shareSettings
        })
      `, graph);
      
      console.log(`✅ Created graph: ${graph.name} (${graph.type})`);
    }

    console.log('🎉 Test graphs created successfully!');
  } catch (error) {
    console.error('❌ Error creating test graphs:', error);
    throw error;
  } finally {
    await session.close();
    await driver.close();
  }
}

createTestGraphs().catch(console.error);