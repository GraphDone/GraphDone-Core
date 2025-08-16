import { v4 as uuidv4 } from 'uuid';
import { GraphEdge, EdgeId, NodeId, EdgeType } from './types';

export class Edge implements GraphEdge {
  public readonly id: EdgeId;
  public source: NodeId;
  public target: NodeId;
  public type: EdgeType;
  public weight: number;
  public metadata?: Record<string, unknown>;

  constructor(params: Omit<GraphEdge, 'id'> & { id?: EdgeId }) {
    this.id = params.id || uuidv4();
    this.source = params.source;
    this.target = params.target;
    this.type = params.type;
    this.weight = params.weight;
    this.metadata = params.metadata;
  }

  updateWeight(weight: number): void {
    this.weight = Math.max(0, Math.min(1, weight));
  }

  reverse(): Edge {
    return new Edge({
      source: this.target,
      target: this.source,
      type: this.type,
      weight: this.weight,
      metadata: this.metadata
    });
  }

  toJSON(): GraphEdge {
    return {
      id: this.id,
      source: this.source,
      target: this.target,
      type: this.type,
      weight: this.weight,
      metadata: this.metadata
    };
  }
}