# GraphDone Architecture Overview

## System Architecture Philosophy

GraphDone is architected around three core principles:

1. **Graph-Native**: All operations are modeled as graph transformations
2. **Real-Time First**: Changes propagate immediately to all participants
3. **Democratic Coordination**: Priority emerges from community validation, not top-down assignment

## Current Architecture (v0.3.1-alpha)

```mermaid
graph TB
    subgraph "Client Applications"
        WEB[Web Application<br/>React + TypeScript + D3.js<br/>Touch-optimized UI<br/>Port 3127]
        IOS[iPhone App<br/>SwiftUI<br/>Separate GraphDone-iOS repo]
        CLAUDE[Claude Code MCP<br/>Natural language interface<br/>Port 3128]
    end
    
    subgraph "API Layer"
        GQL[GraphQL Server<br/>Apollo Server + @neo4j/graphql<br/>Auto-generated resolvers<br/>WebSocket subscriptions<br/>Port 4127]
        CORE[Core Graph Engine<br/>@graphdone/core package<br/>Priority algorithms]
    end
    
    subgraph "Data Layer"
        SQLITE[(SQLite<br/>User authentication<br/>User settings & preferences<br/>Fast local storage)]
        NEO4J[(Neo4j 5.15-community<br/>Project management graph<br/>Work items & dependencies<br/>APOC plugins<br/>Port 7687)]
        REDIS[(Redis 8-alpine<br/>Available in Docker<br/>Not yet integrated<br/>Port 6379)]
    end
    
    subgraph "Future: Monitoring & Analytics (TIG Stack)"
        TELEGRAF[Telegraf<br/>Metrics collection<br/>Server monitoring]
        INFLUXDB[(InfluxDB<br/>Time-series database<br/>Metrics storage)]  
        GRAFANA[Grafana<br/>Dashboards & alerts<br/>GraphDone insights]
    end
    
    WEB --> GQL
    IOS --> GQL
    CLAUDE --> NEO4J
    GQL --> SQLITE
    GQL --> NEO4J
    GQL --> CORE
    REDIS -.-> GQL
    
    GQL -.-> TELEGRAF
    TELEGRAF -.-> INFLUXDB
    INFLUXDB -.-> GRAFANA
```

## Core Components Deep Dive

### Graph Engine (@graphdone/core)

The graph engine is the heart of GraphDone, implementing all graph operations and algorithms.

```mermaid
classDiagram
    class Graph {
        -nodes: Map~NodeId, Node~
        -edges: Map~EdgeId, Edge~
        -adjacencyList: Map~NodeId, Set~NodeId~~
        +addNode(params) Node
        +removeNode(nodeId) boolean
        +addEdge(params) Edge
        +removeEdge(edgeId) boolean
        +findPath(start, end) NodeId[]
        +findShortestPath(start, end) NodeId[]
        +detectCycles() NodeId[][]
        +getConnectedComponents() NodeId[][]
        +getNodesByPriority(threshold) Node[]
        +getNodesByType(type) Node[]
        +getNodesByContributor(id) Node[]
        +topologicalSort() NodeId[]
    }
    
    class Node {
        +id: NodeId
        +type: NodeType
        +title: string
        +description?: string
        +priority: Priority
        +position: SphericalCoordinate
        +status: NodeStatus
        +contributors: ContributorId[]
        +dependencies: NodeId[]
        +dependents: NodeId[]
        +metadata?: object
        +createdAt: Date
        +updatedAt: Date
        
        +updatePriority(updates) void
        +addContributor(id) void
        +removeContributor(id) void
        +addDependency(id) void
        +removeDependency(id) void
        +updateStatus(status) void
        +calculateInfluence() number
        +getPathToCenter() NodeId[]
    }
    
    class PriorityCalculator {
        -executiveWeight: 0.4
        -individualWeight: 0.3
        -communityWeight: 0.3
        
        +calculate(priority) Priority
        +migratePriority(current, boost, time) Priority
        +calculateRadiusFromPriority(priority) number
        +calculateInfluence(node, graph) number
        +propagatePriorityChanges(node, graph) void
    }
    
    Graph *-- Node
    Graph *-- Edge
    Node *-- Priority
    PriorityCalculator ..> Priority
```

### Priority System Implementation

The priority system implements the democratic prioritization philosophy through mathematical algorithms.

```mermaid
graph TB
    subgraph "Priority Input Sources"
        EXEC[Executive Priority<br/>Strategic importance<br/>0.0 - 1.0]
        INDIV[Individual Priority<br/>Personal importance<br/>0.0 - 1.0]
        COMM[Community Priority<br/>Collective validation<br/>0.0 - 1.0]
    end
    
    subgraph "Priority Calculation Engine"
        WEIGHTS[Weight Application<br/>Executive: 40%<br/>Individual: 30%<br/>Community: 30%]
        
        FORMULA[Computed Priority = <br/>exec × 0.4 + indiv × 0.3 + comm × 0.3]
        
        NORMALIZATION[Normalization<br/>Ensure 0.0 ≤ result ≤ 1.0]
    end
    
    subgraph "Spatial Positioning"
        RADIUS[Radius Calculation<br/>radius = 1 - priority]
        ANGLES[Angular Position<br/>theta, phi distribution]
        POSITION[3D Spherical Coordinate<br/>r, θ, φ]
    end
    
    subgraph "Migration System"
        BOOST[Community Boost<br/>Anonymous rating system]
        TIME_DECAY[Time-based Decay<br/>Prevents stagnation]
        MIGRATION[Position Migration<br/>Smooth transitions]
    end
    
    EXEC --> WEIGHTS
    INDIV --> WEIGHTS
    COMM --> WEIGHTS
    
    WEIGHTS --> FORMULA
    FORMULA --> NORMALIZATION
    
    NORMALIZATION --> RADIUS
    RADIUS --> ANGLES
    ANGLES --> POSITION
    
    BOOST --> MIGRATION
    TIME_DECAY --> MIGRATION
    MIGRATION --> POSITION
```

### Real-Time Collaboration Architecture

GraphDone maintains real-time synchronization across all clients using a sophisticated event system.

```mermaid
sequenceDiagram
    participant User1 as User 1 (Web)
    participant User2 as User 2 (Mobile)
    participant Agent as AI Agent
    participant WS as WebSocket Hub
    participant Graph as Graph Engine
    participant DB as Database
    participant Priority as Priority Engine
    
    Note over User1,Priority: Initial Setup
    User1->>WS: Connect + Subscribe to graph events
    User2->>WS: Connect + Subscribe to graph events
    Agent->>WS: Connect + Subscribe to priority events
    
    Note over User1,Priority: User Action Triggers Update
    User1->>Graph: Mutation: createNode(title: "New Feature")
    Note over User1: Optimistic UI update
    
    Graph->>Priority: Calculate initial priority
    Priority->>Graph: Return priority + position
    Graph->>DB: Persist new node
    
    Graph->>WS: Broadcast nodeCreated event
    WS->>User1: Confirm creation
    WS->>User2: New node appears
    WS->>Agent: Node creation notification
    
    Note over User1,Priority: Community Interaction
    User2->>Graph: Mutation: boostNodePriority(boost: 0.2)
    Graph->>Priority: Recalculate priorities
    Priority->>Priority: Apply boost + migration
    Priority->>Graph: Return new position
    Graph->>DB: Update node priority
    
    Graph->>WS: Broadcast priorityChanged event
    WS->>User1: Node migrates inward
    WS->>User2: Confirm boost applied
    WS->>Agent: Priority change notification
    
    Note over Agent: AI processes priority change
    Agent->>Graph: Query: getHighPriorityNodes()
    Graph->>Agent: Return prioritized work list
    Agent->>Graph: Mutation: addContributor(self)
    
    Graph->>WS: Broadcast contributorAdded event
    WS->>User1: Show AI agent joined
    WS->>User2: Show AI agent joined
```

### Hybrid Database Architecture

GraphDone uses a hybrid database approach, optimizing each database for its specific use case:

**SQLite: Authentication & User Data**
- User authentication (login, passwords, tokens)
- User settings and preferences
- Application configuration
- Fast, local storage with ACID properties
- No network latency for auth operations

**Neo4j: Graph Data**
- Project management nodes (tasks, outcomes, milestones)
- Dependencies and relationships between work items
- Graph traversal and pathfinding operations
- Complex graph queries and analytics

**Benefits of Hybrid Architecture:**
- **Performance**: Auth operations are lightning-fast (no network latency)
- **Reliability**: Server can start without Neo4j (auth-only mode)
- **Scalability**: SQLite handles auth load, Neo4j focuses on graph operations
- **Security**: User credentials isolated in separate database
- **Flexibility**: Can switch graph databases without affecting authentication
- **Development**: Easier testing and development with minimal dependencies

```mermaid
erDiagram
    %% SQLite Schema - Authentication & User Data
    User {
        uuid id PK
        varchar username UK
        varchar email UK  
        varchar password_hash
        varchar name
        varchar role
        boolean is_active
        boolean is_email_verified
        varchar email_verification_token
        varchar password_reset_token
        timestamp password_reset_expires
        jsonb settings
        jsonb metadata
        timestamp created_at
        timestamp updated_at
    }
    
    Team {
        uuid id PK
        varchar name
        text description
        boolean is_active
        jsonb settings
        timestamp created_at
        timestamp updated_at
    }
    
    UserTeam {
        uuid user_id PK,FK
        uuid team_id PK,FK
        varchar role
        timestamp added_at
    }
    
    %% Neo4j Schema - Graph Data
    WorkItem {
        uuid id PK
        work_item_type type
        varchar title
        text description
        float position_x
        float position_y
        float position_z
        float radius
        float theta
        float phi
        float priority_exec
        float priority_indiv
        float priority_comm
        float priority_comp
        work_item_status status
        uuid assigned_to FK
        jsonb metadata
        timestamp created_at
        timestamp updated_at
    }
    
    Dependency {
        uuid id PK
        uuid source_id FK
        uuid target_id FK
        dependency_type type
        float weight
        jsonb metadata
        timestamp created_at
    }
    
    Graph {
        uuid id PK
        varchar name
        text description
        uuid owner_id FK
        uuid team_id FK
        boolean is_public
        jsonb settings
        timestamp created_at
        timestamp updated_at
    }
    
    %% Relationships
    User ||--o{ Team : "member_of"
    User ||--o{ Graph : "owns"
    Team ||--o{ Graph : "team_graphs"
    WorkItem ||--o{ Dependency : "source_of"
    WorkItem ||--o{ Dependency : "target_of"
    Graph ||--o{ WorkItem : "contains"
```

### Performance Optimization Strategies

GraphDone implements several performance optimizations for real-time collaboration at scale.

```mermaid
graph TB
    subgraph "Client-Side Optimization"
        CACHE[Apollo Client Cache<br/>Normalized graph cache]
        OPTIMISTIC[Optimistic Updates<br/>Immediate UI feedback]
        VIRTUALIZATION[Virtual Scrolling<br/>Large node lists]
        DEBOUNCE[Input Debouncing<br/>Reduce API calls]
    end
    
    subgraph "Server-Side Optimization"
        DATALOADER[DataLoader<br/>Batch + cache DB queries]
        SUBSCRIPTION_FILTER[Subscription Filtering<br/>Send only relevant updates]
        QUERY_COMPLEXITY[Query Complexity Analysis<br/>Prevent expensive queries]
        RATE_LIMITING[Rate Limiting<br/>Per-user API limits]
    end
    
    subgraph "Database Optimization"
        INDEXES[Strategic Indexes<br/>Priority, type, status queries]
        PARTITIONING[Table Partitioning<br/>Large graphs]
        CONNECTION_POOL[Connection Pooling<br/>Efficient DB connections]
        READ_REPLICAS[Read Replicas<br/>Scale read operations]
    end
    
    subgraph "Caching Strategy"
        REDIS_CACHE[Redis Cache<br/>Session + computed data]
        CDN[CDN Distribution<br/>Static assets]
        GRAPH_CACHE[In-Memory Graph Cache<br/>Frequently accessed nodes]
        QUERY_CACHE[Query Result Cache<br/>Expensive computations]
    end
    
    CACHE --> DATALOADER
    OPTIMISTIC --> SUBSCRIPTION_FILTER
    VIRTUALIZATION --> QUERY_COMPLEXITY
    
    DATALOADER --> INDEXES
    SUBSCRIPTION_FILTER --> CONNECTION_POOL
    
    INDEXES --> REDIS_CACHE
    CONNECTION_POOL --> GRAPH_CACHE
```

## Deployment Architecture

GraphDone supports multiple deployment patterns from single-server to distributed cloud deployments.

```mermaid
graph TB
    subgraph "Production Deployment"
        LB[Load Balancer<br/>HAProxy, Nginx]
        
        subgraph "Application Tier"
            APP1[GraphDone Server 1<br/>Node.js + GraphQL]
            APP2[GraphDone Server 2<br/>Node.js + GraphQL]
            APP3[GraphDone Server 3<br/>Node.js + GraphQL]
        end
        
        subgraph "Data Tier"
            DB_PRIMARY[(PostgreSQL Primary<br/>Read/Write operations)]
            DB_REPLICA1[(PostgreSQL Replica 1<br/>Read operations)]
            DB_REPLICA2[(PostgreSQL Replica 2<br/>Read operations)]
            REDIS_CLUSTER[(Redis Cluster<br/>Session + Cache)]
        end
        
        subgraph "Static Assets"
            CDN[CDN<br/>CloudFlare, AWS CloudFront]
            STORAGE[Object Storage<br/>S3, R2, GCS]
        end
        
        subgraph "Monitoring"
            METRICS[Prometheus<br/>Metrics collection]
            GRAFANA[Grafana<br/>Visualization]
            ALERTS[AlertManager<br/>Incident response]
            LOGS[Loki/ELK<br/>Log aggregation]
        end
    end
    
    LB --> APP1
    LB --> APP2
    LB --> APP3
    
    APP1 --> DB_PRIMARY
    APP2 --> DB_REPLICA1
    APP3 --> DB_REPLICA2
    
    APP1 --> REDIS_CLUSTER
    APP2 --> REDIS_CLUSTER
    APP3 --> REDIS_CLUSTER
    
    CDN --> STORAGE
    
    APP1 --> METRICS
    APP2 --> METRICS
    APP3 --> METRICS
    
    METRICS --> GRAFANA
    METRICS --> ALERTS
    APP1 --> LOGS
```

## Security Architecture

Security is implemented at multiple layers with defense in depth principles.

```mermaid
graph TB
    subgraph "External Security"
        WAF[Web Application Firewall<br/>DDoS protection]
        RATE_LIMIT[Rate Limiting<br/>API abuse prevention]
        TLS[TLS Termination<br/>Encrypted communication]
    end
    
    subgraph "Authentication & Authorization"
        JWT[JWT Tokens<br/>Stateless authentication]
        RBAC[Role-Based Access Control<br/>Permission matrix]
        OAUTH[OAuth Integration<br/>SSO providers]
        MFA[Multi-Factor Authentication<br/>Enhanced security]
    end
    
    subgraph "Data Security"
        ENCRYPTION[Data Encryption<br/>At rest + in transit]
        ANONYMIZATION[Data Anonymization<br/>Privacy protection]
        AUDIT[Audit Logging<br/>Action tracking]
        BACKUP_ENCRYPTION[Encrypted Backups<br/>Secure recovery]
    end
    
    subgraph "Application Security"
        INPUT_VALIDATION[Input Validation<br/>Injection prevention]
        QUERY_LIMITS[Query Complexity Limits<br/>DoS prevention]
        CORS[CORS Configuration<br/>Origin restrictions]
        CSP[Content Security Policy<br/>XSS prevention]
    end
    
    WAF --> TLS
    TLS --> JWT
    JWT --> RBAC
    
    RBAC --> ENCRYPTION
    OAUTH --> ANONYMIZATION
    
    ENCRYPTION --> INPUT_VALIDATION
    ANONYMIZATION --> QUERY_LIMITS
```

This architecture ensures GraphDone can scale from small teams to large organizations while maintaining the core principles of democratic coordination and real-time collaboration.