import { describe, it, expect } from 'vitest';
import {
  assignLayersByDependencyDirection, computeLayerYPositions, isHierarchicalLayout,
  parseLayoutMode, computeNodeLayerY, LAYOUT_MODE_STORAGE_KEY,
} from '../layoutAlgorithms';

const n = (id: string) => ({ id });
const dep = (source: string, target: string) => ({ source, target, type: 'DEPENDS_ON' });

describe('assignLayersByDependencyDirection', () => {
  it('puts dependency-free nodes at layer 0 and dependents below', () => {
    // A depends on B → B is the prerequisite (layer 0), A is layer 1.
    const layers = assignLayersByDependencyDirection([n('A'), n('B')], [dep('A', 'B')]);
    expect(layers.get('B')).toBe(0);
    expect(layers.get('A')).toBe(1);
  });

  it('layers a chain by longest dependency path', () => {
    const layers = assignLayersByDependencyDirection(
      [n('A'), n('B'), n('C')], [dep('A', 'B'), dep('B', 'C')],
    );
    expect(layers.get('C')).toBe(0);
    expect(layers.get('B')).toBe(1);
    expect(layers.get('A')).toBe(2);
  });

  it('isolated nodes are layer 0', () => {
    const layers = assignLayersByDependencyDirection([n('A'), n('X')], [dep('A', 'A2')]);
    expect(layers.get('X')).toBe(0);
  });

  it('ignores non-DEPENDS_ON edges', () => {
    const layers = assignLayersByDependencyDirection(
      [n('A'), n('B')], [{ source: 'A', target: 'B', type: 'RELATES_TO' }],
    );
    expect(layers.get('A')).toBe(0);
    expect(layers.get('B')).toBe(0);
  });

  it('accepts edges whose source/target are node objects', () => {
    const layers = assignLayersByDependencyDirection(
      [n('A'), n('B')], [{ source: { id: 'A' }, target: { id: 'B' }, type: 'DEPENDS_ON' }],
    );
    expect(layers.get('A')).toBe(1);
  });

  it('is cycle-safe (does not infinite-loop)', () => {
    const layers = assignLayersByDependencyDirection(
      [n('A'), n('B')], [dep('A', 'B'), dep('B', 'A')],
    );
    expect(layers.size).toBe(2); // returns finite layers
  });
});

describe('computeLayerYPositions', () => {
  it('maps layer 0 near the top and higher layers monotonically lower', () => {
    const layers = new Map([['A', 2], ['B', 1], ['C', 0]]);
    const ys = computeLayerYPositions(layers, { width: 1000, height: 900 }, 80);
    expect(ys.get(0)!).toBeLessThan(ys.get(1)!);
    expect(ys.get(1)!).toBeLessThan(ys.get(2)!);
    expect(ys.get(0)!).toBeGreaterThanOrEqual(0);
    expect(ys.get(2)!).toBeLessThanOrEqual(900);
  });

  it('single layer collapses to one row without dividing by zero', () => {
    const ys = computeLayerYPositions(new Map([['A', 0]]), { width: 500, height: 500 }, 50);
    expect(Number.isFinite(ys.get(0)!)).toBe(true);
  });
});

describe('isHierarchicalLayout', () => {
  it('true only for "hierarchical"', () => {
    expect(isHierarchicalLayout('hierarchical')).toBe(true);
    expect(isHierarchicalLayout('force')).toBe(false);
    expect(isHierarchicalLayout(undefined)).toBe(false);
  });
});

describe('parseLayoutMode', () => {
  it('keeps "hierarchical"', () => {
    expect(parseLayoutMode('hierarchical')).toBe('hierarchical');
  });

  it('defaults anything else to "force"', () => {
    expect(parseLayoutMode('force')).toBe('force');
    expect(parseLayoutMode('garbage')).toBe('force');
    expect(parseLayoutMode(null)).toBe('force');
    expect(parseLayoutMode(undefined)).toBe('force');
  });

  it('exposes a stable storage key', () => {
    expect(LAYOUT_MODE_STORAGE_KEY).toBe('graphdone:layoutMode');
  });
});

describe('computeNodeLayerY', () => {
  it('gives every node the Y of its dependency layer (prerequisite higher)', () => {
    // A depends on B → B layer 0 (top, smaller Y), A layer 1 (lower, larger Y).
    const ys = computeNodeLayerY([n('A'), n('B')], [dep('A', 'B')], { width: 1000, height: 900 });
    expect(ys.get('B')!).toBeLessThan(ys.get('A')!);
  });

  it('places nodes on the same layer at the same Y', () => {
    const ys = computeNodeLayerY(
      [n('A'), n('B'), n('C')], [dep('A', 'C'), dep('B', 'C')], { width: 800, height: 600 },
    );
    expect(ys.get('A')!).toBe(ys.get('B')!);
    expect(ys.get('C')!).toBeLessThan(ys.get('A')!);
  });

  it('returns a finite Y for every node in a single-layer graph', () => {
    const ys = computeNodeLayerY([n('A'), n('B')], [], { width: 500, height: 500 });
    expect(Number.isFinite(ys.get('A')!)).toBe(true);
    expect(Number.isFinite(ys.get('B')!)).toBe(true);
  });
});

describe('compact hierarchical card layout', () => {
  const size = (node: { id: string }) => ({ width: node.id === 'A' ? 200 : 170, height: node.id === 'A' ? 152 : 120 });
  it('keeps small dependency chains compact when a window grows', async () => {
    const { computeCompactLayout } = await import('../layoutAlgorithms');
    const nodes = [n('A'), n('B')];
    const small = computeCompactLayout(nodes, [dep('A', 'B')], { width: 390, height: 600 }, size);
    const large = computeCompactLayout(nodes, [dep('A', 'B')], { width: 2560, height: 1440 }, size);
    const gap = (points: typeof small) => points.get('A')!.y - points.get('B')!.y;
    expect(gap(large)).toBe(gap(small));
    expect(gap(large)).toBeLessThan(240);
    expect(gap(large) - (size(nodes[0]).height + size(nodes[1]).height) / 2).toBeGreaterThanOrEqual(48);
  });
  it('keeps mixed-size siblings clear and centers the occupied row', async () => {
    const { computeCompactLayout } = await import('../layoutAlgorithms');
    const nodes = [n('A'), n('B'), n('C')];
    const points = computeCompactLayout(nodes, [], { width: 844, height: 390 }, size);
    const left = points.get('A')!.x - size(nodes[0]).width / 2;
    const right = points.get('C')!.x + size(nodes[2]).width / 2;
    expect((left + right) / 2).toBe(422);
    for (let i = 1; i < nodes.length; i++) {
      expect(points.get(nodes[i].id)!.x - points.get(nodes[i - 1].id)!.x).toBeGreaterThan((size(nodes[i]).width + size(nodes[i - 1]).width) / 2 + 24);
    }
  });
});


it('wraps a wide set of independent tasks instead of making one unreadable strip', async () => {
  const { computeCompactLayout } = await import('../layoutAlgorithms');
  const nodes = Array.from({length:200}, (_,i) => ({id:`task-${i}`}));
  const points = [...computeCompactLayout(nodes, [], {width:1440,height:900}, () => ({width:170,height:120})).values()];
  expect(Math.max(...points.map(p=>p.x)) - Math.min(...points.map(p=>p.x))).toBeLessThan(1100);
  for(let i=0;i<points.length;i++)for(let j=i+1;j<points.length;j++) {
    expect(Math.abs(points[i].x-points[j].x)>=194 || Math.abs(points[i].y-points[j].y)>=144).toBe(true);
  }
});

describe('hierarchical rows with room for relationship labels', () => {
  const card = () => ({ width: 170, height: 120 });
  const link = (source: string, target: string, type = 'RELATES_TO') => ({ source, target, type });
  const view = { width: 1440, height: 900 };
  const borderGapX = (points: Map<string, { x: number; y: number }>, a: string, b: string) => Math.abs(points.get(b)!.x - points.get(a)!.x) - 170;

  it('keeps linked cards in a row apart by what the edge between them asks, and only them', async () => {
    const { computeCompactLayout } = await import('../layoutAlgorithms');
    const edges = [link('A', 'B'), link('B', 'C')];
    const points = computeCompactLayout([n('A'), n('B'), n('C')], edges, view, card, {
      edgeGap: edge => (edge.source === 'A' ? 200 : 100),
    });
    expect(new Set([...points.values()].map(p => p.y)).size).toBe(1);
    expect(borderGapX(points, 'A', 'B')).toBeCloseTo(200);
    expect(borderGapX(points, 'B', 'C')).toBeCloseTo(100);
    const plain = computeCompactLayout([n('A'), n('B'), n('C')], edges, view, card);
    expect(borderGapX(plain, 'A', 'B')).toBeCloseTo(36);
  });

  it('keeps rows apart by what the edges across them ask', async () => {
    const { computeCompactLayout } = await import('../layoutAlgorithms');
    const points = computeCompactLayout([n('A'), n('B')], [dep('A', 'B')], view, card, { edgeGap: () => 250 });
    expect(points.get('A')!.y - points.get('B')!.y - 120).toBeCloseTo(250);
  });

  it('puts a card under the prerequisite it depends on, not in the middle of its row', async () => {
    const { computeCompactLayout } = await import('../layoutAlgorithms');
    const nodes = ['P1', 'P2', 'P3', 'P4', 'X'].map(n);
    const points = computeCompactLayout(nodes, [dep('X', 'P4')], view, card);
    expect(points.get('X')!.y).toBeGreaterThan(points.get('P4')!.y);
    expect(points.get('X')!.x).toBeCloseTo(points.get('P4')!.x);
  });

  it('splits cards linked inside one dependency layer into rows instead of wiring through a row', async () => {
    const { computeCompactLayout } = await import('../layoutAlgorithms');
    // A hub with four spokes: the spokes go on their own row under the hub.
    const edges = ['S1', 'S2', 'S3', 'S4'].map(id => link('H', id));
    const points = computeCompactLayout(['H', 'S1', 'S2', 'S3', 'S4'].map(n), edges, view, card);
    for (const id of ['S1', 'S2', 'S3', 'S4']) expect(points.get(id)!.y).toBeGreaterThan(points.get('H')!.y);
  });

  it('wraps a long chain back and forth so every link stays short', async () => {
    const { computeCompactLayout } = await import('../layoutAlgorithms');
    const ids = Array.from({ length: 12 }, (_, i) => `step-${String(i).padStart(2, '0')}`);
    const edges = ids.slice(1).map((id, i) => link(ids[i], id, 'FOLLOWS'));
    const points = computeCompactLayout(ids.map(n), edges, { width: 390, height: 800 }, card, { edgeGap: () => 150 });
    expect(new Set([...points.values()].map(p => p.y)).size).toBeGreaterThan(1);
    for (const edge of edges) {
      const a = points.get(edge.source)!, b = points.get(edge.target)!;
      // Next to each other in a row, or straight down at a wrap.
      if (a.y === b.y) expect(borderGapX(points, edge.source, edge.target)).toBeCloseTo(150);
      else expect(Math.abs(a.x - b.x)).toBeLessThan(170);
    }
  });
});
