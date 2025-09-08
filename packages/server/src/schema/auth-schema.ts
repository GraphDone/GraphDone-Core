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

  # Folder Management Types
  type Folder {
    id: String!
    name: String!
    parentId: String
    type: FolderType!
    ownerId: String
    ownerName: String
    color: String
    icon: String
    description: String
    position: Int!
    isExpanded: Boolean!
    createdAt: String!
    updatedAt: String!
    children: [Folder!]!
    graphs: [GraphFolderMapping!]!
  }

  type GraphFolderMapping {
    graphId: String!
    folderId: String!
    position: Int!
    createdAt: String!
    updatedAt: String!
  }

  enum FolderType {
    USER
    TEAM
    SYSTEM
  }

  input CreateFolderInput {
    name: String!
    parentId: String
    type: FolderType!
    ownerId: String
    color: String
    icon: String
    description: String
    position: Int
  }

  input UpdateFolderInput {
    name: String
    parentId: String
    color: String
    icon: String
    description: String
    position: Int
    isExpanded: Boolean
  }

  type SystemSettings {
    allowAnonymousGuest: Boolean!
  }

  type DefaultAccount {
    username: String!
    password: String!
    role: String!
    description: String!
  }

  type DevelopmentInfo {
    isDevelopment: Boolean!
    hasDefaultCredentials: Boolean!
    defaultAccounts: [DefaultAccount!]!
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
    
    # Get development mode info and default credentials (dev mode only)
    developmentInfo: DevelopmentInfo!
    
    # Folder Management Queries
    # Get user's folder structure (hierarchical)
    folders: [Folder!]!
    
    # Get specific folder by ID
    folder(id: String!): Folder
    
    # Get graphs in a specific folder
    folderGraphs(folderId: String!): [GraphFolderMapping!]!
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
    
    # Folder Management Mutations
    # Create new folder
    createFolder(input: CreateFolderInput!): Folder!
    
    # Update folder properties
    updateFolder(id: String!, input: UpdateFolderInput!): Folder!
    
    # Delete folder (and optionally its contents)
    deleteFolder(id: String!, moveGraphsTo: String): MessageResponse!
    
    # Add graph to folder
    addGraphToFolder(graphId: String!, folderId: String!, position: Int): MessageResponse!
    
    # Remove graph from folder
    removeGraphFromFolder(graphId: String!, folderId: String!): MessageResponse!
    
    # Move graph between folders
    moveGraphBetweenFolders(graphId: String!, fromFolderId: String!, toFolderId: String!, position: Int): MessageResponse!
    
    # Reorder graphs within folder
    reorderGraphsInFolder(folderId: String!, graphOrders: [GraphOrderInput!]!): MessageResponse!
  }
  
  input GraphOrderInput {
    graphId: String!
    position: Int!
  }
`;