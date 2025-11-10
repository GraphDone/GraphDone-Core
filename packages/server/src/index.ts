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
import os from 'os';
import session from 'express-session';
import passport from 'passport';
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
import { configureOAuthStrategies } from './auth/oauth-strategies.js';
import { generateToken } from './utils/auth.js';
import { createTlsConfig, validateTlsConfig, type TlsConfig } from './config/tls.js';
import { emailService } from './auth/email-service.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import rateLimit from 'express-rate-limit';
import { createCaptchaChallenge, verifyCaptcha } from './utils/captcha.js';

const execAsync = promisify(exec);

// Function to calculate total GraphDone memory usage
async function getTotalGraphDoneMemory(): Promise<{ memory: number, label: string }> {
  const nodeMemoryMB = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);

  // If running inside Docker container, we can't get total system memory
  // So we'll just show the API container memory with a different label
  const isDocker = process.env.NODE_ENV === 'production' ||
                   fs.existsSync('/.dockerenv') ||
                   process.env.DOCKER_CONTAINER === 'true';

  if (isDocker) {
    // Running inside Docker - just show container memory
    return {
      memory: nodeMemoryMB,
      label: 'API container memory'
    };
  }

  try {
    // Running locally - try to get all Docker container stats
    const { stdout: dockerStats } = await execAsync('docker stats --no-stream --format "{{.Container}}\\t{{.MemUsage}}" 2>/dev/null | grep graphdone || echo ""');

    let totalDockerMB = 0;
    const lines = dockerStats.split('\n').filter(line => line.trim());

    for (const line of lines) {
      // Parse memory like "45.2MiB / 1.944GiB" or "127.4MB / 2GB"
      const match = line.match(/(\d+\.?\d*)\s*(MiB|MB|GiB|GB)/);
      if (match) {
        const value = parseFloat(match[1]);
        const unit = match[2];
        if (unit === 'GiB' || unit === 'GB') {
          totalDockerMB += value * 1024;
        } else {
          totalDockerMB += value;
        }
      }
    }

    if (totalDockerMB > 0) {
      return {
        memory: Math.round(totalDockerMB),
        label: 'Total system memory'
      };
    }

    // No Docker containers found, just show Node memory
    return {
      memory: nodeMemoryMB,
      label: 'Server memory'
    };
  } catch (error) {
    // Fallback to just Node.js memory if Docker stats fail
    return {
      memory: nodeMemoryMB,
      label: 'Server memory'
    };
  }
}

dotenv.config();
// OAuth LinkedIn and GitHub credentials updated

const PORT = Number(process.env.PORT) || 4127;

async function startServer() {
  // Use the start time from ./start command if available, otherwise use current time
  const startTime = process.env.GRAPHDONE_START_TIME ? parseInt(process.env.GRAPHDONE_START_TIME) : Date.now();
  console.log('🚀 GraphDone Server v0.3.1-alpha starting...'); // eslint-disable-line no-console
  if (process.env.GRAPHDONE_START_TIME) {
    console.log(`🕰️ Using ./start command timing: ${process.env.GRAPHDONE_START_TIME}`); // eslint-disable-line no-console
  }
  console.log(`📅 Started at: ${new Date().toISOString()}`); // eslint-disable-line no-console
  console.log(`💻 Platform: ${process.platform} ${process.arch}`); // eslint-disable-line no-console
  console.log(`💥 Node.js: ${process.version}`); // eslint-disable-line no-console
  console.log(`✳️  Memory: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB used`); // eslint-disable-line no-console

  const app = express();
  const steps: string[] = [];

  // Configure TLS if enabled
  let tlsConfig: TlsConfig | null = null;
  try {
    tlsConfig = createTlsConfig();
    if (tlsConfig) {
      validateTlsConfig(tlsConfig);
      console.log('🔐 TLS/SSL configuration loaded successfully'); // eslint-disable-line no-console
      console.log(`🔒 Certificate: ${tlsConfig.cert ? 'Valid' : 'Missing'}, Key: ${tlsConfig.key ? 'Valid' : 'Missing'}`); // eslint-disable-line no-console
      console.log(`🌐 HTTPS Port: ${tlsConfig.port}`); // eslint-disable-line no-console
      steps.push('✅ Loaded TLS/SSL certificates');
    } else {
      console.log('🔓 Running in HTTP mode (no TLS/SSL)'); // eslint-disable-line no-console
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

  app.use(
    session({
      secret: process.env.SESSION_SECRET || 'graphdone-default-secret-change-in-production',
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: !!tlsConfig,
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000,
      },
    })
  );

  app.use(passport.initialize());
  app.use(passport.session());

  if (process.env.GOOGLE_CLIENT_ID || process.env.LINKEDIN_CLIENT_ID || process.env.GITHUB_CLIENT_ID) {
    configureOAuthStrategies();
    console.log('🔐 OAuth strategies configured'); // eslint-disable-line no-console
    console.log(`   LinkedIn: ${process.env.LINKEDIN_CLIENT_ID ? '✅' : '❌'}`); // eslint-disable-line no-console
    console.log(`   GitHub: ${process.env.GITHUB_CLIENT_ID ? '✅' : '❌'}`); // eslint-disable-line no-console
    console.log(`   Google: ${process.env.GOOGLE_CLIENT_ID ? '✅' : '❌'}`); // eslint-disable-line no-console
  } else {
    console.log('ℹ️  OAuth disabled (no client IDs configured)'); // eslint-disable-line no-console
  }

  // Initialize SQLite auth system first (for users and config)
  try {
    const authStart = Date.now();
    await sqliteAuthStore.initialize();
    const authTime = Date.now() - authStart;
    console.log(`🔑 SQLite authentication system initialized (${authTime}ms)`); // eslint-disable-line no-console

    // Check for existing users
    const userCount = await sqliteAuthStore.getUserCount();
    console.log(`👥 Authentication: ${userCount} users in database`); // eslint-disable-line no-console
    steps.push('✅ Initialized SQLite authentication database');
  } catch (error) {
    console.error('❌ Failed to initialize SQLite auth:', (error as Error).message); // eslint-disable-line no-console
    process.exit(1);
  }

  // Platform-aware timeout configuration
  const getTimeoutConfig = () => {
    const platform = process.platform;
    const isLinux = platform === 'linux';
    const isMacOS = platform === 'darwin';
    const isWindows = platform === 'win32';
    const totalMemoryGB = os.totalmem() / (1024 * 1024 * 1024);
    const isLowMemory = totalMemoryGB < 4;
    
    // Log system info for debugging
    console.log(`🖥️  Platform: ${platform}, Memory: ${totalMemoryGB.toFixed(1)}GB`); // eslint-disable-line no-console
    
    if (isWindows) {
      if (isLowMemory) {
        console.log('⚙️  Detected low-memory Windows system - using extended timeouts'); // eslint-disable-line no-console
        return { maxRetries: 50, timeoutMs: 20000 }; // 16.7 minutes for low-memory Windows
      } else {
        console.log('⚙️  Detected Windows system - using Windows-optimized timeouts'); // eslint-disable-line no-console
        return { maxRetries: 40, timeoutMs: 18000 }; // 12 minutes for Windows
      }
    } else if (isLinux && isLowMemory) {
      console.log('⚙️  Detected low-memory Linux system - using extended timeouts'); // eslint-disable-line no-console
      return { maxRetries: 45, timeoutMs: 18000 }; // 13.5 minutes for low-memory Linux
    } else if (isLinux) {
      console.log('⚙️  Detected Linux system - using standard timeouts'); // eslint-disable-line no-console
      return { maxRetries: 35, timeoutMs: 15000 }; // 8.75 minutes for Linux
    } else if (isMacOS) {
      console.log('⚙️  Detected macOS system - using optimized timeouts'); // eslint-disable-line no-console
      return { maxRetries: 25, timeoutMs: 12000 }; // 5 minutes for macOS
    } else {
      console.log('⚙️  Detected unknown system - using default timeouts'); // eslint-disable-line no-console
      return { maxRetries: 30, timeoutMs: 15000 }; // 7.5 minutes for unknown platforms
    }
  };

  // Smart Neo4j connection with timeout and retry logic
  let schema;
  let isNeo4jAvailable = false;

  // Neo4j connection function with timeout and retries
  const connectToNeo4jWithTimeout = async (maxRetries = 20, timeoutMs = 10000): Promise<number | false> => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const attemptStart = Date.now();
        const session = driver.session();
        
        // Race between connection and timeout
        const timeoutPromise = new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Connection timeout')), timeoutMs)
        );
        
        await Promise.race([
          session.run('RETURN 1'),
          timeoutPromise
        ]);
        
        await session.close();
        const connectionTime = Date.now() - attemptStart;
        
        console.log(`✅ Neo4j connection successful after ${attempt} attempts (${connectionTime}ms)`); // eslint-disable-line no-console
        return connectionTime;
        
      } catch (error) {
        if (attempt === maxRetries) {
          console.log(`⚠️  Neo4j connection failed after ${maxRetries} attempts`); // eslint-disable-line no-console
          return false;
        }
        
        // Progressive user feedback
        if (attempt === 1) {
          console.log('⏳ Connecting to Neo4j database (this can take 1-5 minutes on first startup)...'); // eslint-disable-line no-console
        } else if (attempt === 5) {
          console.log('⏳ Still waiting for Neo4j (normal for first-time installation)...'); // eslint-disable-line no-console
        } else if (attempt === 10) {
          console.log('⏳ Neo4j taking longer than usual (checking system resources)...'); // eslint-disable-line no-console
        } else if (attempt === 15) {
          console.log('⏳ Almost there - Neo4j initialization nearly complete...'); // eslint-disable-line no-console
        }
        
        // Wait before next attempt with exponential backoff (max 15 seconds)
        const delay = Math.min(3000 + (attempt * 500), 15000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    return false;
  };

  try {
    const neo4jStart = Date.now();
    const timeoutConfig = getTimeoutConfig();
    const connectionTime = await connectToNeo4jWithTimeout(timeoutConfig.maxRetries, timeoutConfig.timeoutMs);
    
    if (connectionTime !== false) {
      const totalTime = Date.now() - neo4jStart;
      isNeo4jAvailable = true;
      console.log(`🗄️  Neo4j URI: ${NEO4J_URI}`); // eslint-disable-line no-console
      console.log(`⚡ Total Neo4j startup time: ${(totalTime / 1000).toFixed(1)}s`); // eslint-disable-line no-console
      steps.push('✅ Connected to Neo4j graph database');
    } else {
      throw new Error('Neo4j connection timeout - falling back to auth-only mode');
    }

    // Create default admin user for testing if none exists
    try {
      await execAsync('npm run create-admin', { cwd: process.cwd() });
    } catch (error) {
      // Admin creation is optional - may already exist
      console.log('ℹ️  Default admin setup completed'); // eslint-disable-line no-console
    }

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

    // Count schema statistics
    const schemaTypeMap = schema.getTypeMap();
    const schemaTypes = Object.keys(schemaTypeMap).filter(name => !name.startsWith('_'));
    const queryFields = schemaTypeMap.Query ? Object.keys((schemaTypeMap.Query as any).getFields()) : [];
    const mutationFields = schemaTypeMap.Mutation ? Object.keys((schemaTypeMap.Mutation as any).getFields()) : [];

    console.log('🔗 Full Neo4j + SQLite auth schema ready'); // eslint-disable-line no-console
    console.log(`📊 Schema: ${schemaTypes.length} types, ${queryFields.length} queries, ${mutationFields.length} mutations`); // eslint-disable-line no-console
    steps.push('✅ Merged GraphQL schemas (Neo4j + auth)');

  } catch (error) {
    const errorMessage = (error as Error).message;
    isNeo4jAvailable = false;
    
    // Enhanced graceful degradation messaging
    console.log(''); // eslint-disable-line no-console
    console.log('⚠️  Neo4j connection failed - entering auth-only mode'); // eslint-disable-line no-console
    console.log(`📋 Reason: ${errorMessage}`); // eslint-disable-line no-console
    console.log(''); // eslint-disable-line no-console
    console.log('🔐 Available features in auth-only mode:'); // eslint-disable-line no-console
    console.log('   • User authentication and registration'); // eslint-disable-line no-console
    console.log('   • User profile management'); // eslint-disable-line no-console
    console.log('   • Team and role management'); // eslint-disable-line no-console
    console.log('   • GraphQL API (auth endpoints only)'); // eslint-disable-line no-console
    console.log(''); // eslint-disable-line no-console
    console.log('📊 Disabled features (will be available once Neo4j connects):'); // eslint-disable-line no-console
    console.log('   • Work item creation and management'); // eslint-disable-line no-console
    console.log('   • Dependency graph visualization'); // eslint-disable-line no-console
    console.log('   • Project analytics and reporting'); // eslint-disable-line no-console
    console.log(''); // eslint-disable-line no-console
    
    // Create auth-only schema using just SQLite resolvers and complete auth schema
    const { makeExecutableSchema } = await import('@graphql-tools/schema');
    schema = makeExecutableSchema({
      typeDefs: authOnlyTypeDefs,
      resolvers: sqliteAuthResolvers
    });
    console.log('✅ Auth-only SQLite schema ready'); // eslint-disable-line no-console
    steps.push('✅ Started in auth-only mode (Neo4j unavailable)');
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
          req,
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

  // Rate limiting configuration for authentication endpoints
  const authRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Max 5 requests per 15 minutes per IP
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false,
    handler: (req, res) => {
      const retryAfter = Math.ceil((req.rateLimit.resetTime?.getTime() || Date.now()) / 1000 - Date.now() / 1000);
      console.log(`⚠️  Rate limit exceeded for IP: ${req.ip}`); // eslint-disable-line no-console
      res.status(429).json({
        error: 'Too many requests',
        message: `You've exceeded the maximum number of authentication requests. Please try again in ${Math.ceil(retryAfter / 60)} minutes.`,
        retryAfter,
        rateLimitExceeded: true
      });
    }
  });

  const strictAuthRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 3, // Max 3 requests per 15 minutes per IP
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false,
    handler: (req, res) => {
      const retryAfter = Math.ceil((req.rateLimit.resetTime?.getTime() || Date.now()) / 1000 - Date.now() / 1000);
      console.log(`⚠️  Strict rate limit exceeded for IP: ${req.ip}`); // eslint-disable-line no-console
      res.status(429).json({
        error: 'Too many requests',
        message: `Too many authentication attempts. Please wait ${Math.ceil(retryAfter / 60)} minutes before trying again.`,
        retryAfter,
        rateLimitExceeded: true
      });
    }
  });

  app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

  app.get(
    '/auth/google/callback',
    passport.authenticate('google', { failureRedirect: `${process.env.CLIENT_URL || 'http://localhost:3127'}/login?error=google` }),
    (req, res) => {
      console.log('🔐 Google OAuth callback received'); // eslint-disable-line no-console
      const user = req.user as any;
      console.log('👤 User from OAuth:', user?.email || 'No user'); // eslint-disable-line no-console
      const token = generateToken(user.id, user.email, user.role);
      console.log('🎫 Generated token:', token?.substring(0, 20) + '...'); // eslint-disable-line no-console
      const clientUrl = process.env.CLIENT_URL || 'http://localhost:3127';
      const redirectUrl = `${clientUrl}/login?token=${token}`;
      console.log('↪️  Redirecting to:', redirectUrl); // eslint-disable-line no-console
      res.redirect(redirectUrl);
    }
  );

  app.get('/auth/linkedin', passport.authenticate('linkedin', { scope: ['openid', 'profile', 'email'] }));

  app.get(
    '/auth/linkedin/callback',
    passport.authenticate('linkedin', { failureRedirect: `${process.env.CLIENT_URL || 'http://localhost:3127'}/login?error=linkedin` }),
    (req, res) => {
      console.log('🔐 LinkedIn OAuth callback received'); // eslint-disable-line no-console
      const user = req.user as any;
      console.log('👤 User from OAuth:', user?.email || 'No user'); // eslint-disable-line no-console
      const token = generateToken(user.id, user.email, user.role);
      console.log('🎫 Generated token:', token?.substring(0, 20) + '...'); // eslint-disable-line no-console
      const clientUrl = process.env.CLIENT_URL || 'http://localhost:3127';
      const redirectUrl = `${clientUrl}/login?token=${token}`;
      console.log('↪️  Redirecting to:', redirectUrl); // eslint-disable-line no-console
      res.redirect(redirectUrl);
    }
  );

  app.get('/auth/github', passport.authenticate('github', { scope: ['user:email'] }));

  app.get(
    '/auth/github/callback',
    passport.authenticate('github', { failureRedirect: `${process.env.CLIENT_URL || 'http://localhost:3127'}/login?error=github` }),
    (req, res) => {
      console.log('🔐 GitHub OAuth callback received'); // eslint-disable-line no-console
      const user = req.user as any;
      console.log('👤 User from OAuth:', user?.email || 'No user'); // eslint-disable-line no-console
      const token = generateToken(user.id, user.email, user.role);
      console.log('🎫 Generated token:', token?.substring(0, 20) + '...'); // eslint-disable-line no-console
      const clientUrl = process.env.CLIENT_URL || 'http://localhost:3127';
      const redirectUrl = `${clientUrl}/login?token=${token}`;
      console.log('↪️  Redirecting to:', redirectUrl); // eslint-disable-line no-console
      res.redirect(redirectUrl);
    }
  );

  const magicLinkCorsOptions = {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3127',
    credentials: true,
    methods: ['POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  };

  app.options('/auth/magic-link/request', cors<cors.CorsRequest>(magicLinkCorsOptions));

  app.post('/auth/magic-link/request', authRateLimiter, cors<cors.CorsRequest>(magicLinkCorsOptions), express.json(), async (req, res) => {
    try {
      const { email, captchaPayload } = req.body;

      if (!email || typeof email !== 'string') {
        return res.status(400).json({ error: 'Email is required' });
      }

      // Verify CAPTCHA
      const isCaptchaValid = await verifyCaptcha(captchaPayload);
      if (!isCaptchaValid) {
        return res.status(400).json({ error: 'CAPTCHA verification failed' });
      }

      const user = await sqliteAuthStore.findUserByEmailOrUsername(email);

      if (user) {
        const magicLink = await sqliteAuthStore.createMagicLink(email);
        await emailService.sendMagicLink(email, magicLink.token);
        console.log(`✉️  Magic link sent to: ${email}`); // eslint-disable-line no-console
      } else {
        console.log(`⚠️  Magic link requested for non-existent user: ${email}`); // eslint-disable-line no-console
      }

      return res.json({
        success: true,
        userExists: !!user,
        message: user
          ? 'Magic link sent! Check your email.'
          : 'This email is not registered in our system.',
        expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString()
      });
    } catch (error) {
      console.error('❌ Magic link request failed:', error); // eslint-disable-line no-console
      return res.status(500).json({ error: 'Failed to send magic link' });
    }
  });

  app.get('/auth/magic-link/verify', async (req, res) => {
    try {
      const { token } = req.query;

      if (!token || typeof token !== 'string') {
        return res.redirect(`${process.env.CLIENT_URL || 'http://localhost:3127'}/login?error=invalid_magic_link`);
      }

      const result = await sqliteAuthStore.verifyMagicLink(token);

      if (!result.valid || !result.userId) {
        return res.redirect(`${process.env.CLIENT_URL || 'http://localhost:3127'}/login?error=expired_magic_link`);
      }

      const jwtToken = generateToken(result.userId, result.email!, 'USER');
      const clientUrl = process.env.CLIENT_URL || 'http://localhost:3127';
      const redirectUrl = `${clientUrl}/login?token=${jwtToken}`;

      console.log(`🔐 Magic link verified for: ${result.email}`); // eslint-disable-line no-console
      res.redirect(redirectUrl);
    } catch (error) {
      console.error('❌ Magic link verification failed:', error); // eslint-disable-line no-console
      res.redirect(`${process.env.CLIENT_URL || 'http://localhost:3127'}/login?error=magic_link_failed`);
    }
  });

  const forgotPasswordCorsOptions = {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3127',
    credentials: true,
    methods: ['POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  };

  app.options('/auth/forgot-password', cors<cors.CorsRequest>(forgotPasswordCorsOptions));

  app.post('/auth/forgot-password', strictAuthRateLimiter, cors<cors.CorsRequest>(forgotPasswordCorsOptions), express.json(), async (req, res) => {
    try {
      const { email, captchaPayload } = req.body;

      if (!email || typeof email !== 'string') {
        return res.status(400).json({ error: 'Email is required' });
      }

      // Verify CAPTCHA
      const isCaptchaValid = await verifyCaptcha(captchaPayload);
      if (!isCaptchaValid) {
        return res.status(400).json({ error: 'CAPTCHA verification failed' });
      }

      // Check if user exists
      const user = await sqliteAuthStore.findUserByEmailOrUsername(email);

      if (user) {
        // User exists - create reset link and send email
        const resetLink = await sqliteAuthStore.createMagicLink(email);
        await emailService.sendPasswordReset(email, resetLink.token);
        console.log(`🔐 Password reset link sent to: ${email}`); // eslint-disable-line no-console
      } else {
        // User doesn't exist - don't send email
        console.log(`⚠️  Password reset requested for non-existent user: ${email}`); // eslint-disable-line no-console
      }

      // Return response with userExists flag for different UI messages
      return res.json({
        success: true,
        userExists: !!user,
        message: user
          ? 'Password reset link sent! Check your email.'
          : 'This email is not registered in our system.',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString()
      });
    } catch (error) {
      console.error('❌ Password reset request failed:', error); // eslint-disable-line no-console
      return res.status(500).json({ error: 'Failed to send reset link' });
    }
  });

  app.get('/auth/reset-password', async (req, res) => {
    try {
      const { token } = req.query;

      if (!token || typeof token !== 'string') {
        return res.redirect(`${process.env.CLIENT_URL || 'http://localhost:3127'}/login?error=invalid_reset_link`);
      }

      const clientUrl = process.env.CLIENT_URL || 'http://localhost:3127';
      const redirectUrl = `${clientUrl}/reset-password?token=${token}`;

      console.log(`🔐 Password reset link accessed`); // eslint-disable-line no-console
      res.redirect(redirectUrl);
    } catch (error) {
      console.error('❌ Password reset verification failed:', error); // eslint-disable-line no-console
      res.redirect(`${process.env.CLIENT_URL || 'http://localhost:3127'}/login?error=reset_failed`);
    }
  });

  const resetPasswordCorsOptions = {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3127',
    credentials: true,
    methods: ['POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  };

  app.options('/auth/reset-password', cors<cors.CorsRequest>(resetPasswordCorsOptions));

  app.post('/auth/reset-password', cors<cors.CorsRequest>(resetPasswordCorsOptions), express.json(), async (req, res) => {
    try {
      const { token, newPassword, captchaPayload } = req.body;

      if (!token || typeof token !== 'string') {
        return res.status(400).json({ error: 'Reset token is required' });
      }

      if (!newPassword || typeof newPassword !== 'string') {
        return res.status(400).json({ error: 'New password is required' });
      }

      if (newPassword.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters' });
      }

      // Verify CAPTCHA
      const isCaptchaValid = await verifyCaptcha(captchaPayload);
      if (!isCaptchaValid) {
        return res.status(400).json({ error: 'CAPTCHA verification failed' });
      }

      const result = await sqliteAuthStore.verifyMagicLink(token);

      if (!result.valid || !result.userId) {
        return res.status(400).json({ error: 'Invalid or expired reset token' });
      }

      await sqliteAuthStore.updateUserPassword(result.userId, newPassword);

      console.log(`🔐 Password updated successfully for: ${result.email}`); // eslint-disable-line no-console

      return res.json({
        success: true,
        message: 'Password updated successfully'
      });
    } catch (error) {
      console.error('❌ Password update failed:', error); // eslint-disable-line no-console
      return res.status(500).json({ error: 'Failed to update password' });
    }
  });

  app.post('/share/create', cors<cors.CorsRequest>(), express.json(), async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      const user = extractUserFromToken(authHeader);

      if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { graphId, accessLevel, expiresAt, maxUses, requiresSignIn } = req.body;

      if (!graphId) {
        return res.status(400).json({ error: 'Graph ID is required' });
      }

      const shareableLink = await sqliteAuthStore.createShareableLink({
        graphId,
        createdBy: user.userId,
        accessLevel: accessLevel || 'VIEW',
        expiresAt,
        maxUses,
        requiresSignIn: requiresSignIn || false
      });

      const shareUrl = `${process.env.CLIENT_URL || 'http://localhost:3127'}/share/${shareableLink.token}`;

      console.log(`🔗 Shareable link created for graph ${graphId}`); // eslint-disable-line no-console

      return res.json({
        success: true,
        shareUrl,
        token: shareableLink.token,
        accessLevel: accessLevel || 'VIEW'
      });
    } catch (error) {
      console.error('❌ Failed to create shareable link:', error); // eslint-disable-line no-console
      return res.status(500).json({ error: 'Failed to create shareable link' });
    }
  });

  app.get('/share/verify/:token', cors<cors.CorsRequest>(), async (req, res) => {
    try {
      const { token } = req.params;
      const result = await sqliteAuthStore.verifyShareableLink(token);

      if (!result.valid) {
        return res.status(404).json({ error: 'Link not found or expired' });
      }

      return res.json({
        valid: true,
        graphId: result.graphId,
        accessLevel: result.accessLevel,
        requiresSignIn: result.requiresSignIn
      });
    } catch (error) {
      console.error('❌ Failed to verify shareable link:', error); // eslint-disable-line no-console
      return res.status(500).json({ error: 'Failed to verify link' });
    }
  });

  const captchaCorsOptions = {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3127',
    credentials: true,
    methods: ['GET', 'OPTIONS'],
    allowedHeaders: ['Content-Type']
  };

  app.options('/api/captcha/challenge', cors<cors.CorsRequest>(captchaCorsOptions));

  app.get('/api/captcha/challenge', cors<cors.CorsRequest>(captchaCorsOptions), async (_req, res) => {
    try {
      const challenge = await createCaptchaChallenge();
      res.json(challenge);
    } catch (error) {
      console.error('❌ CAPTCHA challenge creation failed:', error); // eslint-disable-line no-console
      res.status(500).json({ error: 'Failed to create CAPTCHA challenge' });
    }
  });

  server.listen(serverPort, '0.0.0.0', async () => {
    const totalTime = Date.now() - startTime;
    const memoryInfo = await getTotalGraphDoneMemory();

    // Add final server startup steps
    if (tlsConfig) {
      steps.push(`✅ Started HTTPS server on port ${serverPort}`);
      steps.push('✅ Started secure WebSocket server');
      steps.push('✅ Enabled full TLS encryption');
    } else {
      steps.push(`✅ Started HTTP server on port ${serverPort}`);
      steps.push('✅ Started WebSocket server');
    }

    // Print the clean checklist summary
    console.log(''); // eslint-disable-line no-console
    console.log('========================================'); // eslint-disable-line no-console
    console.log('         GraphDone Server Ready!       '); // eslint-disable-line no-console
    console.log('========================================'); // eslint-disable-line no-console
    console.log(''); // eslint-disable-line no-console
    steps.forEach((step, index) => {
      console.log(`  ${index + 1}. ${step}`); // eslint-disable-line no-console
    });
    console.log(''); // eslint-disable-line no-console
    console.log('  🌐 The application is now ready to use at:'); // eslint-disable-line no-console
    if (tlsConfig) {
      console.log('  🖥️  Web App: https://localhost:3128'); // eslint-disable-line no-console
      console.log('  🔗 GraphQL API: https://localhost:4128/graphql'); // eslint-disable-line no-console
    } else {
      console.log('  🖥️  Web App: http://localhost:3127'); // eslint-disable-line no-console
      console.log('  🔗 GraphQL API: http://localhost:4127/graphql'); // eslint-disable-line no-console
    }
    console.log(''); // eslint-disable-line no-console
    const timingLabel = process.env.GRAPHDONE_START_TIME ? 'Total startup time' : 'Server startup time';
    console.log(`  🧩 ${timingLabel}: ${(totalTime / 1000).toFixed(3)} seconds`); // eslint-disable-line no-console
    console.log(`  🧬 ${memoryInfo.label}: ${memoryInfo.memory} MB`); // eslint-disable-line no-console
    // More nuanced Neo4j status - check if it might still be starting up
    const neo4jStatusMessage = isNeo4jAvailable 
      ? '🟢 Connected' 
      : (Date.now() - startTime < 60000 ? '⏳ Starting...' : '🔴 Offline');
    console.log(`  🌐 Neo4j status: ${neo4jStatusMessage}`); // eslint-disable-line no-console
    console.log('========================================'); // eslint-disable-line no-console
    console.log(''); // eslint-disable-line no-console
    
    // Start background Neo4j reconnection if initially unavailable
    if (!isNeo4jAvailable) {
      console.log('🔄 Starting background Neo4j reconnection monitor...'); // eslint-disable-line no-console
      
      const backgroundReconnect = async () => {
        try {
          const session = driver.session();
          await session.run('RETURN 1');
          await session.close();
          
          console.log(''); // eslint-disable-line no-console
          console.log('🎉 ========================================'); // eslint-disable-line no-console
          console.log('🎉    Neo4j Connected! Full Features Enabled!'); // eslint-disable-line no-console
          console.log('🎉 ========================================'); // eslint-disable-line no-console
          console.log(''); // eslint-disable-line no-console
          console.log('📊 Graph features now available:'); // eslint-disable-line no-console
          console.log('   • Work item creation and management'); // eslint-disable-line no-console
          console.log('   • Dependency graph visualization'); // eslint-disable-line no-console
          console.log('   • Project analytics and reporting'); // eslint-disable-line no-console
          console.log(''); // eslint-disable-line no-console
          console.log('🔄 Please restart the server to enable full GraphQL schema'); // eslint-disable-line no-console
          console.log('   Run: ./start stop && ./start'); // eslint-disable-line no-console
          console.log(''); // eslint-disable-line no-console
          
          // Stop the reconnection attempts
          return true;
        } catch {
          // Still not available, keep trying
          return false;
        }
      };
      
      // Check every 30 seconds for Neo4j availability
      const reconnectInterval = setInterval(async () => {
        const connected = await backgroundReconnect();
        if (connected) {
          clearInterval(reconnectInterval);
        }
      }, 30000);
      
      console.log('⏰ Will check for Neo4j every 30 seconds...'); // eslint-disable-line no-console
    }
  });
}

startServer().catch((error) => {
  console.error('Failed to start server:', error); // eslint-disable-line no-console
  process.exit(1);
});