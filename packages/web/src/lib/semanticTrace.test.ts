import { expect, it } from 'vitest';
import { projectSemanticTrace } from './semanticTrace';
import type { SemanticBundle, SemanticGroup } from './semanticLOD';

const groups: SemanticGroup[] = ['hub', 'a', 'b', 'c', 'unrelated'].map(id => ({
  id,
  label: id,
  hierarchyId: id,
  basis: 'path',
  members: [],
  internalEdges: [],
  blocked: 0,
  completed: 0,
  ancestors: [],
  children: [],
  isDirect: false,
}));
const bundles: SemanticBundle[] = ['a', 'b', 'c'].flatMap(target =>
  ['BLOCKS', 'DEPENDS_ON'].map(type => ({
    id: `${target}:${type}`,
    source: 'hub',
    target,
    type,
    edges: [
      {
        id: `original:${target}:${type}`,
        source: 'hub-item',
        target: `${target}-item`,
        type,
      },
    ],
  }))
);

it('pages exact typed bundles once, excludes unrelated groups and keeps the focus on every page', () => {
  const seen: string[] = [];
  for (const page of [0, 1, 2]) {
    const result = projectSemanticTrace(
      groups,
      bundles,
      { groupId: 'hub', direction: 'outgoing', page },
      2
    );
    expect(result.groups.map(group => group.id)).toEqual([
      'hub',
      ['a', 'b', 'c'][page],
    ]);
    expect(result.pages).toBe(3);
    expect(result.totalNeighbors).toBe(3);
    expect(result.shownNeighbors).toBe(1);
    for (const bundle of result.bundles) {
      expect(bundles).toContain(bundle);
      seen.push(...bundle.edges.map(edge => edge.id));
    }
    expect(
      projectSemanticTrace(
        [...groups].reverse(),
        [...bundles].reverse(),
        { groupId: 'hub', direction: 'outgoing', page },
        2
      ).groups.map(group => group.id)
    ).toEqual(result.groups.map(group => group.id));
  }
  expect(seen.sort()).toEqual(
    bundles.flatMap(bundle => bundle.edges.map(edge => edge.id)).sort()
  );
});

it('retains the source alone when a narrow viewport cannot fit a neighbor', () => {
  const result = projectSemanticTrace(
    groups,
    bundles,
    { groupId: 'hub', direction: 'outgoing', page: 0 },
    1
  );
  expect(result.groups.map(group => group.id)).toEqual(['hub']);
  expect(result.bundles).toEqual([]);
  expect(result.hasRoom).toBe(false);
  expect(result.shownNeighbors).toBe(0);
  expect(result.totalNeighbors).toBe(3);
});

it('clamps the current page after a live removal without changing incoming directions', () => {
  const incoming = bundles
    .filter(bundle => bundle.target === 'a')
    .map(bundle => ({
      ...bundle,
      source: bundle.target,
      target: bundle.source,
    }));
  const result = projectSemanticTrace(
    groups,
    incoming,
    { groupId: 'hub', direction: 'incoming', page: 2 },
    2
  );
  expect(result.page).toBe(0);
  expect(result.groups.map(group => group.id)).toEqual(['hub', 'a']);
  expect(result.bundles).toEqual(incoming);
  expect(result.bundles.every(bundle => bundle.target === 'hub')).toBe(true);
});

it('makes a removed focus unavailable instead of silently switching scope', () => {
  const result = projectSemanticTrace(
    groups.filter(group => group.id !== 'hub'),
    bundles,
    { groupId: 'hub', direction: 'outgoing', page: 0 },
    6
  );
  expect(result.focus).toBeUndefined();
  expect(result.groups).toEqual([]);
  expect(result.bundles).toEqual([]);
});
