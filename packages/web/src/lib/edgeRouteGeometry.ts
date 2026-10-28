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

export function edgeRouteLabel(
  route: EdgeRouteGeometry,
  options: {
    dims: Dims;
    t?: number;
    offset?: number;
    padding?: number;
    obstacles?: readonly ObstacleBox[];
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
  let best: EdgeRouteLabel | null = null;
  let bestDistance = Infinity;
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
    for (const distance of new Set([
      clamp(desired, low, high),
      (low + high) / 2,
      low,
      high,
    ])) {
      const local = (distance - segment.start) / segment.length;
      const x =
        segment.source.x +
        (segment.target.x - segment.source.x) * local +
        Math.sin(radians) * offset;
      const y =
        segment.source.y +
        (segment.target.y - segment.source.y) * local -
        Math.cos(radians) * offset;
      if (
        obstacles.some(
          box =>
            Math.abs(x - box.x) < (width + box.width) / 2 + padding &&
            Math.abs(y - box.y) < (height + box.height) / 2 + padding
        )
      )
        continue;
      const delta = Math.abs(distance - desired);
      if (
        delta < bestDistance ||
        (delta === bestDistance && distance / route.length < best!.t)
      ) {
        bestDistance = delta;
        best = {
          x,
          y,
          t: distance / route.length,
          rotation,
          iconRotation: flipped ? 180 : 0,
        };
      }
    }
  }
  return best;
}
