import { Node } from './node';
import { Edge } from './edge';
import {
  GraphNode,
  GraphEdge,
  NodeId,
  EdgeId,
  NodeType,
  EdgeType,
  ContributorId
} from './types';

export class Graph {
  private nodes: Map<NodeId, Node>;
  private edges: Map<EdgeId, Edge>;
  private adjacencyList: Map<NodeId, Set<NodeId>>;

  constructor() {
    this.nodes = new Map();
    this.edges = new Map();
    this.adjacencyList = new Map();
  }

  addNode(params: Partial<GraphNode> & { title: string; type: NodeType }): Node {
    const node = new Node(params);
    this.nodes.set(node.id, node);
    
    if (!this.adjacencyList.has(node.id)) {
      this.adjacencyList.set(node.id, new Set());
    }
    
    return node;
  }

  removeNode(nodeId: NodeId): boolean {
    const node = this.nodes.get(nodeId);
    if (!node) return false;
    
    const edgesToRemove: EdgeId[] = [];
    this.edges.forEach((edge) => {
      if (edge.source === nodeId || edge.target === nodeId) {
        edgesToRemove.push(edge.id);
      }
    });
    
    edgesToRemove.forEach(edgeId => this.removeEdge(edgeId));
    
    this.adjacencyList.delete(nodeId);
    this.nodes.delete(nodeId);
    
    return true;
  }

  getNode(nodeId: NodeId): Node | undefined {
    return this.nodes.get(nodeId);
  }

  addEdge(params: Omit<GraphEdge, 'id'> & { id?: EdgeId }): Edge {
    const edge = new Edge(params);
    this.edges.set(edge.id, edge);
    
    if (!this.adjacencyList.has(edge.source)) {
      this.adjacencyList.set(edge.source, new Set());
    }
    if (!this.adjacencyList.has(edge.target)) {
      this.adjacencyList.set(edge.target, new Set());
    }
    
    this.adjacencyList.get(edge.source)!.add(edge.target);
    
    const sourceNode = this.nodes.get(edge.source);
    const targetNode = this.nodes.get(edge.target);
    
    if (edge.type === EdgeType.DEPENDENCY && sourceNode && targetNode) {
      sourceNode.addDependency(edge.target);
      targetNode.dependents.push(edge.source);
    }
    
    return edge;
  }

  removeEdge(edgeId: EdgeId): boolean {
    const edge = this.edges.get(edgeId);
    if (!edge) return false;
    
    const sourceAdjacent = this.adjacencyList.get(edge.source);
    if (sourceAdjacent) {
      sourceAdjacent.delete(edge.target);
    }
    
    if (edge.type === EdgeType.DEPENDENCY) {
      const sourceNode = this.nodes.get(edge.source);
      const targetNode = this.nodes.get(edge.target);
      
      if (sourceNode) {
        sourceNode.removeDependency(edge.target);
      }
      if (targetNode) {
        const index = targetNode.dependents.indexOf(edge.source);
        if (index > -1) {
          targetNode.dependents.splice(index, 1);
        }
      }
    }
    
    this.edges.delete(edgeId);
    return true;
  }

  getEdge(edgeId: EdgeId): Edge | undefined {
    return this.edges.get(edgeId);
  }

  getNeighbors(nodeId: NodeId): NodeId[] {
    return Array.from(this.adjacencyList.get(nodeId) || []);
  }

  getDependencies(nodeId: NodeId): Node[] {
    const node = this.nodes.get(nodeId);
    if (!node) return [];
    
    return node.dependencies
      .map(depId => this.nodes.get(depId))
      .filter((n): n is Node => n !== undefined);
  }

  getDependents(nodeId: NodeId): Node[] {
    const node = this.nodes.get(nodeId);
    if (!node) return [];
    
    return node.dependents
      .map(depId => this.nodes.get(depId))
      .filter((n): n is Node => n !== undefined);
  }

  getNodesByType(type: NodeType): Node[] {
    return Array.from(this.nodes.values()).filter(node => node.type === type);
  }

  getNodesByContributor(contributorId: ContributorId): Node[] {
    return Array.from(this.nodes.values()).filter(
      node => node.contributors.includes(contributorId)
    );
  }

  getNodesByPriorityThreshold(threshold: number): Node[] {
    return Array.from(this.nodes.values())
      .filter(node => node.priority.computed >= threshold)
      .sort((a, b) => b.priority.computed - a.priority.computed);
  }

  findPath(startId: NodeId, endId: NodeId): NodeId[] | null {
    if (!this.nodes.has(startId) || !this.nodes.has(endId)) {
      return null;
    }
    
    const visited = new Set<NodeId>();
    const queue: { nodeId: NodeId; path: NodeId[] }[] = [
      { nodeId: startId, path: [startId] }
    ];
    
    while (queue.length > 0) {
      const { nodeId, path } = queue.shift()!;
      
      if (nodeId === endId) {
        return path;
      }
      
      if (visited.has(nodeId)) {
        continue;
      }
      
      visited.add(nodeId);
      
      const neighbors = this.getNeighbors(nodeId);
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          queue.push({
            nodeId: neighbor,
            path: [...path, neighbor]
          });
        }
      }
    }
    
    return null;
  }

  detectCycles(): NodeId[][] {
    const cycles: NodeId[][] = [];
    const visited = new Set<NodeId>();
    const recursionStack = new Set<NodeId>();
    
    const dfs = (nodeId: NodeId, path: NodeId[]): void => {
      visited.add(nodeId);
      recursionStack.add(nodeId);
      path.push(nodeId);
      
      const neighbors = this.getNeighbors(nodeId);
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          dfs(neighbor, [...path]);
        } else if (recursionStack.has(neighbor)) {
          const cycleStart = path.indexOf(neighbor);
          if (cycleStart !== -1) {
            cycles.push(path.slice(cycleStart));
          }
        }
      }
      
      recursionStack.delete(nodeId);
    };
    
    for (const nodeId of this.nodes.keys()) {
      if (!visited.has(nodeId)) {
        dfs(nodeId, []);
      }
    }
    
    return cycles;
  }

  toJSON(): { nodes: GraphNode[]; edges: GraphEdge[] } {
    return {
      nodes: Array.from(this.nodes.values()).map(node => node.toJSON()),
      edges: Array.from(this.edges.values()).map(edge => edge.toJSON())
    };
  }

  get nodeCount(): number {
    return this.nodes.size;
  }

  get edgeCount(): number {
    return this.edges.size;
  }
}