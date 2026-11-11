/**
 * Room for relationship labels in the automatic layouts.
 *
 * The renderer draws a label beside its edge, turned to the edge's angle, only
 * where the whole label clears every card, arrowhead, other edge line and label
 * placed before it (edgeRouteLabel); otherwise the label is hidden. Below 100%
 * zoom a label keeps its screen size, so in graph units it grows by 1/zoom.
 * Layouts that only keep cards 64px apart therefore hide most labels.
 *
 * - `placeGraphLabels` places every label of a laid-out graph the way the
 *   renderer does, over the whole graph, and `labelReport` checks the result
 *   with exact geometry: hidden labels, labels on cards or on other labels, and
 *   labels outside the visible gap of their own edge.
 * - `labelGap` is how long an edge's visible line must be for its label.
 * - `spreadForLabels` finds the smallest spread of a group of cards that lets
 *   all of their labels show: the fallback when reserving gaps is not enough.
 * - `organizeWithLabelRoom`, `hierarchyWithLabelRoom` and `clearFreeCards` run
 *   the organizer, the hierarchical rows and a settled force layout with that
 *   room, at the zoom the camera will show them.
 */
import type { Dims, ObstacleBox } from './edgeLabelLayout';
import { borderReach, edgeBorderEndpoints } from './edgeGeometry';
import {
  createParallelEdgeRoute,
  edgeRouteArrowBounds,
  orientedBoxesOverlap,
  type EdgeRouteGeometry,
  type EdgeRouteLabel,
} from './edgeRouteGeometry';
import { placeItemLabels, type ItemLabelBudget } from './edgeLabelPlacement';
import { arrowVisibility, perpendicularOffset } from './edgeLOD';
import { assignParallelEdgeIndices } from './parallelEdges';
import { computeGraphFit, type FitObstacle } from './graphFit';
import {
  organizeTopology,
  type OrganizationEdge,
  type OrganizationNode,
} from './topologyOrganization';
import { computeCompactLayout } from './layoutAlgorithms';
import { CARD_TITLES_HIDE_BELOW } from './cardTitleZoom';

type Point = { x: number; y: number };
type Size = { width: number; height: number };

/** Clearance the renderer keeps around a label (edgeRouteLabel's padding). */
export const LABEL_PADDING = 8;
/** Labels are placed at this zoom and closer: while card titles show. */
export const LABEL_MIN_ZOOM = CARD_TITLES_HIDE_BELOW;
/** "Organize around connections" never frames a large graph below this zoom. */
export const ORGANIZED_ZOOM_FLOOR = 0.65;
/**
 * Up to this many cards, Organize and the hierarchical layout frame the whole
 * graph, down to SMALL_GRAPH_ZOOM_FLOOR (the smallest zoom where card titles
 * and labels still show), with room for each label at that zoom. Below it the
 * camera holds that zoom on the organized hub's neighbourhood or the top rows
 * of the hierarchy. Larger graphs keep
 * ORGANIZED_ZOOM_FLOOR and open on a neighbourhood or the overview.
 */
export const WHOLE_FIT_MAX_CARDS = 60;
export const SMALL_GRAPH_ZOOM_FLOOR = CARD_TITLES_HIDE_BELOW;
const ARROW_LENGTH = 16;

/** How much bigger than its drawn size a label is in graph units at `zoom`. */
export const labelWorldScale = (zoom: number) => Math.max(1, 1 / zoom);
/** Distance from an edge's line to its label's centre at that label scale. */
export const labelSideOffset = (scale: number) => 26 * scale + 3;

/**
 * Visible (border-to-border) edge length a label needs at `zoom`: the label,
 * the clearance at both ends and the arrowhead it must not cover.
 */
export function labelGap(label: Dims, zoom: number): number {
  return label.width * labelWorldScale(zoom) + 4 * LABEL_PADDING + ARROW_LENGTH;
}

export interface LabelCard {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LabelEdge {
  id: string;
  source: string;
  target: string;
  /** Drawn label size at 100% (edgeLabelDimensions of its measured text). */
  label: Dims;
  /** Lower first, as relationshipPriorityTier. */
  priority?: number;
}

export interface GraphLabels {
  zoom: number;
  scale: number;
  routes: Map<string, EdgeRouteGeometry | null>;
  placements: Map<string, EdgeRouteLabel>;
  hidden: string[];
  checks: number;
}

const UNBOUNDED: ItemLabelBudget = { labels: Infinity, attempts: Infinity, checks: Infinity };

/**
 * Place every label of a laid-out graph as the renderer does at `zoom`
 * (InteractiveGraphVisualization.updateEdgePositions): border-to-border routes
 * with parallel lanes, cards and arrowheads as obstacles, every edge line as a
 * wire to avoid, labels in priority order. With no viewport the whole graph
 * counts as on screen.
 */
export function placeGraphLabels(
  cards: readonly LabelCard[],
  edges: readonly LabelEdge[],
  options: {
    zoom: number;
    viewport?: ObstacleBox;
    obstacles?: readonly ObstacleBox[];
    budget?: ItemLabelBudget;
  }
): GraphLabels {
  const { zoom } = options;
  const scale = labelWorldScale(zoom);
  const byId = new Map(cards.map(card => [card.id, card]));
  const lanes = assignParallelEdgeIndices([...edges]);
  const routes = new Map<string, EdgeRouteGeometry | null>();
  const obstacles: ObstacleBox[] = cards.map(({ x, y, width, height }) => ({ x, y, width, height }));
  for (const edge of edges) {
    const a = byId.get(edge.source),
      b = byId.get(edge.target);
    if (!a || !b) {
      routes.set(edge.id, null);
      continue;
    }
    const ends = edgeBorderEndpoints(a, a, b, b);
    const lane = lanes.get(edge.id);
    const route = createParallelEdgeRoute(
      { id: a.id, x: ends.x1, y: ends.y1 },
      { id: b.id, x: ends.x2, y: ends.y2 },
      perpendicularOffset(lane?.index ?? 0, lane?.total ?? 1, zoom)
    );
    routes.set(edge.id, route);
    if (route) obstacles.push(edgeRouteArrowBounds(route, arrowVisibility(zoom, lane?.total ?? 1).scale));
  }
  if (options.obstacles) obstacles.push(...options.obstacles);
  let left = Infinity,
    right = -Infinity,
    top = Infinity,
    bottom = -Infinity;
  for (const card of cards) {
    left = Math.min(left, card.x - card.width / 2);
    right = Math.max(right, card.x + card.width / 2);
    top = Math.min(top, card.y - card.height / 2);
    bottom = Math.max(bottom, card.y + card.height / 2);
  }
  const viewport = options.viewport ?? {
    x: (left + right) / 2,
    y: (top + bottom) / 2,
    width: right - left + 4000,
    height: bottom - top + 4000,
  };
  const segments = [...routes.values()].flatMap(route => route?.segments ?? []);
  const result = placeItemLabels(
    edges.map(edge => ({
      id: edge.id,
      route: routes.get(edge.id) ?? null,
      eligible: zoom >= LABEL_MIN_ZOOM,
      priority: edge.priority ?? 0,
      dims: { width: edge.label.width * scale, height: edge.label.height * scale },
      t: 0.5,
      offset: labelSideOffset(scale),
    })),
    { viewport, obstacles, segments },
    options.budget ?? UNBOUNDED
  );
  return {
    zoom,
    scale,
    routes,
    placements: result.placements,
    hidden: edges.filter(edge => !result.placements.has(edge.id)).map(edge => edge.id),
    checks: result.checks,
  };
}

export interface LabelReport {
  /** Edges with no label shown. */
  hidden: string[];
  /** "edge × card" for every label that touches any card. */
  onCards: string[];
  /** "edge × edge" for every pair of labels that touch. */
  onLabels: string[];
  /** Labels that reach past the visible part of their own edge. */
  outOfGap: string[];
}

/** Check placed labels with exact (turned) boxes and no padding. */
export function labelReport(
  cards: readonly LabelCard[],
  edges: readonly LabelEdge[],
  labels: GraphLabels
): LabelReport {
  const boxes: [string, ObstacleBox][] = [];
  for (const edge of edges) {
    const placed = labels.placements.get(edge.id);
    if (!placed) continue;
    boxes.push([edge.id, {
      x: placed.x,
      y: placed.y,
      width: edge.label.width * labels.scale,
      height: edge.label.height * labels.scale,
      rotation: placed.rotation,
    }]);
  }
  const onCards: string[] = [],
    onLabels: string[] = [],
    outOfGap: string[] = [];
  for (const [i, [id, box]] of boxes.entries()) {
    for (const card of cards) if (orientedBoxesOverlap(box, card)) onCards.push(`${id} × ${card.id}`);
    for (const [other, peer] of boxes.slice(i + 1)) if (orientedBoxesOverlap(box, peer)) onLabels.push(`${id} × ${other}`);
    const route = labels.routes.get(id);
    const segment = route?.segments.find(part => {
      const ux = (part.target.x - part.source.x) / part.length,
        uy = (part.target.y - part.source.y) / part.length;
      const along = (box.x - part.source.x) * ux + (box.y - part.source.y) * uy;
      return along >= 0 && along <= part.length;
    });
    const r = ((box.rotation ?? 0) * Math.PI) / 180;
    const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => ({
      x: box.x + (u * box.width * Math.cos(r)) / 2 - (v * box.height * Math.sin(r)) / 2,
      y: box.y + (u * box.width * Math.sin(r)) / 2 + (v * box.height * Math.cos(r)) / 2,
    }));
    const inside =
      !!segment &&
      corners.every(corner => {
        const ux = (segment.target.x - segment.source.x) / segment.length,
          uy = (segment.target.y - segment.source.y) / segment.length;
        const along = (corner.x - segment.source.x) * ux + (corner.y - segment.source.y) * uy;
        return along >= -0.5 && along <= segment.length + 0.5;
      });
    if (!inside) outOfGap.push(id);
  }
  return { hidden: labels.hidden, onCards, onLabels, outOfGap };
}

/** `point` moved `factor` times as far from `anchor` (only vertically for 'y'). */
export function spreadPoint(point: Point, anchor: Point, factor: number, axes: 'xy' | 'y' = 'xy'): Point {
  return {
    x: axes === 'y' ? point.x : anchor.x + (point.x - anchor.x) * factor,
    y: anchor.y + (point.y - anchor.y) * factor,
  };
}

/** Work limit for the spread searches of one layout, in obstacle checks. */
export const SPREAD_CHECKS = 4_000_000;
/**
 * Groups of more cards than this keep only the reserved gaps, without the
 * spread search: a graph that large opens as an overview, a person reads its
 * labels a neighbourhood at a time, and the search would cost seconds.
 */
export const SPREAD_MAX_CARDS = 200;

/**
 * Extra spread on top of the smallest that frees every label: the renderer
 * places labels one by one from where each was last, so its order can differ a
 * little from this search's and needs some room to spare.
 */
export const SPREAD_SLACK = 1.1;

/**
 * The smallest factor (1 = as is) by which spreading `points` about `anchor`
 * lets every label in `edges` show at `zoom`, times SPREAD_SLACK (at most
 * `maxFactor`); `maxFactor` when even that does not. Card sizes are the ones
 * drawn at `zoom`. `work.remaining` counts down the obstacle checks it may
 * spend; with none left it stops searching and keeps the largest factor it has
 * tried.
 */
export function spreadForLabels(
  points: ReadonlyMap<string, Point>,
  sizes: ReadonlyMap<string, Size>,
  edges: readonly LabelEdge[],
  options: {
    zoom: number;
    anchor?: Point;
    maxFactor?: number;
    work?: { remaining: number };
    /** 'y' spreads rows apart and keeps each card's x. */
    axes?: 'xy' | 'y';
    /** Only these cards move; the others stay where they are. */
    moves?: (id: string) => boolean;
  }
): number {
  const ids = new Set(points.keys());
  const local = edges.filter(edge => ids.has(edge.source) && ids.has(edge.target));
  if (!local.length || options.zoom < LABEL_MIN_ZOOM) return 1;
  const anchor = options.anchor ?? points.values().next().value!;
  const maxFactor = options.maxFactor ?? 4;
  const work = options.work ?? { remaining: SPREAD_CHECKS };
  const fits = (factor: number) => {
    if (work.remaining <= 0) return false;
    const cards: LabelCard[] = [...points].map(([id, p]) => ({
      id,
      ...(options.moves?.(id) === false ? p : spreadPoint(p, anchor, factor, options.axes)),
      ...sizes.get(id)!,
    }));
    const placed = placeGraphLabels(cards, local, {
      zoom: options.zoom,
      budget: { labels: Infinity, attempts: Infinity, checks: work.remaining },
    });
    work.remaining -= placed.checks;
    return placed.hidden.length === 0;
  };
  if (fits(1)) return 1;
  let low = 1,
    high = 1.2;
  while (high < maxFactor && !fits(high)) {
    low = high;
    high = Math.min(maxFactor, high * 1.25);
  }
  if (high >= maxFactor) return maxFactor;
  for (let step = 0; step < 6 && high - low > 0.02; step++) {
    const middle = (low + high) / 2;
    if (fits(middle)) high = middle;
    else low = middle;
  }
  return Math.min(maxFactor, high * SPREAD_SLACK);
}

export interface LabelRoomOptions<T, E> {
  /** Card size drawn at `scale` (graphItemLayout with the real text measure). */
  dimensionsAt: (node: T, scale: number) => Size;
  /** Drawn size of the edge's label at 100%, or null when it is not drawn. */
  labelFor: (edge: E) => Dims | null;
  priority?: (edge: E) => number;
  viewport: Size;
  /** Screen rectangles the camera fit keeps cards away from. */
  obstacles?: FitObstacle[];
  /** The camera never frames below this zoom. */
  floor?: number;
}

const endpointId = (value: OrganizationEdge['source']) =>
  typeof value === 'string' ? value : value.id;

function drawnEdges<E extends OrganizationEdge & { id: string }>(
  edges: readonly E[],
  options: Pick<LabelRoomOptions<unknown, E>, 'labelFor' | 'priority'>
): LabelEdge[] {
  return edges.flatMap(edge => {
    const label = options.labelFor(edge);
    return label
      ? [{ id: edge.id, source: endpointId(edge.source), target: endpointId(edge.target), label, priority: options.priority?.(edge) }]
      : [];
  });
}

/** The zoom the camera frames these positions at (graphFit, then the floor). */
export function framedZoom<T extends OrganizationNode>(
  nodes: readonly T[],
  positions: ReadonlyMap<string, Point>,
  options: Pick<LabelRoomOptions<T, never>, 'dimensionsAt' | 'viewport' | 'obstacles'>,
  floor: number
): number {
  const byId = new Map(nodes.map(node => [node.id, node]));
  const fit = computeGraphFit({
    width: options.viewport.width,
    height: options.viewport.height,
    obstacles: options.obstacles ?? [],
    cards: [...positions].map(([id, p]) => ({ id, ...p })),
    dimensionsAt: (card, scale) => options.dimensionsAt(byId.get(card.id)!, scale),
  });
  return Math.max(floor, fit?.scale ?? 1);
}

/**
 * Run `layout` with label room for the zoom it will be shown at. Below 100%
 * labels are bigger in graph units, so more room spreads the layout and the
 * camera frames it further out: find the closest zoom (between the floor, or
 * LABEL_MIN_ZOOM, and 100%) whose layout the camera still frames at that zoom
 * or closer, by bisection. When even the farthest does not fit, its layout is
 * returned (labels that do not fit stay hidden).
 */
function withFramedRoom<T extends OrganizationNode, R extends { positions: Map<string, Point> }>(
  nodes: readonly T[],
  options: LabelRoomOptions<T, never>,
  layout: (zoom: number) => R
): R & { zoom: number; labelZoom: number } {
  const floor = Math.max(options.floor ?? 0, 0);
  const at = (labelZoom: number) => {
    const result = layout(labelZoom);
    return { ...result, zoom: framedZoom(nodes, result.positions, options, floor), labelZoom };
  };
  const closest = at(1);
  if (closest.zoom >= 1) return closest;
  let low = Math.min(1, Math.max(floor, LABEL_MIN_ZOOM)),
    high = 1;
  let fits = at(low);
  if (fits.zoom < low) return fits;
  for (let step = 0; step < 5 && high - low > 0.02; step++) {
    const middle = (low + high) / 2;
    const tried = at(middle);
    if (tried.zoom >= middle) {
      low = middle;
      fits = tried;
    } else high = middle;
  }
  return fits;
}

/**
 * "Organize around connections" with room for every label: the organizer's
 * gaps between connected cards fit their labels, and a component whose labels
 * still collide (crossing wires in a dense network) is spread just enough.
 */
export function organizeWithLabelRoom<
  T extends OrganizationNode,
  E extends OrganizationEdge & { id: string },
>(nodes: readonly T[], edges: readonly E[], options: LabelRoomOptions<T, E>) {
  const labelled = drawnEdges(edges, options);
  const byEdge = new Map(labelled.map(edge => [edge.id, edge]));
  const byId = new Map(nodes.map(node => [node.id, node]));
  const work = { remaining: SPREAD_CHECKS };
  return withFramedRoom(nodes, { ...options, floor: options.floor ?? ORGANIZED_ZOOM_FLOOR } as LabelRoomOptions<T, never>, labelZoom => {
    const result = organizeTopology(nodes, edges, node => options.dimensionsAt(node, 1), options.viewport, 64, {
      edgeGap: edge => {
        const drawn = byEdge.get(edge.id);
        return drawn ? labelGap(drawn.label, labelZoom) : 0;
      },
      spread: (ids, points) => {
        if (ids.length > SPREAD_MAX_CARDS) return 1;
        const sizes = new Map(ids.map(id => [id, options.dimensionsAt(byId.get(id)!, labelZoom)]));
        return spreadForLabels(points, sizes, labelled, { zoom: labelZoom, anchor: points.get(ids[0]), work });
      },
    });
    const turned = turnToScreen(nodes, result.positions, labelled, options, labelZoom);
    return turned ? { ...result, positions: turned } : result;
  });
}

/**
 * A tall layout on a wide screen (or a wide one on a tall screen) turned a
 * quarter turn, so the camera can frame it closer; null when it already
 * matches, is too large to check, or turning would put cards on cards or hide
 * a label that shows now.
 */
function turnToScreen<T extends OrganizationNode>(
  nodes: readonly T[],
  positions: ReadonlyMap<string, Point>,
  labelled: readonly LabelEdge[],
  options: Pick<LabelRoomOptions<T, never>, 'dimensionsAt' | 'viewport'>,
  zoom: number
): Map<string, Point> | null {
  if (nodes.length < 2 || nodes.length > SPREAD_MAX_CARDS) return null;
  const cardsAt = (points: ReadonlyMap<string, Point>, scale = zoom): LabelCard[] =>
    nodes.map(node => ({ id: node.id, ...points.get(node.id)!, ...options.dimensionsAt(node, scale) }));
  const extent = (cards: LabelCard[]) => ({
    width: Math.max(...cards.map(card => card.x + card.width / 2)) - Math.min(...cards.map(card => card.x - card.width / 2)),
    height: Math.max(...cards.map(card => card.y + card.height / 2)) - Math.min(...cards.map(card => card.y - card.height / 2)),
  });
  const before = cardsAt(positions);
  const size = extent(before);
  const screenWide = options.viewport.width >= options.viewport.height;
  if (screenWide === size.width >= size.height) return null;
  const cx = before.reduce((sum, card) => sum + card.x, 0) / before.length,
    cy = before.reduce((sum, card) => sum + card.y, 0) / before.length;
  const turned = new Map([...positions].map(([id, p]) => [id, { x: cx + (p.y - cy), y: cy - (p.x - cx) }]));
  const after = cardsAt(turned);
  const fitOf = (box: Size) => Math.min(options.viewport.width / box.width, options.viewport.height / box.height);
  if (fitOf(extent(after)) <= fitOf(size)) return null;
  // Cards are largest at 100%: none may touch there.
  const full = cardsAt(turned, 1);
  for (const [i, a] of full.entries()) for (const b of full.slice(i + 1)) if (cardsOverlap(a, b, CARD_CLEARANCE)) return null;
  const hiddenBefore = placeGraphLabels(before, labelled, { zoom }).hidden.length;
  return placeGraphLabels(after, labelled, { zoom }).hidden.length <= hiddenBefore ? turned : null;
}

/**
 * The hierarchical rows with room for every label: rows sit far enough apart
 * for the labels of the edges between them, cards in a row for edges inside
 * it, and when wires still cross labels the rows spread further apart.
 */
export function hierarchyWithLabelRoom<
  T extends OrganizationNode,
  E extends OrganizationEdge & { id: string },
>(nodes: readonly T[], edges: readonly E[], options: LabelRoomOptions<T, E>) {
  const labelled = drawnEdges(edges, options);
  const byEdge = new Map(labelled.map(edge => [edge.id, edge]));
  return withFramedRoom(nodes, options as LabelRoomOptions<T, never>, labelZoom => {
    const gapFor = (edge: E) => {
      const drawn = byEdge.get(edge.id);
      return drawn ? labelGap(drawn.label, labelZoom) : 0;
    };
    let positions = computeCompactLayout(
      nodes as unknown as (T & { id: string })[],
      edges as never,
      options.viewport,
      node => options.dimensionsAt(node, 1),
      { edgeGap: gapFor as never }
    );
    if (nodes.length > SPREAD_MAX_CARDS || !labelled.length) return { positions };
    const sizes = new Map(nodes.map(node => [node.id, options.dimensionsAt(node, labelZoom)]));
    const ys = [...positions.values()].map(p => p.y);
    const anchor = { x: options.viewport.width / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 };
    // Rows apart first (keeps the columns); both ways only when that is not enough.
    const work = { remaining: SPREAD_CHECKS };
    const rows = spreadForLabels(positions, sizes, labelled, { zoom: labelZoom, anchor, maxFactor: 3, axes: 'y', work });
    positions = new Map([...positions].map(([id, p]) => [id, spreadPoint(p, anchor, rows, 'y')]));
    if (rows >= 3) {
      const both = spreadForLabels(positions, sizes, labelled, { zoom: labelZoom, anchor, maxFactor: 2, work });
      positions = new Map([...positions].map(([id, p]) => [id, spreadPoint(p, anchor, both)]));
    }
    return { positions };
  });
}

/** Gap two cards keep when `clearFreeCards` moves one past the other. */
const CARD_CLEARANCE = 24;

const cardsOverlap = (a: LabelCard, b: LabelCard, clearance: number) =>
  Math.abs(a.x - b.x) * 2 < a.width + b.width + 2 * clearance &&
  Math.abs(a.y - b.y) * 2 < a.height + b.height + 2 * clearance;

/**
 * After the force layout settles: move only the cards the simulation is free
 * to move (never a pinned, saved card) until every label in `edges` shows at
 * `zoom`. First a hidden label's free card steps away from the card at the
 * other end of its edge, enough for the label and a little more to get clear
 * of crowding; when wires still cross labels, the free cards spread out about
 * the pinned ones (or their own centre) by the smallest factor that frees
 * them, and the steps run once more. A moved card that lands on another card
 * keeps going the same way. Returns the new centres of the cards it moved and
 * the labels still hidden (both ends pinned, or out of work).
 */
export function clearFreeCards(
  cards: readonly LabelCard[],
  edges: readonly LabelEdge[],
  options: { zoom: number; free: (id: string) => boolean; rounds?: number; work?: { remaining: number } }
): { moved: Map<string, Point>; hidden: string[] } {
  const current = new Map(cards.map(card => [card.id, { ...card }]));
  const byEdge = new Map(edges.map(edge => [edge.id, edge]));
  const moved = new Set<string>();
  const work = options.work ?? { remaining: SPREAD_CHECKS };
  const rounds = options.rounds ?? 6;
  const hiddenNow = () => {
    if (work.remaining <= 0) return null;
    const placed = placeGraphLabels([...current.values()], edges, {
      zoom: options.zoom,
      budget: { labels: Infinity, attempts: Infinity, checks: work.remaining },
    });
    work.remaining -= placed.checks;
    return placed.hidden;
  };
  // Move `card` by (dx, dy), then on along (ux, uy) while it sits on a card.
  const shift = (card: LabelCard, dx: number, dy: number, ux = dx, uy = dy) => {
    card.x += dx;
    card.y += dy;
    const length = Math.hypot(ux, uy);
    for (let step = 0; length && step < 20; step++) {
      const blocker = [...current.values()].find(other => other !== card && cardsOverlap(card, other, CARD_CLEARANCE));
      if (!blocker) break;
      card.x += (ux / length) * (blocker.width / 2 + CARD_CLEARANCE);
      card.y += (uy / length) * (blocker.height / 2 + CARD_CLEARANCE);
    }
    moved.add(card.id);
  };
  const step = (hidden: string[]) => {
    const push = new Map<string, Point>();
    const add = (id: string, x: number, y: number) => {
      const p = push.get(id) ?? { x: 0, y: 0 };
      push.set(id, { x: p.x + x, y: p.y + y });
    };
    for (const id of hidden) {
      const edge = byEdge.get(id)!;
      const a = current.get(edge.source),
        b = current.get(edge.target);
      if (!a || !b) continue;
      const freeA = options.free(a.id),
        freeB = options.free(b.id);
      if (!freeA && !freeB) continue;
      const apart = Math.hypot(b.x - a.x, b.y - a.y);
      // Cards on the same spot part sideways.
      const ux = apart ? (b.x - a.x) / apart : 1,
        uy = apart ? (b.y - a.y) / apart : 0;
      const visible = apart - borderReach(a, ux, uy) - borderReach(b, ux, uy);
      const need = labelGap(edge.label, options.zoom);
      const length = Math.max(0, need - visible) + 0.2 * need;
      if (freeA && freeB) {
        add(a.id, (-ux * length) / 2, (-uy * length) / 2);
        add(b.id, (ux * length) / 2, (uy * length) / 2);
      } else if (freeB) add(b.id, ux * length, uy * length);
      else add(a.id, -ux * length, -uy * length);
    }
    for (const [id, p] of push) shift(current.get(id)!, p.x, p.y);
    return push.size > 0;
  };
  const steps = () => {
    let hidden = hiddenNow();
    for (let round = 0; round < rounds && hidden?.length && step(hidden); round++) hidden = hiddenNow();
    return hidden;
  };
  let hidden = steps();
  if (hidden?.length) {
    const free = [...current.values()].filter(card => options.free(card.id));
    const pinned = [...current.values()].filter(card => !options.free(card.id));
    const around = pinned.length ? pinned : free;
    const anchor = {
      x: around.reduce((sum, card) => sum + card.x, 0) / around.length,
      y: around.reduce((sum, card) => sum + card.y, 0) / around.length,
    };
    const points = new Map([...current].map(([id, card]) => [id, { x: card.x, y: card.y }]));
    const sizes = new Map([...current].map(([id, card]) => [id, { width: card.width, height: card.height }]));
    const factor = spreadForLabels(points, sizes, edges, { zoom: options.zoom, anchor, work, moves: options.free });
    if (factor > 1) {
      for (const card of free) {
        const to = spreadPoint(card, anchor, factor);
        card.x = to.x;
        card.y = to.y;
        moved.add(card.id);
      }
      for (const card of free) shift(card, 0, 0, card.x - anchor.x, card.y - anchor.y);
      hidden = steps();
    }
  }
  return {
    moved: new Map([...moved].map(id => [id, { x: current.get(id)!.x, y: current.get(id)!.y }])),
    hidden: hidden ?? edges.map(edge => edge.id),
  };
}
