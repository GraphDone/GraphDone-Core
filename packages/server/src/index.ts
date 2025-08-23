import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { useServer } from 'graphql-ws/lib/use/ws';
import cors from 'cors';
import dotenv from 'dotenv';
import neo4j from 'neo4j-driver';
import { Neo4jGraphQL } from '@neo4j/graphql';
import fetch from 'node-fetch';

import { typeDefs } from './schema/neo4j-schema.js';

dotenv.config();

const PORT = Number(process.env.PORT) || 4127;
const NEO4J_URI = process.env.NEO4J_URI || 'bolt://localhost:7687';
const NEO4J_USER = process.env.NEO4J_USER || 'neo4j';
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD || 'password';

async function startServer() {
  const app = express();
  const httpServer = createServer(app);

  // Create Neo4j driver
  const driver = neo4j.driver(NEO4J_URI, neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD));

  // Create Neo4jGraphQL instance
  const neoSchema = new Neo4jGraphQL({
    typeDefs,
    driver,
  });

  const schema = await neoSchema.getSchema();

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
      context: async () => {
        return {
          driver,
        };
      },
    })
  );

  // Enhanced health check endpoint that checks all services
  app.get('/health', async (_req, res) => {
    const health: any = {
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
      (health.services.neo4j as any).error = error instanceof Error ? error.message : 'Connection failed';
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
        const mcpHealth: any = await response.json();
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
      (health.services.mcp as any).error = error instanceof Error ? error.message : 'Connection failed';
      // Don't mark overall health as degraded if MCP is just offline
    }

    res.json(health);
  });

  // MCP-specific status endpoint
  app.get('/mcp/status', async (_req, res) => {
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
        const mcpStatus: any = await response.json();
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
    console.log(`🚀 GraphQL server ready at http://localhost:${PORT}/graphql`);
    console.log(`🔌 WebSocket server ready at ws://localhost:${PORT}/graphql`);
  });
}

startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});