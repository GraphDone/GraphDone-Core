import { expect, it } from 'vitest';
import {
  organizeTopology,
  organizationAdjacency,
} from './topologyOrganization';

const size = (node: { id: string }) => ({
  width: node.id === 'long' ? 320 : 240,
  height: node.id === 'long' ? 190 : 120,
});
const view = { width: 1360, height: 850 };
const edge = (source: string, target: string) => ({ source, target });
const checkClearance = (
  result: ReturnType<typeof organizeTopology>,
  nodes: { id: string }[]
) => {
  for (let i = 0; i < nodes.length; i++)
    for (let j = 0; j < i; j++) {
      const a = result.positions.get(nodes[i].id)!,
        b = result.positions.get(nodes[j].id)!;
      const da = size(nodes[i]),
        db = size(nodes[j]);
      const dx = Math.max(0, Math.abs(a.x - b.x) - (da.width + db.width) / 2);
      const dy = Math.max(0, Math.abs(a.y - b.y) - (da.height + db.height) / 2);
      expect(Math.hypot(dx, dy)).toBeGreaterThanOrEqual(63.99);
    }
};

it('puts the actual hub at the center of a clear ring without duplicate-type bias', () => {
  const nodes = [
    'hub',
    'long',
    ...Array.from({ length: 7 }, (_, i) => `leaf-${i}`),
  ].map(id => ({ id }));
  const edges = nodes.slice(1).map(n => edge('hub', n.id));
  const input = structuredClone({ nodes, edges });
  const result = organizeTopology(nodes, edges, size, view);
  const center = result.positions.get('hub')!;
  expect(result.components[0]).toMatchObject({ kind: 'hub', center: 'hub' });
  const ring = nodes.slice(1).map(n => result.positions.get(n.id)!);
  expect(ring.reduce((sum, p) => sum + p.x, 0) / ring.length).toBeCloseTo(
    center.x,
    5
  );
  expect(ring.reduce((sum, p) => sum + p.y, 0) / ring.length).toBeCloseTo(
    center.y,
    5
  );
  const radii = ring.map(p => Math.hypot(p.x - center.x, p.y - center.y));
  expect(Math.max(...radii) - Math.min(...radii)).toBeLessThan(0.001);
  checkClearance(result, nodes);
  expect(
    organizeTopology(
      [...nodes].reverse(),
      [
        ...edges,
        ...Array.from({ length: 100 }, () => edge('hub', 'long')),
      ].reverse(),
      size,
      view
    ).positions
  ).toEqual(result.positions);
  expect({ nodes, edges }).toEqual(input);
});

it('follows cycle and chain topology instead of inventing dependency tiers', () => {
  const nodes = Array.from({ length: 12 }, (_, i) => ({
    id: `node-${String(i).padStart(2, '0')}`,
  }));
  const path = nodes.slice(1).map((n, i) => edge(nodes[i].id, n.id));
  const chain = organizeTopology(nodes, path, size, view);
  const cycle = organizeTopology(
    nodes,
    [...path, edge(nodes.at(-1)!.id, nodes[0].id)],
    size,
    view
  );
  expect(chain.components[0].kind).toBe('chain');
  expect(cycle.components[0].kind).toBe('cycle');
  for (const result of [chain, cycle]) checkClearance(result, nodes);
  for (const link of path) {
    const a = chain.positions.get(link.source)!,
      b = chain.positions.get(link.target)!;
    expect(a.x === b.x || a.y === b.y).toBe(true);
  }
  expect(
    new Set([...cycle.positions.values()].map(p => Math.round(p.y))).size
  ).toBeGreaterThan(3);
});

it('separates disconnected systems and ignores unresolved or self endpoints for placement', () => {
  const nodes = ['a', 'b', 'c', 'd', 'long', 'isolated'].map(id => ({ id }));
  const edges = [
    edge('a', 'b'),
    edge('c', 'd'),
    edge('d', 'long'),
    edge('a', 'missing'),
    edge('a', 'a'),
  ];
  const result = organizeTopology(nodes, edges, size, {
    width: 390,
    height: 844,
  });
  expect(result.components).toHaveLength(3);
  expect(result.positions.size).toBe(nodes.length);
  expect(organizationAdjacency(nodes, edges).get('a')).toEqual(['b']);
  checkClearance(result, nodes);
  expect(organizeTopology([], [], size, view).positions.size).toBe(0);
});

it('bounds iterative network work at two thousand items and five thousand relationships', () => {
  const nodes = Array.from({ length: 2000 }, (_, i) => ({
    id: `node-${String(i).padStart(4, '0')}`,
  }));
  const edges = Array.from({ length: 5000 }, (_, i) =>
    edge(
      nodes[i % 2000].id,
      nodes[i < 1999 ? i + 1 : (i * 17 + Math.floor(i / 2000) * 31 + 23) % 2000]
        .id
    )
  );
  const result = organizeTopology(nodes, edges, size, view);
  expect(result.positions.size).toBe(2000);
  expect(
    [...result.positions.values()].every(
      p => Number.isFinite(p.x) && Number.isFinite(p.y)
    )
  ).toBe(true);
  expect(result.work.edgeEvaluations).toBeLessThanOrEqual(40000);
  expect(result.work.pairCandidates).toBeGreaterThan(0);
  expect(
    organizeTopology([...nodes].reverse(), [...edges].reverse(), size, view)
      .positions
  ).toEqual(result.positions);
});

it('keeps a small phone hub and every neighbor within a readable viewport with wiring clearance', () => {
  const nodes = ['hub', 'a', 'b', 'c', 'd'].map(id => ({ id }));
  const dimensions = () => ({ width: 220, height: 104 });
  const edges = nodes.slice(1).map(node => edge('hub', node.id));
  const result = organizeTopology(nodes, edges, dimensions, {
    width: 390,
    height: 684,
  });
  const points = [...result.positions.values()];
  const width =
    Math.max(...points.map(p => p.x + 110)) -
    Math.min(...points.map(p => p.x - 110));
  const height =
    Math.max(...points.map(p => p.y + 52)) -
    Math.min(...points.map(p => p.y - 52));
  expect(width * 0.65).toBeLessThanOrEqual(350);
  expect(height * 0.65).toBeLessThanOrEqual(484);
  for (let i = 0; i < points.length; i++)
    for (let j = 0; j < i; j++) {
      const dx = Math.max(0, Math.abs(points[i].x - points[j].x) - 220);
      const dy = Math.max(0, Math.abs(points[i].y - points[j].y) - 104);
      expect(Math.hypot(dx, dy)).toBeGreaterThanOrEqual(64);
    }
  const hub = result.positions.get('hub')!;
  const leaves = nodes.slice(1).map(node => result.positions.get(node.id)!);
  expect(leaves.reduce((sum, p) => sum + p.x, 0) / 4).toBeCloseTo(hub.x, 5);
  expect(leaves.reduce((sum, p) => sum + p.y, 0) / 4).toBeCloseTo(hub.y, 5);
  expect(
    organizeTopology([...nodes].reverse(), [...edges].reverse(), dimensions, {
      width: 390,
      height: 684,
    }).positions
  ).toEqual(result.positions);
});
