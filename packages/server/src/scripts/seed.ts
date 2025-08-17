import neo4j from 'neo4j-driver';
import dotenv from 'dotenv';
import path from 'path';

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
    console.log('🌱 Starting Neo4j database seeding...');
    
    // Clear existing data
    await session.run('MATCH (n) DETACH DELETE n');
    console.log('✨ Cleared existing data');
    
    // Create work items with proper team IDs
    const workItems = [
      // Infrastructure & Setup
      { id: 'wi-1', title: 'Set up Neo4j database', type: 'TASK', status: 'COMPLETED', teamId: 'team-1', userId: 'user-1' },
      { id: 'wi-2', title: 'Configure GraphQL schema', type: 'TASK', status: 'COMPLETED', teamId: 'team-1', userId: 'user-1' },
      { id: 'wi-3', title: 'Implement authentication', type: 'TASK', status: 'IN_PROGRESS', teamId: 'team-1', userId: 'user-2' },
      { id: 'wi-4', title: 'Set up CI/CD pipeline', type: 'TASK', status: 'PLANNED', teamId: 'team-1', userId: 'user-3' },
      
      // Core Features
      { id: 'wi-5', title: 'Graph visualization system', type: 'MILESTONE', status: 'IN_PROGRESS', teamId: 'team-1', userId: 'user-1' },
      { id: 'wi-6', title: 'Implement D3.js force layout', type: 'TASK', status: 'COMPLETED', teamId: 'team-1', userId: 'user-2' },
      { id: 'wi-7', title: 'Add node drag interaction', type: 'TASK', status: 'COMPLETED', teamId: 'team-1', userId: 'user-2' },
      { id: 'wi-8', title: 'Create edge rendering system', type: 'TASK', status: 'IN_PROGRESS', teamId: 'team-1', userId: 'user-3' },
      
      // Ideas & Proposals
      { id: 'wi-9', title: 'AI agent integration', type: 'IDEA', status: 'PROPOSED', teamId: 'team-1', userId: 'user-4' },
      { id: 'wi-10', title: 'Mobile app development', type: 'IDEA', status: 'PROPOSED', teamId: 'team-1', userId: 'user-5' },
      { id: 'wi-11', title: 'Real-time collaboration', type: 'IDEA', status: 'PROPOSED', teamId: 'team-1', userId: 'user-1' },
      
      // Outcomes
      { id: 'wi-12', title: 'Production-ready graph system', type: 'OUTCOME', status: 'PLANNED', teamId: 'team-1', userId: 'user-1' },
      { id: 'wi-13', title: 'Scalable architecture', type: 'OUTCOME', status: 'IN_PROGRESS', teamId: 'team-1', userId: 'user-2' },
      
      // Additional tasks for testing
      { id: 'wi-14', title: 'Write unit tests', type: 'TASK', status: 'IN_PROGRESS', teamId: 'team-1', userId: 'user-3' },
      { id: 'wi-15', title: 'Performance optimization', type: 'TASK', status: 'PLANNED', teamId: 'team-1', userId: 'user-4' },
      { id: 'wi-16', title: 'Documentation update', type: 'TASK', status: 'PLANNED', teamId: 'team-1', userId: 'user-5' },
      
      // More features
      { id: 'wi-17', title: 'User dashboard', type: 'MILESTONE', status: 'PLANNED', teamId: 'team-1', userId: 'user-1' },
      { id: 'wi-18', title: 'Analytics module', type: 'MILESTONE', status: 'PROPOSED', teamId: 'team-1', userId: 'user-2' },
      { id: 'wi-19', title: 'Export functionality', type: 'TASK', status: 'PROPOSED', teamId: 'team-1', userId: 'user-3' },
      { id: 'wi-20', title: 'Import from other tools', type: 'TASK', status: 'PROPOSED', teamId: 'team-1', userId: 'user-4' },
      
      // Test data variations
      { id: 'wi-21', title: 'Test WithAPOC', type: 'TASK', status: 'COMPLETED', teamId: 'team-1', userId: 'user-1' },
      { id: 'wi-22', title: 'testUI Test', type: 'TASK', status: 'IN_PROGRESS', teamId: 'team-1', userId: 'user-2' },
      { id: 'wi-23', title: 'Form validation testing', type: 'TASK', status: 'PLANNED', teamId: 'team-1', userId: 'user-3' },
      { id: 'wi-24', title: 'Edge case handling', type: 'TASK', status: 'PROPOSED', teamId: 'team-1', userId: 'user-4' },
      
      // Strategic items
      { id: 'wi-25', title: 'Q1 2024 Planning', type: 'MILESTONE', status: 'COMPLETED', teamId: 'team-1', userId: 'user-1' },
      { id: 'wi-26', title: 'Product roadmap review', type: 'OUTCOME', status: 'IN_PROGRESS', teamId: 'team-1', userId: 'user-2' },
      { id: 'wi-27', title: 'Customer feedback analysis', type: 'TASK', status: 'PLANNED', teamId: 'team-1', userId: 'user-3' },
      { id: 'wi-28', title: 'Market research', type: 'TASK', status: 'PROPOSED', teamId: 'team-1', userId: 'user-4' },
      
      // Technical debt
      { id: 'wi-29', title: 'Refactor graph engine', type: 'TASK', status: 'PLANNED', teamId: 'team-1', userId: 'user-5' },
      { id: 'wi-30', title: 'Update dependencies', type: 'TASK', status: 'IN_PROGRESS', teamId: 'team-1', userId: 'user-1' },
      { id: 'wi-31', title: 'Security audit', type: 'MILESTONE', status: 'PLANNED', teamId: 'team-1', userId: 'user-2' },
      { id: 'wi-32', title: 'Performance benchmarking', type: 'TASK', status: 'PROPOSED', teamId: 'team-1', userId: 'user-3' }
    ];
    
    // Create work items
    for (const item of workItems) {
      await session.run(
        `CREATE (w:WorkItem {
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
          createdAt: datetime(),
          updatedAt: datetime()
        })`,
        {
          ...item,
          description: `Description for ${item.title}`,
          positionX: Math.random() * 800 - 400,
          positionY: Math.random() * 600 - 300,
          priorityExec: Math.random(),
          priorityIndiv: Math.random(),
          priorityComm: Math.random(),
          priorityComp: Math.random()
        }
      );
    }
    console.log(`✅ Created ${workItems.length} work items`);
    
    // Create edges (relationships between work items)
    const edges = [
      { source: 'wi-1', target: 'wi-2', type: 'DEPENDENCY' },
      { source: 'wi-2', target: 'wi-3', type: 'DEPENDENCY' },
      { source: 'wi-5', target: 'wi-6', type: 'CONTAINS' },
      { source: 'wi-5', target: 'wi-7', type: 'CONTAINS' },
      { source: 'wi-5', target: 'wi-8', type: 'CONTAINS' },
      { source: 'wi-12', target: 'wi-5', type: 'DEPENDENCY' }
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
    console.log(`✅ Created ${contributors.length} contributors`);
    
    // Connect some contributors to work items
    const assignments = [
      { contributorId: 'contrib-1', workItemId: 'wi-1' },
      { contributorId: 'contrib-1', workItemId: 'wi-5' },
      { contributorId: 'contrib-2', workItemId: 'wi-6' },
      { contributorId: 'contrib-2', workItemId: 'wi-7' },
      { contributorId: 'contrib-3', workItemId: 'wi-8' },
      { contributorId: 'contrib-5', workItemId: 'wi-9' }
    ];
    
    for (const assignment of assignments) {
      await session.run(
        `MATCH (c:Contributor {id: $contributorId})
         MATCH (w:WorkItem {id: $workItemId})
         CREATE (c)-[:CONTRIBUTES_TO]->(w)`,
        assignment
      );
    }
    console.log(`✅ Created ${assignments.length} contributor assignments`);
    
    console.log('🎉 Database seeding completed successfully!');
    
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    throw error;
  } finally {
    await session.close();
    await driver.close();
  }
}

// Run the seed function
seed().catch(console.error);