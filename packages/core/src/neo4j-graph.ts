import { Driver, Session } from 'neo4j-driver';
import { Node } from './node';
import { Edge } from './edge';
import {
  GraphNode,
  GraphEdge,
  NodeId,
  EdgeId,
  NodeType,
  NodeStatus
} from './types';

export class Neo4jGraph {
  private driver: Driver;

  constructor(driver: Driver) {
    this.driver = driver;
  }

  private async withSession<T>(work: (session: Session) => Promise<T>): Promise<T> {
    const session = this.driver.session();
    try {
      return await work(session);
    } finally {
      await session.close();
    }
  }

  async addNode(params: Partial<GraphNode> & { title: string; type: NodeType }): Promise<Node> {
    return this.withSession(async (session) => {
      const query = `
        CREATE (n:Node {
          id: randomUUID(),
          type: $type,
          title: $title,
          description: $description,
          positionX: $positionX,
          positionY: $positionY,
          positionZ: $positionZ,
          radius: $radius,
          theta: $theta,
          phi: $phi,
          priorityExec: $priorityExec,
          priorityIndiv: $priorityIndiv,
          priorityComm: $priorityComm,
          priorityComp: $priorityComp,
          status: $status,
          metadata: $metadata,
          createdAt: datetime(),
          updatedAt: datetime()
        })
        RETURN n
      `;

      const result = await session.run(query, {
        type: params.type,
        title: params.title,
        description: params.description || null,
        positionX: params.position?.radius || 0,
        positionY: params.position?.theta || 0,
        positionZ: params.position?.phi || 0,
        radius: 1.0,
        theta: 0.0,
        phi: 0.0,
        priorityExec: params.priority?.executive || 0,
        priorityIndiv: params.priority?.individual || 0,
        priorityComm: params.priority?.community || 0,
        priorityComp: params.priority?.computed || 0,
        status: params.status || NodeStatus.PROPOSED,
        metadata: params.metadata ? JSON.stringify(params.metadata) : null
      });

      const record = result.records[0];
      const nodeData = record.get('n').properties;
      
      return new Node({
        id: nodeData.id,
        type: nodeData.type,
        title: nodeData.title,
        description: nodeData.description,
        position: {
          radius: nodeData.radius,
          theta: nodeData.theta,
          phi: nodeData.phi
        },
        priority: {
          executive: nodeData.priorityExec,
          individual: nodeData.priorityIndiv,
          community: nodeData.priorityComm,
          computed: nodeData.priorityComp
        },
        status: nodeData.status,
        contributors: [],
        dependencies: [],
        dependents: [],
        createdAt: new Date(nodeData.createdAt),
        updatedAt: new Date(nodeData.updatedAt),
        metadata: nodeData.metadata ? JSON.parse(nodeData.metadata) : undefined
      });
    });
  }

  async removeNode(nodeId: NodeId): Promise<boolean> {
    return this.withSession(async (session) => {
      const query = `
        MATCH (n:Node {id: $nodeId})
        DETACH DELETE n
        RETURN count(n) as deletedCount
      `;

      const result = await session.run(query, { nodeId });
      const deletedCount = result.records[0]?.get('deletedCount').toNumber() || 0;
      return deletedCount > 0;
    });
  }

  async getNode(nodeId: NodeId): Promise<Node | undefined> {
    return this.withSession(async (session) => {
      const query = `
        MATCH (n:Node {id: $nodeId})
        OPTIONAL MATCH (n)-[:DEPENDS_ON]->(dep:Node)
        OPTIONAL MATCH (dependent:Node)-[:DEPENDS_ON]->(n)
        RETURN n, 
               collect(DISTINCT dep.id) as dependencies,
               collect(DISTINCT dependent.id) as dependents
      `;

      const result = await session.run(query, { nodeId });
      if (result.records.length === 0) return undefined;

      const record = result.records[0];
      const nodeData = record.get('n').properties;
      const dependencies = record.get('dependencies').filter((id: string) => id);
      const dependents = record.get('dependents').filter((id: string) => id);

      return new Node({
        id: nodeData.id,
        type: nodeData.type,
        title: nodeData.title,
        description: nodeData.description,
        position: {
          radius: nodeData.radius,
          theta: nodeData.theta,
          phi: nodeData.phi
        },
        priority: {
          executive: nodeData.priorityExec,
          individual: nodeData.priorityIndiv,
          community: nodeData.priorityComm,
          computed: nodeData.priorityComp
        },
        status: nodeData.status,
        contributors: [], // TODO: Load contributors
        dependencies,
        dependents,
        createdAt: new Date(nodeData.createdAt),
        updatedAt: new Date(nodeData.updatedAt),
        metadata: nodeData.metadata ? JSON.parse(nodeData.metadata) : undefined
      });
    });
  }

  async addEdge(params: Omit<GraphEdge, 'id'> & { id?: EdgeId }): Promise<Edge> {
    return this.withSession(async (session) => {
      const query = `
        MATCH (source:Node {id: $sourceId})
        MATCH (target:Node {id: $targetId})
        CREATE (source)-[e:EDGE {
          id: randomUUID(),
          type: $type,
          weight: $weight,
          metadata: $metadata,
          createdAt: datetime()
        }]->(target)
        RETURN e
      `;

      const result = await session.run(query, {
        sourceId: params.source,
        targetId: params.target,
        type: params.type,
        weight: params.weight || 1.0,
        metadata: params.metadata ? JSON.stringify(params.metadata) : null
      });

      const record = result.records[0];
      const edgeData = record.get('e').properties;

      return new Edge({
        id: edgeData.id,
        source: params.source,
        target: params.target,
        type: params.type,
        weight: edgeData.weight,
        metadata: edgeData.metadata ? JSON.parse(edgeData.metadata) : undefined
      });
    });
  }

  async findPath(startId: NodeId, endId: NodeId): Promise<NodeId[] | null> {
    return this.withSession(async (session) => {
      const query = `
        MATCH path = shortestPath((start:Node {id: $startId})-[:DEPENDS_ON*]->(end:Node {id: $endId}))
        RETURN [node in nodes(path) | node.id] as pathIds
      `;

      const result = await session.run(query, { startId, endId });
      if (result.records.length === 0) return null;

      return result.records[0].get('pathIds');
    });
  }

  async detectCycles(): Promise<NodeId[][]> {
    return this.withSession(async (session) => {
      const query = `
        MATCH path = (n:Node)-[:DEPENDS_ON*1..]->(n)
        RETURN [node in nodes(path) | node.id] as cycle
        LIMIT 100
      `;

      const result = await session.run(query);
      return result.records.map(record => record.get('cycle'));
    });
  }

  async getNodesByType(type: NodeType): Promise<Node[]> {
    return this.withSession(async (session) => {
      const query = `
        MATCH (n:Node {type: $type})
        RETURN n
        ORDER BY n.priorityComp DESC
      `;

      const result = await session.run(query, { type });
      
      return result.records.map(record => {
        const nodeData = record.get('n').properties;
        return new Node({
          id: nodeData.id,
          type: nodeData.type,
          title: nodeData.title,
          description: nodeData.description,
          position: {
            radius: nodeData.radius,
            theta: nodeData.theta,
            phi: nodeData.phi
          },
          priority: {
            executive: nodeData.priorityExec,
            individual: nodeData.priorityIndiv,
            community: nodeData.priorityComm,
            computed: nodeData.priorityComp
          },
          status: nodeData.status,
          contributors: [],
          dependencies: [],
          dependents: [],
          createdAt: new Date(nodeData.createdAt),
          updatedAt: new Date(nodeData.updatedAt),
          metadata: nodeData.metadata ? JSON.parse(nodeData.metadata) : undefined
        });
      });
    });
  }

  async getNodesByPriorityThreshold(threshold: number): Promise<Node[]> {
    return this.withSession(async (session) => {
      const query = `
        MATCH (n:Node)
        WHERE n.priorityComp >= $threshold
        RETURN n
        ORDER BY n.priorityComp DESC
      `;

      const result = await session.run(query, { threshold });
      
      return result.records.map(record => {
        const nodeData = record.get('n').properties;
        return new Node({
          id: nodeData.id,
          type: nodeData.type,
          title: nodeData.title,
          description: nodeData.description,
          position: {
            radius: nodeData.radius,
            theta: nodeData.theta,
            phi: nodeData.phi
          },
          priority: {
            executive: nodeData.priorityExec,
            individual: nodeData.priorityIndiv,
            community: nodeData.priorityComm,
            computed: nodeData.priorityComp
          },
          status: nodeData.status,
          contributors: [],
          dependencies: [],
          dependents: [],
          createdAt: new Date(nodeData.createdAt),
          updatedAt: new Date(nodeData.updatedAt),
          metadata: nodeData.metadata ? JSON.parse(nodeData.metadata) : undefined
        });
      });
    });
  }

  async getNodeCount(): Promise<number> {
    return this.withSession(async (session) => {
      const query = `MATCH (n:Node) RETURN count(n) as count`;
      const result = await session.run(query);
      return result.records[0].get('count').toNumber();
    });
  }

  async getEdgeCount(): Promise<number> {
    return this.withSession(async (session) => {
      const query = `MATCH ()-[e:EDGE]->() RETURN count(e) as count`;
      const result = await session.run(query);
      return result.records[0].get('count').toNumber();
    });
  }

  async close(): Promise<void> {
    await this.driver.close();
  }
}