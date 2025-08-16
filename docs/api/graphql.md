# GraphQL API Reference

**AI-Generated Content Warning: This documentation contains AI-generated content. Verify information before depending on it for decision making.**

GraphDone provides a comprehensive GraphQL API for all data operations. The API supports queries, mutations, and real-time subscriptions.

## Endpoint

```
http://localhost:4000/graphql
```

## Authentication

Currently using a demo authentication system. In production, include your JWT token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

## Core Types

### Node

Represents a work item in the graph.

```graphql
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
```

### Priority

Multi-dimensional priority system.

```graphql
type Priority {
  executive: Float!    # Strategic priority (0-1)
  individual: Float!   # Personal priority (0-1)
  community: Float!    # Community validation (0-1)
  computed: Float!     # Weighted combination (0-1)
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
  DEPENDENCY
  BLOCKS
  RELATES_TO
  CONTAINS
}
```

## Common Queries

### Get All Nodes

```graphql
query GetNodes {
  nodes {
    id
    title
    type
    status
    priority {
      computed
    }
    position {
      radius
      theta
      phi
    }
  }
}
```

### Get Node with Dependencies

```graphql
query GetNodeWithDeps($id: ID!) {
  node(id: $id) {
    id
    title
    description
    type
    status
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
      contributor {
        name
        type
      }
    }
  }
}
```

### Filter by Priority

```graphql
query HighPriorityNodes {
  nodes(priorityThreshold: 0.7) {
    id
    title
    priority {
      computed
    }
  }
}
```

### Get Graph Statistics

```graphql
query GraphStats {
  graphStats {
    nodeCount
    edgeCount
    avgPriority
    cycleCount
  }
}
```

## Common Mutations

### Create Node

```graphql
mutation CreateNode($input: CreateNodeInput!) {
  createNode(input: $input) {
    id
    title
    type
    priority {
      computed
    }
    position {
      radius
    }
  }
}
```

Variables:
```json
{
  "input": {
    "type": "TASK",
    "title": "Implement user authentication",
    "description": "Add secure login and registration",
    "priority": {
      "executive": 0.8,
      "individual": 0.6,
      "community": 0.4
    }
  }
}
```

### Update Node Priority

```graphql
mutation UpdatePriority($id: ID!, $priority: PriorityInput!) {
  updateNodePriority(id: $id, priority: $priority) {
    id
    priority {
      executive
      individual
      community
      computed
    }
    position {
      radius
    }
  }
}
```

### Boost Node (Community Priority)

```graphql
mutation BoostNode($id: ID!, $boost: Float!) {
  boostNodePriority(id: $id, boost: $boost) {
    id
    priority {
      community
      computed
    }
  }
}
```

### Create Edge (Dependency)

```graphql
mutation CreateDependency($input: CreateEdgeInput!) {
  createEdge(input: $input) {
    id
    source {
      title
    }
    target {
      title
    }
    type
  }
}
```

Variables:
```json
{
  "input": {
    "sourceId": "node-1-id",
    "targetId": "node-2-id",
    "type": "DEPENDENCY",
    "weight": 1.0
  }
}
```

## Subscriptions

### Node Updates

```graphql
subscription NodeUpdates {
  nodeUpdated {
    id
    title
    status
    priority {
      computed
    }
  }
}
```

### Priority Changes

```graphql
subscription PriorityChanges {
  priorityChanged {
    nodeId
    oldPriority {
      computed
    }
    newPriority {
      computed
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

### Complete Node Management

```graphql
# Create a new outcome
mutation {
  outcome: createNode(input: {
    type: OUTCOME
    title: "Launch MVP"
    description: "Release minimum viable product"
    priority: { executive: 0.9, individual: 0.8, community: 0.0 }
  }) {
    id
  }
}

# Create dependent task
mutation {
  task: createNode(input: {
    type: TASK
    title: "User testing"
    description: "Conduct user acceptance testing"
    priority: { executive: 0.7, individual: 0.6, community: 0.0 }
  }) {
    id
  }
}

# Create dependency relationship
mutation {
  createEdge(input: {
    sourceId: "outcome-id"
    targetId: "task-id"
    type: DEPENDENCY
  }) {
    id
  }
}

# Boost task priority through community validation
mutation {
  boostNodePriority(id: "task-id", boost: 0.2) {
    priority {
      computed
    }
  }
}
```

For more examples, see the [Examples directory](../examples/).

## Playground

Visit http://localhost:4000/graphql in your browser to access the GraphQL Playground for interactive exploration and testing.