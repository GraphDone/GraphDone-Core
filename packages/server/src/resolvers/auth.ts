import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { GraphQLError } from 'graphql';
import { Driver } from 'neo4j-driver';
import { sqliteAuthStore } from '../auth/sqlite-auth.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const BCRYPT_ROUNDS = 10;

interface AuthContext {
  driver: Driver;
  user?: any;
}

interface SignupInput {
  email: string;
  username: string;
  password: string;
  name: string;
  teamId?: string;
}

interface LoginInput {
  emailOrUsername: string;
  password: string;
}

function generateToken(userId: string, email: string, role: string): string {
  return jwt.sign(
    { userId, email, role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions
  );
}

function verifyToken(token: string): any {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    throw new GraphQLError('Invalid or expired token', {
      extensions: { code: 'UNAUTHENTICATED' }
    });
  }
}

export const authResolvers = {
  Query: {
    systemSettings: async () => {
      // For now, return default settings - in future this could be stored in database
      return {
        allowAnonymousGuest: true // Default to enabled
      };
    },

    me: async (_: any, __: any, context: AuthContext) => {
      if (!context.user) {
        return null;
      }

      // Try SQLite first
      try {
        const user = await sqliteAuthStore.findUserById(context.user.userId);
        if (user) {
          return {
            ...user,
            passwordHash: undefined // Never expose password hash
          };
        }
      } catch (sqliteError: any) {
        console.log('⚠️  SQLite user lookup failed, trying Neo4j fallback:', sqliteError.message);
      }

      // Fallback to Neo4j
      const session = context.driver.session();
      try {
        const result = await session.run(
          `MATCH (u:User {id: $userId})
           OPTIONAL MATCH (u)-[:MEMBER_OF]->(t:Team)
           RETURN u, t`,
          { userId: context.user.userId }
        );

        if (result.records.length === 0) {
          return null;
        }

        const user = result.records[0].get('u').properties;
        const team = result.records[0].get('t')?.properties;
        
        return {
          ...user,
          team: team || null,
          passwordHash: undefined // Never expose password hash
        };
      } catch (error: any) {
        console.log('⚠️  Both SQLite and Neo4j user lookup failed');
        return null;
      } finally {
        await session.close();
      }
    },

    users: async (_: any, __: any, context: AuthContext) => {
      if (!context.user || context.user.role !== 'ADMIN') {
        throw new GraphQLError('Insufficient permissions', {
          extensions: { code: 'FORBIDDEN' }
        });
      }

      const session = context.driver.session();
      try {
        const result = await session.run(
          `MATCH (u:User)
           OPTIONAL MATCH (u)-[:MEMBER_OF]->(t:Team)
           RETURN u, t
           ORDER BY u.createdAt DESC`
        );

        return result.records.map(record => {
          const user = record.get('u').properties;
          const team = record.get('t')?.properties;
          return {
            ...user,
            team: team || null,
            passwordHash: undefined // Never expose password hash
          };
        });
      } finally {
        await session.close();
      }
    },

    checkAvailability: async (_: any, args: { email?: string; username?: string }, context: AuthContext) => {
      const session = context.driver.session();
      try {
        if (args.email) {
          const emailResult = await session.run(
            'MATCH (u:User {email: $email}) RETURN u',
            { email: args.email.toLowerCase() }
          );
          
          if (emailResult.records.length > 0) {
            return {
              success: false,
              message: 'Email is already in use'
            };
          }
        }

        if (args.username) {
          const usernameResult = await session.run(
            'MATCH (u:User {username: $username}) RETURN u',
            { username: args.username.toLowerCase() }
          );
          
          if (usernameResult.records.length > 0) {
            return {
              success: false,
              message: 'Username is already taken'
            };
          }
        }

        return {
          success: true,
          message: 'Available'
        };
      } finally {
        await session.close();
      }
    },

    // Query to check development mode and default credentials status
    developmentInfo: async (_: any, __: any, context: AuthContext) => {
      const isDevelopment = process.env.NODE_ENV !== 'production';
      
      if (!isDevelopment) {
        return {
          isDevelopment: false,
          hasDefaultCredentials: false,
          defaultAccounts: []
        };
      }

      const session = context.driver.session();
      try {
        // Check if default admin/viewer accounts exist with default password
        const adminResult = await session.run(
          `MATCH (u:User {username: 'admin'}) RETURN u.passwordHash as passwordHash`
        );
        
        const viewerResult = await session.run(
          `MATCH (u:User {username: 'viewer'}) RETURN u.passwordHash as passwordHash`
        );

        const defaultAccounts = [];
        let hasDefaultCredentials = false;

        // Check if admin exists and has default password
        if (adminResult.records.length > 0) {
          const adminPasswordHash = adminResult.records[0].get('passwordHash');
          const isDefaultPassword = await bcrypt.compare('graphdone', adminPasswordHash);
          if (isDefaultPassword) {
            defaultAccounts.push({
              username: 'admin',
              password: 'graphdone',
              role: 'ADMIN',
              description: 'Full administrator access'
            });
            hasDefaultCredentials = true;
          }
        }

        // Check if viewer exists and has default password  
        if (viewerResult.records.length > 0) {
          const viewerPasswordHash = viewerResult.records[0].get('passwordHash');
          const isDefaultPassword = await bcrypt.compare('graphdone', viewerPasswordHash);
          if (isDefaultPassword) {
            defaultAccounts.push({
              username: 'viewer',
              password: 'graphdone', 
              role: 'VIEWER',
              description: 'Read-only access'
            });
            hasDefaultCredentials = true;
          }
        }

        return {
          isDevelopment,
          hasDefaultCredentials,
          defaultAccounts
        };
      } finally {
        await session.close();
      }
    }
  },

  Mutation: {
    signup: async (_: any, { input }: { input: SignupInput }, context: AuthContext) => {
      const session = context.driver.session();
      try {
        // Validate input
        if (!input.email || !input.username || !input.password || !input.name) {
          throw new GraphQLError('All fields are required', {
            extensions: { code: 'BAD_USER_INPUT' }
          });
        }

        // Check if email or username already exists
        const existingUser = await session.run(
          `MATCH (u:User) 
           WHERE u.email = $email OR u.username = $username
           RETURN u`,
          { 
            email: input.email.toLowerCase(),
            username: input.username.toLowerCase()
          }
        );

        if (existingUser.records.length > 0) {
          throw new GraphQLError('Email or username already exists', {
            extensions: { code: 'BAD_USER_INPUT' }
          });
        }

        // Hash password
        const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
        
        // Generate verification token
        const emailVerificationToken = uuidv4();
        
        // Create user
        const userId = uuidv4();
        const result = await session.run(
          `CREATE (u:User {
            id: $userId,
            email: $email,
            username: $username,
            passwordHash: $passwordHash,
            name: $name,
            role: 'NODE_WATCHER',
            isActive: true,
            isEmailVerified: false,
            emailVerificationToken: $emailVerificationToken,
            createdAt: datetime(),
            updatedAt: datetime()
          })
          ${input.teamId ? 'WITH u MATCH (t:Team {id: $teamId}) CREATE (u)-[:MEMBER_OF]->(t)' : ''}
          RETURN u`,
          {
            userId,
            email: input.email.toLowerCase(),
            username: input.username.toLowerCase(),
            passwordHash,
            name: input.name,
            emailVerificationToken,
            teamId: input.teamId
          }
        );

        const user = result.records[0].get('u').properties;
        const token = generateToken(user.id, user.email, user.role);

        // TODO: Send verification email
        
        return {
          token,
          user: {
            ...user,
            passwordHash: undefined
          }
        };
      } catch (error: any) {
        if (error instanceof GraphQLError) {
          throw error;
        }
        throw new GraphQLError('Failed to create account', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' }
        });
      } finally {
        await session.close();
      }
    },

    login: async (_: any, { input }: { input: LoginInput }) => {
      console.log(`🔐 Login attempt for: ${input.emailOrUsername}`);
      
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
    },

    guestLogin: async () => {
      // Create a temporary guest user token without storing in database
      const guestUser = {
        id: 'guest-' + Date.now(),
        email: 'guest@demo.local',
        username: 'guest',
        name: 'Guest User',
        role: 'GUEST',
        isActive: true,
        isEmailVerified: false,
        team: null
      };

      const token = generateToken(guestUser.id, guestUser.email, guestUser.role);

      return {
        token,
        user: guestUser
      };
    },

    logout: async () => {
      // Client-side will handle token removal
      return {
        success: true,
        message: 'Logged out successfully'
      };
    },

    refreshToken: async (_: any, __: any, context: AuthContext) => {
      if (!context.user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' }
        });
      }

      const session = context.driver.session();
      try {
        const result = await session.run(
          `MATCH (u:User {id: $userId})
           OPTIONAL MATCH (u)-[:MEMBER_OF]->(t:Team)
           RETURN u, t`,
          { userId: context.user.userId }
        );

        if (result.records.length === 0) {
          throw new GraphQLError('User not found', {
            extensions: { code: 'UNAUTHENTICATED' }
          });
        }

        const user = result.records[0].get('u').properties;
        const team = result.records[0].get('t')?.properties;
        const token = generateToken(user.id, user.email, user.role);

        return {
          token,
          user: {
            ...user,
            team: team || null,
            passwordHash: undefined
          }
        };
      } finally {
        await session.close();
      }
    },

    updateProfile: async (_: any, { input }: any, context: AuthContext) => {
      if (!context.user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' }
        });
      }

      const session = context.driver.session();
      try {
        const setClause = [];
        const params: any = { userId: context.user.userId };

        if (input.name !== undefined) {
          setClause.push('u.name = $name');
          params.name = input.name;
        }
        if (input.avatar !== undefined) {
          setClause.push('u.avatar = $avatar');
          params.avatar = input.avatar;
        }
        if (input.metadata !== undefined) {
          setClause.push('u.metadata = $metadata');
          params.metadata = input.metadata;
        }

        if (setClause.length === 0) {
          throw new GraphQLError('No fields to update', {
            extensions: { code: 'BAD_USER_INPUT' }
          });
        }

        setClause.push('u.updatedAt = datetime()');

        const result = await session.run(
          `MATCH (u:User {id: $userId})
           SET ${setClause.join(', ')}
           RETURN u`,
          params
        );

        const user = result.records[0].get('u').properties;
        return {
          ...user,
          passwordHash: undefined
        };
      } finally {
        await session.close();
      }
    },

    changePassword: async (_: any, { input }: any, context: AuthContext) => {
      if (!context.user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' }
        });
      }

      const session = context.driver.session();
      try {
        // Get current user
        const userResult = await session.run(
          'MATCH (u:User {id: $userId}) RETURN u',
          { userId: context.user.userId }
        );

        if (userResult.records.length === 0) {
          throw new GraphQLError('User not found', {
            extensions: { code: 'NOT_FOUND' }
          });
        }

        const user = userResult.records[0].get('u').properties;

        // Verify current password
        const validPassword = await bcrypt.compare(input.currentPassword, user.passwordHash);
        if (!validPassword) {
          throw new GraphQLError('Current password is incorrect', {
            extensions: { code: 'BAD_USER_INPUT' }
          });
        }

        // Hash new password
        const newPasswordHash = await bcrypt.hash(input.newPassword, BCRYPT_ROUNDS);

        // Update password
        await session.run(
          `MATCH (u:User {id: $userId})
           SET u.passwordHash = $passwordHash, u.updatedAt = datetime()`,
          { userId: context.user.userId, passwordHash: newPasswordHash }
        );

        return {
          success: true,
          message: 'Password changed successfully'
        };
      } finally {
        await session.close();
      }
    },

    sendVerificationEmail: async (_: any, __: any, context: AuthContext) => {
      if (!context.user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' }
        });
      }

      const session = context.driver.session();
      try {
        const result = await session.run(
          'MATCH (u:User {id: $userId}) RETURN u',
          { userId: context.user.userId }
        );

        if (result.records.length === 0) {
          throw new GraphQLError('User not found', {
            extensions: { code: 'NOT_FOUND' }
          });
        }

        const user = result.records[0].get('u').properties;

        if (user.isEmailVerified) {
          return {
            success: false,
            message: 'Email is already verified'
          };
        }

        // Generate new verification token
        const emailVerificationToken = uuidv4();
        
        await session.run(
          `MATCH (u:User {id: $userId})
           SET u.emailVerificationToken = $token, u.updatedAt = datetime()`,
          { userId: context.user.userId, token: emailVerificationToken }
        );

        // TODO: Send actual email
        console.log(`Verification link: ${process.env.FRONTEND_URL}/verify-email?token=${emailVerificationToken}`);

        return {
          success: true,
          message: 'Verification email sent'
        };
      } finally {
        await session.close();
      }
    },

    verifyEmail: async (_: any, { token }: { token: string }, context: AuthContext) => {
      const session = context.driver.session();
      try {
        const result = await session.run(
          `MATCH (u:User {emailVerificationToken: $token})
           SET u.isEmailVerified = true, 
               u.emailVerificationToken = null,
               u.updatedAt = datetime()
           RETURN u`,
          { token }
        );

        if (result.records.length === 0) {
          throw new GraphQLError('Invalid verification token', {
            extensions: { code: 'BAD_USER_INPUT' }
          });
        }

        return {
          success: true,
          message: 'Email verified successfully'
        };
      } finally {
        await session.close();
      }
    },

    requestPasswordReset: async (_: any, { email }: { email: string }, context: AuthContext) => {
      const session = context.driver.session();
      try {
        const result = await session.run(
          'MATCH (u:User {email: $email}) RETURN u',
          { email: email.toLowerCase() }
        );

        // Don't reveal if email exists or not
        if (result.records.length === 0) {
          return {
            success: true,
            message: 'If the email exists, a reset link has been sent'
          };
        }

        // Generate reset token
        const resetToken = uuidv4();
        const resetExpires = new Date(Date.now() + 3600000); // 1 hour

        await session.run(
          `MATCH (u:User {email: $email})
           SET u.passwordResetToken = $token,
               u.passwordResetExpires = datetime($expires),
               u.updatedAt = datetime()`,
          { 
            email: email.toLowerCase(),
            token: resetToken,
            expires: resetExpires.toISOString()
          }
        );

        // TODO: Send actual email
        console.log(`Reset link: ${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`);

        return {
          success: true,
          message: 'If the email exists, a reset link has been sent'
        };
      } finally {
        await session.close();
      }
    },

    resetPassword: async (_: any, { input }: any, context: AuthContext) => {
      const session = context.driver.session();
      try {
        const result = await session.run(
          `MATCH (u:User {passwordResetToken: $token})
           WHERE u.passwordResetExpires > datetime()
           RETURN u`,
          { token: input.token }
        );

        if (result.records.length === 0) {
          throw new GraphQLError('Invalid or expired reset token', {
            extensions: { code: 'BAD_USER_INPUT' }
          });
        }

        // Hash new password
        const passwordHash = await bcrypt.hash(input.newPassword, BCRYPT_ROUNDS);

        // Update password and clear reset token
        await session.run(
          `MATCH (u:User {passwordResetToken: $token})
           SET u.passwordHash = $passwordHash,
               u.passwordResetToken = null,
               u.passwordResetExpires = null,
               u.updatedAt = datetime()`,
          { token: input.token, passwordHash }
        );

        return {
          success: true,
          message: 'Password reset successfully'
        };
      } finally {
        await session.close();
      }
    },

    createTeam: async (_: any, { name, description }: any, context: AuthContext) => {
      if (!context.user || context.user.role !== 'ADMIN') {
        throw new GraphQLError('Insufficient permissions', {
          extensions: { code: 'FORBIDDEN' }
        });
      }

      const session = context.driver.session();
      try {
        const teamId = uuidv4();
        const result = await session.run(
          `CREATE (t:Team {
            id: $teamId,
            name: $name,
            description: $description,
            isActive: true,
            createdAt: datetime(),
            updatedAt: datetime()
          })
          WITH t
          MATCH (u:User {id: $userId})
          CREATE (u)-[:MEMBER_OF]->(t)
          RETURN t`,
          {
            teamId,
            name,
            description,
            userId: context.user.userId
          }
        );

        return result.records[0].get('t').properties;
      } finally {
        await session.close();
      }
    },

    updateUserRole: async (_: any, { userId, role }: any, context: AuthContext) => {
      if (!context.user) {
        throw new GraphQLError('Not authenticated', {
          extensions: { code: 'UNAUTHENTICATED' }
        });
      }

      // Only ADMIN can change roles
      if (context.user.role !== 'ADMIN') {
        throw new GraphQLError('Insufficient permissions', {
          extensions: { code: 'FORBIDDEN' }
        });
      }

      const session = context.driver.session();
      try {
        const result = await session.run(
          `MATCH (u:User {id: $userId})
           SET u.role = $role, u.updatedAt = datetime()
           RETURN u`,
          { userId, role }
        );

        if (result.records.length === 0) {
          throw new GraphQLError('User not found', {
            extensions: { code: 'NOT_FOUND' }
          });
        }

        const user = result.records[0].get('u').properties;
        return {
          ...user,
          passwordHash: undefined
        };
      } finally {
        await session.close();
      }
    },

    resetUserPassword: async (_: any, { userId }: { userId: string }, context: AuthContext) => {
      if (!context.user || context.user.role !== 'ADMIN') {
        throw new GraphQLError('Only ADMIN can reset user passwords', {
          extensions: { code: 'FORBIDDEN' }
        });
      }

      const session = context.driver.session();
      try {
        // Generate a temporary password
        const tempPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8);
        const passwordHash = await bcrypt.hash(tempPassword, BCRYPT_ROUNDS);

        const result = await session.run(
          `MATCH (u:User {id: $userId})
           SET u.passwordHash = $passwordHash,
               u.mustChangePassword = true,
               u.updatedAt = datetime()
           RETURN u`,
          { userId, passwordHash }
        );

        if (result.records.length === 0) {
          throw new GraphQLError('User not found', {
            extensions: { code: 'NOT_FOUND' }
          });
        }

        return {
          success: true,
          tempPassword,
          message: 'Password reset successfully. User must change password on next login.'
        };
      } finally {
        await session.close();
      }
    },

    deleteUser: async (_: any, { userId }: { userId: string }, context: AuthContext) => {
      console.log('Delete user called with userId:', userId);
      
      if (!context.user || context.user.role !== 'ADMIN') {
        throw new GraphQLError('Only ADMIN can delete users', {
          extensions: { code: 'FORBIDDEN' }
        });
      }

      const session = context.driver.session();
      try {
        // First, check if user exists and get their info
        const userCheck = await session.run(
          `MATCH (u:User {id: $userId}) RETURN u`,
          { userId }
        );

        if (userCheck.records.length === 0) {
          throw new GraphQLError('User not found', {
            extensions: { code: 'NOT_FOUND' }
          });
        }

        const userToDelete = userCheck.records[0].get('u').properties;

        // Prevent deletion of the default admin if it's the only admin
        if (userToDelete.role === 'ADMIN') {
          const adminCount = await session.run(
            `MATCH (u:User {role: 'ADMIN'}) RETURN count(u) as count`
          );
          
          const totalAdmins = adminCount.records[0].get('count').toNumber();
          
          if (totalAdmins <= 1) {
            throw new GraphQLError('Cannot delete the last admin user. At least one ADMIN must exist.', {
              extensions: { code: 'FORBIDDEN' }
            });
          }
        }

        // Simple approach: detach delete but preserve work items by updating their relationships first
        await session.run(
          `MATCH (u:User {id: $userId})
           // Remove user assignments but keep work items
           OPTIONAL MATCH (u)-[:ASSIGNED_TO]->(w:WorkItem)
           SET w.assignedTo = null
           // Remove user as contributor but keep work items
           OPTIONAL MATCH (u)-[c:CONTRIBUTOR_TO]->(w:WorkItem)
           DELETE c`,
          { userId }
        );

        // Now safely delete the user
        const result = await session.run(
          `MATCH (u:User {id: $userId})
           DETACH DELETE u
           RETURN 1 as deletedCount`,
          { userId }
        );

        const deletedCount = result.records[0].get('deletedCount').toNumber();

        if (deletedCount === 0) {
          throw new GraphQLError('Failed to delete user', {
            extensions: { code: 'INTERNAL_ERROR' }
          });
        }

        return {
          success: true,
          message: 'User account deleted successfully. Work items and contributions have been preserved.'
        };
      } finally {
        await session.close();
      }
    },

    createUser: async (_: any, { input }: { input: any }, context: AuthContext) => {
      if (!context.user || context.user.role !== 'ADMIN') {
        throw new GraphQLError('Only ADMIN can create users', {
          extensions: { code: 'FORBIDDEN' }
        });
      }

      const { email, username, name, password, role } = input;
      
      const session = context.driver.session();
      try {
        // Check if email or username already exists
        const existingUser = await session.run(
          `MATCH (u:User)
           WHERE u.email = $email OR u.username = $username
           RETURN u`,
          { email, username }
        );

        if (existingUser.records.length > 0) {
          throw new GraphQLError('Email or username already exists', {
            extensions: { code: 'BAD_USER_INPUT' }
          });
        }

        // Create new user
        const userId = uuidv4();
        const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
        
        const result = await session.run(
          `CREATE (u:User {
            id: $userId,
            email: $email,
            username: $username,
            passwordHash: $passwordHash,
            name: $name,
            role: $role,
            isActive: true,
            isEmailVerified: false,
            createdAt: datetime(),
            updatedAt: datetime()
          })
          RETURN u`,
          { userId, email, username, passwordHash, name, role }
        );

        const user = result.records[0].get('u').properties;
        return {
          ...user,
          passwordHash: undefined // Don't return password hash
        };
      } finally {
        await session.close();
      }
    },

    updateUserStatus: async (_: any, { userId, isActive }: { userId: string, isActive: boolean }, context: AuthContext) => {
      if (!context.user || context.user.role !== 'ADMIN') {
        throw new GraphQLError('Only ADMIN can update user status', {
          extensions: { code: 'FORBIDDEN' }
        });
      }

      const session = context.driver.session();
      try {
        // Build the SET clause based on status
        const setFields = ['u.isActive = $isActive', 'u.updatedAt = datetime()'];
        const params: any = { userId, isActive };

        // If deactivating, set deactivation date; if reactivating, clear it
        if (!isActive) {
          setFields.push('u.deactivationDate = datetime()');
        } else {
          setFields.push('u.deactivationDate = null');
        }

        const result = await session.run(
          `MATCH (u:User {id: $userId})
           SET ${setFields.join(', ')}
           RETURN u`,
          params
        );

        if (result.records.length === 0) {
          throw new GraphQLError('User not found', {
            extensions: { code: 'NOT_FOUND' }
          });
        }

        const user = result.records[0].get('u').properties;
        return {
          ...user,
          passwordHash: undefined
        };
      } finally {
        await session.close();
      }
    }
  }
};

export { verifyToken };