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

  type Query {
    # Get current user from JWT token
    me: User
    
    # Get all users (admin only)
    users: [User!]!
    
    # Check if email/username is available
    checkAvailability(email: String, username: String): MessageResponse!
    
    # Verify email token
    verifyEmailToken(token: String!): MessageResponse!
  }

  type Mutation {
    # Authentication mutations
    signup(input: SignupInput!): AuthPayload!
    login(input: LoginInput!): AuthPayload!
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
  }
`;