import { describe, expect, it } from 'vitest';
import {
  denseItemCandidates,
  localCardDimensions,
  localItemSlots,
  nearestDenseItem,
  type LocalItemObstacle,
} from './localItemLayout';
import { projectItemNeighborhood } from './localItemLOD';
import { indexSemanticRelationships } from './semanticRelationships';
import type { SemanticEdge, SemanticItem } from './semanticLOD';
import { measureGraphText } from './graphSymbolLayout';

const longTitle =
  '#2215 EPIC — Factory session loops, core tooling, automation hygiene and safe delivery across a complex distributed system';
const item = (id: string, group = 'Factory'): SemanticItem => ({
  id,
  title: `${longTitle} ${id}`,
  type: 'TASK',
  status: 'PROPOSED',
  metadata: { lod: { groupPath: [group] } },
});
const edge = (id: string, source: string, target: string): SemanticEdge => ({
  id,
  source,
  target,
  type: 'DEPENDS_ON',
});
const fixture = () => {
  const items = [
    item('hub'),
    ...Array.from({ length: 107 }, (_, i) =>
      item(`n${i}`, ['Factory', 'Infra', 'Platform'][i % 3])
    ),
    item('small'),
    item('s0'),
    item('s1'),
    item('s2'),
  ];
  const edges = [
    ...Array.from({ length: 107 }, (_, i) =>
      i === 106 ? edge(`e${i}`, `n${i}`, 'hub') : edge(`e${i}`, 'hub', `n${i}`)
    ),
    ...Array.from({ length: 3 }, (_, i) => edge(`s${i}`, 'small', `s${i}`)),
  ];
  return { items, edges, index: indexSemanticRelationships(items, edges) };
};
const distance = (a: LocalItemObstacle, b: LocalItemObstacle) =>
  Math.hypot(
    Math.max(0, a.x - b.x - b.width, b.x - a.x - a.width),
    Math.max(0, a.y - b.y - b.height, b.y - a.y - a.height)
  );
const assertGeometry = (
  result: ReturnType<typeof localItemSlots>,
  viewport: { width: number; height: number },
  obstacles: readonly LocalItemObstacle[]
) => {
  expect(result.slots.length).toBeLessThanOrEqual(7);
  expect(result.work.candidates).toBeLessThanOrEqual(96);
  expect(result.work.maxCandidates).toBe(96);
  for (const [i, slot] of result.slots.entries()) {
    expect(slot.width).toBeGreaterThan(0);
    expect(slot.height).toBeGreaterThan(0);
    expect(slot.x).toBeGreaterThanOrEqual(20);
    expect(slot.y).toBeGreaterThanOrEqual(20);
    expect(slot.x + slot.width).toBeLessThanOrEqual(viewport.width - 20);
    expect(slot.y + slot.height).toBeLessThanOrEqual(viewport.height - 20);
    for (const obstacle of obstacles)
      expect(distance(slot, obstacle)).toBeGreaterThanOrEqual(20);
    for (const other of result.slots.slice(i + 1))
      expect(distance(slot, other)).toBeGreaterThanOrEqual(64);
  }
};

describe('local item display geometry', () => {
  it('admits a useful 107-neighbor desktop cut with original cards and summaries at full title size', () => {
    const { index } = fixture();
    const initial = projectItemNeighborhood(index, 'hub', {
      capacity: 7,
      page: 0,
    });
    const dimensions = initial.cards.map(card =>
      localCardDimensions(card, 1440)
    );
    const cell = {
      width: Math.max(...dimensions.map(value => value.width)),
      height: Math.max(...dimensions.map(value => value.height)),
    };
    expect(cell).toEqual({ width: 320, height: 160 });
    for (const value of dimensions) {
      expect(value.title.lines.length).toBeLessThanOrEqual(3);
      for (const line of value.title.lines)
        expect(measureGraphText(line, 18, 600)).toBeLessThanOrEqual(
          value.width - 28
        );
    }
    const viewport = { width: 1440, height: 900 };
    const obstacles = [
      { x: 12, y: 12, width: 490, height: 160 },
      { x: 12, y: 808, width: 300, height: 72 },
      { x: 1140, y: 680, width: 280, height: 200 },
    ];
    const layout = localItemSlots(viewport, obstacles, cell);
    assertGeometry(layout, viewport, obstacles);
    const projection = projectItemNeighborhood(index, 'hub', {
      capacity: layout.slots.length,
      page: 0,
    });
    expect(
      projection.cards.filter(card => card.kind === 'item').length
    ).toBeGreaterThanOrEqual(2);
    expect(projection.cards.some(card => card.kind === 'summary')).toBe(true);
    expect(projection.cards).toHaveLength(layout.slots.length);
    expect(layout.slots).toHaveLength(7);
  });

  it('fits focus and one original on a 390×684 phone below three toolbar rows and above the footer', () => {
    const { index } = fixture();
    const viewport = { width: 390, height: 684 };
    const obstacles = [
      { x: 12, y: 12, width: 300, height: 160 },
      { x: 12, y: 600, width: 366, height: 72 },
      { x: 334, y: 12, width: 44, height: 44 },
      { x: 334, y: 68, width: 44, height: 44 },
      { x: 334, y: 124, width: 44, height: 44 },
    ];
    const layout = localItemSlots(viewport, obstacles, {
      width: 320,
      height: 160,
    });
    assertGeometry(layout, viewport, obstacles);
    expect(layout.slots.length).toBeGreaterThanOrEqual(2);
    const projection = projectItemNeighborhood(index, 'hub', {
      capacity: layout.slots.length,
      page: 0,
    });
    expect(
      projection.cards.filter(card => card.kind === 'item').length
    ).toBeGreaterThanOrEqual(2);
    expect(projection.overflowGroups.length).toBeGreaterThan(0);
    for (const card of projection.cards)
      expect(localCardDimensions(card, viewport.width).width).toBe(320);
    expect(
      localItemSlots(viewport, [...obstacles].reverse(), {
        width: 320,
        height: 160,
      })
    ).toEqual(layout);
  });

  it('reports one or zero real slots when overlays or a narrow viewport leave no more room', () => {
    const cell = { width: 320, height: 160 };
    const short = { width: 390, height: 300 };
    const toolbar = [{ x: 0, y: 0, width: 390, height: 60 }];
    const one = localItemSlots(short, toolbar, cell);
    expect(one.slots).toHaveLength(1);
    assertGeometry(one, short, toolbar);
    const blocked = [{ x: 0, y: 0, width: 390, height: 300 }];
    const none = localItemSlots(short, blocked, cell);
    expect(none.slots).toHaveLength(0);
    assertGeometry(none, short, blocked);
    const narrow = { width: 180, height: 684 };
    const focus = projectItemNeighborhood(fixture().index, 'hub', {
      capacity: 1,
      page: 0,
    }).cards[0];
    const dimensions = localCardDimensions(focus, narrow.width);
    const noWidth = localItemSlots(narrow, [], dimensions);
    expect(noWidth.slots).toHaveLength(0);
    assertGeometry(noWidth, narrow, []);
    expect(localItemSlots({ width: 0, height: 0 }, [], cell).slots).toEqual([]);
  });

  it('keeps the 96-candidate bound with many reordered obstacles', () => {
    const viewport = { width: 1440, height: 900 };
    const obstacles = Array.from({ length: 40 }, (_, i) => ({
      x: i % 2 ? 2 : 1394,
      y: 5 + i * 17,
      width: 44,
      height: 12,
    }));
    const a = localItemSlots(viewport, obstacles, { width: 320, height: 160 });
    const b = localItemSlots(viewport, [...obstacles].reverse(), {
      width: 320,
      height: 160,
    });
    expect(a).toEqual(b);
    assertGeometry(a, viewport, obstacles);
  });
});

describe('dense local focus selection', () => {
  it('recognizes 107 unique neighbors without treating degree three, loops or parallel edges as dense', () => {
    const { items, edges } = fixture();
    const parallels = Array.from({ length: 107 }, (_, i) =>
      edge(`parallel${i}`, 'small', 's0')
    );
    const index = indexSemanticRelationships(items, [
      ...edges,
      ...parallels,
      edge('loop', 'small', 'small'),
    ]);
    expect(denseItemCandidates(index)).toEqual(['hub']);
    expect(denseItemCandidates(index, 108)).toEqual([]);
  });

  it('uses a visible explicit selection before distance and ignores an offscreen selection', () => {
    const positions = new Map([
      ['center', { x: 100, y: 100 }],
      ['selected', { x: 0, y: 0 }],
      ['outside', { x: 1000, y: 1000 }],
    ]);
    const camera = { x: 200, y: 100, scale: 2 };
    const viewport = { width: 800, height: 600 };
    expect(
      nearestDenseItem(
        ['outside', 'selected', 'center'],
        positions,
        camera,
        viewport
      )
    ).toBe('center');
    expect(
      nearestDenseItem(
        ['outside', 'selected', 'center'],
        positions,
        camera,
        viewport,
        'selected'
      )
    ).toBe('selected');
    expect(
      nearestDenseItem(
        ['outside', 'selected', 'center'],
        positions,
        camera,
        viewport,
        'outside'
      )
    ).toBe('center');
    expect(
      nearestDenseItem(['center'], positions, camera, viewport, 'selected')
    ).toBe('center');
  });

  it('does not pull in a nearby offscreen candidate or a missing/nonfinite position', () => {
    const positions = new Map([
      ['left', { x: -0.001, y: 300 }],
      ['right', { x: 800.001, y: 300 }],
      ['top', { x: 400, y: -0.001 }],
      ['bottom', { x: 400, y: 600.001 }],
      ['invalid', { x: NaN, y: 300 }],
    ]);
    expect(
      nearestDenseItem(
        [...positions.keys(), 'missing'],
        positions,
        { x: 0, y: 0, scale: 1 },
        { width: 800, height: 600 },
        'left'
      )
    ).toBeUndefined();
  });

  it('makes the same focus choice after input and candidate reordering', () => {
    const { items, edges, index } = fixture();
    const reverse = indexSemanticRelationships(
      [...items].reverse(),
      [...edges].reverse()
    );
    expect(denseItemCandidates(index).sort()).toEqual(
      denseItemCandidates(reverse).sort()
    );
    const positions = new Map([
      ['a', { x: 300, y: 300 }],
      ['b', { x: 500, y: 300 }],
    ]);
    const camera = { x: 0, y: 0, scale: 1 };
    const viewport = { width: 800, height: 600 };
    expect(nearestDenseItem(['b', 'a'], positions, camera, viewport)).toBe('a');
    expect(nearestDenseItem(['a', 'b'], positions, camera, viewport)).toBe('a');
  });

  it('does not activate a dense neighborhood from pending endpoints when only three neighbors are loaded', () => {
    const items = [item('hub'), item('a'), item('b'), item('c')];
    const edges = [
      edge('a', 'hub', 'a'),
      edge('b', 'hub', 'b'),
      edge('c', 'hub', 'c'),
      ...Array.from({ length: 107 }, (_, i) =>
        edge(`pending${i}`, 'hub', `absent${i}`)
      ),
    ];
    expect(
      denseItemCandidates(indexSemanticRelationships(items, edges))
    ).toEqual([]);
  });
});
