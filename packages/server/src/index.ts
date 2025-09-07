import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { useServer } from 'graphql-ws/lib/use/ws';
import cors from 'cors';
import dotenv from 'dotenv';
// OAuth imports disabled
// import session from 'express-session';
// import passport from 'passport';
import { Neo4jGraphQL } from '@neo4j/graphql';
import fetch from 'node-fetch';

import { typeDefs } from './schema/neo4j-schema.js';
import { authTypeDefs } from './schema/auth-schema.js';
import { authOnlyTypeDefs } from './schema/auth-only-schema.js';
import { sqliteAuthResolvers } from './resolvers/sqlite-auth.js';
import { extractUserFromToken } from './middleware/auth.js';
import { mergeTypeDefs } from '@graphql-tools/merge';
import { driver, NEO4J_URI } from './db.js';
import { sqliteAuthStore } from './auth/sqlite-auth.js';

dotenv.config();

const PORT = Number(process.env.PORT) || 4127;

async function cleanupDuplicateUsers() {
  const session = driver.session();
  
  try {
    console.log('🧹 Cleaning up duplicate users...');
    
    // Find and remove duplicate admin users, keeping the oldest one
    const duplicateAdmins = await session.run(`
      MATCH (u:User {username: 'admin'})
      WITH u
      ORDER BY u.createdAt ASC
      WITH collect(u) as users
      WHERE size(users) > 1
      UNWIND users[1..] as duplicateUser
      DETACH DELETE duplicateUser
      RETURN count(duplicateUser) as deletedCount
    `);
    
    const adminDeletedCount = duplicateAdmins.records[0]?.get('deletedCount')?.toNumber() || 0;
    if (adminDeletedCount > 0) {
      console.log(`🗑️  Removed ${adminDeletedCount} duplicate admin users`);
    }
    
    // Find and remove duplicate viewer users, keeping the oldest one
    const duplicateViewers = await session.run(`
      MATCH (u:User {username: 'viewer'})
      WITH u
      ORDER BY u.createdAt ASC
      WITH collect(u) as users
      WHERE size(users) > 1
      UNWIND users[1..] as duplicateUser
      DETACH DELETE duplicateUser
      RETURN count(duplicateUser) as deletedCount
    `);
    
    const viewerDeletedCount = duplicateViewers.records[0]?.get('deletedCount')?.toNumber() || 0;
    if (viewerDeletedCount > 0) {
      console.log(`🗑️  Removed ${viewerDeletedCount} duplicate viewer users`);
    }
    
    if (adminDeletedCount === 0 && viewerDeletedCount === 0) {
      console.log('✅ No duplicate users found');
    }
    
  } catch (error) {
    console.error('❌ Error cleaning up duplicate users:', error);
  } finally {
    await session.close();
  }
}

async function ensureDefaultUsers() {
  const session = driver.session();
  
  try {
    // First, migrate existing users with old role names to new ones
    await session.run(`
      MATCH (u:User)
      WHERE u.role = 'GRAPH_MASTER'
      SET u.role = 'ADMIN'
    `);
    
    await session.run(`
      MATCH (u:User)
      WHERE u.role = 'PATH_KEEPER'
      SET u.role = 'USER'
    `);
    
    await session.run(`
      MATCH (u:User)
      WHERE u.role = 'ORIGIN_NODE'
      SET u.role = 'USER'
    `);
    
    await session.run(`
      MATCH (u:User)
      WHERE u.role = 'CONNECTOR'
      SET u.role = 'USER'
    `);
    
    await session.run(`
      MATCH (u:User)
      WHERE u.role = 'NODE_WATCHER'
      SET u.role = 'VIEWER'
    `);

    // Check if the default admin user specifically exists
    const existingDefaultAdmin = await session.run(
      `MATCH (u:User {username: 'admin'}) RETURN u LIMIT 1`
    );

    if (existingDefaultAdmin.records.length === 0) {
      // Create default admin user
      const adminId = uuidv4();
      const adminPasswordHash = await bcrypt.hash('graphdone', 10);
      
      await session.run(
        `CREATE (u:User {
          id: $adminId,
          email: 'admin@graphdone.local',
          username: 'admin',
          passwordHash: $adminPasswordHash,
          name: 'Default Admin',
          role: 'ADMIN',
          isActive: true,
          isEmailVerified: true,
          createdAt: datetime(),
          updatedAt: datetime()
        })
        RETURN u`,
        { adminId, adminPasswordHash }
      );

      console.log('🔐 DEFAULT ADMIN USER CREATED');
      console.log('📧 Email/Username: admin');
      console.log('🔑 Password: graphdone');
      console.log('👑 Role: ADMIN');
    } else {
      console.log('👤 Default admin user already exists (skipped creation)');
    }

    // Check if the default viewer user specifically exists  
    const existingDefaultViewer = await session.run(
      `MATCH (u:User {username: 'viewer'}) RETURN u LIMIT 1`
    );

    if (existingDefaultViewer.records.length === 0) {
      // Create default view-only user
      const viewerId = uuidv4();
      const viewerPasswordHash = await bcrypt.hash('graphdone', 10);
      
      await session.run(
        `CREATE (u:User {
          id: $viewerId,
          email: 'viewer@graphdone.local',
          username: 'viewer',
          passwordHash: $viewerPasswordHash,
          name: 'Default Viewer',
          role: 'VIEWER',
          isActive: true,
          isEmailVerified: true,
          createdAt: datetime(),
          updatedAt: datetime()
        })
        RETURN u`,
        { viewerId, viewerPasswordHash }
      );

      console.log('👁️  DEFAULT VIEWER USER CREATED');
      console.log('📧 Email/Username: viewer');
      console.log('🔑 Password: graphdone');
      console.log('👁️  Role: VIEWER (Read-only)');
    } else {
      console.log('👁️  Default viewer user already exists (skipped creation)');
    }

    if (existingDefaultAdmin.records.length === 0 || existingDefaultViewer.records.length === 0) {
      console.log('⚠️  Please change the default passwords after first login!\n');
    }

  } catch (error) {
    console.error('❌ Error creating default users:', error);
  } finally {
    await session.close();
  }
}

async function startServer() {
  const app = express();
  const httpServer = createServer(app);

  // Initialize SQLite auth system first (for users and config)
  try {
    await sqliteAuthStore.initialize();
    console.log('🔐 SQLite authentication system initialized');
  } catch (error) {
    console.error('❌ Failed to initialize SQLite auth:', error.message);
    console.error('🚫 Server cannot start without authentication system');
    process.exit(1);
  }

  // Try to connect to Neo4j, but don't block server startup if it fails
  let schema;
  let isNeo4jAvailable = false;
  
  try {
    // Test Neo4j connection
    const session = driver.session();
    await session.run('RETURN 1');
    await session.close();
    isNeo4jAvailable = true;
    console.log('✅ Neo4j connection successful');
    
    // Merge type definitions (Neo4j schema + auth schema)  
    const mergedTypeDefs = mergeTypeDefs([typeDefs, authTypeDefs]);

    // Create Neo4jGraphQL instance for graph data with SQLite auth resolvers override
    const neoSchema = new Neo4jGraphQL({
      typeDefs: mergedTypeDefs,
      driver,
      resolvers: {
        // Override auth resolvers to use SQLite instead of Neo4j User nodes
        ...sqliteAuthResolvers,
      },
    });

    schema = await neoSchema.getSchema();
    console.log('🔗 Full Neo4j + SQLite auth schema ready');
    
  } catch (error) {
    console.log('⚠️  Neo4j not available, using auth-only mode:', error.message);
    isNeo4jAvailable = false;
    
    // Create auth-only schema using just SQLite resolvers and complete auth schema
    const { makeExecutableSchema } = await import('@graphql-tools/schema');
    schema = makeExecutableSchema({
      typeDefs: authOnlyTypeDefs,
      resolvers: sqliteAuthResolvers
    });
    console.log('🔐 Auth-only SQLite schema ready (Neo4j disabled)');
  }

  const wsServer = new WebSocketServer({
    server: httpServer,
    path: '/graphql',
  });

  const serverCleanup = useServer({ schema }, wsServer);

  const server = new ApolloServer({
    schema,
    plugins: [
      ApolloServerPluginDrainHttpServer({ httpServer }),
      {
        async serverWillStart() {
          return {
            async drainServer() {
              await serverCleanup.dispose();
            },
          };
        },
      },
    ],
  });

  await server.start();


  app.use(
    '/graphql',
    cors<cors.CorsRequest>(),
    express.json(),
    expressMiddleware(server, {
      context: async ({ req }) => {
        const user = extractUserFromToken(req.headers.authorization);
        return {
          driver: isNeo4jAvailable ? driver : null,
          user,
          isNeo4jAvailable,
        };
      },
    })
  );

  // Enhanced health check endpoint that checks all services
  app.get('/health', cors<cors.CorsRequest>(), async (_req, res) => {
    const health: {
      status: string;
      timestamp: string;
      services: {
        graphql: { status: string; port: number };
        neo4j: { status: string; uri: string; error?: string };
        mcp: { status: string; port: number; capabilities: string[]; version?: string; uptime?: number; lastAccessed?: string; error?: string };
      };
    } = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        graphql: {
          status: 'healthy',
          port: PORT
        },
        neo4j: {
          status: 'unknown',
          uri: NEO4J_URI
        },
        mcp: {
          status: 'unknown',
          port: 3128,
          capabilities: []
        }
      }
    };

    // Check Neo4j connection
    try {
      const session = driver.session();
      await session.run('RETURN 1');
      await session.close();
      health.services.neo4j.status = 'healthy';
    } catch (error) {
      health.services.neo4j.status = 'unhealthy';
      health.services.neo4j.error = error instanceof Error ? error.message : 'Connection failed';
      health.status = 'degraded';
    }

    // Check MCP server health
    try {
      const mcpHealthUrl = `http://localhost:${process.env.MCP_HEALTH_PORT || 3128}/health`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      
      const response = await fetch(mcpHealthUrl, { 
        method: 'GET',
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const mcpHealth = await response.json() as { version?: string; uptime?: number; capabilities?: string[]; lastAccessed?: string };
        health.services.mcp.status = 'healthy';
        health.services.mcp.version = mcpHealth.version;
        health.services.mcp.uptime = mcpHealth.uptime;
        health.services.mcp.capabilities = mcpHealth.capabilities || [];
        health.services.mcp.lastAccessed = mcpHealth.lastAccessed;
      } else {
        health.services.mcp.status = 'unhealthy';
        health.status = 'degraded';
      }
    } catch (error) {
      health.services.mcp.status = 'offline';
      health.services.mcp.error = error instanceof Error ? error.message : 'Connection failed';
      // Don't mark overall health as degraded if MCP is just offline
    }

    res.json(health);
  });

  // MCP-specific status endpoint
  app.get('/mcp/status', cors<cors.CorsRequest>(), async (_req, res) => {
    try {
      const mcpStatusUrl = `http://localhost:${process.env.MCP_HEALTH_PORT || 3128}/status`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      
      const response = await fetch(mcpStatusUrl, { 
        method: 'GET',
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const mcpStatus = await response.json() as Record<string, unknown>;
        res.json({
          connected: true,
          ...mcpStatus
        });
      } else {
        res.status(503).json({
          connected: false,
          error: 'MCP server returned an error'
        });
      }
    } catch (error) {
      res.status(503).json({
        connected: false,
        error: error instanceof Error ? error.message : 'Connection failed'
      });
    }
  });

  httpServer.listen(PORT, '0.0.0.0', () => {
    // eslint-disable-next-line no-console
    console.log(`🚀 GraphQL server ready at http://localhost:${PORT}/graphql`);
    // eslint-disable-next-line no-console
    console.log(`🔌 WebSocket server ready at ws://localhost:${PORT}/graphql`);
  });
}

startServer().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Failed to start server:', error);
  process.exit(1);
});