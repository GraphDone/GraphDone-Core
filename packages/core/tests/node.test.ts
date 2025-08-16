import { describe, it, expect, beforeEach } from 'vitest';
import { Node } from '../src/node';
import { NodeType, NodeStatus } from '../src/types';

describe('Node', () => {
  let node: Node;

  beforeEach(() => {
    node = new Node({
      title: 'Test Node',
      type: NodeType.TASK,
      description: 'Test description'
    });
  });

  describe('constructor', () => {
    it('should create a node with default values', () => {
      expect(node.title).toBe('Test Node');
      expect(node.type).toBe(NodeType.TASK);
      expect(node.status).toBe(NodeStatus.PROPOSED);
      expect(node.contributors).toEqual([]);
      expect(node.dependencies).toEqual([]);
      expect(node.dependents).toEqual([]);
    });

    it('should generate an ID if not provided', () => {
      expect(node.id).toBeDefined();
      expect(node.id).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('should calculate initial position based on priority', () => {
      expect(node.position).toBeDefined();
      expect(node.position.radius).toBeGreaterThanOrEqual(0);
      expect(node.position.radius).toBeLessThanOrEqual(1);
      expect(node.position.theta).toBeGreaterThanOrEqual(0);
      expect(node.position.theta).toBeLessThanOrEqual(2 * Math.PI);
      expect(node.position.phi).toBeGreaterThanOrEqual(0);
      expect(node.position.phi).toBeLessThanOrEqual(Math.PI);
    });

    it('should accept custom priority values', () => {
      const customNode = new Node({
        title: 'Custom Priority Node',
        type: NodeType.OUTCOME,
        priority: {
          executive: 0.8,
          individual: 0.6,
          community: 0.4,
          computed: 0
        }
      });

      expect(customNode.priority.executive).toBe(0.8);
      expect(customNode.priority.individual).toBe(0.6);
      expect(customNode.priority.community).toBe(0.4);
      expect(customNode.priority.computed).toBeCloseTo(0.62);
    });
  });

  describe('updatePriority', () => {
    it('should update priority and recalculate position', () => {
      const initialRadius = node.position.radius;
      
      node.updatePriority({ executive: 0.9 });
      
      expect(node.priority.executive).toBe(0.9);
      expect(node.position.radius).not.toBe(initialRadius);
      expect(node.updatedAt).not.toBe(node.createdAt);
    });

    it('should partially update priority values', () => {
      node.updatePriority({ executive: 0.5 });
      const afterFirst = node.priority.individual;
      
      node.updatePriority({ individual: 0.7 });
      
      expect(node.priority.executive).toBe(0.5);
      expect(node.priority.individual).toBe(0.7);
    });
  });

  describe('contributor management', () => {
    it('should add contributors', () => {
      node.addContributor('contributor-1');
      node.addContributor('contributor-2');
      
      expect(node.contributors).toContain('contributor-1');
      expect(node.contributors).toContain('contributor-2');
      expect(node.contributors).toHaveLength(2);
    });

    it('should not add duplicate contributors', () => {
      node.addContributor('contributor-1');
      node.addContributor('contributor-1');
      
      expect(node.contributors).toHaveLength(1);
    });

    it('should remove contributors', () => {
      node.addContributor('contributor-1');
      node.addContributor('contributor-2');
      node.removeContributor('contributor-1');
      
      expect(node.contributors).not.toContain('contributor-1');
      expect(node.contributors).toContain('contributor-2');
      expect(node.contributors).toHaveLength(1);
    });
  });

  describe('dependency management', () => {
    it('should add dependencies', () => {
      node.addDependency('node-1');
      node.addDependency('node-2');
      
      expect(node.dependencies).toContain('node-1');
      expect(node.dependencies).toContain('node-2');
      expect(node.dependencies).toHaveLength(2);
    });

    it('should not add duplicate dependencies', () => {
      node.addDependency('node-1');
      node.addDependency('node-1');
      
      expect(node.dependencies).toHaveLength(1);
    });

    it('should remove dependencies', () => {
      node.addDependency('node-1');
      node.addDependency('node-2');
      node.removeDependency('node-1');
      
      expect(node.dependencies).not.toContain('node-1');
      expect(node.dependencies).toContain('node-2');
      expect(node.dependencies).toHaveLength(1);
    });
  });

  describe('updateStatus', () => {
    it('should update node status', () => {
      node.updateStatus(NodeStatus.IN_PROGRESS);
      expect(node.status).toBe(NodeStatus.IN_PROGRESS);
      
      node.updateStatus(NodeStatus.COMPLETED);
      expect(node.status).toBe(NodeStatus.COMPLETED);
    });

    it('should update timestamp when status changes', () => {
      const initialUpdatedAt = node.updatedAt;
      
      setTimeout(() => {
        node.updateStatus(NodeStatus.IN_PROGRESS);
        expect(node.updatedAt).not.toBe(initialUpdatedAt);
      }, 10);
    });
  });

  describe('toJSON', () => {
    it('should serialize node to JSON format', () => {
      const json = node.toJSON();
      
      expect(json).toHaveProperty('id');
      expect(json).toHaveProperty('type');
      expect(json).toHaveProperty('title');
      expect(json).toHaveProperty('description');
      expect(json).toHaveProperty('position');
      expect(json).toHaveProperty('priority');
      expect(json).toHaveProperty('status');
      expect(json).toHaveProperty('contributors');
      expect(json).toHaveProperty('dependencies');
      expect(json).toHaveProperty('dependents');
      expect(json).toHaveProperty('createdAt');
      expect(json).toHaveProperty('updatedAt');
    });
  });
});