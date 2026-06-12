import { describe, it, expect } from 'vitest';
import { mergeSimulationNodes, mergeSimulationEdges } from '../graphDataMerge';

interface SimNode {
  id: string;
  title?: string;
  status?: string;
  priority?: number;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
}

describe('mergeSimulationNodes — the fix for lines detaching from nodes', () => {
  it('preserves object identity for existing nodes (DOM bindings stay live)', () => {
    const sim: SimNode[] = [{ id: 'a', title: 'old', x: 10, y: 20, vx: 1, vy: 2 }];
    const incoming = [{ id: 'a', title: 'new title', status: 'IN_PROGRESS' }];

    const result = mergeSimulationNodes(sim, incoming);

    expect(result.nodes[0]).toBe(sim[0]);
    expect(sim[0].title).toBe('new title');
    expect(sim[0].status).toBe('IN_PROGRESS');
  });

  it('never clobbers physics state (x, y, vx, vy, fx, fy)', () => {
    const sim: SimNode[] = [{ id: 'a', x: 100, y: 200, vx: 3, vy: -4, fx: 100, fy: null }];
    const incoming = [{ id: 'a', x: 0, y: 0, positionX: 999, positionY: 999, title: 't' } as { id: string } & Record<string, unknown>];

    mergeSimulationNodes(sim, incoming);

    expect(sim[0].x).toBe(100);
    expect(sim[0].y).toBe(200);
    expect(sim[0].vx).toBe(3);
    expect(sim[0].vy).toBe(-4);
    expect(sim[0].fx).toBe(100);
  });

  it('reports added and removed node ids', () => {
    const sim: SimNode[] = [{ id: 'a' }, { id: 'b' }];
    const incoming = [{ id: 'b' }, { id: 'c', title: 'new' }];

    const result = mergeSimulationNodes(sim, incoming);

    expect(result.addedIds).toEqual(['c']);
    expect(result.removedIds).toEqual(['a']);
    expect(result.nodes.map((n) => n.id)).toEqual(['b', 'c']);
  });

  it('reports which existing nodes actually changed (for targeted DOM updates)', () => {
    const sim: SimNode[] = [
      { id: 'a', title: 'same', status: 'PLANNED' },
      { id: 'b', title: 'before', status: 'PLANNED' }
    ];
    const incoming = [
      { id: 'a', title: 'same', status: 'PLANNED' },
      { id: 'b', title: 'before', status: 'COMPLETED' }
    ];

    const result = mergeSimulationNodes(sim, incoming);

    expect(result.changedIds).toEqual(['b']);
  });

  it('seeds new nodes from positionX/positionY when present', () => {
    const result = mergeSimulationNodes<SimNode>([], [{ id: 'n', positionX: 42, positionY: -7 } as { id: string } & Record<string, unknown>]);
    expect(result.nodes[0].x).toBe(42);
    expect(result.nodes[0].y).toBe(-7);
  });
});

describe('mergeSimulationEdges', () => {
  it('keeps edge object identity and re-points source/target at live node objects', () => {
    const nodeA = { id: 'a', x: 1, y: 2 };
    const nodeB = { id: 'b', x: 3, y: 4 };
    const simEdges = [{ id: 'e1', type: 'DEPENDS_ON', source: nodeA, target: nodeB }];
    const incoming = [{ id: 'e1', type: 'BLOCKS', source: 'a', target: 'b' }];

    const result = mergeSimulationEdges(simEdges, incoming, [nodeA, nodeB]);

    expect(result.edges[0]).toBe(simEdges[0]);
    expect(result.edges[0].type).toBe('BLOCKS');
    expect(result.edges[0].source).toBe(nodeA);
    expect(result.edges[0].target).toBe(nodeB);
  });

  it('resolves string endpoints on new edges to node objects', () => {
    const nodeA = { id: 'a' };
    const nodeB = { id: 'b' };
    const result = mergeSimulationEdges<{ id: string; source: any; target: any }>([], [{ id: 'e', type: 'DEPENDS_ON', source: 'a', target: 'b' }], [nodeA, nodeB]);
    expect(result.edges[0].source).toBe(nodeA);
    expect(result.edges[0].target).toBe(nodeB);
    expect(result.addedIds).toEqual(['e']);
  });

  it('drops edges whose endpoints no longer exist', () => {
    const nodeA = { id: 'a' };
    const result = mergeSimulationEdges<{ id: string; source: any; target: any }>([], [{ id: 'e', type: 'DEPENDS_ON', source: 'a', target: 'ghost' }], [nodeA]);
    expect(result.edges).toEqual([]);
    expect(result.droppedIds).toEqual(['e']);
  });
});
