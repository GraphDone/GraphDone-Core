import { describe, it, expect } from 'vitest';
import { buildNeighborhood } from '../graphAdjacency';

const edge = (id: string, s: string, t: string) => ({ id, source: { id: s }, target: { id: t } });

describe('buildNeighborhood (LIVE-7): precomputed 1-hop lookup', () => {
  it('maps each node to its neighbors and incident edges', () => {
    const n = buildNeighborhood([edge('e1', 'a', 'b'), edge('e2', 'b', 'c')]);
    expect([...n.get('b')!.nodes].sort()).toEqual(['a', 'c']);
    expect([...n.get('b')!.edges].sort()).toEqual(['e1', 'e2']);
    expect([...n.get('a')!.nodes]).toEqual(['b']);
    expect([...n.get('c')!.edges]).toEqual(['e2']);
  });

  it('accepts string endpoints too', () => {
    const n = buildNeighborhood([{ id: 'e', source: 'x', target: 'y' }]);
    expect([...n.get('x')!.nodes]).toEqual(['y']);
  });

  it('returns an empty map for no edges', () => {
    expect(buildNeighborhood([]).size).toBe(0);
  });

  it('is O(1) per lookup on large graphs (<16ms for 500 nodes / 1500 edges total)', () => {
    const edges = Array.from({ length: 1500 }, (_, i) =>
      edge(`e${i}`, `n${i % 500}`, `n${(i * 7 + 1) % 500}`)
    );
    const start = performance.now();
    const n = buildNeighborhood(edges);
    for (let i = 0; i < 500; i++) n.get(`n${i}`);
    expect(performance.now() - start).toBeLessThan(16);
  });
});
