import neo4j from 'neo4j-driver';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

const driver = neo4j.driver(
  process.env.NEO4J_URI || 'bolt://localhost:7687',
  neo4j.auth.basic(
    process.env.NEO4J_USER || 'neo4j',
    process.env.NEO4J_PASSWORD || 'graphdone_password'
  )
);

async function seed() {
  const session = driver.session();
  
  try {
    // eslint-disable-next-line no-console
    console.log('🌱 Starting Neo4j database seeding...');
    
    // Clear existing data
    await session.run('MATCH (n) DETACH DELETE n');
    // eslint-disable-next-line no-console
    console.log('✨ Cleared existing data');

    // Create graphs first
    const graphs = [
      {
        id: 'welcome-graph-shared',
        name: 'Welcome to GraphDone',
        description: 'A tutorial graph to help you understand GraphDone',
        isPublic: true,
        teamId: 'team-1',
        userId: 'user-1'
      },
      {
        id: 'graph-project-alpha',
        name: 'Project Alpha',
        description: 'Main development project',
        isPublic: false,
        teamId: 'team-1',
        userId: 'user-1'
      },
      {
        id: 'graph-test-beta',
        name: 'Test Graph Beta',
        description: 'Testing and experimentation',
        isPublic: false,
        teamId: 'team-1',
        userId: 'user-2'
      }
    ];

    for (const graph of graphs) {
      await session.run(
        `CREATE (g:Graph {
          id: $id,
          name: $name,
          description: $description,
          isPublic: $isPublic,
          teamId: $teamId,
          userId: $userId,
          createdAt: datetime(),
          updatedAt: datetime()
        })`,
        graph
      );
    }
    // eslint-disable-next-line no-console
    console.log(`✅ Created ${graphs.length} graphs`);

    // Create work items with proper team IDs and graph assignments
    const workItems = [
      // Welcome Graph Items (tutorial)
      { id: 'wi-welcome-1', title: 'Welcome to GraphDone!', type: 'MILESTONE', status: 'COMPLETED', teamId: 'team-1', userId: 'user-1', graphId: 'welcome-graph-shared' },
      { id: 'wi-welcome-2', title: 'Create your first work item', type: 'TASK', status: 'COMPLETED', teamId: 'team-1', userId: 'user-1', graphId: 'welcome-graph-shared' },
      { id: 'wi-welcome-3', title: 'Connect work items together', type: 'TASK', status: 'IN_PROGRESS', teamId: 'team-1', userId: 'user-1', graphId: 'welcome-graph-shared' },
      { id: 'wi-welcome-4', title: 'Explore different views', type: 'TASK', status: 'PLANNED', teamId: 'team-1', userId: 'user-1', graphId: 'welcome-graph-shared' },

      // Project Alpha - Infrastructure & Setup
      { id: 'wi-1', title: 'Set up Neo4j database', type: 'TASK', status: 'COMPLETED', teamId: 'team-1', userId: 'user-1', graphId: 'graph-project-alpha' },
      { id: 'wi-2', title: 'Configure GraphQL schema', type: 'TASK', status: 'COMPLETED', teamId: 'team-1', userId: 'user-1', graphId: 'graph-project-alpha' },
      { id: 'wi-3', title: 'Implement authentication', type: 'TASK', status: 'IN_PROGRESS', teamId: 'team-1', userId: 'user-2', graphId: 'graph-project-alpha' },
      { id: 'wi-4', title: 'Set up CI/CD pipeline', type: 'TASK', status: 'PLANNED', teamId: 'team-1', userId: 'user-3', graphId: 'graph-project-alpha' },
      
      // Project Alpha - Core Features
      { id: 'wi-5', title: 'Graph visualization system', type: 'MILESTONE', status: 'IN_PROGRESS', teamId: 'team-1', userId: 'user-1', graphId: 'graph-project-alpha' },
      { id: 'wi-6', title: 'Implement D3.js force layout', type: 'TASK', status: 'COMPLETED', teamId: 'team-1', userId: 'user-2', graphId: 'graph-project-alpha' },
      { id: 'wi-7', title: 'Add node drag interaction', type: 'TASK', status: 'COMPLETED', teamId: 'team-1', userId: 'user-2', graphId: 'graph-project-alpha' },
      { id: 'wi-8', title: 'Create edge rendering system', type: 'TASK', status: 'IN_PROGRESS', teamId: 'team-1', userId: 'user-3', graphId: 'graph-project-alpha' },
      
      // Project Alpha - Ideas & More
      { id: 'wi-9', title: 'AI agent integration', type: 'IDEA', status: 'PROPOSED', teamId: 'team-1', userId: 'user-4', graphId: 'graph-project-alpha' },
      { id: 'wi-10', title: 'Mobile app development', type: 'IDEA', status: 'PROPOSED', teamId: 'team-1', userId: 'user-5', graphId: 'graph-project-alpha' },
      { id: 'wi-11', title: 'Real-time collaboration', type: 'IDEA', status: 'PROPOSED', teamId: 'team-1', userId: 'user-1', graphId: 'graph-project-alpha' },
      { id: 'wi-12', title: 'Production-ready graph system', type: 'OUTCOME', status: 'PLANNED', teamId: 'team-1', userId: 'user-1', graphId: 'graph-project-alpha' },
      { id: 'wi-13', title: 'Scalable architecture', type: 'OUTCOME', status: 'IN_PROGRESS', teamId: 'team-1', userId: 'user-2', graphId: 'graph-project-alpha' },

      // Test Graph Beta - Testing items
      { id: 'wi-14', title: 'Write unit tests', type: 'TASK', status: 'IN_PROGRESS', teamId: 'team-1', userId: 'user-3', graphId: 'graph-test-beta' },
      { id: 'wi-15', title: 'Performance optimization', type: 'TASK', status: 'PLANNED', teamId: 'team-1', userId: 'user-4', graphId: 'graph-test-beta' },
      { id: 'wi-16', title: 'Documentation update', type: 'TASK', status: 'PLANNED', teamId: 'team-1', userId: 'user-5', graphId: 'graph-test-beta' },
      { id: 'wi-17', title: 'User dashboard', type: 'MILESTONE', status: 'PLANNED', teamId: 'team-1', userId: 'user-1', graphId: 'graph-test-beta' },
      { id: 'wi-18', title: 'Analytics module', type: 'MILESTONE', status: 'PROPOSED', teamId: 'team-1', userId: 'user-2', graphId: 'graph-test-beta' },
      { id: 'wi-19', title: 'Export functionality', type: 'TASK', status: 'PROPOSED', teamId: 'team-1', userId: 'user-3', graphId: 'graph-test-beta' },
      { id: 'wi-20', title: 'Import from other tools', type: 'TASK', status: 'PROPOSED', teamId: 'team-1', userId: 'user-4', graphId: 'graph-test-beta' },
      { id: 'wi-21', title: 'Test WithAPOC', type: 'TASK', status: 'COMPLETED', teamId: 'team-1', userId: 'user-1', graphId: 'graph-test-beta' },
      { id: 'wi-22', title: 'testUI Test', type: 'TASK', status: 'IN_PROGRESS', teamId: 'team-1', userId: 'user-2', graphId: 'graph-test-beta' },
      { id: 'wi-23', title: 'Form validation testing', type: 'TASK', status: 'PLANNED', teamId: 'team-1', userId: 'user-3', graphId: 'graph-test-beta' },
      { id: 'wi-24', title: 'Edge case handling', type: 'TASK', status: 'PROPOSED', teamId: 'team-1', userId: 'user-4', graphId: 'graph-test-beta' },
      { id: 'wi-25', title: 'Q1 2024 Planning', type: 'MILESTONE', status: 'COMPLETED', teamId: 'team-1', userId: 'user-1', graphId: 'graph-test-beta' },
      { id: 'wi-26', title: 'Product roadmap review', type: 'OUTCOME', status: 'IN_PROGRESS', teamId: 'team-1', userId: 'user-2', graphId: 'graph-test-beta' },
      { id: 'wi-27', title: 'Customer feedback analysis', type: 'TASK', status: 'PLANNED', teamId: 'team-1', userId: 'user-3', graphId: 'graph-test-beta' },
      { id: 'wi-28', title: 'Market research', type: 'TASK', status: 'PROPOSED', teamId: 'team-1', userId: 'user-4', graphId: 'graph-test-beta' },
      { id: 'wi-29', title: 'Refactor graph engine', type: 'TASK', status: 'PLANNED', teamId: 'team-1', userId: 'user-5', graphId: 'graph-test-beta' },
      { id: 'wi-30', title: 'Update dependencies', type: 'TASK', status: 'IN_PROGRESS', teamId: 'team-1', userId: 'user-1', graphId: 'graph-test-beta' },
      { id: 'wi-31', title: 'Security audit', type: 'MILESTONE', status: 'PLANNED', teamId: 'team-1', userId: 'user-2', graphId: 'graph-test-beta' },
      { id: 'wi-32', title: 'Performance benchmarking', type: 'TASK', status: 'PROPOSED', teamId: 'team-1', userId: 'user-3', graphId: 'graph-test-beta' }
    ];
    
    // Create work items and link to graphs
    for (const item of workItems) {
      await session.run(
        `MATCH (g:Graph {id: $graphId})
         CREATE (w:WorkItem {
          id: $id,
          title: $title,
          type: $type,
          status: $status,
          teamId: $teamId,
          userId: $userId,
          description: $description,
          positionX: $positionX,
          positionY: $positionY,
          positionZ: 0,
          radius: 1.0,
          theta: 0,
          phi: 0,
          priorityExec: $priorityExec,
          priorityIndiv: $priorityIndiv,
          priorityComm: $priorityComm,
          priorityComp: $priorityComp,
          tags: $tags,
          createdAt: datetime(),
          updatedAt: datetime()
        })
        CREATE (w)-[:BELONGS_TO]->(g)`,
        {
          ...item,
          description: `Description for ${item.title}`,
          positionX: Math.random() * 800 - 400,
          positionY: Math.random() * 600 - 300,
          priorityExec: Math.random(),
          priorityIndiv: Math.random(),
          priorityComm: Math.random(),
          priorityComp: Math.random(),
          tags: []
        }
      );
    }
    // eslint-disable-next-line no-console
    console.log(`✅ Created ${workItems.length} work items`);
    
    // Create edges (relationships between work items)
    const edges = [
      // Welcome graph edges
      { source: 'wi-welcome-1', target: 'wi-welcome-2', type: 'DEPENDS_ON' },
      { source: 'wi-welcome-2', target: 'wi-welcome-3', type: 'DEPENDS_ON' },
      { source: 'wi-welcome-3', target: 'wi-welcome-4', type: 'DEPENDS_ON' },

      // Project Alpha edges
      { source: 'wi-1', target: 'wi-2', type: 'DEPENDS_ON' },
      { source: 'wi-2', target: 'wi-3', type: 'DEPENDS_ON' },
      { source: 'wi-5', target: 'wi-6', type: 'IS_PART_OF' },
      { source: 'wi-5', target: 'wi-7', type: 'IS_PART_OF' },
      { source: 'wi-5', target: 'wi-8', type: 'IS_PART_OF' },
      { source: 'wi-12', target: 'wi-5', type: 'DEPENDS_ON' },

      // Test graph edges
      { source: 'wi-14', target: 'wi-15', type: 'DEPENDS_ON' },
      { source: 'wi-17', target: 'wi-18', type: 'IS_PART_OF' }
    ];
    
    for (const edge of edges) {
      await session.run(
        `MATCH (s:WorkItem {id: $sourceId})
         MATCH (t:WorkItem {id: $targetId})
         CREATE (s)-[e:DEPENDS_ON {
           id: $id,
           type: $type,
           weight: 1.0,
           teamId: 'team-1',
           userId: 'user-1',
           createdAt: datetime()
         }]->(t)`,
        {
          sourceId: edge.source,
          targetId: edge.target,
          type: edge.type,
          id: `edge-${edge.source}-${edge.target}`
        }
      );
    }
    // eslint-disable-next-line no-console
    console.log(`✅ Created ${edges.length} edges`);
    
    // Create Edge entities for the new edge system with proper relationships
    for (const edge of edges) {
      await session.run(
        `MATCH (s:WorkItem {id: $sourceId})
         MATCH (t:WorkItem {id: $targetId})
         CREATE (e:Edge {
           id: $id,
           type: $type,
           weight: 1.0,
           teamId: 'team-1',
           userId: 'user-1',
           createdAt: datetime()
         })
         CREATE (e)-[:EDGE_SOURCE]->(s)
         CREATE (e)-[:EDGE_TARGET]->(t)`,
        {
          id: `edge-entity-${edge.source}-${edge.target}`,
          type: edge.type,
          sourceId: edge.source,
          targetId: edge.target
        }
      );
    }
    // eslint-disable-next-line no-console
    console.log(`✅ Created ${edges.length} Edge entities`);
    
    // Create contributors
    const contributors = [
      { id: 'contrib-1', name: 'Alice Johnson', type: 'HUMAN', email: 'alice@graphdone.com', teamId: 'team-1' },
      { id: 'contrib-2', name: 'Bob Smith', type: 'HUMAN', email: 'bob@graphdone.com', teamId: 'team-1' },
      { id: 'contrib-3', name: 'Charlie Brown', type: 'HUMAN', email: 'charlie@graphdone.com', teamId: 'team-1' },
      { id: 'contrib-4', name: 'Diana Prince', type: 'HUMAN', email: 'diana@graphdone.com', teamId: 'team-1' },
      { id: 'contrib-5', name: 'AI Assistant', type: 'AI_AGENT', email: 'ai@graphdone.com', teamId: 'team-1' }
    ];
    
    for (const contrib of contributors) {
      await session.run(
        `CREATE (c:Contributor {
          id: $id,
          name: $name,
          type: $type,
          email: $email,
          teamId: $teamId,
          createdAt: datetime(),
          updatedAt: datetime()
        })`,
        contrib
      );
    }
    // eslint-disable-next-line no-console
    console.log(`✅ Created ${contributors.length} contributors`);
    
    // Connect some contributors to work items
    const contributions = [
      { contributorId: 'contrib-1', workItemId: 'wi-1' },
      { contributorId: 'contrib-1', workItemId: 'wi-5' },
      { contributorId: 'contrib-2', workItemId: 'wi-6' },
      { contributorId: 'contrib-2', workItemId: 'wi-7' },
      { contributorId: 'contrib-3', workItemId: 'wi-8' },
      { contributorId: 'contrib-5', workItemId: 'wi-9' }
    ];
    
    for (const contribution of contributions) {
      await session.run(
        `MATCH (c:Contributor {id: $contributorId})
         MATCH (w:WorkItem {id: $workItemId})
         CREATE (c)-[:CONTRIBUTES_TO]->(w)`,
        contribution
      );
    }
    // eslint-disable-next-line no-console
    console.log(`✅ Created ${contributions.length} contributor connections`);
    
    // eslint-disable-next-line no-console
    console.log('🎉 Database seeding completed successfully!');
    
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('❌ Error seeding database:', error);
    throw error;
  } finally {
    await session.close();
    await driver.close();
  }
}

// Run the seed function
// eslint-disable-next-line no-console
seed().catch(console.error);