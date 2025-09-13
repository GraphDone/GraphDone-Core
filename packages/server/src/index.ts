import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import express from 'express';
import { createServer } from 'http';
import { createServer as createHttpsServer } from 'https';
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
import { createTlsConfig, validateTlsConfig, type TlsConfig } from './config/tls.js';

dotenv.config();

const PORT = Number(process.env.PORT) || 4127;

async function startServer() {
  const app = express();
  
  // Configure TLS if enabled
  let tlsConfig: TlsConfig | null = null;
  try {
    tlsConfig = createTlsConfig();
    if (tlsConfig) {
      validateTlsConfig(tlsConfig);
      console.log('🔐 TLS/SSL configuration loaded successfully'); // eslint-disable-line no-console
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown TLS configuration error';
    console.error('❌ TLS/SSL configuration failed:', errorMessage); // eslint-disable-line no-console
    process.exit(1);
  }

  // Create server (HTTP or HTTPS based on configuration)
  const server = tlsConfig 
    ? createHttpsServer({ key: tlsConfig.key, cert: tlsConfig.cert }, app)
    : createServer(app);
    
  const serverPort = tlsConfig ? tlsConfig.port : PORT;
  const protocol = tlsConfig ? 'https' : 'http';
  const wsProtocol = tlsConfig ? 'wss' : 'ws';

  // Initialize SQLite auth system first (for users and config)
  try {
    await sqliteAuthStore.initialize();
    console.log('🔐 SQLite authentication system initialized'); // eslint-disable-line no-console
  } catch (error) {
    console.error('❌ Failed to initialize SQLite auth:', (error as Error).message); // eslint-disable-line no-console
    console.error('🚫 Server cannot start without authentication system'); // eslint-disable-line no-console
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
    console.log('✅ Neo4j connection successful'); // eslint-disable-line no-console
    
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
    console.log('🔗 Full Neo4j + SQLite auth schema ready'); // eslint-disable-line no-console
    
  } catch (error) {
    console.log('⚠️  Neo4j not available, using auth-only mode:', (error as Error).message); // eslint-disable-line no-console
    isNeo4jAvailable = false;
    
    // Create auth-only schema using just SQLite resolvers and complete auth schema
    const { makeExecutableSchema } = await import('@graphql-tools/schema');
    schema = makeExecutableSchema({
      typeDefs: authOnlyTypeDefs,
      resolvers: sqliteAuthResolvers
    });
    console.log('🔐 Auth-only SQLite schema ready (Neo4j disabled)'); // eslint-disable-line no-console
  }

  const wsServer = new WebSocketServer({
    server,
    path: '/graphql',
  });

  const serverCleanup = useServer({ schema }, wsServer);

  const apolloServer = new ApolloServer({
    schema,
    plugins: [
      ApolloServerPluginDrainHttpServer({ httpServer: server }),
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

  await apolloServer.start();

  app.use(
    '/graphql',
    cors<cors.CorsRequest>(),
    express.json(),
    expressMiddleware(apolloServer, {
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
        graphql: { status: string; port: number; protocol: string };
        neo4j: { status: string; uri: string; error?: string };
        mcp: { status: string; port: number; capabilities: string[]; version?: string; uptime?: number; lastAccessed?: string; error?: string };
      };
    } = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        graphql: {
          status: 'healthy',
          port: serverPort,
          protocol: protocol
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

  // Live system configuration endpoint
  app.get('/config', cors<cors.CorsRequest>(), async (_req, res) => {
    const config = {
      timestamp: new Date().toISOString(),
      services: {
        api: {
          port: serverPort,
          protocol: protocol,
          host: 'localhost',
          path: '/graphql',
          healthPath: '/health'
        },
        web: {
          port: Number(process.env.WEB_PORT) || 3127,
          protocol: 'http',
          host: 'localhost',
          path: '/'
        },
        neo4j: {
          uri: NEO4J_URI,
          port: 7687,
          protocol: 'bolt',
          host: 'localhost'
        },
        mcp: {
          port: Number(process.env.MCP_HEALTH_PORT) || 3128,
          protocol: 'http',
          host: 'localhost',
          path: '/health'
        },
        proxy: {
          enabled: !!process.env.NGINX_ENABLED || false,
          httpsPort: Number(process.env.NGINX_HTTPS_PORT) || 8443,
          httpPort: Number(process.env.NGINX_HTTP_PORT) || 8080,
          protocol: 'https',
          host: 'localhost',
          certPath: tlsConfig?.certPath || null,
          keyPath: tlsConfig?.keyPath || null
        }
      },
      tls: {
        enabled: !!tlsConfig,
        certPath: tlsConfig?.certPath || null,
        keyPath: tlsConfig?.keyPath || null,
        httpsPort: tlsConfig ? Number(process.env.HTTPS_PORT) || 4128 : null
      },
      environment: {
        nodeEnv: process.env.NODE_ENV || 'development',
        clientUrl: process.env.CLIENT_URL || `http://localhost:${Number(process.env.WEB_PORT) || 3127}`,
        corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3127'
      }
    };

    res.json(config);
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

  server.listen(serverPort, '0.0.0.0', () => {
    // eslint-disable-next-line no-console
    console.log(`🚀 GraphQL server ready at ${protocol}://localhost:${serverPort}/graphql`); // eslint-disable-line no-console
    // eslint-disable-next-line no-console
    console.log(`🔌 WebSocket server ready at ${wsProtocol}://localhost:${serverPort}/graphql`); // eslint-disable-line no-console
    if (tlsConfig) {
      // eslint-disable-next-line no-console
      console.log(`🔒 HTTPS/TLS encryption enabled`); // eslint-disable-line no-console
    }
  });
}

startServer().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Failed to start server:', error); // eslint-disable-line no-console
  process.exit(1);
});