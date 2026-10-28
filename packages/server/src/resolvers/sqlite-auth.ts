import { GraphQLError } from 'graphql';
import { sqliteAuthStore } from '../auth/sqlite-auth.js';
import { generateToken } from '../utils/auth.js';
import { verifyAuthCaptcha } from '../utils/captcha.js';
import { randomUUID } from 'node:crypto';
import { folderActor, folderCreationOwner, folderResponse, requireFolderAccess, requireFolderDeletion, requireFolderParent, requireGraphAccess, visibleFolderGraphs } from '../auth/folder-access.js';
import { passwordLoginLimiter, PasswordLoginLimitError } from '../auth/password-login-limiter.js';

interface LoginInput {
  emailOrUsername: string;
  password: string;
  captchaPayload?: string;
}

interface LoginContext {
  req?: {
    ip?: string;
    socket?: { remoteAddress?: string };
    connection?: { remoteAddress?: string };
  };
}

interface SignupInput {
  email: string;
  username: string;
  password: string;
  name: string;
  teamId?: string;
  captchaPayload?: string;
}

interface UpdateProfileInput {
  name?: string;
  avatar?: string;
  metadata?: string;
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const signupRateLimits = new Map<string, RateLimitEntry>();

function checkSignupRateLimit(ip: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const windowMs = 15 * 60 * 1000;
  const maxAttempts = 5;

  const entry = signupRateLimits.get(ip);

  if (!entry || now > entry.resetTime) {
    signupRateLimits.set(ip, { count: 1, resetTime: now + windowMs });
    return { allowed: true };
  }

  if (entry.count >= maxAttempts) {
    const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
    return { allowed: false, retryAfter };
  }

  entry.count++;
  return { allowed: true };
}

setInterval(() => {
  const now = Date.now();
  const entries = Array.from(signupRateLimits.entries());
  for (const [ip, entry] of entries) {
    if (now > entry.resetTime) {
      signupRateLimits.delete(ip);
    }
  }
}, 5 * 60 * 1000);

// SQLite-only auth resolvers that don't depend on Neo4j
export const sqliteAuthResolvers = {
  Query: {
    // Get current user from JWT token
    me: async (_: any, __: any, context: any) => {
      if (!context.user) {
        return null;
      }

      try {
        const user = await sqliteAuthStore.findUserById(context.user.userId);
        if (!user) {
          return null;
        }

        return {
          ...user,
          passwordHash: undefined // Never expose password hash
        };
      } catch (error: any) {
        console.log('⚠️  SQLite user lookup failed:', error.message);
        return null;
      }
    },

    // Get all users (admin only) 
    users: async (_: any, __: any, context: any) => {
      if (!context.user || context.user.role !== 'ADMIN') {
        throw new GraphQLError('Unauthorized', {
          extensions: { code: 'FORBIDDEN' }
        });
      }

      try {
        const users = await sqliteAuthStore.getAllUsers();
        return users.map(user => ({
          ...user,
          passwordHash: undefined
        }));
      } catch (error: any) {
        console.error('Error fetching users:', error);
        throw new GraphQLError('Failed to fetch users');
      }
    },

    // Check if email/username is available
    checkAvailability: async (_: any, { email, username }: { email?: string; username?: string }) => {
      try {
        if (email) {
          const existingUser = await sqliteAuthStore.findUserByEmailOrUsername(email);
          if (existingUser) {
            return { success: false, message: 'Email already taken' };
          }
        }

        if (username) {
          const existingUser = await sqliteAuthStore.findUserByEmailOrUsername(username);
          if (existingUser) {
            return { success: false, message: 'Username already taken' };
          }
        }

        return { success: true, message: 'Available' };
      } catch (error: any) {
        console.error('Error checking availability:', error);
        return { success: false, message: 'Error checking availability' };
      }
    },

    // Get development mode info and default credentials
    developmentInfo: async () => {
      const isDevelopment = ['development', 'test'].includes(process.env.NODE_ENV || '');
      
      return {
        isDevelopment,
        hasDefaultCredentials: isDevelopment,
        defaultAccounts: isDevelopment ? [
          {
            username: 'admin',
            password: 'graphdone',
            role: 'ADMIN',
            description: 'Full system administrator access'
          },
          {
            username: 'viewer',
            password: 'viewer123',
            role: 'VIEWER',
            description: 'Read-only access to all content'
          }
        ] : []
      };
    },

    // Get public system settings
    systemSettings: async () => {
      try {
        const allowAnonymousGuest = await sqliteAuthStore.getServerConfig('allowAnonymousGuest') ?? true;
        return {
          allowAnonymousGuest
        };
      } catch (error) {
        // Default settings if config lookup fails
        return {
          allowAnonymousGuest: true
        };
      }
    },

    // FOLDER MANAGEMENT QUERIES
    
    // Get user's folder structure
    folders: async (_: any, __: any, context: any) => {
      const actor = await folderActor(context);

      try {
        // Ensure user has personal folders
        if (['USER', 'ADMIN'].includes(actor.role)) await sqliteAuthStore.createUserPersonalFolders(actor.userId, actor.teamId);
        
        const folders = (await sqliteAuthStore.getUserFolders(actor.userId)).filter(folder => actor.role !== 'GUEST' || folder.type === 'system');
        
        // Build hierarchical structure
        const folderMap = new Map();
        const rootFolders: any[] = [];

        // First pass: create folder objects
        folders.forEach(folder => {
          folderMap.set(folder.id, {
            ...folderResponse(folder),
            children: [],
            graphs: []
          });
        });

        // Second pass: build hierarchy
        folders.forEach(folder => {
          const folderObj = folderMap.get(folder.id);
          if (folder.parentId) {
            const parent = folderMap.get(folder.parentId);
            if (parent) {
              parent.children.push(folderObj);
            }
          } else {
            rootFolders.push(folderObj);
          }
        });

        // Third pass: get graphs for each folder
        for (const folder of folders) {
          const graphs = await visibleFolderGraphs(folder.id, context, actor);
          const folderObj = folderMap.get(folder.id);
          if (folderObj) {
            folderObj.graphs = graphs;
          }
        }

        return rootFolders;
      } catch (error: any) {
        console.error('❌ Get folders error:', error);
        throw new GraphQLError('Failed to get folders');
      }
    },

    // Get specific folder by ID
    folder: async (_: any, { id }: { id: string }, context: any) => {
      const actor = await folderActor(context);
      if (!await sqliteAuthStore.findFolderById(id)) return null;
      const folder = await requireFolderAccess(id, actor);

      try {
        const graphs = await visibleFolderGraphs(folder.id, context, actor);
        
        return {
          ...folderResponse(folder),
          children: [],
          graphs
        };
      } catch (error: any) {
        console.error('❌ Get folder error:', error);
        throw new GraphQLError('Failed to get folder');
      }
    },

    // Get graphs in a specific folder
    folderGraphs: async (_: any, { folderId }: { folderId: string }, context: any) => {
      const actor = await folderActor(context);
      await requireFolderAccess(folderId, actor);

      try {
        return await visibleFolderGraphs(folderId, context, actor);
      } catch (error: any) {
        console.error('❌ Get folder graphs error:', error);
        throw new GraphQLError('Failed to get folder graphs');
      }
    },

    // Get all OAuth provider configurations (Admin only)
    oauthProviderConfigs: async (_: any, __: any, context: any) => {
      if (!context.user || context.user.role !== 'ADMIN') {
        throw new GraphQLError('Unauthorized', {
          extensions: { code: 'FORBIDDEN' }
        });
      }

      try {
        const configs = await sqliteAuthStore.getAllOAuthProviderConfigs();
        return configs.map((config: any) => ({
          ...config,
          enabled: Boolean(config.enabled),
          configured: Boolean(config.clientId && config.clientSecret)
        }));
      } catch (error: any) {
        console.error('❌ Get OAuth provider configs error:', error);
        throw new GraphQLError('Failed to get OAuth provider configurations');
      }
    },

    // Get specific OAuth provider configuration (Admin only)
    oauthProviderConfig: async (_: any, { provider }: { provider: string }, context: any) => {
      if (!context.user || context.user.role !== 'ADMIN') {
        throw new GraphQLError('Unauthorized', {
          extensions: { code: 'FORBIDDEN' }
        });
      }

      try {
        const config = await sqliteAuthStore.getOAuthProviderConfig(provider as any);
        if (!config) {
          return null;
        }
        return {
          ...config,
          enabled: Boolean(config.enabled),
          configured: Boolean(config.clientId && config.clientSecret)
        };
      } catch (error: any) {
        console.error('❌ Get OAuth provider config error:', error);
        throw new GraphQLError('Failed to get OAuth provider configuration');
      }
    }
  },

  Mutation: {
    // Login mutation - SQLite only
    login: async (_: any, { input }: { input: LoginInput }, context: LoginContext = {}) => {
      console.log(`🔐 Login attempt for: ${input.emailOrUsername}`);
      let ipAttempt: ReturnType<typeof passwordLoginLimiter.reserveIp> | undefined;
      let accountAttempt: ReturnType<typeof passwordLoginLimiter.reserveAccount> | undefined;
      let outcome: 'success' | 'failure' | 'cancel' = 'cancel';

      try {
        const ip = context?.req?.ip || context?.req?.socket?.remoteAddress || context?.req?.connection?.remoteAddress || 'unknown';
        ipAttempt = passwordLoginLimiter.reserveIp(ip);
        const identifier = input.emailOrUsername.trim().toLowerCase();
        const user = await sqliteAuthStore.findUserByEmailOrUsername(identifier);
        accountAttempt = passwordLoginLimiter.reserveAccount(user ? `user:${user.id}` : `identifier:${identifier}`);

        if (!await verifyAuthCaptcha(input.captchaPayload, 'login')) {
          outcome = 'failure';
          throw new GraphQLError('Please complete verification and try again.', {
            extensions: { code: 'CAPTCHA_FAILED' }
          });
        }

        if (!user) {
          outcome = 'failure';
          console.log('❌ User not found:', input.emailOrUsername);
          throw new GraphQLError('Invalid credentials', {
            extensions: { code: 'UNAUTHENTICATED' }
          });
        }

        console.log(`👤 Found user: ${user.username}`);
        
        // Verify password
        const validPassword = await sqliteAuthStore.validatePassword(user, input.password);
        if (!validPassword) {
          outcome = 'failure';
          console.log('❌ Invalid password for user:', user.username);
          throw new GraphQLError('Invalid credentials', {
            extensions: { code: 'UNAUTHENTICATED' }
          });
        }

        // Check if user is active
        if (!user.isActive) {
          outcome = 'failure';
          console.log('❌ User is deactivated:', user.username);
          throw new GraphQLError('Account is deactivated', {
            extensions: { code: 'FORBIDDEN' }
          });
        }

        const token = generateToken(user.id, user.email, user.role, user.authVersion);
        outcome = 'success';
        console.log(`✅ Login successful: ${user.username} (${user.role})`);

        return {
          token,
          user: {
            ...user,
            passwordHash: undefined
          }
        };
      } catch (error) {
        if (error instanceof PasswordLoginLimitError) {
          outcome = 'failure';
          throw new GraphQLError(error.message, {
            extensions: { code: 'RATE_LIMIT_EXCEEDED', retryAfter: error.retryAfter, rateLimitExceeded: true, http: { status: 429 } },
          });
        }
        if (error instanceof GraphQLError) {
          throw error;
        }
        console.error('❌ Login error:', error);
        throw new GraphQLError('Login failed', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' }
        });
      } finally {
        accountAttempt?.finish(outcome);
        ipAttempt?.finish(outcome);
      }
    },

    // Guest login
    guestLogin: async () => {
      const guestUser = {
        id: `guest-${randomUUID()}`,
        email: 'guest@demo.local',
        username: 'guest',
        name: 'Guest User',
        role: 'GUEST',
        isActive: true,
        isEmailVerified: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        team: null
      };

      const token = generateToken(guestUser.id, guestUser.email, guestUser.role, 0);
      
      return {
        token,
        user: guestUser
      };
    },

    // Signup mutation
    signup: async (_: any, { input }: { input: SignupInput }, context: any) => {
      try {
        const clientIp = context.req?.ip || context.req?.connection?.remoteAddress || 'unknown';

        const rateLimit = checkSignupRateLimit(clientIp);
        if (!rateLimit.allowed) {
          throw new GraphQLError('Too many signup attempts. Please try again later.', {
            extensions: {
              code: 'RATE_LIMIT_EXCEEDED',
              retryAfter: rateLimit.retryAfter,
              rateLimitExceeded: true
            }
          });
        }

        if (!await verifyAuthCaptcha(input.captchaPayload, 'signup')) {
          throw new GraphQLError('Please complete verification and try again.', {
            extensions: { code: 'CAPTCHA_FAILED' }
          });
        }

        // Check if user already exists
        const existingUser = await sqliteAuthStore.findUserByEmailOrUsername(input.email) ||
                            await sqliteAuthStore.findUserByEmailOrUsername(input.username);

        if (existingUser) {
          throw new GraphQLError('User already exists with that email or username', {
            extensions: { code: 'BAD_USER_INPUT' }
          });
        }

        // Create new user
        const user = await sqliteAuthStore.createUser({
          email: input.email,
          username: input.username,
          password: input.password,
          name: input.name,
          role: 'USER'
        });

        const token = generateToken(user.id, user.email, user.role, user.authVersion);

        return {
          token,
          user: {
            ...user,
            passwordHash: undefined
          }
        };
      } catch (error) {
        if (error instanceof GraphQLError) {
          throw error;
        }
        console.error('❌ Signup error:', error);
        throw new GraphQLError('Signup failed', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' }
        });
      }
    },

    // Update profile
    updateProfile: async (_: any, { input: _input }: { input: UpdateProfileInput }, context: any) => {
      if (!context.user) {
        throw new GraphQLError('Unauthorized', {
          extensions: { code: 'UNAUTHENTICATED' }
        });
      }

      // For now, return the current user - implement profile updates later
      const user = await sqliteAuthStore.findUserById(context.user.userId);
      if (!user) {
        throw new GraphQLError('User not found');
      }

      return {
        ...user,
        passwordHash: undefined
      };
    },

    // Logout (client-side token removal mostly)
    logout: async () => {
      return { success: true, message: 'Logged out successfully' };
    },

    // Other mutations can be implemented as needed
    refreshToken: async (_: any, __: any, context: any) => {
      if (!context.user) {
        throw new GraphQLError('Unauthorized', {
          extensions: { code: 'UNAUTHENTICATED' }
        });
      }

      const user = await sqliteAuthStore.findUserById(context.user.userId);
      if (!user?.isActive || user.authVersion !== context.user.authVersion) {
        throw new GraphQLError('Session expired', { extensions: { code: 'UNAUTHENTICATED' } });
      }

      const token = generateToken(user.id, user.email, user.role, user.authVersion);

      return {
        token,
        user: {
          ...user,
          passwordHash: undefined
        }
      };
    },

    // Admin: Update user role
    updateUserRole: async (_: any, { userId, role }: { userId: string; role: string }, context: any) => {
      if (!context.user || context.user.role !== 'ADMIN') {
        throw new GraphQLError('Unauthorized', {
          extensions: { code: 'FORBIDDEN' }
        });
      }

      try {
        console.log(`Admin ${context.user.userId} updating user ${userId} role to ${role}`);
        const updatedUser = await sqliteAuthStore.updateUserRole(userId, role);
        
        return {
          ...updatedUser,
          passwordHash: undefined
        };
      } catch (error: any) {
        console.error('❌ Update user role error:', error);
        throw new GraphQLError('Failed to update user role');
      }
    },

    // Admin: Reset user password
    resetUserPassword: async (_: any, { userId }: { userId: string }, context: any) => {
      if (!context.user || context.user.role !== 'ADMIN') {
        throw new GraphQLError('Unauthorized', {
          extensions: { code: 'FORBIDDEN' }
        });
      }

      try {
        const user = await sqliteAuthStore.findUserById(userId);
        if (!user) {
          throw new GraphQLError('User not found');
        }

        // Generate temporary password
        const tempPassword = 'temp' + Math.random().toString(36).slice(-6);
        await sqliteAuthStore.updateUserPassword(userId, tempPassword);
        
        console.log(`Admin ${context.user.userId} reset password for user ${userId}`);
        
        return {
          success: true,
          tempPassword,
          message: `Password reset for ${user.username}`
        };
      } catch (error: any) {
        console.error('❌ Reset password error:', error);
        throw new GraphQLError('Failed to reset password');
      }
    },

    // Admin: Delete user
    deleteUser: async (_: any, { userId }: { userId: string }, context: any) => {
      if (!context.user || context.user.role !== 'ADMIN') {
        throw new GraphQLError('Unauthorized', {
          extensions: { code: 'FORBIDDEN' }
        });
      }

      try {
        const user = await sqliteAuthStore.findUserById(userId);
        if (!user) {
          throw new GraphQLError('User not found');
        }

        await sqliteAuthStore.deleteUser(userId);
        console.log(`Admin ${context.user.userId} deleted user ${userId} (${user.username})`);
        
        return {
          success: true,
          message: `User ${user.username} has been deleted`
        };
      } catch (error: any) {
        console.error('❌ Delete user error:', error);
        throw new GraphQLError('Failed to delete user');
      }
    },

    // Admin: Create user
    createUser: async (_: any, { input }: { input: { email: string; username: string; name: string; password: string; role: string } }, context: any) => {
      if (!context.user || context.user.role !== 'ADMIN') {
        throw new GraphQLError('Unauthorized', {
          extensions: { code: 'FORBIDDEN' }
        });
      }

      try {
        // Check if user already exists
        const existingUser = await sqliteAuthStore.findUserByEmailOrUsername(input.email) || 
                            await sqliteAuthStore.findUserByEmailOrUsername(input.username);
        
        if (existingUser) {
          throw new GraphQLError('User already exists with that email or username', {
            extensions: { code: 'BAD_USER_INPUT' }
          });
        }

        // Create new user
        const user = await sqliteAuthStore.createUser({
          email: input.email,
          username: input.username,
          password: input.password,
          name: input.name,
          role: input.role as 'USER' | 'VIEWER'
        });

        console.log(`Admin ${context.user.userId} created user ${user.id} (${user.username})`);

        return {
          ...user,
          passwordHash: undefined
        };
      } catch (error) {
        if (error instanceof GraphQLError) {
          throw error;
        }
        console.error('❌ Create user error:', error);
        throw new GraphQLError('Failed to create user');
      }
    },

    // Admin: Update user status  
    updateUserStatus: async (_: any, { userId, isActive }: { userId: string; isActive: boolean }, context: any) => {
      if (!context.user || context.user.role !== 'ADMIN') {
        throw new GraphQLError('Unauthorized', {
          extensions: { code: 'FORBIDDEN' }
        });
      }

      try {
        console.log(`Admin ${context.user.userId} ${isActive ? 'activating' : 'deactivating'} user ${userId}`);
        const updatedUser = await sqliteAuthStore.updateUserStatus(userId, isActive);
        
        return {
          ...updatedUser,
          passwordHash: undefined
        };
      } catch (error: any) {
        console.error('❌ Update user status error:', error);
        throw new GraphQLError('Failed to update user status');
      }
    },

    // FOLDER MANAGEMENT MUTATIONS

    // Create new folder
    createFolder: async (_: any, { input }: { input: any }, context: any) => {
      const actor = await folderActor(context, true);
      const folderData = { ...input, ...await folderCreationOwner(input, actor) };
      await requireFolderParent(folderData, input.parentId, actor);

      try {
        const folder = await sqliteAuthStore.createFolder(folderData);
        
        return {
          ...folderResponse(folder),
          children: [],
          graphs: []
        };
      } catch (error: any) {
        console.error('❌ Create folder error:', error);
        throw new GraphQLError('Failed to create folder');
      }
    },

    // Update folder
    updateFolder: async (_: any, { id, input }: { id: string; input: any }, context: any) => {
      const actor = await folderActor(context, true);
      const existing = await requireFolderAccess(id, actor, true);
      if (input.parentId !== undefined) await requireFolderParent(existing, input.parentId, actor);

      try {
        const folder = await sqliteAuthStore.updateFolder(id, input);
        const graphs = await visibleFolderGraphs(id, context, actor);
        
        return {
          ...folderResponse(folder),
          children: [],
          graphs
        };
      } catch (error: any) {
        console.error('❌ Update folder error:', error);
        throw new GraphQLError('Failed to update folder');
      }
    },

    // Delete folder
    deleteFolder: async (_: any, { id, moveGraphsTo }: { id: string; moveGraphsTo?: string }, context: any) => {
      const actor = await folderActor(context, true);
      await requireFolderDeletion(id, actor, moveGraphsTo);
      const graphs = moveGraphsTo ? await sqliteAuthStore.getFolderGraphs(id) : [];
      if (moveGraphsTo) {
        await requireFolderAccess(moveGraphsTo, actor, true);
        await requireGraphAccess(graphs.map(graph => graph.graphId), context, actor);
      }

      try {
        // If moveGraphsTo is specified, move all graphs first
        if (moveGraphsTo) {
          for (const graph of graphs) {
            await sqliteAuthStore.removeGraphFromFolder(graph.graphId, id);
            await sqliteAuthStore.addGraphToFolder(graph.graphId, moveGraphsTo, graph.position);
          }
        }

        await sqliteAuthStore.deleteFolder(id);
        
        return {
          success: true,
          message: 'Folder deleted successfully'
        };
      } catch (error: any) {
        console.error('❌ Delete folder error:', error);
        throw new GraphQLError('Failed to delete folder');
      }
    },

    // Add graph to folder
    addGraphToFolder: async (_: any, { graphId, folderId, position }: { graphId: string; folderId: string; position?: number }, context: any) => {
      const actor = await folderActor(context, true);
      await requireFolderAccess(folderId, actor, true);
      await requireGraphAccess([graphId], context, actor);

      try {
        await sqliteAuthStore.addGraphToFolder(graphId, folderId, position || 0);
        
        return {
          success: true,
          message: 'Graph added to folder successfully'
        };
      } catch (error: any) {
        console.error('❌ Add graph to folder error:', error);
        throw new GraphQLError('Failed to add graph to folder');
      }
    },

    // Remove graph from folder
    removeGraphFromFolder: async (_: any, { graphId, folderId }: { graphId: string; folderId: string }, context: any) => {
      const actor = await folderActor(context, true);
      await requireFolderAccess(folderId, actor, true);
      await requireGraphAccess([graphId], context, actor);

      try {
        await sqliteAuthStore.removeGraphFromFolder(graphId, folderId);
        
        return {
          success: true,
          message: 'Graph removed from folder successfully'
        };
      } catch (error: any) {
        console.error('❌ Remove graph from folder error:', error);
        throw new GraphQLError('Failed to remove graph from folder');
      }
    },

    // Move graph between folders  
    moveGraphBetweenFolders: async (_: any, { graphId, fromFolderId, toFolderId, position }: { graphId: string; fromFolderId: string; toFolderId: string; position?: number }, context: any) => {
      const actor = await folderActor(context, true);
      await requireFolderAccess(fromFolderId, actor, true);
      await requireFolderAccess(toFolderId, actor, true);
      await requireGraphAccess([graphId], context, actor);

      try {
        await sqliteAuthStore.removeGraphFromFolder(graphId, fromFolderId);
        await sqliteAuthStore.addGraphToFolder(graphId, toFolderId, position || 0);
        
        return {
          success: true,
          message: 'Graph moved between folders successfully'
        };
      } catch (error: any) {
        console.error('❌ Move graph between folders error:', error);
        throw new GraphQLError('Failed to move graph between folders');
      }
    },

    // Reorder graphs in folder
    reorderGraphsInFolder: async (_: any, { folderId, graphOrders }: { folderId: string; graphOrders: Array<{ graphId: string; position: number }> }, context: any) => {
      const actor = await folderActor(context, true);
      await requireFolderAccess(folderId, actor, true);
      await requireGraphAccess(graphOrders.map(order => order.graphId), context, actor);

      try {
        // Update position for each graph
        for (const order of graphOrders) {
          await sqliteAuthStore.addGraphToFolder(order.graphId, folderId, order.position);
        }
        
        return {
          success: true,
          message: 'Graphs reordered successfully'
        };
      } catch (error: any) {
        console.error('❌ Reorder graphs error:', error);
        throw new GraphQLError('Failed to reorder graphs in folder');
      }
    },

    // Update OAuth provider configuration (Admin only)
    updateOAuthProviderConfig: async (_: any, { input }: { input: { provider: string; enabled: boolean; clientId: string; clientSecret: string; callbackUrl: string } }, context: any) => {
      if (!context.user || context.user.role !== 'ADMIN') {
        throw new GraphQLError('Unauthorized', {
          extensions: { code: 'FORBIDDEN' }
        });
      }

      try {
        await sqliteAuthStore.upsertOAuthProviderConfig({
          provider: input.provider as any,
          enabled: input.enabled,
          clientId: input.clientId,
          clientSecret: input.clientSecret,
          callbackUrl: input.callbackUrl
        });

        const config = await sqliteAuthStore.getOAuthProviderConfig(input.provider as any);
        return {
          ...config,
          enabled: Boolean(config.enabled),
          configured: Boolean(config.clientId && config.clientSecret)
        };
      } catch (error: any) {
        console.error('❌ Update OAuth provider config error:', error);
        throw new GraphQLError('Failed to update OAuth provider configuration');
      }
    },

    // Delete OAuth provider configuration (Admin only)
    deleteOAuthProviderConfig: async (_: any, { provider }: { provider: string }, context: any) => {
      if (!context.user || context.user.role !== 'ADMIN') {
        throw new GraphQLError('Unauthorized', {
          extensions: { code: 'FORBIDDEN' }
        });
      }

      try {
        await sqliteAuthStore.deleteOAuthProviderConfig(provider as any);
        return {
          success: true,
          message: 'OAuth provider configuration deleted successfully'
        };
      } catch (error: any) {
        console.error('❌ Delete OAuth provider config error:', error);
        throw new GraphQLError('Failed to delete OAuth provider configuration');
      }
    }
  }
};
