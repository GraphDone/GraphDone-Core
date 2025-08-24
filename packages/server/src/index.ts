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

import { typeDefs } from './schema/neo4j-schema.js';
import { authTypeDefs } from './schema/auth-schema.js';
import { authResolvers } from './resolvers/auth.js';
import { extractUserFromToken } from './middleware/auth.js';
import { mergeTypeDefs } from '@graphql-tools/merge';
import { driver } from './db.js';
// import { configurePassport } from './config/passport.js';
// import { authRoutes } from './routes/auth.js';

dotenv.config();

const PORT = Number(process.env.PORT) || 4127;

async function startServer() {
  const app = express();
  const httpServer = createServer(app);

  // OAuth configuration disabled
  // configurePassport();
  // app.use(session(...));
  // app.use(passport.initialize());
  // app.use(passport.session());
  // app.use('/auth', authRoutes);

  // Merge type definitions
  const mergedTypeDefs = mergeTypeDefs([typeDefs, authTypeDefs]);

  // Create Neo4jGraphQL instance
  const neoSchema = new Neo4jGraphQL({
    typeDefs: mergedTypeDefs,
    driver,
    resolvers: authResolvers,
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
      context: async ({ req }) => {
        const user = extractUserFromToken(req.headers.authorization);
        return {
          driver,
          user,
        };
      },
    })
  );

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
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