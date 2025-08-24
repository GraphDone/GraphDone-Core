import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { GraphQLError } from 'graphql';
import { Driver } from 'neo4j-driver';

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
    me: async (_: any, __: any, context: AuthContext) => {
      if (!context.user) {
        return null;
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
          return null;
        }

        const user = result.records[0].get('u').properties;
        const team = result.records[0].get('t')?.properties;
        
        return {
          ...user,
          team: team || null,
          passwordHash: undefined // Never expose password hash
        };
      } finally {
        await session.close();
      }
    },

    users: async (_: any, __: any, context: AuthContext) => {
      if (!context.user || !['PATH_KEEPER', 'GRAPH_MASTER'].includes(context.user.role)) {
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

    login: async (_: any, { input }: { input: LoginInput }, context: AuthContext) => {
      const session = context.driver.session();
      try {
        // Find user by email or username
        const result = await session.run(
          `MATCH (u:User)
           WHERE u.email = $identifier OR u.username = $identifier
           OPTIONAL MATCH (u)-[:MEMBER_OF]->(t:Team)
           RETURN u, t`,
          { identifier: input.emailOrUsername.toLowerCase() }
        );

        if (result.records.length === 0) {
          throw new GraphQLError('Invalid credentials', {
            extensions: { code: 'UNAUTHENTICATED' }
          });
        }

        const user = result.records[0].get('u').properties;
        const team = result.records[0].get('t')?.properties;

        // Verify password
        const validPassword = await bcrypt.compare(input.password, user.passwordHash);
        if (!validPassword) {
          throw new GraphQLError('Invalid credentials', {
            extensions: { code: 'UNAUTHENTICATED' }
          });
        }

        // Check if user is active
        if (!user.isActive) {
          throw new GraphQLError('Account is deactivated', {
            extensions: { code: 'FORBIDDEN' }
          });
        }

        // Update last login
        await session.run(
          'MATCH (u:User {id: $userId}) SET u.lastLogin = datetime()',
          { userId: user.id }
        );

        const token = generateToken(user.id, user.email, user.role);

        return {
          token,
          user: {
            ...user,
            team: team || null,
            passwordHash: undefined
          }
        };
      } catch (error: any) {
        if (error instanceof GraphQLError) {
          throw error;
        }
        throw new GraphQLError('Login failed', {
          extensions: { code: 'INTERNAL_SERVER_ERROR' }
        });
      } finally {
        await session.close();
      }
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
      if (!context.user || context.user.role !== 'GRAPH_MASTER') {
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

      // Only PATH_KEEPER and GRAPH_MASTER can change roles
      if (!['PATH_KEEPER', 'GRAPH_MASTER'].includes(context.user.role)) {
        throw new GraphQLError('Insufficient permissions', {
          extensions: { code: 'FORBIDDEN' }
        });
      }

      // PATH_KEEPER cannot promote to GRAPH_MASTER
      if (context.user.role === 'PATH_KEEPER' && role === 'GRAPH_MASTER') {
        throw new GraphQLError('Cannot promote to GRAPH_MASTER role', {
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
    }
  }
};

export { verifyToken };