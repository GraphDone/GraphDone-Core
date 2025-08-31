import neo4j from 'neo4j-driver';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';

dotenv.config();

const NEO4J_URI = process.env.NEO4J_URI || 'bolt://localhost:7687';
const NEO4J_USER = process.env.NEO4J_USER || 'neo4j';
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD || 'password';

async function createAdmin() {
  const driver = neo4j.driver(NEO4J_URI, neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD));
  const session = driver.session();

  try {
    // Check if admin already exists
    const existingAdmin = await session.run(
      `MATCH (u:User {role: 'ADMIN'}) RETURN u LIMIT 1`
    );

    if (existingAdmin.records.length > 0) {
      console.log('Admin user already exists!');
      return;
    }

    // Create default team first
    const teamId = 'team-1';
    await session.run(
      `CREATE (t:Team {
        id: $teamId,
        name: 'GraphDone Team',
        description: 'Default GraphDone team for graph management',
        memberCount: 1,
        createdAt: datetime(),
        updatedAt: datetime()
      })
      RETURN t`,
      { teamId }
    );

    // Create admin user
    const adminId = uuidv4();
    const passwordHash = await bcrypt.hash('graphdone', 10);
    
    await session.run(
      `MATCH (t:Team {id: $teamId})
       CREATE (u:User {
        id: $adminId,
        email: 'admin@graphdone.local',
        username: 'admin',
        passwordHash: $passwordHash,
        name: 'System Administrator',
        role: 'ADMIN',
        isActive: true,
        isEmailVerified: true,
        createdAt: datetime(),
        updatedAt: datetime()
      })
      CREATE (u)-[:MEMBER_OF]->(t)
      RETURN u`,
      { adminId, passwordHash, teamId }
    );

    console.log('✅ Admin user and team created successfully!');
    console.log('👥 Team: GraphDone Team (team-1)');
    console.log('📧 Email: admin@graphdone.local');
    console.log('🔑 Password: graphdone');
    console.log('👑 Role: ADMIN');
    console.log('\nYou can now login and access the Admin panel!');

  } catch (error) {
    console.error('❌ Error creating admin:', error);
  } finally {
    await session.close();
    await driver.close();
  }
}

createAdmin();