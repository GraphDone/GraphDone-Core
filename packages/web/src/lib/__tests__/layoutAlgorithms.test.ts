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
