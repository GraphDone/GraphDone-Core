import { GraphQLError } from 'graphql';
import { sqliteAuthStore } from '../auth/sqlite-auth.js';
import { generateToken } from '../utils/auth.js';

interface LoginInput {
  emailOrUsername: string;
  password: string;
}

interface SignupInput {
  email: string;
  username: string;
  password: string;
  name: string;
  teamId?: string;
}

interface UpdateProfileInput {
  name?: string;
  avatar?: string;
  metadata?: string;
}

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
      const isDevelopment = process.env.NODE_ENV !== 'production';
      
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
      if (!context.user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' }
        });
      }

      try {
        // Ensure user has personal folders
        await sqliteAuthStore.createUserPersonalFolders(context.user.userId, context.user.teamId);
        
        const folders = await sqliteAuthStore.getUserFolders(context.user.userId);
        
        // Build hierarchical structure
        const folderMap = new Map();
        const rootFolders: any[] = [];

        // First pass: create folder objects
        folders.forEach(folder => {
          folderMap.set(folder.id, {
            ...folder,
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
          const graphs = await sqliteAuthStore.getFolderGraphs(folder.id);
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
      if (!context.user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' }
        });
      }

      try {
        const folders = await sqliteAuthStore.getUserFolders(context.user.userId);
        const folder = folders.find(f => f.id === id);
        
        if (!folder) {
          return null;
        }

        const graphs = await sqliteAuthStore.getFolderGraphs(folder.id);
        
        return {
          ...folder,
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
      if (!context.user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' }
        });
      }

      try {
        return await sqliteAuthStore.getFolderGraphs(folderId);
      } catch (error: any) {
        console.error('❌ Get folder graphs error:', error);
        throw new GraphQLError('Failed to get folder graphs');
      }
    }
  },

  Mutation: {
    // Login mutation - SQLite only
    login: async (_: any, { input }: { input: LoginInput }) => {
      console.log(`🔐 Login attempt for: ${input.emailOrUsername}`);
      
      try {
        // SQLite-only authentication
        const user = await sqliteAuthStore.findUserByEmailOrUsername(input.emailOrUsername);
        
        if (!user) {
          console.log('❌ User not found:', input.emailOrUsername);
          throw new GraphQLError('Invalid credentials', {
            extensions: { code: 'UNAUTHENTICATED' }
          });
        }

        console.log(`👤 Found user: ${user.username}`);
        
        // Verify password
        const validPassword = await sqliteAuthStore.validatePassword(user, input.password);
        if (!validPassword) {
          console.log('❌ Invalid password for user:', user.username);
          throw new GraphQLError('Invalid credentials', {
            extensions: { code: 'UNAUTHENTICATED' }
          });
        }

        // Check if user is active
        if (!user.isActive) {
          console.log('❌ User is deactivated:', user.username);
          throw new GraphQLError('Account is deactivated', {
            extensions: { code: 'FORBIDDEN' }
          });
        }

        const token = generateToken(user.id, user.email, user.role);
        console.log(`✅ Login successful: ${user.username} (${user.role})`);
        
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
        console.error('❌ Login error:', error);
        throw new GraphQLError('Login failed', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' }
        });
      }
    },

    // Guest login
    guestLogin: async () => {
      const guestUser = {
        id: 'guest-' + Date.now(),
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

      const token = generateToken(guestUser.id, guestUser.email, guestUser.role);
      
      return {
        token,
        user: guestUser
      };
    },

    // Signup mutation
    signup: async (_: any, { input }: { input: SignupInput }) => {
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
          role: 'USER'
        });

        const token = generateToken(user.id, user.email, user.role);

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
      if (!user) {
        throw new GraphQLError('User not found');
      }

      const token = generateToken(user.id, user.email, user.role);

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
      if (!context.user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' }
        });
      }

      try {
        const folderData = {
          ...input,
          ownerId: input.ownerId || context.user.userId
        };

        const folder = await sqliteAuthStore.createFolder(folderData);
        
        return {
          ...folder,
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
      if (!context.user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' }
        });
      }

      try {
        const folder = await sqliteAuthStore.updateFolder(id, input);
        const graphs = await sqliteAuthStore.getFolderGraphs(id);
        
        return {
          ...folder,
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
      if (!context.user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' }
        });
      }

      try {
        // If moveGraphsTo is specified, move all graphs first
        if (moveGraphsTo) {
          const graphs = await sqliteAuthStore.getFolderGraphs(id);
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
      if (!context.user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' }
        });
      }

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
      if (!context.user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' }
        });
      }

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
      if (!context.user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' }
        });
      }

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
      if (!context.user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' }
        });
      }

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
    }
  }
};