import { describe, expect, it } from 'vitest';
import {
  boundsOf,
  fitLabel,
  graphFrame,
  INITIAL_ZOOM_STATE,
  MAX_ZOOM_TILES,
  minZoomScale,
  neighbourRects,
  nextZoomState,
  Rect,
  ringCells,
  ZoomGraph,
  zoomContextOf,
  zoomLayout,
  ZoomLevel,
  zoomLevelOf,
} from './graphZoomContext';

const g = (id: string, name: string, parentGraphId: string | null = null, nodeCount = 0, createdAt = ''): ZoomGraph =>
  ({ id, name, parentGraphId, nodeCount, createdAt, type: parentGraphId ? 'SUBGRAPH' : 'PROJECT' });

// The example project new workspaces get (#277), plus an older top-level graph.
const starter: ZoomGraph[] = [
  g('gs', 'Getting started', null, 0, '1'),
  g('welcome', 'Welcome', 'gs', 4, '2'),
  g('launch', 'Plan a launch', 'gs', 12, '3'),
  g('bugs', 'Fix bugs', 'gs', 6, '4'),
  g('ideas', 'Ideas', 'gs', 5, '5'),
  g('home', 'Home', null, 0, '6'),
  g('move', 'Move house', 'home', 6, '7'),
  g('old', 'Old notes', null, 9, '0'),
];

const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const contains = (outer: Rect, inner: Rect) =>
  inner.x >= outer.x - 1e-6 && inner.y >= outer.y - 1e-6 &&
  inner.x + inner.w <= outer.x + outer.w + 1e-6 && inner.y + inner.h <= outer.y + outer.h + 1e-6;

describe('zoomContextOf', () => {
  it('finds the graphs beside this one and the projects above it', () => {
    const context = zoomContextOf(starter, 'welcome')!;
    expect(context.parent?.name).toBe('Getting started');
    expect(context.siblings.map(s => s.name)).toEqual(['Plan a launch', 'Fix bugs', 'Ideas']);
    // Current project first, then projects that hold graphs, then plain top-level graphs.
    expect(context.projects.map(p => p.graph.name)).toEqual(['Getting started', 'Home', 'Old notes']);
    expect(context.projects[0]).toMatchObject({ current: true, items: 27 });
    expect(context.projects[0].children.map(c => c.name)).toEqual(['Welcome', 'Plan a launch', 'Fix bugs', 'Ideas']);
    expect(context.projects[1]).toMatchObject({ current: false, items: 6 });
    expect(context.childCount.get('gs')).toBe(4);
  });

  it('gives a top-level graph its top-level neighbours and no project level', () => {
    const context = zoomContextOf(starter, 'old')!;
    expect(context.parent).toBeNull();
    expect(context.siblings.map(s => s.name)).toEqual(['Getting started', 'Home']);
    expect(context.projects).toEqual([]);
  });

  it('treats a missing parent id and null alike, and an unknown graph as no context', () => {
    const loose = [{ id: 'a', name: 'A' }, { id: 'b', name: 'B', parentGraphId: null }];
    expect(zoomContextOf(loose, 'a')!.siblings.map(s => s.id)).toEqual(['b']);
    expect(zoomContextOf(loose, 'missing')).toBeNull();
  });
});

describe('layout', () => {
  it('fills the nearest ring first, beside before above and below', () => {
    expect(ringCells(4)).toEqual([[1, 0], [-1, 0], [0, 1], [0, -1]]);
    const cells = ringCells(24);
    expect(new Set(cells.map(c => c.join())).size).toBe(24);
    expect(cells.slice(0, 8).every(([i, j]) => Math.max(Math.abs(i), Math.abs(j)) === 1)).toBe(true);
  });

  it('places neighbour tiles around the frame without overlapping it or each other', () => {
    const frame = { x: -300, y: -120, w: 600, h: 240 };
    for (const portrait of [false, true]) {
      const rects = neighbourRects(frame, 12, 0.3, portrait);
      for (const [i, r] of rects.entries()) {
        expect(overlaps(r, frame)).toBe(false);
        for (const other of rects.slice(i + 1)) expect(overlaps(r, other)).toBe(false);
      }
      // Portrait screens put the first neighbours above and below.
      const first = rects[0];
      expect(portrait ? first.x + first.w / 2 : first.y + first.h / 2).toBeCloseTo(portrait ? 0 : 0);
    }
  });

  it('frames every card, ignoring items without a position', () => {
    const frame = graphFrame([{ x: 0, y: 0 }, { x: 400, y: 100 }, { x: NaN, y: 3 }, {}], () => ({ width: 200, height: 80 }), 40)!;
    expect(frame).toEqual({ x: -140, y: -80, w: 680, h: 260 });
    expect(graphFrame([], () => ({ width: 1, height: 1 }))).toBeNull();
  });

  it('builds the project region from the frame and its neighbours, and caps the tiles', () => {
    const frame = { x: 0, y: 0, w: 500, h: 300 };
    const layout = zoomLayout(zoomContextOf(starter, 'welcome')!, frame);
    expect(layout.siblings.map(s => s.graph.name)).toEqual(['Plan a launch', 'Fix bugs', 'Ideas']);
    expect(contains(layout.cluster!, frame)).toBe(true);
    for (const s of layout.siblings) expect(contains(layout.cluster!, s.rect)).toBe(true);
    expect(layout.projects[0].project.current).toBe(true);
    expect(layout.projects[0].rect).toBe(layout.cluster);
    for (const [i, p] of layout.projects.entries()) {
      expect(contains(layout.span, p.rect)).toBe(true);
      for (const other of layout.projects.slice(i + 1)) expect(overlaps(p.rect, other.rect)).toBe(false);
    }

    const many = [g('root', 'Root'), ...Array.from({ length: 40 }, (_, i) => g(`c${i}`, `Graph ${i}`, 'root'))];
    const capped = zoomLayout(zoomContextOf(many, 'c0')!, frame);
    expect(capped.siblings).toHaveLength(MAX_ZOOM_TILES);
    expect(capped.moreSiblings).toBe(39 - MAX_ZOOM_TILES);
  });
});

/** Zoom out from `from` to the zoom limit in wheel-sized steps; return each level. */
function zoomOut(graphs: ZoomGraph[], id: string, frame: Rect, viewport: { w: number; h: number }, from = 1, overviewBelow = 0) {
  const portrait = viewport.h > viewport.w * 1.2;
  const layout = zoomLayout(zoomContextOf(graphs, id)!, frame, portrait);
  const min = minZoomScale(layout.span, viewport);
  const levels: ZoomLevel[] = [];
  let state = INITIAL_ZOOM_STATE;
  for (let k = from; k >= min * 0.999; k /= 1.15) {
    const overview = k < overviewBelow;
    state = nextZoomState(state, { scale: k, viewport, frame, overview, hasSiblings: layout.siblings.length > 0, cluster: layout.cluster });
    levels.push(zoomLevelOf(state, overview));
  }
  return { levels, min };
}

const DESKTOP = { w: 1440, h: 900 };
const TABLET = { w: 834, h: 1100 };
const PHONE = { w: 390, h: 664 };
const SMALL = { x: -255, y: -115, w: 510, h: 230 }; // the 4-item Welcome graph
const LARGE = { x: -4000, y: -3000, w: 8000, h: 6000 }; // a 2000-item graph

describe('nextZoomState', () => {
  for (const [name, viewport] of Object.entries({ DESKTOP, TABLET, PHONE })) {
    it(`walks up every level in order on ${name.toLowerCase()} for a small graph`, () => {
      const { levels } = zoomOut(starter, 'welcome', SMALL, viewport);
      expect(levels[0]).toBe(0);
      for (let i = 1; i < levels.length; i++) expect(levels[i]).toBeGreaterThanOrEqual(levels[i - 1]);
      expect(levels).toContain(2);
      expect(levels[levels.length - 1]).toBe(3);
    });

    it(`walks up every level on ${name.toLowerCase()} for a 2000-item graph`, () => {
      const { levels, min } = zoomOut(starter, 'welcome', LARGE, viewport, 1, 1);
      expect(min).toBeLessThan(0.1);
      expect(levels[1]).toBe(1); // the large-graph overview takes over below 1
      for (let i = 1; i < levels.length; i++) expect(levels[i]).toBeGreaterThanOrEqual(levels[i - 1]);
      expect(levels[levels.length - 1]).toBe(3);
    });
  }

  it('does not flicker when the camera rests near a threshold', () => {
    const layout = zoomLayout(zoomContextOf(starter, 'welcome')!, SMALL);
    const input = (scale: number) => ({ scale, viewport: DESKTOP, frame: SMALL, overview: false, hasSiblings: true, cluster: layout.cluster });
    // Find each scale where the level changes on the way out, then wobble ±3% around it.
    let state = INITIAL_ZOOM_STATE;
    const switches: number[] = [];
    for (let k = 1; k > 0.05; k *= 0.99) {
      const next = nextZoomState(state, input(k));
      if (zoomLevelOf(next, false) !== zoomLevelOf(state, false)) switches.push(k);
      state = next;
    }
    expect(switches.length).toBeGreaterThanOrEqual(2);
    for (const k of switches) {
      let s = nextZoomState(INITIAL_ZOOM_STATE, input(k * 1.5));
      s = nextZoomState(s, input(k));
      const settled = zoomLevelOf(s, false);
      for (let i = 0; i < 20; i++) {
        s = nextZoomState(s, input(k * (i % 2 ? 1.03 : 0.97)));
        expect(zoomLevelOf(s, false)).toBe(settled);
      }
    }
  });

  it('skips the neighbours level without neighbours and the project level for a top-level graph', () => {
    const alone = [g('p', 'Project'), g('only', 'Only graph', 'p', 4)];
    expect(zoomOut(alone, 'only', SMALL, DESKTOP).levels).not.toContain(2);
    const top = [g('a', 'A', null, 4), g('b', 'B', null, 4)];
    const levels = zoomOut(top, 'a', SMALL, DESKTOP).levels;
    expect(levels).toContain(2);
    expect(levels).not.toContain(3);
  });

  it('keeps the first screen unchanged: no neighbours at normal size', () => {
    const layout = zoomLayout(zoomContextOf(starter, 'welcome')!, SMALL);
    const tiny = { x: 0, y: 0, w: 210, h: 80 };
    for (const frame of [SMALL, tiny]) {
      const state = nextZoomState(INITIAL_ZOOM_STATE, { scale: 1, viewport: DESKTOP, frame, overview: false, hasSiblings: true, cluster: layout.cluster });
      expect(zoomLevelOf(state, false)).toBe(0);
    }
    // A one-item graph alone in its project is small enough to "fill" little of
    // the screen, but it still opens on its items, not on the projects.
    const lone = zoomLayout(zoomContextOf([g('p', 'Project'), g('only', 'Only graph', 'p', 1), g('q', 'Other')], 'only')!, tiny);
    for (const viewport of [DESKTOP, TABLET, PHONE]) {
      const state = nextZoomState(INITIAL_ZOOM_STATE, { scale: 1, viewport, frame: tiny, overview: false, hasSiblings: false, cluster: lone.cluster });
      expect(zoomLevelOf(state, false)).toBe(0);
      expect(zoomLevelOf(nextZoomState(state, { scale: 0.9, viewport, frame: tiny, overview: false, hasSiblings: false, cluster: lone.cluster }), false)).toBe(0);
    }
  });
});

describe('minZoomScale', () => {
  it('keeps 0.1 unless more is around, and then fits all of it', () => {
    expect(minZoomScale(null, DESKTOP)).toBe(0.1);
    expect(minZoomScale({ x: 0, y: 0, w: 1000, h: 600 }, DESKTOP)).toBe(0.1);
    const span = boundsOf([{ x: -20000, y: -9000, w: 40000, h: 18000 }])!;
    const min = minZoomScale(span, PHONE);
    expect(span.w * min).toBeLessThanOrEqual(PHONE.w);
    expect(span.h * min).toBeLessThanOrEqual(PHONE.h);
  });
});

describe('fitLabel', () => {
  it('keeps names that fit and truncates the rest', () => {
    expect(fitLabel('Ideas', 200, 15)).toBe('Ideas');
    expect(fitLabel('Plan a launch', 60, 15)).toMatch(/^Plan…$|^Pla…$|^Plan a…$/);
    expect(fitLabel('Plan a launch', 5, 15)).toBe('');
  });
});
