import type { Dims, ObstacleBox, Point } from './edgeLabelLayout';

export interface EdgeRouteSegment {
  source: Point;
  target: Point;
  length: number;
  start: number;
  end: number;
  angle: number;
}

export interface EdgeRouteGeometry {
  points: readonly Point[];
  segments: readonly EdgeRouteSegment[];
  length: number;
  path: string;
  target: Point & { angle: number };
}

export interface EdgeRouteLabel {
  x: number;
  y: number;
  t: number;
  rotation: number;
  iconRotation: number;
  offset: number;
}

const finitePoint = (point: Point) =>
  Number.isFinite(point.x) && Number.isFinite(point.y);
const clamp = (value: number, low: number, high: number) =>
  Math.max(low, Math.min(high, value));
const fraction = (value: number) =>
  clamp(Number.isFinite(value) ? value : 0.5, 0, 1);
const upright = (angle: number) =>
  angle > 90 ? angle - 180 : angle < -90 ? angle + 180 : angle;

export function createEdgeRoute(
  input: readonly Point[]
): EdgeRouteGeometry | null {
  if (input.some(point => !finitePoint(point))) return null;
  const points: Point[] = [];
  for (const point of input) {
    const last = points[points.length - 1];
    if (last?.x === point.x && last.y === point.y) continue;
    const previous = points[points.length - 2];
    if (previous && last) {
      const ax = last.x - previous.x,
        ay = last.y - previous.y;
      const bx = point.x - last.x,
        by = point.y - last.y;
      if (ax * by === ay * bx && ax * bx + ay * by > 0) points.pop();
    }
    points.push({ ...point });
  }
  if (points.length < 2) return null;
  const segments: EdgeRouteSegment[] = [];
  let length = 0;
  for (let i = 1; i < points.length; i++) {
    const source = points[i - 1],
      target = points[i];
    const dx = target.x - source.x,
      dy = target.y - source.y;
    const size = Math.hypot(dx, dy);
    const end = length + size;
    if (!Number.isFinite(end) || size === 0) return null;
    segments.push({
      source,
      target,
      length: size,
      start: length,
      end,
      angle: (Math.atan2(dy, dx) * 180) / Math.PI,
    });
    length = end;
  }
  const last = segments[segments.length - 1];
  return {
    points,
    segments,
    length,
    path: points
      .map((point, i) => `${i ? 'L' : 'M'}${point.x},${point.y}`)
      .join(' '),
    target: { ...last.target, angle: last.angle },
  };
}

export function pointOnEdgeRoute(route: EdgeRouteGeometry, value: number) {
  const t = fraction(value),
    distance = t * route.length;
  const segment =
    route.segments.find(part => distance < part.end) ??
    route.segments[route.segments.length - 1];
  const local = clamp((distance - segment.start) / segment.length, 0, 1);
  return {
    x: segment.source.x + (segment.target.x - segment.source.x) * local,
    y: segment.source.y + (segment.target.y - segment.source.y) * local,
    angle: segment.angle,
    t,
  };
}

export function createParallelEdgeRoute(
  source: Point & { id: string },
  target: Point & { id: string },
  offset: number
) {
  const dx = target.x - source.x,
    dy = target.y - source.y;
  const length = Math.hypot(dx, dy);
  if (!Number.isFinite(offset) || !Number.isFinite(length) || length === 0)
    return null;
  const signed = offset * (source.id < target.id ? 1 : -1);
  const x = (-dy / length) * signed,
    y = (dx / length) * signed;
  return createEdgeRoute([
    { x: source.x + x, y: source.y + y },
    { x: target.x + x, y: target.y + y },
  ]);
}

export function projectEdgeRoutePointer(
  route: EdgeRouteGeometry,
  pointer: Point,
  previousT = 0.5,
  options: { offset?: number } = {}
) {
  const previous = fraction(previousT);
  const offset = options.offset ?? 0;
  if (!finitePoint(pointer) || !Number.isFinite(offset)) return previous;
  let bestT = previous,
    bestDistance = Infinity;
  for (const segment of route.segments) {
    const dx = segment.target.x - segment.source.x;
    const dy = segment.target.y - segment.source.y;
    const angle = (upright(segment.angle) * Math.PI) / 180;
    const sx = segment.source.x + Math.sin(angle) * offset;
    const sy = segment.source.y - Math.cos(angle) * offset;
    const along = clamp(
      ((pointer.x - sx) * (dx / segment.length) +
        (pointer.y - sy) * (dy / segment.length)) /
        segment.length,
      0,
      1
    );
    const x = sx + along * dx;
    const y = sy + along * dy;
    const distance = Math.hypot(pointer.x - x, pointer.y - y);
    const t = (segment.start + along * segment.length) / route.length;
    if (
      distance < bestDistance - 1e-9 ||
      (Math.abs(distance - bestDistance) <= 1e-9 &&
        Math.abs(t - previous) < Math.abs(bestT - previous))
    ) {
      bestDistance = distance;
      bestT = t;
    }
  }
  return bestT;
}

export function edgeRouteArrowBounds(
  route: EdgeRouteGeometry,
  scale = 1
): ObstacleBox {
  const angle = (route.target.angle * Math.PI) / 180;
  const points = [
    [-16, -8],
    [0, 0],
    [-16, 8],
    [-8, 0],
  ].map(([x, y]) => ({
    x: route.target.x + (x * Math.cos(angle) - y * Math.sin(angle)) * scale,
    y: route.target.y + (x * Math.sin(angle) + y * Math.cos(angle)) * scale,
  }));
  const left = Math.min(...points.map(p => p.x)),
    right = Math.max(...points.map(p => p.x));
  const top = Math.min(...points.map(p => p.y)),
    bottom = Math.max(...points.map(p => p.y));
  return {
    x: (left + right) / 2,
    y: (top + bottom) / 2,
    width: right - left,
    height: bottom - top,
  };
}

export function edgeSegmentHitsBox(
  segment: Pick<EdgeRouteSegment, 'source' | 'target'>,
  box: ObstacleBox,
  padding = 0
) {
  let first = 0,
    last = 1;
  for (const [axis, span] of [
    ['x', 'width'],
    ['y', 'height'],
  ] as const) {
    const low = box[axis] - box[span] / 2 - padding,
      high = box[axis] + box[span] / 2 + padding;
    const delta = segment.target[axis] - segment.source[axis];
    if (delta === 0) {
      if (segment.source[axis] < low || segment.source[axis] > high)
        return false;
    } else {
      const a = (low - segment.source[axis]) / delta,
        b = (high - segment.source[axis]) / delta;
      first = Math.max(first, Math.min(a, b));
      last = Math.min(last, Math.max(a, b));
      if (first > last) return false;
    }
  }
  return true;
}

export function edgeSegmentHitsRotatedBox(
  segment: Pick<EdgeRouteSegment, 'source' | 'target'>,
  box: ObstacleBox,
  rotation: number,
  padding = 0
) {
  const angle = (rotation * Math.PI) / 180;
  const local = (point: { x: number; y: number }) => {
    const x = point.x - box.x,
      y = point.y - box.y;
    return {
      x: x * Math.cos(angle) + y * Math.sin(angle),
      y: -x * Math.sin(angle) + y * Math.cos(angle),
    };
  };
  return edgeSegmentHitsBox(
    { source: local(segment.source), target: local(segment.target) },
    { x: 0, y: 0, width: box.width, height: box.height },
    padding
  );
}

/**
 * Whether two boxes overlap, each centred on (x, y) and turned by its
 * `rotation` in degrees (an obstacle without one is axis-aligned). `b` grows
 * by `padding` on every side. Separating-axis test on both boxes' axes, so a
 * turned label is tested with its real footprint, not the box around it.
 */
export function orientedBoxesOverlap(
  a: ObstacleBox,
  b: ObstacleBox,
  padding = 0
) {
  const aw = a.width / 2,
    ah = a.height / 2,
    bw = b.width / 2 + padding,
    bh = b.height / 2 + padding;
  const dx = b.x - a.x,
    dy = b.y - a.y;
  // Far apart: the circles around the two boxes do not meet.
  const reachAll = Math.hypot(aw, ah) + Math.hypot(bw, bh);
  if (dx * dx + dy * dy >= reachAll * reachAll) return false;
  const ra = ((a.rotation ?? 0) * Math.PI) / 180,
    rb = ((b.rotation ?? 0) * Math.PI) / 180;
  const aux = Math.cos(ra),
    auy = Math.sin(ra),
    bux = Math.cos(rb),
    buy = Math.sin(rb);
  // Axes: each box's own two (u, and v = u turned a quarter).
  return !(
    separatedAlong(aux, auy, dx, dy, aw, ah, aux, auy, bw, bh, bux, buy) ||
    separatedAlong(-auy, aux, dx, dy, aw, ah, aux, auy, bw, bh, bux, buy) ||
    separatedAlong(bux, buy, dx, dy, aw, ah, aux, auy, bw, bh, bux, buy) ||
    separatedAlong(-buy, bux, dx, dy, aw, ah, aux, auy, bw, bh, bux, buy)
  );
}

/** Whether axis (nx, ny) separates two turned boxes (half sizes and u axes). */
function separatedAlong(
  nx: number,
  ny: number,
  dx: number,
  dy: number,
  aw: number,
  ah: number,
  aux: number,
  auy: number,
  bw: number,
  bh: number,
  bux: number,
  buy: number
) {
  const reach =
    Math.abs(aw * (aux * nx + auy * ny)) +
    Math.abs(ah * (-auy * nx + aux * ny)) +
    Math.abs(bw * (bux * nx + buy * ny)) +
    Math.abs(bh * (-buy * nx + bux * ny));
  return Math.abs(dx * nx + dy * ny) >= reach - 1e-9;
}

/** Half width of the axis-aligned bounds of a box turned by `rotation` degrees, grown by `pad`. */
function reachX(width: number, height: number, rotation: number | undefined, pad: number) {
  if (!rotation) return width / 2 + pad;
  const r = (rotation * Math.PI) / 180;
  return Math.abs(Math.cos(r)) * (width / 2 + pad) + Math.abs(Math.sin(r)) * (height / 2 + pad);
}

/** Half height of those bounds. */
function reachY(width: number, height: number, rotation: number | undefined, pad: number) {
  if (!rotation) return height / 2 + pad;
  const r = (rotation * Math.PI) / 180;
  return Math.abs(Math.sin(r)) * (width / 2 + pad) + Math.abs(Math.cos(r)) * (height / 2 + pad);
}

/** Positions tried along each straight part of a route, besides its ends and middle. */
export const LABEL_SAMPLES = 12;

export function edgeRouteLabel(
  route: EdgeRouteGeometry,
  options: {
    dims: Dims;
    t?: number;
    offset?: number;
    padding?: number;
    obstacles?: readonly ObstacleBox[];
    segments?: readonly Pick<EdgeRouteSegment, 'source' | 'target'>[];
    offsets?: readonly number[];
    viewport?: ObstacleBox;
    budget?: { remaining: number };
  }
) {
  const { dims, obstacles = [] } = options;
  const offset = options.offset ?? 22,
    padding = options.padding ?? 8;
  if (
    ![dims.width, dims.height, offset, padding].every(Number.isFinite) ||
    dims.width <= 0 ||
    dims.height <= 0 ||
    padding < 0
  )
    return null;
  const desired = fraction(options.t ?? 0.5) * route.length;
  // Every candidate spot, nearest the desired one first (then the earlier
  // one); the first that clears everything wins. A label slides along its
  // edge, or flips to the other side, before it gives up.
  const candidates: (EdgeRouteLabel & { delta: number })[] = [];
  for (const segment of route.segments) {
    const margin = dims.width / 2 + padding;
    if (segment.length < 2 * margin) continue;
    const low = segment.start + margin,
      high = segment.end - margin;
    const flipped = segment.angle > 90 || segment.angle < -90;
    const rotation = upright(segment.angle);
    const radians = (rotation * Math.PI) / 180;
    const width =
      Math.abs(Math.cos(radians)) * dims.width +
      Math.abs(Math.sin(radians)) * dims.height;
    const height =
      Math.abs(Math.sin(radians)) * dims.width +
      Math.abs(Math.cos(radians)) * dims.height;
    for (const candidateOffset of options.offsets ?? [offset]) {
      if (!Number.isFinite(candidateOffset)) continue;
      let visibleLow = low,
        visibleHigh = high;
      if (options.viewport) {
        const center = {
          x: segment.source.x + Math.sin(radians) * candidateOffset,
          y: segment.source.y - Math.cos(radians) * candidateOffset,
        };
        for (const [axis, span, footprint] of [
          ['x', 'width', width],
          ['y', 'height', height],
        ] as const) {
          const half = (options.viewport[span] - footprint) / 2 - padding;
          const delta =
            (segment.target[axis] - segment.source[axis]) / segment.length;
          if (
            half < 0 ||
            (!delta && Math.abs(center[axis] - options.viewport[axis]) > half)
          ) {
            visibleLow = Infinity;
            break;
          }
          if (!delta) continue;
          const a =
            segment.start +
            (options.viewport[axis] - half - center[axis]) / delta;
          const b =
            segment.start +
            (options.viewport[axis] + half - center[axis]) / delta;
          visibleLow = Math.max(visibleLow, Math.min(a, b));
          visibleHigh = Math.min(visibleHigh, Math.max(a, b));
        }
      }
      if (visibleLow > visibleHigh) continue;
      const distances = new Set([
        clamp(desired, visibleLow, visibleHigh),
        (visibleLow + visibleHigh) / 2,
        visibleLow,
        visibleHigh,
      ]);
      for (let step = 1; step < LABEL_SAMPLES; step++)
        distances.add(
          visibleLow + ((visibleHigh - visibleLow) * step) / LABEL_SAMPLES
        );
      for (const distance of distances) {
        const local = (distance - segment.start) / segment.length;
        candidates.push({
          x:
            segment.source.x +
            (segment.target.x - segment.source.x) * local +
            Math.sin(radians) * candidateOffset,
          y:
            segment.source.y +
            (segment.target.y - segment.source.y) * local -
            Math.cos(radians) * candidateOffset,
          t: distance / route.length,
          rotation,
          iconRotation: flipped ? 180 : 0,
          offset: candidateOffset,
          delta:
            Math.abs(distance - desired) +
            Math.abs(candidateOffset - offset) * 0.01,
        });
      }
    }
  }
  candidates.sort((a, b) => a.delta - b.delta || a.t - b.t);
  // A turned box lies inside its axis-aligned bounds (reachX, reachY), so
  // whatever is clear of the bounds is clear of the box; for two boxes square
  // to the axes the bounds are exact. Only obstacles and wires that reach some
  // candidate are checked for each one (padding grows the obstacle against a
  // label and the label against a wire, each in its own turned frame). Each
  // one looked at here counts against the budget like a check.
  let left = Infinity,
    right = -Infinity,
    top = Infinity,
    bottom = -Infinity;
  for (const { x, y, rotation } of candidates) {
    const rx = reachX(dims.width, dims.height, rotation, padding),
      ry = reachY(dims.width, dims.height, rotation, padding);
    left = Math.min(left, x - rx);
    right = Math.max(right, x + rx);
    top = Math.min(top, y - ry);
    bottom = Math.max(bottom, y + ry);
  }
  const nearObstacles: ObstacleBox[] = [],
    nearX: number[] = [],
    nearY: number[] = [];
  for (const box of candidates.length ? obstacles : []) {
    if (options.budget) {
      if (options.budget.remaining <= 0) return null;
      options.budget.remaining--;
    }
    const rx = reachX(box.width, box.height, box.rotation, padding),
      ry = reachY(box.width, box.height, box.rotation, padding);
    if (box.x + rx > left && box.x - rx < right && box.y + ry > top && box.y - ry < bottom) {
      nearObstacles.push(box);
      nearX.push(rx);
      nearY.push(ry);
    }
  }
  const nearSegments: Pick<EdgeRouteSegment, 'source' | 'target'>[] = [];
  for (const part of candidates.length ? options.segments ?? [] : []) {
    if (options.budget) {
      if (options.budget.remaining <= 0) return null;
      options.budget.remaining--;
    }
    if (
      Math.max(part.source.x, part.target.x) >= left &&
      Math.min(part.source.x, part.target.x) <= right &&
      Math.max(part.source.y, part.target.y) >= top &&
      Math.min(part.source.y, part.target.y) <= bottom
    )
      nearSegments.push(part);
  }
  for (const candidate of candidates) {
    const { x, y, rotation } = candidate;
    const radians = (rotation * Math.PI) / 180;
    const width =
      Math.abs(Math.cos(radians)) * dims.width +
      Math.abs(Math.sin(radians)) * dims.height;
    const height =
      Math.abs(Math.sin(radians)) * dims.width +
      Math.abs(Math.cos(radians)) * dims.height;
    const viewport = options.viewport;
    if (
      viewport &&
      (Math.abs(x - viewport.x) + width / 2 + padding > viewport.width / 2 ||
        Math.abs(y - viewport.y) + height / 2 + padding >
          viewport.height / 2)
    )
      continue;
    const label = { x, y, width: dims.width, height: dims.height, rotation };
    const rx = reachX(dims.width, dims.height, rotation, padding),
      ry = reachY(dims.width, dims.height, rotation, padding);
    const square = rotation % 90 === 0;
    let blocked = false;
    for (let index = 0; index < nearObstacles.length; index++) {
      const box = nearObstacles[index];
      if (options.budget) {
        if (options.budget.remaining <= 0) return null;
        options.budget.remaining--;
      }
      if (
        Math.abs(box.x - x) >= width / 2 + nearX[index] - 1e-9 ||
        Math.abs(box.y - y) >= height / 2 + nearY[index] - 1e-9
      )
        continue;
      if (
        (square && (!box.rotation || box.rotation % 90 === 0)) ||
        orientedBoxesOverlap(label, box, padding)
      ) {
        blocked = true;
        break;
      }
    }
    if (blocked) continue;
    for (const part of nearSegments) {
      if (options.budget) {
        if (options.budget.remaining <= 0) return null;
        options.budget.remaining--;
      }
      if (
        Math.min(part.source.x, part.target.x) > x + rx + 1e-9 ||
        Math.max(part.source.x, part.target.x) < x - rx - 1e-9 ||
        Math.min(part.source.y, part.target.y) > y + ry + 1e-9 ||
        Math.max(part.source.y, part.target.y) < y - ry - 1e-9
      )
        continue;
      if (
        edgeSegmentHitsRotatedBox(
          part,
          { x, y, width: dims.width, height: dims.height },
          rotation,
          padding
        )
      ) {
        blocked = true;
        break;
      }
    }
    if (!blocked)
      return {
        x,
        y,
        t: candidate.t,
        rotation,
        iconRotation: candidate.iconRotation,
        offset: candidate.offset,
      };
  }
  return null;
}
