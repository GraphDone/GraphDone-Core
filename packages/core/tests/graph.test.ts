import { describe, it, expect, beforeEach } from 'vitest';
import { Graph } from '../src/graph';
import { NodeType, EdgeType, NodeStatus } from '../src/types';

describe('Graph', () => {
  let graph: Graph;

  beforeEach(() => {
    graph = new Graph();
  });

  describe('node operations', () => {
    it('should add nodes to the graph', () => {
      const node1 = graph.addNode({
        title: 'Node 1',
        type: NodeType.TASK
      });
      const node2 = graph.addNode({
        title: 'Node 2',
        type: NodeType.OUTCOME
      });

      expect(graph.nodeCount).toBe(2);
      expect(graph.getNode(node1.id)).toBe(node1);
      expect(graph.getNode(node2.id)).toBe(node2);
    });

    it('should remove nodes from the graph', () => {
      const node = graph.addNode({
        title: 'Test Node',
        type: NodeType.TASK
      });

      const removed = graph.removeNode(node.id);
      
      expect(removed).toBe(true);
      expect(graph.nodeCount).toBe(0);
      expect(graph.getNode(node.id)).toBeUndefined();
    });

    it('should remove associated edges when removing a node', () => {
      const node1 = graph.addNode({ title: 'Node 1', type: NodeType.TASK });
      const node2 = graph.addNode({ title: 'Node 2', type: NodeType.TASK });
      const node3 = graph.addNode({ title: 'Node 3', type: NodeType.TASK });

      graph.addEdge({
        source: node1.id,
        target: node2.id,
        type: EdgeType.DEPENDENCY,
        weight: 1
      });
      graph.addEdge({
        source: node2.id,
        target: node3.id,
        type: EdgeType.DEPENDENCY,
        weight: 1
      });

      graph.removeNode(node2.id);

      expect(graph.nodeCount).toBe(2);
      expect(graph.edgeCount).toBe(0);
    });

    it('should get nodes by type', () => {
      graph.addNode({ title: 'Task 1', type: NodeType.TASK });
      graph.addNode({ title: 'Task 2', type: NodeType.TASK });
      graph.addNode({ title: 'Outcome 1', type: NodeType.OUTCOME });
      graph.addNode({ title: 'Milestone 1', type: NodeType.MILESTONE });

      const tasks = graph.getNodesByType(NodeType.TASK);
      const outcomes = graph.getNodesByType(NodeType.OUTCOME);

      expect(tasks).toHaveLength(2);
      expect(outcomes).toHaveLength(1);
    });

    it('should get nodes by contributor', () => {
      const node1 = graph.addNode({ title: 'Node 1', type: NodeType.TASK });
      const node2 = graph.addNode({ title: 'Node 2', type: NodeType.TASK });
      const node3 = graph.addNode({ title: 'Node 3', type: NodeType.TASK });

      node1.addContributor('user-1');
      node2.addContributor('user-1');
      node2.addContributor('user-2');
      node3.addContributor('user-2');

      const user1Nodes = graph.getNodesByContributor('user-1');
      const user2Nodes = graph.getNodesByContributor('user-2');

      expect(user1Nodes).toHaveLength(2);
      expect(user2Nodes).toHaveLength(2);
    });

    it('should get nodes by priority threshold', () => {
      const highPriority = graph.addNode({
        title: 'High Priority',
        type: NodeType.OUTCOME,
        priority: { executive: 0.9, individual: 0.8, community: 0.7, computed: 0 }
      });

      const mediumPriority = graph.addNode({
        title: 'Medium Priority',
        type: NodeType.TASK,
        priority: { executive: 0.5, individual: 0.5, community: 0.5, computed: 0 }
      });

      const lowPriority = graph.addNode({
        title: 'Low Priority',
        type: NodeType.IDEA,
        priority: { executive: 0.1, individual: 0.2, community: 0.1, computed: 0 }
      });

      const highPriorityNodes = graph.getNodesByPriorityThreshold(0.5);
      
      expect(highPriorityNodes).toHaveLength(2);
      expect(highPriorityNodes[0].title).toBe('High Priority');
    });
  });

  describe('edge operations', () => {
    it('should add edges to the graph', () => {
      const node1 = graph.addNode({ title: 'Node 1', type: NodeType.TASK });
      const node2 = graph.addNode({ title: 'Node 2', type: NodeType.TASK });

      const edge = graph.addEdge({
        source: node1.id,
        target: node2.id,
        type: EdgeType.DEPENDENCY,
        weight: 0.8
      });

      expect(graph.edgeCount).toBe(1);
      expect(graph.getEdge(edge.id)).toBe(edge);
    });

    it('should update node dependencies when adding dependency edges', () => {
      const node1 = graph.addNode({ title: 'Node 1', type: NodeType.TASK });
      const node2 = graph.addNode({ title: 'Node 2', type: NodeType.TASK });

      graph.addEdge({
        source: node1.id,
        target: node2.id,
        type: EdgeType.DEPENDENCY,
        weight: 1
      });

      expect(node1.dependencies).toContain(node2.id);
      expect(node2.dependents).toContain(node1.id);
    });

    it('should remove edges from the graph', () => {
      const node1 = graph.addNode({ title: 'Node 1', type: NodeType.TASK });
      const node2 = graph.addNode({ title: 'Node 2', type: NodeType.TASK });

      const edge = graph.addEdge({
        source: node1.id,
        target: node2.id,
        type: EdgeType.DEPENDENCY,
        weight: 1
      });

      const removed = graph.removeEdge(edge.id);

      expect(removed).toBe(true);
      expect(graph.edgeCount).toBe(0);
      expect(graph.getEdge(edge.id)).toBeUndefined();
    });
  });

  describe('graph traversal', () => {
    it('should get neighbors of a node', () => {
      const node1 = graph.addNode({ title: 'Node 1', type: NodeType.TASK });
      const node2 = graph.addNode({ title: 'Node 2', type: NodeType.TASK });
      const node3 = graph.addNode({ title: 'Node 3', type: NodeType.TASK });

      graph.addEdge({
        source: node1.id,
        target: node2.id,
        type: EdgeType.DEPENDENCY,
        weight: 1
      });
      graph.addEdge({
        source: node1.id,
        target: node3.id,
        type: EdgeType.RELATES_TO,
        weight: 0.5
      });

      const neighbors = graph.getNeighbors(node1.id);

      expect(neighbors).toHaveLength(2);
      expect(neighbors).toContain(node2.id);
      expect(neighbors).toContain(node3.id);
    });

    it('should get dependencies of a node', () => {
      const node1 = graph.addNode({ title: 'Node 1', type: NodeType.TASK });
      const node2 = graph.addNode({ title: 'Node 2', type: NodeType.TASK });
      const node3 = graph.addNode({ title: 'Node 3', type: NodeType.TASK });

      graph.addEdge({
        source: node1.id,
        target: node2.id,
        type: EdgeType.DEPENDENCY,
        weight: 1
      });
      graph.addEdge({
        source: node1.id,
        target: node3.id,
        type: EdgeType.DEPENDENCY,
        weight: 1
      });

      const dependencies = graph.getDependencies(node1.id);

      expect(dependencies).toHaveLength(2);
      expect(dependencies[0].id).toBe(node2.id);
      expect(dependencies[1].id).toBe(node3.id);
    });

    it('should get dependents of a node', () => {
      const node1 = graph.addNode({ title: 'Node 1', type: NodeType.TASK });
      const node2 = graph.addNode({ title: 'Node 2', type: NodeType.TASK });
      const node3 = graph.addNode({ title: 'Node 3', type: NodeType.TASK });

      graph.addEdge({
        source: node2.id,
        target: node1.id,
        type: EdgeType.DEPENDENCY,
        weight: 1
      });
      graph.addEdge({
        source: node3.id,
        target: node1.id,
        type: EdgeType.DEPENDENCY,
        weight: 1
      });

      const dependents = graph.getDependents(node1.id);

      expect(dependents).toHaveLength(2);
      expect(dependents[0].id).toBe(node2.id);
      expect(dependents[1].id).toBe(node3.id);
    });

    it('should find path between nodes', () => {
      const node1 = graph.addNode({ title: 'Node 1', type: NodeType.TASK });
      const node2 = graph.addNode({ title: 'Node 2', type: NodeType.TASK });
      const node3 = graph.addNode({ title: 'Node 3', type: NodeType.TASK });
      const node4 = graph.addNode({ title: 'Node 4', type: NodeType.TASK });

      graph.addEdge({
        source: node1.id,
        target: node2.id,
        type: EdgeType.DEPENDENCY,
        weight: 1
      });
      graph.addEdge({
        source: node2.id,
        target: node3.id,
        type: EdgeType.DEPENDENCY,
        weight: 1
      });
      graph.addEdge({
        source: node3.id,
        target: node4.id,
        type: EdgeType.DEPENDENCY,
        weight: 1
      });

      const path = graph.findPath(node1.id, node4.id);

      expect(path).toEqual([node1.id, node2.id, node3.id, node4.id]);
    });

    it('should return null for no path between nodes', () => {
      const node1 = graph.addNode({ title: 'Node 1', type: NodeType.TASK });
      const node2 = graph.addNode({ title: 'Node 2', type: NodeType.TASK });

      const path = graph.findPath(node1.id, node2.id);

      expect(path).toBeNull();
    });
  });

  describe('cycle detection', () => {
    it('should detect cycles in the graph', () => {
      const node1 = graph.addNode({ title: 'Node 1', type: NodeType.TASK });
      const node2 = graph.addNode({ title: 'Node 2', type: NodeType.TASK });
      const node3 = graph.addNode({ title: 'Node 3', type: NodeType.TASK });

      graph.addEdge({
        source: node1.id,
        target: node2.id,
        type: EdgeType.DEPENDENCY,
        weight: 1
      });
      graph.addEdge({
        source: node2.id,
        target: node3.id,
        type: EdgeType.DEPENDENCY,
        weight: 1
      });
      graph.addEdge({
        source: node3.id,
        target: node1.id,
        type: EdgeType.DEPENDENCY,
        weight: 1
      });

      const cycles = graph.detectCycles();

      expect(cycles).toHaveLength(1);
      expect(cycles[0]).toHaveLength(3);
    });

    it('should return empty array for acyclic graph', () => {
      const node1 = graph.addNode({ title: 'Node 1', type: NodeType.TASK });
      const node2 = graph.addNode({ title: 'Node 2', type: NodeType.TASK });
      const node3 = graph.addNode({ title: 'Node 3', type: NodeType.TASK });

      graph.addEdge({
        source: node1.id,
        target: node2.id,
        type: EdgeType.DEPENDENCY,
        weight: 1
      });
      graph.addEdge({
        source: node2.id,
        target: node3.id,
        type: EdgeType.DEPENDENCY,
        weight: 1
      });

      const cycles = graph.detectCycles();

      expect(cycles).toHaveLength(0);
    });
  });

  describe('serialization', () => {
    it('should serialize graph to JSON', () => {
      const node1 = graph.addNode({ title: 'Node 1', type: NodeType.TASK });
      const node2 = graph.addNode({ title: 'Node 2', type: NodeType.TASK });

      graph.addEdge({
        source: node1.id,
        target: node2.id,
        type: EdgeType.DEPENDENCY,
        weight: 1
      });

      const json = graph.toJSON();

      expect(json.nodes).toHaveLength(2);
      expect(json.edges).toHaveLength(1);
      expect(json.nodes[0]).toHaveProperty('id');
      expect(json.edges[0]).toHaveProperty('source');
    });
  });
});