import { describe, it, expect } from 'vitest';
import { nodePairKey, assignParallelEdgeIndices } from '../parallelEdges';

describe('nodePairKey', () => {
  it('is order-independent (A→B === B→A)', () => {
    expect(nodePairKey('a', 'b')).toBe(nodePairKey('b', 'a'));
  });
  it('reads .id from object endpoints (post force-link binding)', () => {
    expect(nodePairKey({ id: 'a' }, { id: 'b' })).toBe(nodePairKey('a', 'b'));
  });
  it('distinguishes different pairs', () => {
    expect(nodePairKey('a', 'b')).not.toBe(nodePairKey('a', 'c'));
  });
});

describe('assignParallelEdgeIndices', () => {
  it('marks a lone edge as index 0 of total 1', () => {
    const m = assignParallelEdgeIndices([{ id: 'e1', source: 'a', target: 'b' }]);
    expect(m.get('e1')).toEqual({ index: 0, total: 1 });
  });

  it('groups edges between the same pair regardless of direction', () => {
    const m = assignParallelEdgeIndices([
      { id: 'e1', source: 'a', target: 'b' },
      { id: 'e2', source: 'b', target: 'a' },
      { id: 'e3', source: 'a', target: 'b' },
    ]);
    expect(m.get('e1')!.total).toBe(3);
    expect(m.get('e2')!.total).toBe(3);
    expect(m.get('e3')!.total).toBe(3);
    const indices = ['e1', 'e2', 'e3'].map((id) => m.get(id)!.index).sort();
    expect(indices).toEqual([0, 1, 2]);
  });

  it('keeps separate pairs independent', () => {
    const m = assignParallelEdgeIndices([
      { id: 'e1', source: 'a', target: 'b' },
      { id: 'e2', source: 'a', target: 'b' },
      { id: 'e3', source: 'c', target: 'd' },
    ]);
    expect(m.get('e1')!.total).toBe(2);
    expect(m.get('e2')!.total).toBe(2);
    expect(m.get('e3')).toEqual({ index: 0, total: 1 });
  });

  it('assigns indices in input order (stable)', () => {
    const m = assignParallelEdgeIndices([
      { id: 'first', source: 'a', target: 'b' },
      { id: 'second', source: 'a', target: 'b' },
    ]);
    expect(m.get('first')!.index).toBe(0);
    expect(m.get('second')!.index).toBe(1);
  });

  it('works with object endpoints', () => {
    const a = { id: 'a' };
    const b = { id: 'b' };
    const m = assignParallelEdgeIndices([
      { id: 'e1', source: a, target: b },
      { id: 'e2', source: b, target: a },
    ]);
    expect(m.get('e1')!.total).toBe(2);
    expect(m.get('e2')!.total).toBe(2);
  });
});
