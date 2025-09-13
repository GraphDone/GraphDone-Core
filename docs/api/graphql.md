# GraphQL API Reference

GraphDone provides a comprehensive GraphQL API for all data operations. The API supports queries, mutations, and real-time subscriptions.

## Endpoints

GraphQL API is accessed through the web application proxy:

```
# Development (HTTP)
http://localhost:3127/graphql

# Production (HTTPS)
https://localhost:3128/api/graphql

# WebSocket Subscriptions
ws://localhost:3127/graphql      # Development
wss://localhost:3128/api/graphql # Production
```

**Note**: The GraphQL API server runs on internal ports (4127 dev, 4128 prod) but is not directly exposed. All API access goes through the web application which proxies requests to the internal GraphQL server.

## Authentication

Currently using a demo authentication system. In production, include your JWT token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

## Core Types

### WorkItem

Represents a work item in the graph.

```graphql
type WorkItem {
  id: ID!
  type: NodeType!
  title: String!
  description: String
  positionX: Float!
  positionY: Float!
  positionZ: Float!
  radius: Float!
  theta: Float!
  phi: Float!
  priority: Float!
  priorityComp: Float!
  status: NodeStatus!
  dueDate: DateTime
  tags: [String!]
  metadata: String # JSON as string
  createdAt: DateTime!
  updatedAt: DateTime!
  
  # Relationships
  owner: User
  assignedTo: User
  graph: Graph!
  dependencies: [WorkItem!]!
  dependents: [WorkItem!]!
  contributors: [Contributor!]!
  sourceEdges: [Edge!]!
  targetEdges: [Edge!]!
}

enum NodeType {
  DEFAULT      # Generic work item
  EPIC         # Large initiative spanning multiple deliverables
  MILESTONE    # Key project checkpoint
  OUTCOME      # Expected result or deliverable
  FEATURE      # New functionality or capability
  TASK         # Specific work item to be completed
  BUG          # Software defect requiring resolution
  IDEA         # Concept or proposal for future development
  RESEARCH     # Investigation or analysis work
}

enum NodeStatus {
  NOT_STARTED
  PROPOSED
  PLANNED
  IN_PROGRESS
  IN_REVIEW
  BLOCKED
  ON_HOLD
  COMPLETED
  CANCELLED
}
```

### User

Represents an authenticated user in the system.

```graphql
type User {
  id: ID!
  email: String!
  username: String!
  name: String!
  avatar: String
  role: UserRole!
  isActive: Boolean!
  isEmailVerified: Boolean!
  lastLogin: DateTime
  createdAt: DateTime!
  updatedAt: DateTime!
  
  # Relationships
  team: Team
  createdGraphs: [Graph!]!
  contributedTo: [WorkItem!]!
  ownedNodes: [WorkItem!]!
}

enum UserRole {
  GUEST    # Anonymous read-only access
  VIEWER   # Read-only access to view graphs
  USER     # Can create and update work items
  ADMIN    # Full system access and user management
}
```

### Graph

Represents a graph/workspace/project.

```graphql
type Graph {
  id: ID!
  name: String!
  description: String
  type: GraphType!
  status: GraphStatus!
  nodeCount: Int!
  edgeCount: Int!
  contributorCount: Int!
  createdAt: DateTime!
  updatedAt: DateTime!
  
  # Relationships
  creator: User
  team: Team
  workItems: [WorkItem!]!
  subgraphs: [Graph!]!
  parentGraph: Graph
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
```

### Contributor

Represents contributors (humans and AI agents).

```graphql
type Contributor {
  id: ID!
  type: ContributorType!
  name: String!
  email: String
  capabilities: String # JSON as string
  createdAt: DateTime!
  
  # Relationships
  user: User
  workItems: [WorkItem!]!
}

enum ContributorType {
  HUMAN
  AI_AGENT
}
```

### Edge

Represents relationships between nodes.

```graphql
type Edge {
  id: ID!
  source: Node!
  target: Node!
  type: EdgeType!
  weight: Float!
  metadata: JSON
  createdAt: DateTime!
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
```

## Common Queries

### Get All WorkItems

```graphql
query GetWorkItems {
  workItems {
    id
    title
    type
    status
    priority
    positionX
    positionY
    positionZ
    radius
    theta
    phi
    createdAt
    updatedAt
  }
}
```

### Get WorkItem with Dependencies

```graphql
query GetWorkItemWithDeps($id: ID!) {
  workItems(where: { id: $id }) {
    id
    title
    description
    type
    status
    priority
    dependencies {
      id
      title
      type
    }
    dependents {
      id
      title
      type
    }
    contributors {
      name
      type
    }
  }
}
```

### Filter by Priority

```graphql
query HighPriorityWorkItems {
  workItems(where: { priority_GTE: 0.7 }) {
    id
    title
    priority
    type
    status
  }
}
```

### Get Graph with WorkItems

```graphql
query GetGraphWithWorkItems($id: ID!) {
  graphs(where: { id: $id }) {
    id
    name
    description
    type
    status
    nodeCount
    edgeCount
    workItems {
      id
      title
      type
      priority
      status
    }
  }
}
```

## Common Mutations

### Create WorkItem

```graphql
mutation CreateWorkItem($input: [WorkItemCreateInput!]!) {
  createWorkItems(input: $input) {
    workItems {
      id
      title
      type
      priority
      status
      positionX
      positionY
      positionZ
    }
  }
}
```

Variables:
```json
{
  "input": [{
    "type": "TASK",
    "title": "Implement user authentication",
    "description": "Add secure login and registration",
    "priority": 0.8,
    "status": "NOT_STARTED"
  }]
}
```

### Update WorkItem

```graphql
mutation UpdateWorkItem($where: WorkItemWhere!, $update: WorkItemUpdateInput!) {
  updateWorkItems(where: $where, update: $update) {
    workItems {
      id
      title
      priority
      status
      updatedAt
    }
  }
}
```

### Create Edge (Dependency)

```graphql
mutation CreateEdge($input: [EdgeCreateInput!]!) {
  createEdges(input: $input) {
    edges {
      id
      type
      weight
      source {
        title
      }
      target {
        title
      }
    }
  }
}
```

Variables:
```json
{
  "input": [{
    "type": "DEPENDS_ON",
    "weight": 1.0,
    "source": {
      "connect": {
        "where": { "id": "workitem-1-id" }
      }
    },
    "target": {
      "connect": {
        "where": { "id": "workitem-2-id" }
      }
    }
  }]
}
```

## Subscriptions

### WorkItem Updates

```graphql
subscription WorkItemUpdates {
  workItemUpdated {
    id
    title
    status
    priority
    type
    updatedAt
  }
}
```

### Graph Changes

```graphql
subscription GraphChanges {
  graphUpdated {
    id
    name
    nodeCount
    edgeCount
    lastActivity
  }
}
```

### Edge Updates

```graphql
subscription EdgeUpdates {
  edgeCreated {
    id
    type
    weight
    source {
      id
      title
    }
    target {
      id
      title
    }
  }
}
```

## Error Handling

The API returns standard GraphQL errors:

```json
{
  "errors": [
    {
      "message": "Node not found",
      "locations": [{"line": 2, "column": 3}],
      "path": ["node"],
      "extensions": {
        "code": "NOT_FOUND",
        "nodeId": "invalid-id"
      }
    }
  ],
  "data": {
    "node": null
  }
}
```

Common error codes:
- `NOT_FOUND` - Resource doesn't exist
- `VALIDATION_ERROR` - Invalid input data
- `UNAUTHORIZED` - Authentication required
- `FORBIDDEN` - Insufficient permissions

## Rate Limiting

The API implements rate limiting:
- **100 requests/minute** for queries
- **50 requests/minute** for mutations
- **Unlimited** for subscriptions

Headers included in responses:
- `X-RateLimit-Limit` - Maximum requests allowed
- `X-RateLimit-Remaining` - Requests remaining in window
- `X-RateLimit-Reset` - Time when limit resets

## Examples

### Complete WorkItem Management

```graphql
# Create a new outcome
mutation {
  createWorkItems(input: [{
    type: OUTCOME
    title: "Launch MVP"
    description: "Release minimum viable product"
    priority: 0.9
    status: NOT_STARTED
  }]) {
    workItems {
      id
      title
      priority
    }
  }
}

# Create dependent task
mutation {
  createWorkItems(input: [{
    type: TASK
    title: "User testing"
    description: "Conduct user acceptance testing"
    priority: 0.7
    status: NOT_STARTED
  }]) {
    workItems {
      id
      title
      priority
    }
  }
}

# Create dependency relationship
mutation {
  createEdges(input: [{
    type: DEPENDS_ON
    weight: 1.0
    source: { connect: { where: { id: "outcome-id" } } }
    target: { connect: { where: { id: "task-id" } } }
  }]) {
    edges {
      id
      type
      weight
    }
  }
}

# Update task priority
mutation {
  updateWorkItems(
    where: { id: "task-id" }
    update: { priority: 0.8 }
  ) {
    workItems {
      id
      priority
    }
  }
}
```

For more comprehensive examples, see the [Getting Started guide](../guides/getting-started.md) or explore the GraphQL Playground interface.

## GraphQL Playground

GraphQL Playground is available through the web application interface:

**Development:**
- Visit http://localhost:3127/graphql in your browser

**Production:**
- Visit https://localhost:3128/api/graphql in your browser

**Note**: The playground is accessed through the web proxy, not directly from the GraphQL server.