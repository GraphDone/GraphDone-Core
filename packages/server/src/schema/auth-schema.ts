import { gql } from 'graphql-tag';

export const authTypeDefs = gql`
  type AuthPayload {
    token: String!
    user: User!
  }

  type MessageResponse {
    success: Boolean!
    message: String!
  }

  type PasswordResetResponse {
    success: Boolean!
    tempPassword: String
    message: String!
  }

  input SignupInput {
    email: String!
    username: String!
    password: String!
    name: String!
    teamId: String
  }

  input LoginInput {
    emailOrUsername: String!
    password: String!
  }

  input UpdateProfileInput {
    name: String
    avatar: String
    metadata: String
  }

  input ChangePasswordInput {
    currentPassword: String!
    newPassword: String!
  }

  input ResetPasswordInput {
    token: String!
    newPassword: String!
  }

  input CreateUserInput {
    email: String!
    username: String!
    name: String!
    password: String!
    role: UserRole!
  }

  type SystemSettings {
    allowAnonymousGuest: Boolean!
  }

  type Query {
    # Get current user from JWT token
    me: User
    
    # Get all users (admin only)
    users: [User!]!
    
    # Check if email/username is available
    checkAvailability(email: String, username: String): MessageResponse!
    
    # Verify email token
    verifyEmailToken(token: String!): MessageResponse!
    
    # Get public system settings
    systemSettings: SystemSettings!
  }

  type Mutation {
    # Authentication mutations
    signup(input: SignupInput!): AuthPayload!
    login(input: LoginInput!): AuthPayload!
    guestLogin: AuthPayload!
    logout: MessageResponse!
    refreshToken: AuthPayload!
    
    # Profile management
    updateProfile(input: UpdateProfileInput!): User!
    changePassword(input: ChangePasswordInput!): MessageResponse!
    
    # Email verification
    sendVerificationEmail: MessageResponse!
    verifyEmail(token: String!): MessageResponse!
    
    # Password reset
    requestPasswordReset(email: String!): MessageResponse!
    resetPassword(input: ResetPasswordInput!): MessageResponse!
    
    # Team management (for GRAPH_MASTER role)
    createTeam(name: String!, description: String): Team!
    inviteToTeam(email: String!, teamId: String!, role: UserRole!): MessageResponse!
    acceptInvite(inviteToken: String!): AuthPayload!
    
    # Role management (for PATH_KEEPER and GRAPH_MASTER)
    updateUserRole(userId: String!, role: UserRole!): User!
    
    # Admin password reset (for GRAPH_MASTER only)
    resetUserPassword(userId: String!): PasswordResetResponse!
    
    # Admin user deletion (for GRAPH_MASTER only)
    deleteUser(userId: String!): MessageResponse!
    
    # Admin user creation (for GRAPH_MASTER only)
    createUser(input: CreateUserInput!): User!
    
    # Admin user status update (for GRAPH_MASTER only)
    updateUserStatus(userId: String!, isActive: Boolean!): User!
  }
`;