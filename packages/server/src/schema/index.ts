import { gql } from 'graphql-tag';

export const typeDefs = gql`
  scalar DateTime
  scalar JSON

  type Query {
    nodes(
      type: NodeType
      status: NodeStatus
      contributorId: ID
      priorityThreshold: Float
      limit: Int
      offset: Int
    ): [Node!]!
    
    node(id: ID!): Node
    
    edges(
      sourceId: ID
      targetId: ID
      type: EdgeType
      limit: Int
      offset: Int
    ): [Edge!]!
    
    edge(id: ID!): Edge
    
    contributors(
      type: ContributorType
      limit: Int
      offset: Int
    ): [Contributor!]!
    
    contributor(id: ID!): Contributor
    
    findPath(startId: ID!, endId: ID!): [ID!]
    detectCycles: [[ID!]!]!
    
    graphStats: GraphStats!
  }

  type Mutation {
    createNode(input: CreateNodeInput!): Node!
    updateNode(id: ID!, input: UpdateNodeInput!): Node!
    deleteNode(id: ID!): Boolean!
    
    createEdge(input: CreateEdgeInput!): Edge!
    updateEdge(id: ID!, input: UpdateEdgeInput!): Edge!
    deleteEdge(id: ID!): Boolean!
    
    createContributor(input: CreateContributorInput!): Contributor!
    updateContributor(id: ID!, input: UpdateContributorInput!): Contributor!
    deleteContributor(id: ID!): Boolean!
    
    addNodeContributor(nodeId: ID!, contributorId: ID!, role: String): NodeContributor!
    removeNodeContributor(nodeId: ID!, contributorId: ID!): Boolean!
    
    updateNodePriority(id: ID!, priority: PriorityInput!): Node!
    boostNodePriority(id: ID!, boost: Float!): Node!
  }

  type Subscription {
    nodeUpdated: Node!
    nodeCreated: Node!
    nodeDeleted: NodeDeletedEvent!
    
    edgeUpdated: Edge!
    edgeCreated: Edge!
    edgeDeleted: EdgeDeletedEvent!
    
    priorityChanged: PriorityChangedEvent!
  }

  type Node {
    id: ID!
    type: NodeType!
    title: String!
    description: String
    position: SphericalCoordinate!
    priority: Priority!
    status: NodeStatus!
    contributors: [NodeContributor!]!
    dependencies: [Node!]!
    dependents: [Node!]!
    edges: [Edge!]!
    metadata: JSON
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type Edge {
    id: ID!
    source: Node!
    target: Node!
    type: EdgeType!
    weight: Float!
    metadata: JSON
    createdAt: DateTime!
  }

  type Contributor {
    id: ID!
    type: ContributorType!
    name: String!
    email: String
    avatarUrl: String
    capabilities: [String!]
    nodes: [NodeContributor!]!
    metadata: JSON
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type NodeContributor {
    id: ID!
    node: Node!
    contributor: Contributor!
    role: String
    addedAt: DateTime!
  }

  type SphericalCoordinate {
    radius: Float!
    theta: Float!
    phi: Float!
  }

  type Priority {
    executive: Float!
    individual: Float!
    community: Float!
    computed: Float!
  }

  type GraphStats {
    nodeCount: Int!
    edgeCount: Int!
    avgPriority: Float!
    cycleCount: Int!
  }

  type NodeDeletedEvent {
    id: ID!
    title: String!
  }

  type EdgeDeletedEvent {
    id: ID!
    sourceId: ID!
    targetId: ID!
  }

  type PriorityChangedEvent {
    nodeId: ID!
    oldPriority: Priority!
    newPriority: Priority!
  }

  input CreateNodeInput {
    type: NodeType!
    title: String!
    description: String
    priority: PriorityInput
    status: NodeStatus
    metadata: JSON
  }

  input UpdateNodeInput {
    title: String
    description: String
    status: NodeStatus
    metadata: JSON
  }

  input CreateEdgeInput {
    sourceId: ID!
    targetId: ID!
    type: EdgeType!
    weight: Float = 1.0
    metadata: JSON
  }

  input UpdateEdgeInput {
    weight: Float
    metadata: JSON
  }

  input CreateContributorInput {
    type: ContributorType!
    name: String!
    email: String
    avatarUrl: String
    capabilities: [String!]
    metadata: JSON
  }

  input UpdateContributorInput {
    name: String
    email: String
    avatarUrl: String
    capabilities: [String!]
    metadata: JSON
  }

  input PriorityInput {
    executive: Float
    individual: Float
    community: Float
  }

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
`;