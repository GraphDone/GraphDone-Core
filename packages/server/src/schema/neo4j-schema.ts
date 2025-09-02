import { gql } from 'graphql-tag';

export const typeDefs = gql`
  # Enums
  enum NodeType {
    # Legacy types (for backward compatibility)
    OUTCOME
    
    # Strategic Planning
    EPIC
    INITIATIVE
    THEME
    OBJECTIVE
    GOAL
    MILESTONE
    ROADMAP_ITEM
    PORTFOLIO
    PROGRAM
    PROJECT
    CAMPAIGN
    
    # Development Work
    STORY
    USER_STORY
    FEATURE
    ENHANCEMENT
    TASK
    SUBTASK
    SPIKE
    RESEARCH
    PRODUCT_BACKLOG_ITEM
    WORK_ITEM
    TICKET
    
    # Quality & Issues
    BUG
    DEFECT
    INCIDENT
    HOTFIX
    REGRESSION
    ISSUE
    PROBLEM
    ERROR
    VULNERABILITY
    
    # Operations & Maintenance
    CHORE
    MAINTENANCE
    DEPLOYMENT
    RELEASE
    INFRASTRUCTURE
    DEVOPS
    AUTOMATION
    MONITORING
    BACKUP
    SECURITY
    
    # Documentation & Knowledge
    DOCUMENTATION
    SPECIFICATION
    REQUIREMENT
    DESIGN
    ARCHITECTURE
    WIKI
    GUIDE
    TUTORIAL
    MANUAL
    POLICY
    PROCEDURE
    
    # Process & Improvement
    IMPROVEMENT
    OPTIMIZATION
    REFACTORING
    TECHNICAL_DEBT
    PROCESS_IMPROVEMENT
    WORKFLOW
    AUTOMATION_REQUEST
    
    # Planning & Analysis
    ANALYSIS
    INVESTIGATION
    PROPOSAL
    IDEA
    CONCEPT
    FEASIBILITY_STUDY
    MARKET_RESEARCH
    COMPETITIVE_ANALYSIS
    
    # Testing & Validation
    TEST
    TEST_CASE
    TEST_PLAN
    TEST_SUITE
    VALIDATION
    REVIEW
    CODE_REVIEW
    DESIGN_REVIEW
    QA
    UAT
    ACCEPTANCE_TEST
    
    # Business & Sales
    LEAD
    OPPORTUNITY
    QUOTE
    CONTRACT
    DEAL
    ACCOUNT
    CUSTOMER_REQUEST
    
    # Marketing & Content
    CONTENT
    BLOG_POST
    SOCIAL_MEDIA
    EMAIL_CAMPAIGN
    ADVERTISEMENT
    BRAND_ASSET
    
    # Events & Activities
    EVENT
    MEETING
    WORKSHOP
    CONFERENCE
    WEBINAR
    PRESENTATION
    DEMO
    
    # Support & Training
    SUPPORT
    TRAINING
    ONBOARDING
    KNOWLEDGE_TRANSFER
    HELP_DESK
    FAQ
    
    # Finance & Legal
    BUDGET
    INVOICE
    EXPENSE
    LEGAL_REVIEW
    COMPLIANCE
    AUDIT
    
    # HR & People
    RECRUITMENT
    INTERVIEW
    PERFORMANCE_REVIEW
    TEAM_BUILDING
    
    # Default Type
    DEFAULT
    VACATION_REQUEST
    
    # Creative & Design
    CREATIVE_BRIEF
    MOCKUP
    PROTOTYPE
    WIREFRAME
    BRAND_DESIGN
    UX_RESEARCH
    UI_DESIGN
    
    # Custom & Miscellaneous
    CUSTOM
    NOTE
    REMINDER
    ACTION_ITEM
    FOLLOW_UP
    DECISION
    RISK
    DEPENDENCY
    BLOCKER
    QUESTION
  }

  enum NodeStatus {
    NOT_STARTED
    PROPOSED
    PLANNED
    ACTIVE
    IN_PROGRESS
    BLOCKED
    COMPLETED
    CANCELLED
  }

  enum EdgeType {
    DEPENDS_ON
    BLOCKS
    ENABLES
    RELATES_TO
    IS_PART_OF
    FOLLOWS
    DEFAULT_EDGE
    PARALLEL_WITH
    DUPLICATES
    CONFLICTS_WITH
    VALIDATES
    REFERENCES
    CONTAINS
  }

  enum ContributorType {
    HUMAN
    AI_AGENT
  }

  enum UserRole {
    GUEST           # Anonymous read-only access for demos (no data modification)
    VIEWER          # Read-only access to view graphs and nodes
    USER            # Can work on tasks, create and update nodes
    ADMIN           # System admin - full system access and user management
  }

  enum GraphType {
    PROJECT
    WORKSPACE
    SUBGRAPH
    TEMPLATE
  }

  enum GraphStatus {
    DRAFT
    ACTIVE
    ARCHIVED
    DELETED
  }

  # User entity - represents authenticated users in the system
  type User {
    id: ID! @id
    email: String! @unique
    username: String! @unique
    passwordHash: String @private  # Made optional for OAuth users
    name: String!
    avatar: String
    role: UserRole! @default(value: VIEWER)
    isActive: Boolean! @default(value: true)
    isEmailVerified: Boolean! @default(value: false)
    deactivationDate: DateTime
    emailVerificationToken: String @private
    passwordResetToken: String @private
    passwordResetExpires: DateTime @private
    lastLogin: DateTime
    
    # OAuth provider data
    googleId: String @unique @private
    linkedinId: String @unique @private
    githubId: String @unique @private
    oauthProvider: String  # "google", "linkedin", "github", "local"
    oauthVerified: Boolean! @default(value: false)
    
    metadata: String # JSON for additional user preferences
    
    createdAt: DateTime! @timestamp(operations: [CREATE])
    updatedAt: DateTime! @timestamp
    
    # Relationships
    team: Team @relationship(type: "MEMBER_OF", direction: OUT)
    createdGraphs: [Graph!]! @relationship(type: "CREATED", direction: OUT)
    contributedTo: [WorkItem!]! @relationship(type: "ASSIGNED_TO", direction: OUT)
    ownedNodes: [WorkItem!]! @relationship(type: "OWNS", direction: OUT)
  }

  # Team entity - represents teams/organizations
  type Team {
    id: ID! @id
    name: String! @unique
    description: String
    logo: String
    isActive: Boolean! @default(value: true)
    settings: String # JSON for team settings
    
    createdAt: DateTime! @timestamp(operations: [CREATE])
    updatedAt: DateTime! @timestamp
    
    # Relationships
    members: [User!]! @relationship(type: "MEMBER_OF", direction: IN)
    graphs: [Graph!]! @relationship(type: "OWNS_GRAPH", direction: OUT)
  }

  # Graph entity - represents a graph/workspace/project
  type Graph {
    id: ID! @id
    name: String!
    description: String
    type: GraphType!
    status: GraphStatus! @default(value: DRAFT)
    parentGraphId: String
    teamId: String # Team ID for backwards compatibility
    createdBy: String # Creator ID for backwards compatibility  
    tags: [String!] # Tags for organization
    defaultRole: String # Default role for team members
    depth: Int! @default(value: 0)
    path: [String!]
    isShared: Boolean! @default(value: false)
    nodeCount: Int! @default(value: 0)
    edgeCount: Int! @default(value: 0)
    contributorCount: Int! @default(value: 0)
    lastActivity: DateTime
    settings: String # JSON as string for graph settings
    permissions: String # JSON as string for permissions
    shareSettings: String # JSON as string for share settings
    
    createdAt: DateTime! @timestamp(operations: [CREATE])
    updatedAt: DateTime! @timestamp
    
    # Relationships (optional for backwards compatibility)
    creator: User @relationship(type: "CREATED", direction: IN)
    team: Team @relationship(type: "OWNS_GRAPH", direction: IN)
    workItems: [WorkItem!]! @relationship(type: "BELONGS_TO", direction: IN)
    subgraphs: [Graph!]! @relationship(type: "PARENT_OF", direction: OUT)
    parentGraph: Graph @relationship(type: "PARENT_OF", direction: IN)
  }

  # WorkItem entity - represents work items in the graph
  type WorkItem {
    id: ID! @id
    type: NodeType!
    title: String!
    description: String
    positionX: Float! @default(value: 0.0)
    positionY: Float! @default(value: 0.0)
    positionZ: Float! @default(value: 0.0)
    radius: Float! @default(value: 1.0)
    theta: Float! @default(value: 0.0)
    phi: Float! @default(value: 0.0)
    priorityExec: Float! @default(value: 0.0)
    priorityIndiv: Float! @default(value: 0.0)
    priorityComm: Float! @default(value: 0.0)
    priorityComp: Float! @default(value: 0.0)
    status: NodeStatus! @default(value: NOT_STARTED)
    dueDate: DateTime
    tags: [String!]
    metadata: String # JSON as string
    
    createdAt: DateTime! @timestamp(operations: [CREATE])
    updatedAt: DateTime! @timestamp

    # Relationships
    owner: User @relationship(type: "OWNS", direction: IN)
    assignedTo: User @relationship(type: "ASSIGNED_TO", direction: IN)
    graph: Graph @relationship(type: "BELONGS_TO", direction: OUT)
    dependencies: [WorkItem!]! @relationship(type: "DEPENDS_ON", direction: OUT)
    dependents: [WorkItem!]! @relationship(type: "DEPENDS_ON", direction: IN)
    contributors: [Contributor!]! @relationship(type: "CONTRIBUTES_TO", direction: IN)
    sourceEdges: [Edge!]! @relationship(type: "EDGE_SOURCE", direction: IN)
    targetEdges: [Edge!]! @relationship(type: "EDGE_TARGET", direction: IN)
  }

  # Contributor entity - humans and AI agents (legacy - kept for AI agents)
  type Contributor {
    id: ID! @id
    type: ContributorType!
    name: String!
    email: String @unique
    avatarUrl: String
    capabilities: String # JSON as string
    metadata: String # JSON as string
    
    createdAt: DateTime! @timestamp(operations: [CREATE])
    updatedAt: DateTime! @timestamp

    # Relationships
    user: User @relationship(type: "CONTRIBUTOR_PROFILE", direction: IN)
    workItems: [WorkItem!]! @relationship(type: "CONTRIBUTES_TO", direction: OUT)
  }

  # Edge entity - relationships between nodes
  type Edge {
    id: ID! @id
    type: EdgeType!
    weight: Float! @default(value: 1.0)
    metadata: String # JSON as string
    
    createdAt: DateTime! @timestamp(operations: [CREATE])
    createdBy: User @relationship(type: "CREATED_EDGE", direction: IN)

    # Relationships
    source: WorkItem! @relationship(type: "EDGE_SOURCE", direction: OUT)
    target: WorkItem! @relationship(type: "EDGE_TARGET", direction: OUT)
  }

  # All input types will be auto-generated by Neo4j GraphQL

  # Neo4j GraphQL will auto-generate Query and Mutation types

  type Subscription {
    graphCreated: Graph!
    graphUpdated: Graph!
    graphDeleted: ID!
    workItemCreated: WorkItem!
    workItemUpdated: WorkItem!
    workItemDeleted: ID!
    edgeCreated: Edge!
    edgeUpdated: Edge!
    edgeDeleted: ID!
    contributorCreated: Contributor!
    contributorUpdated: Contributor!
    contributorDeleted: ID!
  }
`;