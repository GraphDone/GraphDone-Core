import { v4 as uuidv4 } from 'uuid';
import {
  GraphNode,
  NodeId,
  NodeType,
  NodeStatus,
  SphericalCoordinate,
  Priority,
  ContributorId
} from './types';
import { PriorityCalculator } from './priority';

export class Node implements GraphNode {
  public readonly id: NodeId;
  public type: NodeType;
  public title: string;
  public description?: string;
  public position: SphericalCoordinate;
  public priority: Priority;
  public status: NodeStatus;
  public contributors: ContributorId[];
  public dependencies: NodeId[];
  public dependents: NodeId[];
  public readonly createdAt: Date;
  public updatedAt: Date;
  public metadata?: Record<string, unknown>;

  private priorityCalculator: PriorityCalculator;

  constructor(params: Partial<GraphNode> & { title: string; type: NodeType }) {
    this.id = params.id || uuidv4();
    this.type = params.type;
    this.title = params.title;
    this.description = params.description;
    this.status = params.status || NodeStatus.PROPOSED;
    this.contributors = params.contributors || [];
    this.dependencies = params.dependencies || [];
    this.dependents = params.dependents || [];
    this.createdAt = params.createdAt || new Date();
    this.updatedAt = params.updatedAt || new Date();
    this.metadata = params.metadata;
    
    this.priorityCalculator = new PriorityCalculator();
    
    const priorityInput = params.priority || {
      executive: 0,
      individual: 0,
      community: 0,
      computed: 0
    };
    
    this.priority = this.priorityCalculator.calculate(priorityInput);
    
    this.position = params.position || this.calculatePosition();
  }

  private calculatePosition(): SphericalCoordinate {
    const radius = this.priorityCalculator.calculateRadiusFromPriority(
      this.priority.computed
    );
    
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    
    return { radius, theta, phi };
  }

  updatePriority(updates: Partial<Omit<Priority, 'computed'>>): void {
    const newPriority = {
      executive: updates.executive ?? this.priority.executive,
      individual: updates.individual ?? this.priority.individual,
      community: updates.community ?? this.priority.community
    };
    
    this.priority = this.priorityCalculator.calculate(newPriority);
    this.position.radius = this.priorityCalculator.calculateRadiusFromPriority(
      this.priority.computed
    );
    this.updatedAt = new Date();
  }

  addContributor(contributorId: ContributorId): void {
    if (!this.contributors.includes(contributorId)) {
      this.contributors.push(contributorId);
      this.updatedAt = new Date();
    }
  }

  removeContributor(contributorId: ContributorId): void {
    const index = this.contributors.indexOf(contributorId);
    if (index > -1) {
      this.contributors.splice(index, 1);
      this.updatedAt = new Date();
    }
  }

  addDependency(nodeId: NodeId): void {
    if (!this.dependencies.includes(nodeId)) {
      this.dependencies.push(nodeId);
      this.updatedAt = new Date();
    }
  }

  removeDependency(nodeId: NodeId): void {
    const index = this.dependencies.indexOf(nodeId);
    if (index > -1) {
      this.dependencies.splice(index, 1);
      this.updatedAt = new Date();
    }
  }

  updateStatus(status: NodeStatus): void {
    this.status = status;
    this.updatedAt = new Date();
  }

  toJSON(): GraphNode {
    return {
      id: this.id,
      type: this.type,
      title: this.title,
      description: this.description,
      position: this.position,
      priority: this.priority,
      status: this.status,
      contributors: this.contributors,
      dependencies: this.dependencies,
      dependents: this.dependents,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      metadata: this.metadata
    };
  }
}