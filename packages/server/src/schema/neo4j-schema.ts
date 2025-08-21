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
    PROPOSED
    PLANNED
    ACTIVE
    IN_PROGRESS
    BLOCKED
    COMPLETED
    ARCHIVED
  }

  enum EdgeType {
    DEPENDS_ON
    BLOCKS
    ENABLES
    RELATES_TO
    PART_OF
    FOLLOWS
    PARALLEL_WITH
    DUPLICATES
    CONFLICTS_WITH
    VALIDATES
    
    # Legacy support (deprecated)
    DEPENDENCY
    CONTAINS
  }

  enum ContributorType {
    HUMAN
    AI_AGENT
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

  # Graph entity - represents a graph/workspace/project
  type Graph {
    id: ID! @id
    name: String!
    description: String
    type: GraphType!
    status: GraphStatus! @default(value: DRAFT)
    parentGraphId: String
    teamId: String! @default(value: "default-team")
    createdBy: String!
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
    
    # Relationships
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
    status: NodeStatus! @default(value: PROPOSED)
    dueDate: DateTime
    assignedTo: String
    metadata: String # JSON as string
    
    # Data isolation fields
    teamId: String @default(value: "default-team")
    userId: String @default(value: "default-user")
    
    createdAt: DateTime! @timestamp(operations: [CREATE])
    updatedAt: DateTime! @timestamp

    # Relationships
    graph: Graph @relationship(type: "BELONGS_TO", direction: OUT)
    dependencies: [WorkItem!]! @relationship(type: "DEPENDS_ON", direction: OUT)
    dependents: [WorkItem!]! @relationship(type: "DEPENDS_ON", direction: IN)
    contributors: [Contributor!]! @relationship(type: "CONTRIBUTES_TO", direction: IN)
    sourceEdges: [Edge!]! @relationship(type: "EDGE", direction: OUT)
    targetEdges: [Edge!]! @relationship(type: "EDGE", direction: IN)
  }

  # Contributor entity - humans and AI agents
  type Contributor {
    id: ID! @id
    type: ContributorType!
    name: String!
    email: String @unique
    avatarUrl: String
    capabilities: String # JSON as string
    metadata: String # JSON as string
    
    # Data isolation fields
    teamId: String @default(value: "default-team")
    
    createdAt: DateTime! @timestamp(operations: [CREATE])
    updatedAt: DateTime! @timestamp

    # Relationships
    workItems: [WorkItem!]! @relationship(type: "CONTRIBUTES_TO", direction: OUT)
  }

  # Edge entity - relationships between nodes
  type Edge {
    id: ID! @id
    type: EdgeType!
    weight: Float! @default(value: 1.0)
    metadata: String # JSON as string
    
    # Data isolation fields
    teamId: String @default(value: "default-team")
    userId: String @default(value: "default-user")
    
    createdAt: DateTime! @timestamp(operations: [CREATE])

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