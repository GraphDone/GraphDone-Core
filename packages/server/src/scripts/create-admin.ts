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
      `MATCH (u:User {role: 'GRAPH_MASTER'}) RETURN u LIMIT 1`
    );

    if (existingAdmin.records.length > 0) {
      console.log('Admin user already exists!');
      return;
    }

    // Create admin user
    const adminId = uuidv4();
    const passwordHash = await bcrypt.hash('admin123', 10);
    
    await session.run(
      `CREATE (u:User {
        id: $adminId,
        email: 'admin@graphdone.local',
        username: 'admin',
        passwordHash: $passwordHash,
        name: 'Graph Master Admin',
        role: 'GRAPH_MASTER',
        isActive: true,
        isEmailVerified: true,
        createdAt: datetime(),
        updatedAt: datetime()
      })
      RETURN u`,
      { adminId, passwordHash }
    );

    console.log('✅ Admin user created successfully!');
    console.log('📧 Email: admin@graphdone.local');
    console.log('🔑 Password: admin123');
    console.log('👑 Role: GRAPH_MASTER');
    console.log('\nNow you can login and promote other users!');

  } catch (error) {
    console.error('❌ Error creating admin:', error);
  } finally {
    await session.close();
    await driver.close();
  }
}

createAdmin();