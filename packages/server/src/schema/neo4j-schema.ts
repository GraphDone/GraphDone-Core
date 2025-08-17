import { gql } from 'graphql-tag';

export const typeDefs = gql`
  # Enums
  enum NodeType {
    OUTCOME
    TASK
    MILESTONE
    IDEA
  }

  enum NodeStatus {
    PROPOSED
    ACTIVE
    IN_PROGRESS
    BLOCKED
    COMPLETED
    ARCHIVED
  }

  enum EdgeType {
    DEPENDENCY
    BLOCKS
    RELATES_TO
    CONTAINS
  }

  enum ContributorType {
    HUMAN
    AI_AGENT
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
    metadata: String # JSON as string
    createdAt: DateTime! @timestamp(operations: [CREATE])
    updatedAt: DateTime! @timestamp(operations: [UPDATE])

    # Relationships
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
    createdAt: DateTime! @timestamp(operations: [CREATE])
    updatedAt: DateTime! @timestamp(operations: [UPDATE])

    # Relationships
    workItems: [WorkItem!]! @relationship(type: "CONTRIBUTES_TO", direction: OUT)
  }

  # Edge entity - relationships between nodes
  type Edge {
    id: ID! @id
    type: EdgeType!
    weight: Float! @default(value: 1.0)
    metadata: String # JSON as string
    createdAt: DateTime! @timestamp(operations: [CREATE])

    # Relationships
    source: WorkItem! @relationship(type: "EDGE", direction: IN)
    target: WorkItem! @relationship(type: "EDGE", direction: OUT)
  }

  # Input types for mutations
  input WorkItemCreateInput {
    type: NodeType!
    title: String!
    description: String
    positionX: Float
    positionY: Float
    positionZ: Float
    radius: Float
    theta: Float
    phi: Float
    priorityExec: Float
    priorityIndiv: Float
    priorityComm: Float
    priorityComp: Float
    status: NodeStatus
    metadata: String
  }

  input WorkItemUpdateInput {
    title: String
    description: String
    positionX: Float
    positionY: Float
    positionZ: Float
    radius: Float
    theta: Float
    phi: Float
    priorityExec: Float
    priorityIndiv: Float
    priorityComm: Float
    priorityComp: Float
    status: NodeStatus
    metadata: String
  }

  input ContributorCreateInput {
    type: ContributorType!
    name: String!
    email: String
    avatarUrl: String
    capabilities: String
    metadata: String
  }

  input ContributorUpdateInput {
    name: String
    email: String
    avatarUrl: String
    capabilities: String
    metadata: String
  }

  input EdgeCreateInput {
    sourceId: ID!
    targetId: ID!
    type: EdgeType!
    weight: Float
    metadata: String
  }

  input EdgeUpdateInput {
    type: EdgeType
    weight: Float
    metadata: String
  }

  input PriorityUpdateInput {
    executive: Float
    individual: Float
    community: Float
  }

  # Query filters
  input WorkItemFilters {
    type: NodeType
    status: NodeStatus
    priorityThreshold: Float
    contributorId: ID
  }

  input ContributorFilters {
    type: ContributorType
  }

  input EdgeFilters {
    sourceId: ID
    targetId: ID
    type: EdgeType
  }

  # Custom scalars for pagination
  input PaginationInput {
    limit: Int
    offset: Int
  }

  type Query {
    workItems(filters: WorkItemFilters, pagination: PaginationInput): [WorkItem!]!
    workItem(id: ID!): WorkItem
    contributors(filters: ContributorFilters, pagination: PaginationInput): [Contributor!]!
    contributor(id: ID!): Contributor
    edges(filters: EdgeFilters, pagination: PaginationInput): [Edge!]!
    edge(id: ID!): Edge
  }

  type Mutation {
    # WorkItem mutations
    createWorkItem(input: WorkItemCreateInput!): WorkItem!
    updateWorkItem(id: ID!, input: WorkItemUpdateInput!): WorkItem!
    deleteWorkItem(id: ID!): Boolean!
    updateWorkItemPriority(id: ID!, input: PriorityUpdateInput!): WorkItem!
    boostWorkItemPriority(id: ID!, boostAmount: Float!): WorkItem!

    # Contributor mutations
    createContributor(input: ContributorCreateInput!): Contributor!
    updateContributor(id: ID!, input: ContributorUpdateInput!): Contributor!
    deleteContributor(id: ID!): Boolean!
    addWorkItemContributor(workItemId: ID!, contributorId: ID!, role: String): Boolean!
    removeWorkItemContributor(workItemId: ID!, contributorId: ID!): Boolean!

    # Edge mutations
    createEdge(input: EdgeCreateInput!): Edge!
    updateEdge(id: ID!, input: EdgeUpdateInput!): Edge!
    deleteEdge(id: ID!): Boolean!
  }

  type Subscription {
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