/** Zoom-out context: what the graph view shows when cards get too small to read.
 *
 * Zooming out walks up the graph hierarchy (#277):
 *   0  items: cards with readable titles
 *   1  the graph as one labelled frame
 *   2  the other graphs beside it (same parent), as labelled tiles
 *   3  projects: the current project's graphs collapse into one labelled region,
 *      beside the other projects
 * Every level has a readable label, so zooming out never ends on bare shapes.
 *
 * Everything here is a display projection in world coordinates (the same space
 * as item positions): nothing enters the simulation or the position-save queue.
 */

export interface ZoomGraph {
  id: string;
  name: string;
  type?: string;
  parentGraphId?: string | null;
  nodeCount?: number;
  createdAt?: string;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ProjectSummary {
  graph: ZoomGraph;
  children: ZoomGraph[];
  items: number;
  current: boolean;
}

export interface ZoomContext {
  current: ZoomGraph;
  parent: ZoomGraph | null;
  siblings: ZoomGraph[];
  /** Graphs at the parent's level, current project first. Empty for a top-level graph. */
  projects: ProjectSummary[];
  childCount: ReadonlyMap<string, number>;
}

const parentOf = (graph: ZoomGraph) => graph.parentGraphId || null;

function orderGraphs(graphs: ZoomGraph[], childCount: ReadonlyMap<string, number>) {
  return [...graphs].sort(
    (a, b) =>
      Number((childCount.get(b.id) ?? 0) > 0) - Number((childCount.get(a.id) ?? 0) > 0) ||
      (a.createdAt ?? '').localeCompare(b.createdAt ?? '') ||
      a.name.localeCompare(b.name) ||
      a.id.localeCompare(b.id)
  );
}

export function zoomContextOf(graphs: readonly ZoomGraph[], currentId: string): ZoomContext | null {
  const current = graphs.find(graph => graph.id === currentId);
  if (!current) return null;
  const childCount = new Map<string, number>();
  for (const graph of graphs) {
    const parent = parentOf(graph);
    if (parent) childCount.set(parent, (childCount.get(parent) ?? 0) + 1);
  }
  const parentId = parentOf(current);
  const parent = parentId ? graphs.find(graph => graph.id === parentId) ?? null : null;
  const siblings = orderGraphs(
    graphs.filter(graph => graph.id !== current.id && parentOf(graph) === parentId),
    childCount
  );
  const projects: ProjectSummary[] = [];
  if (parent) {
    const level = parentOf(parent);
    const others = orderGraphs(
      graphs.filter(graph => graph.id !== parent.id && parentOf(graph) === level),
      childCount
    );
    for (const graph of [parent, ...others]) {
      const children = orderGraphs(graphs.filter(child => parentOf(child) === graph.id), childCount);
      projects.push({
        graph,
        children,
        items: (graph.nodeCount ?? 0) + children.reduce((sum, child) => sum + (child.nodeCount ?? 0), 0),
        current: graph.id === parent.id,
      });
    }
  }
  return { current, parent, siblings, projects, childCount };
}

/** Grid cells around (0, 0), nearest ring first, horizontal neighbours before
 * vertical ones, so the first few siblings sit left and right of the graph. */
export function ringCells(count: number): [number, number][] {
  const cells: [number, number][] = [];
  for (let ring = 1; cells.length < count; ring++) {
    const ringCells: [number, number][] = [];
    for (let j = -ring; j <= ring; j++)
      for (let i = -ring; i <= ring; i++)
        if (Math.max(Math.abs(i), Math.abs(j)) === ring) ringCells.push([i, j]);
    ringCells.sort(
      ([ai, aj], [bi, bj]) =>
        Math.abs(aj) - Math.abs(bj) || Math.abs(ai) - Math.abs(bi) || bj - aj || bi - ai
    );
    cells.push(...ringCells);
  }
  return cells.slice(0, count);
}

/** At most this many neighbours are drawn; the rest stay in the graph list. */
export const MAX_ZOOM_TILES = 24;
const CELL_GAP = 0.3;
/** Small graphs still get tiles big enough to carry a label. */
const MIN_TILE = { w: 360, h: 220 };

export function tileSize(frame: Rect) {
  return { w: Math.max(frame.w, MIN_TILE.w), h: Math.max(frame.h, MIN_TILE.h) };
}

/** World rectangles for `count` tiles of the frame's size around it. On a tall
 * (portrait) screen the first neighbours go above and below instead of beside. */
export function neighbourRects(frame: Rect, count: number, gap = CELL_GAP, portrait = false): Rect[] {
  const tile = tileSize(frame);
  const cx = frame.x + frame.w / 2;
  const cy = frame.y + frame.h / 2;
  const stepX = Math.max(frame.w, tile.w) * (1 + gap);
  const stepY = Math.max(frame.h, tile.h) * (1 + gap);
  return ringCells(count).map(([a, b]) => (portrait ? [b, a] : [a, b])).map(([i, j]) => ({
    x: cx + i * stepX - tile.w / 2,
    y: cy + j * stepY - tile.h / 2,
    w: tile.w,
    h: tile.h,
  }));
}

export function boundsOf(rects: readonly Rect[], margin = 0): Rect | null {
  if (!rects.length) return null;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const r of rects) {
    x0 = Math.min(x0, r.x);
    y0 = Math.min(y0, r.y);
    x1 = Math.max(x1, r.x + r.w);
    y1 = Math.max(y1, r.y + r.h);
  }
  return { x: x0 - margin, y: y0 - margin, w: x1 - x0 + 2 * margin, h: y1 - y0 + 2 * margin };
}

/** The graph's frame: every item's card plus a margin, in world coordinates. */
export function graphFrame(
  items: readonly { x?: number; y?: number }[],
  size: (index: number) => { width: number; height: number },
  margin = 40
): Rect | null {
  const rects: Rect[] = [];
  items.forEach((item, index) => {
    if (!Number.isFinite(item.x) || !Number.isFinite(item.y)) return;
    const { width, height } = size(index);
    rects.push({ x: item.x! - width / 2, y: item.y! - height / 2, w: width, h: height });
  });
  return boundsOf(rects, margin);
}

export interface ZoomLayout {
  frame: Rect;
  siblings: { graph: ZoomGraph; rect: Rect }[];
  /** "+N more" when siblings were capped. */
  moreSiblings: number;
  /** The current project's region (frame + siblings); null for a top-level graph. */
  cluster: Rect | null;
  projects: { project: ProjectSummary; rect: Rect }[];
  moreProjects: number;
  /** Everything drawn, for the zoom limit. */
  span: Rect;
}

export function zoomLayout(context: ZoomContext, frame: Rect, portrait = false): ZoomLayout {
  const shown = context.siblings.slice(0, MAX_ZOOM_TILES);
  const rects = neighbourRects(frame, shown.length, CELL_GAP, portrait);
  const siblings = shown.map((graph, index) => ({ graph, rect: rects[index] }));
  const parts = [frame, ...rects];
  const clusterBox = boundsOf(parts, Math.max(frame.w, frame.h) * 0.12)!;
  let cluster: Rect | null = null;
  let projects: ZoomLayout['projects'] = [];
  let moreProjects = 0;
  if (context.projects.length) {
    cluster = clusterBox;
    const others = context.projects.filter(p => !p.current).slice(0, MAX_ZOOM_TILES);
    moreProjects = context.projects.length - 1 - others.length;
    const regions = neighbourRects(cluster, others.length, 0.35, portrait).map(r => ({
      ...r,
      w: cluster!.w,
      h: cluster!.h,
      x: r.x + (r.w - cluster!.w) / 2,
      y: r.y + (r.h - cluster!.h) / 2,
    }));
    projects = [
      { project: context.projects.find(p => p.current)!, rect: cluster },
      ...others.map((project, index) => ({ project, rect: regions[index] })),
    ];
  }
  const span = boundsOf([clusterBox, ...projects.map(p => p.rect)])!;
  return {
    frame,
    siblings,
    moreSiblings: context.siblings.length - shown.length,
    cluster,
    projects,
    moreProjects,
    span,
  };
}

export type ZoomLevel = 0 | 1 | 2 | 3;

export interface ZoomLevelState {
  cardsHidden: boolean;
  siblings: boolean;
  projects: boolean;
}

export const INITIAL_ZOOM_STATE: ZoomLevelState = { cardsHidden: false, siblings: false, projects: false };

/** Below this scale compact card titles are fragments (they hide entirely below
 * 0.3), so the graph's own label takes over. */
export const CARD_TITLES_HIDE_BELOW = 0.34;
export const CARD_TITLES_SHOW_ABOVE = 0.38;

export interface ZoomLevelInput {
  scale: number;
  viewport: { w: number; h: number };
  frame: Rect;
  /** The large-graph overview is showing group cards instead of items. */
  overview: boolean;
  hasSiblings: boolean;
  cluster: Rect | null;
}

/** Each level has an on and a higher off threshold, so a camera resting near a
 * threshold never flickers between levels. */
export function nextZoomState(previous: ZoomLevelState, input: ZoomLevelInput): ZoomLevelState {
  const { scale, viewport, frame } = input;
  const shortSide = Math.max(1, Math.min(viewport.w, viewport.h));
  const cardsHidden = previous.cardsHidden ? scale < CARD_TITLES_SHOW_ABOVE : scale < CARD_TITLES_HIDE_BELOW;
  const tile = tileSize(frame);
  const tilePx = Math.max(tile.w, tile.h) * scale;
  // Siblings appear once the user has zoomed out past normal size and the graph
  // leaves room around it.
  const siblings =
    input.hasSiblings &&
    (previous.siblings
      ? tilePx <= 0.5 * shortSide && scale < 0.95
      : tilePx < 0.4 * shortSide && scale < 0.85);
  let projects = false;
  if (input.cluster) {
    // How much of the viewport the project's graphs fill in their tightest direction.
    const fill = Math.max((input.cluster.w * scale) / viewport.w, (input.cluster.h * scale) / viewport.h);
    projects = previous.projects
      ? fill <= 0.45 || (tilePx <= 112 && fill <= 1.1)
      : fill < 0.35 || (tilePx < 96 && fill < 1);
  }
  return { cardsHidden, siblings, projects };
}

export function zoomLevelOf(state: ZoomLevelState, overview: boolean): ZoomLevel {
  if (state.projects) return 3;
  if (state.siblings) return 2;
  if (state.cardsHidden || overview) return 1;
  return 0;
}

/** The smallest zoom: normally 0.1, lower when there is more to see around the
 * graph, so every level is reachable on a phone as well as a desktop. */
export function minZoomScale(span: Rect | null, viewport: { w: number; h: number }, floor = 0.1): number {
  if (!span || span.w <= 0 || span.h <= 0) return floor;
  const fit = 0.85 * Math.min(viewport.w / span.w, viewport.h / span.h);
  return Math.max(0.005, Math.min(floor, fit));
}

/** Truncates `text` to the characters that fit `widthPx` at `fontPx`. */
export function fitLabel(text: string, widthPx: number, fontPx: number): string {
  const max = Math.floor(widthPx / (fontPx * 0.58));
  if (max <= 1) return '';
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(1, max - 1)).trimEnd()}…`;
}

/** Word-wraps `text` into at most `maxLines` lines that fit `widthPx`; the
 * last line is truncated when the rest does not fit. */
export function fitLines(text: string, widthPx: number, fontPx: number, maxLines = 2): string[] {
  const max = Math.floor(widthPx / (fontPx * 0.58));
  if (max <= 1) return [];
  const lines: string[] = [];
  let rest = text.trim();
  while (rest && lines.length < maxLines) {
    if (rest.length <= max) { lines.push(rest); rest = ''; break; }
    if (lines.length === maxLines - 1) { lines.push(fitLabel(rest, widthPx, fontPx)); rest = ''; break; }
    const cut = rest.lastIndexOf(' ', max);
    if (cut <= 0) { lines.push(fitLabel(rest, widthPx, fontPx)); rest = ''; break; }
    lines.push(rest.slice(0, cut));
    rest = rest.slice(cut + 1).trim();
  }
  return lines;
}

export const plural = (count: number, one: string, many = `${one}s`) =>
  `${count} ${count === 1 ? one : many}`;
