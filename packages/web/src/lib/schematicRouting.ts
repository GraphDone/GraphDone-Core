export interface SchematicPoint {
  x: number;
  y: number;
}
export interface SchematicCard extends SchematicPoint {
  id: string;
  width: number;
  height: number;
}
export interface SchematicConnection {
  id: string;
  source: string;
  target: string;
  type: string;
  edgeIds: readonly string[];
}
export interface SchematicSegment {
  a: SchematicPoint;
  b: SchematicPoint;
  bus: string;
}
export interface SchematicRoute {
  id: string;
  bus: string;
  source: string;
  target: string;
  connections: readonly SchematicConnection[];
  edgeIds: readonly string[];
  points: SchematicPoint[];
}
export interface SchematicDeferred extends Omit<SchematicRoute, 'points'> {
  reason: 'endpoint-not-placed' | 'routing-budget';
}

const pointKey = (p: SchematicPoint) => `${p.x},${p.y}`;
const same = (a: SchematicPoint, b: SchematicPoint) =>
  a.x === b.x && a.y === b.y;
const between = (value: number, a: number, b: number) =>
  value >= Math.min(a, b) && value <= Math.max(a, b);
const distance = (a: SchematicPoint, b: SchematicPoint) =>
  Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
export const schematicSegments = (
  points: readonly SchematicPoint[],
  bus: string
): SchematicSegment[] =>
  points.slice(1).map((b, i) => ({ a: points[i], b, bus }));

export function segmentHitsCard(
  segment: SchematicSegment,
  card: SchematicCard,
  padding = 0
) {
  const left = card.x - padding,
    right = card.x + card.width + padding;
  const top = card.y - padding,
    bottom = card.y + card.height + padding;
  return segment.a.x === segment.b.x
    ? segment.a.x > left &&
        segment.a.x < right &&
        Math.max(segment.a.y, segment.b.y) > top &&
        Math.min(segment.a.y, segment.b.y) < bottom
    : segment.a.y > top &&
        segment.a.y < bottom &&
        Math.max(segment.a.x, segment.b.x) > left &&
        Math.min(segment.a.x, segment.b.x) < right;
}

export function segmentContact(
  a: SchematicSegment,
  b: SchematicSegment
): 'crossing' | 'overlap' | null {
  const av = a.a.x === a.b.x,
    bv = b.a.x === b.b.x;
  if (av !== bv) {
    const vertical = av ? a : b,
      horizontal = av ? b : a;
    return between(vertical.a.x, horizontal.a.x, horizontal.b.x) &&
      between(horizontal.a.y, vertical.a.y, vertical.b.y)
      ? 'crossing'
      : null;
  }
  if (av ? a.a.x !== b.a.x : a.a.y !== b.a.y) return null;
  const values = av
    ? [a.a.y, a.b.y, b.a.y, b.b.y]
    : [a.a.x, a.b.x, b.a.x, b.b.x];
  const high = Math.min(
    Math.max(values[0], values[1]),
    Math.max(values[2], values[3])
  );
  const low = Math.max(
    Math.min(values[0], values[1]),
    Math.min(values[2], values[3])
  );
  return high > low ? 'overlap' : high === low ? 'crossing' : null;
}

export function measureSchematicClutter(
  cards: readonly SchematicCard[],
  segments: readonly SchematicSegment[],
  cellSize = 48
) {
  let cardIntersections = 0,
    unrelatedCrossings = 0,
    unrelatedOverlaps = 0,
    diagonalSegments = 0;
  const cells = new Map<string, Set<string>>();
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    if (segment.a.x !== segment.b.x && segment.a.y !== segment.b.y)
      diagonalSegments++;
    for (const card of cards)
      if (segmentHitsCard(segment, card)) cardIntersections++;
    for (let j = 0; j < i; j++) {
      if (segments[j].bus === segment.bus) continue;
      const contact = segmentContact(segment, segments[j]);
      if (contact === 'crossing') unrelatedCrossings++;
      if (contact === 'overlap') unrelatedOverlaps++;
    }
    const steps = Math.max(
      1,
      Math.ceil(distance(segment.a, segment.b) / (cellSize / 2))
    );
    for (let step = 0; step <= steps; step++) {
      const key = `${Math.floor((segment.a.x + ((segment.b.x - segment.a.x) * step) / steps) / cellSize)},${Math.floor((segment.a.y + ((segment.b.y - segment.a.y) * step) / steps) / cellSize)}`;
      if (!cells.has(key)) cells.set(key, new Set());
      cells.get(key)!.add(segment.bus);
    }
  }
  return {
    cardIntersections,
    unrelatedCrossings,
    unrelatedOverlaps,
    diagonalSegments,
    maxBusesPerCell: Math.max(
      0,
      ...[...cells.values()].map(value => value.size)
    ),
  };
}

export function schematicJunctions(segments: readonly SchematicSegment[]) {
  const junctions: Array<SchematicPoint & { bus: string }> = [];
  for (const bus of [...new Set(segments.map(segment => segment.bus))].sort()) {
    const owned = segments.filter(segment => segment.bus === bus);
    const points = new Map(
      owned
        .flatMap(segment => [segment.a, segment.b])
        .map(p => [pointKey(p), p])
    );
    for (const p of points.values()) {
      const directions = new Set<string>();
      for (const segment of owned) {
        if (
          segment.a.x === segment.b.x &&
          p.x === segment.a.x &&
          between(p.y, segment.a.y, segment.b.y)
        ) {
          if (p.y > Math.min(segment.a.y, segment.b.y)) directions.add('n');
          if (p.y < Math.max(segment.a.y, segment.b.y)) directions.add('s');
        }
        if (
          segment.a.y === segment.b.y &&
          p.y === segment.a.y &&
          between(p.x, segment.a.x, segment.b.x)
        ) {
          if (p.x > Math.min(segment.a.x, segment.b.x)) directions.add('w');
          if (p.x < Math.max(segment.a.x, segment.b.x)) directions.add('e');
        }
      }
      if (directions.size >= 3) junctions.push({ ...p, bus });
    }
  }
  return junctions;
}

function ports(card: SchematicCard) {
  return [
    [
      { x: card.x + card.width, y: card.y + card.height / 2 },
      { x: card.x + card.width + 8, y: card.y + card.height / 2 },
    ],
    [
      { x: card.x, y: card.y + card.height / 2 },
      { x: card.x - 8, y: card.y + card.height / 2 },
    ],
    [
      { x: card.x + card.width / 2, y: card.y },
      { x: card.x + card.width / 2, y: card.y - 8 },
    ],
    [
      { x: card.x + card.width / 2, y: card.y + card.height },
      { x: card.x + card.width / 2, y: card.y + card.height + 8 },
    ],
  ];
}

function compact(points: SchematicPoint[]) {
  return points.filter(
    (p, i) =>
      !i ||
      i === points.length - 1 ||
      !(
        (points[i - 1].x === p.x && p.x === points[i + 1].x) ||
        (points[i - 1].y === p.y && p.y === points[i + 1].y)
      )
  );
}

export function routeSchematicConnections(
  cards: readonly SchematicCard[],
  connections: readonly SchematicConnection[],
  width: number,
  height: number,
  obstacles: readonly SchematicCard[] = [],
  budget: {
    maxAttempts?: number;
    maxExpandedStates?: number;
    sharedEndpoint?: 'source' | 'target';
  } = {}
) {
  const byId = new Map(cards.map(card => [card.id, card]));
  const grouped = new Map<string, SchematicConnection[]>();
  for (const connection of [...connections].sort((a, b) =>
    a.id.localeCompare(b.id)
  )) {
    const key = JSON.stringify([connection.source, connection.target]);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(connection);
  }
  const buses = [...grouped].map(([id, entries]) => ({
    id,
    bus: entries[0][budget.sharedEndpoint ?? 'source'],
    source: entries[0].source,
    target: entries[0].target,
    connections: entries,
    edgeIds: entries.flatMap(entry => entry.edgeIds),
  }));
  buses.sort(
    (a, b) => b.edgeIds.length - a.edgeIds.length || a.id.localeCompare(b.id)
  );
  const blocks = [...cards, ...obstacles];
  const xs = [
    ...new Set([
      8,
      width - 8,
      ...blocks.flatMap(card => [
        card.x - 8,
        card.x - 14,
        card.x + card.width / 2,
        card.x + card.width + 8,
        card.x + card.width + 14,
      ]),
    ]),
  ]
    .filter(x => x >= 4 && x <= width - 4)
    .sort((a, b) => a - b);
  const ys = [
    ...new Set([
      8,
      height - 8,
      ...blocks.flatMap(card => [
        card.y - 8,
        card.y - 14,
        card.y + card.height / 2,
        card.y + card.height + 8,
        card.y + card.height + 14,
      ]),
    ]),
  ]
    .filter(y => y >= 4 && y <= height - 4)
    .sort((a, b) => a - b);
  const valid = (p: SchematicPoint) =>
    !blocks.some(
      card =>
        p.x > card.x - 5 &&
        p.x < card.x + card.width + 5 &&
        p.y > card.y - 5 &&
        p.y < card.y + card.height + 5
    );
  const occupied: SchematicSegment[] = [];
  const routes: SchematicRoute[] = [];
  const deferred: SchematicDeferred[] = [];
  const maxRoutes = width < 600 ? 6 : 16;
  const limit = (value: number | undefined, maximum: number) =>
    value === undefined
      ? maximum
      : Number.isFinite(value)
        ? Math.max(0, Math.min(maximum, Math.floor(value)))
        : 0;
  const work = {
    attempts: 0,
    expandedStates: 0,
    maxAttempts: limit(budget.maxAttempts, width < 600 ? 12 : 32),
    maxExpandedStates: limit(budget.maxExpandedStates, 6000),
  };
  for (const bus of buses) {
    const source = byId.get(bus.source),
      target = byId.get(bus.target);
    if (!source || !target) {
      deferred.push({ ...bus, reason: 'endpoint-not-placed' });
      continue;
    }
    if (
      work.attempts >= work.maxAttempts ||
      work.expandedStates >= work.maxExpandedStates ||
      routes.length >= maxRoutes ||
      source.id === target.id ||
      xs.length * ys.length > 4000
    ) {
      deferred.push({ ...bus, reason: 'routing-budget' });
      continue;
    }
    work.attempts++;
    const conflicts = (segment: SchematicSegment) =>
      occupied.some(
        other => other.bus !== bus.bus && segmentContact(segment, other)
      );
    const availablePorts = (card: SchematicCard) =>
      ports(card).filter(
        ([inner, outer]) =>
          xs.includes(outer.x) &&
          ys.includes(outer.y) &&
          valid(outer) &&
          !conflicts({ a: inner, b: outer, bus: bus.bus }) &&
          !blocks.some(
            other =>
              other.id !== card.id &&
              segmentHitsCard({ a: inner, b: outer, bus: bus.bus }, other, 5)
          )
      );
    const starts = availablePorts(source),
      ends = availablePorts(target);
    const goal = new Map(ends.map(port => [pointKey(port[1]), port[0]]));
    type State = {
      x: number;
      y: number;
      direction: number;
      cost: number;
      estimate: number;
      previous?: State;
      inner?: SchematicPoint;
    };
    const queue: State[] = starts.map(([inner, outer]) => ({
      x: xs.indexOf(outer.x),
      y: ys.indexOf(outer.y),
      direction: inner.x === outer.x ? 1 : 0,
      cost: 8,
      estimate: 8,
      inner,
    }));
    const costs = new Map<string, number>();
    let found: State | undefined;
    while (
      queue.length &&
      work.expandedStates < work.maxExpandedStates &&
      goal.size
    ) {
      work.expandedStates++;
      queue.sort((a, b) => b.estimate - a.estimate || b.cost - a.cost);
      const current = queue.pop()!;
      const p = { x: xs[current.x], y: ys[current.y] };
      const key = `${current.x},${current.y},${current.direction}`;
      if ((costs.get(key) ?? Infinity) < current.cost) continue;
      if (goal.has(pointKey(p))) {
        found = current;
        break;
      }
      for (const [dx, dy, direction] of [
        [1, 0, 0],
        [-1, 0, 0],
        [0, 1, 1],
        [0, -1, 1],
      ]) {
        const x = current.x + dx,
          y = current.y + dy;
        if (x < 0 || x >= xs.length || y < 0 || y >= ys.length) continue;
        const next = { x: xs[x], y: ys[y] };
        const segment = { a: p, b: next, bus: bus.bus };
        if (
          !valid(next) ||
          blocks.some(card => segmentHitsCard(segment, card, 5)) ||
          conflicts(segment)
        )
          continue;
        const shared = occupied.some(
          other =>
            other.bus === bus.bus &&
            segmentContact(segment, other) === 'overlap'
        );
        const cost =
          current.cost +
          distance(p, next) * (shared ? 0.35 : 1) +
          (direction === current.direction ? 0 : 12);
        const nextKey = `${x},${y},${direction}`;
        if (cost >= (costs.get(nextKey) ?? Infinity)) continue;
        costs.set(nextKey, cost);
        queue.push({
          x,
          y,
          direction,
          cost,
          estimate:
            cost +
            Math.min(...ends.map(port => distance(next, port[1]))) * 0.35,
          previous: current,
        });
      }
    }
    if (!found) {
      deferred.push({ ...bus, reason: 'routing-budget' });
      continue;
    }
    const points: SchematicPoint[] = [
      goal.get(pointKey({ x: xs[found.x], y: ys[found.y] }))!,
    ];
    let current: State | undefined = found;
    while (current) {
      points.push({ x: xs[current.x], y: ys[current.y] });
      if (current.inner) points.push(current.inner);
      current = current.previous;
    }
    const route = { ...bus, points: compact(points.reverse()) };
    const segments = schematicSegments(route.points, bus.bus);
    if (segments.some(segment => same(segment.a, segment.b))) {
      deferred.push({ ...bus, reason: 'routing-budget' });
      continue;
    }
    occupied.push(...segments);
    routes.push(route);
  }
  return {
    routes,
    deferred,
    work,
    metrics: measureSchematicClutter(cards, occupied),
    segments: occupied,
    junctions: schematicJunctions(occupied),
  };
}
