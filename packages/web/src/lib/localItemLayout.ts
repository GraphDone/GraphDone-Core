import { fitGraphText, measureGraphText } from './graphSymbolLayout';
import type { LocalItemCard } from './localItemLOD';
import type { SemanticRelationshipIndex } from './semanticRelationships';

type Rect = { x: number; y: number; width: number; height: number };
export type LocalItemObstacle = Rect;
export type LocalCamera = { x: number; y: number; scale: number };

export function localCardDimensions(
  card: LocalItemCard,
  viewportWidth: number
) {
  const width = Math.min(320, Math.max(160, viewportWidth - 40));
  const text = card.kind === 'item' ? card.item.title : card.label;
  const title = fitGraphText(text, width - 28, 18, measureGraphText, 3);
  return { width, height: 88 + title.lines.length * 24, title };
}

const clear = (a: Rect, b: Rect, gap: number) =>
  a.x + a.width + gap <= b.x ||
  b.x + b.width + gap <= a.x ||
  a.y + a.height + gap <= b.y ||
  b.y + b.height + gap <= a.y;

export function localItemSlots(
  viewport: { width: number; height: number },
  obstacles: readonly Rect[],
  cell: { width: number; height: number }
) {
  const { width, height } = viewport;
  const dx = cell.width + 64,
    dy = cell.height + 64;
  const templates = [
    [
      [0, 0],
      [-dx, -dy / 2],
      [dx, -dy / 2],
      [-dx, dy / 2],
      [dx, dy / 2],
      [0, -dy],
      [0, dy],
    ],
    [
      [0, 0],
      [0, -dy],
      [0, dy],
      [-dx, 0],
      [dx, 0],
      [-dx, -dy],
      [dx, -dy],
      [-dx, dy],
      [dx, dy],
    ],
  ];
  const raw = [height / 2];
  for (const offsets of templates)
    for (const [, y] of offsets) {
      raw.push(20 + cell.height / 2 - y, height - 20 - cell.height / 2 - y);
      for (const obstacle of obstacles)
        raw.push(
          obstacle.y + obstacle.height + 20 + cell.height / 2 - y,
          obstacle.y - 20 - cell.height / 2 - y
        );
    }
  const ys = [...new Set(raw)]
    .filter(y => Number.isFinite(y))
    .sort(
      (a, b) => Math.abs(a - height / 2) - Math.abs(b - height / 2) || a - b
    )
    .slice(0, 48);
  let slots: Rect[] = [],
    distance = Infinity,
    candidates = 0;
  for (const offsets of templates)
    for (const centerY of ys) {
      candidates++;
      const rectangles = offsets.map(([x, y]) => ({
        x: width / 2 + x - cell.width / 2,
        y: centerY + y - cell.height / 2,
        ...cell,
      }));
      const usable = (rect: Rect) =>
        rect.x >= 20 &&
        rect.y >= 20 &&
        rect.x + rect.width <= width - 20 &&
        rect.y + rect.height <= height - 20 &&
        obstacles.every(obstacle => clear(rect, obstacle, 20));
      if (!usable(rectangles[0])) continue;
      const accepted = [
        rectangles[0],
        ...rectangles.slice(1).filter(usable),
      ].slice(0, 7);
      const away = Math.abs(centerY - height / 2);
      if (
        accepted.length > slots.length ||
        (accepted.length === slots.length && away < distance)
      ) {
        slots = accepted;
        distance = away;
      }
    }
  return { slots, work: { candidates, maxCandidates: 96 } };
}

export function denseItemCandidates(
  index: SemanticRelationshipIndex,
  minimum = 20
) {
  return [...index.byId.keys()].filter(id => {
    const neighbors = new Set<string>();
    for (const edge of [
      ...(index.outgoing.get(id) ?? []),
      ...(index.incoming.get(id) ?? []),
    ]) {
      const a = typeof edge.source === 'string' ? edge.source : edge.source.id;
      const b = typeof edge.target === 'string' ? edge.target : edge.target.id;
      if (a !== id && index.byId.has(a)) neighbors.add(a);
      if (b !== id && index.byId.has(b)) neighbors.add(b);
    }
    return neighbors.size >= minimum;
  });
}

export function nearestDenseItem(
  candidates: readonly string[],
  positions: ReadonlyMap<string, { x: number; y: number }>,
  camera: LocalCamera,
  viewport: { width: number; height: number },
  selectedId?: string
) {
  const visible = candidates
    .flatMap(id => {
      const point = positions.get(id);
      if (!point) return [];
      const x = point.x * camera.scale + camera.x,
        y = point.y * camera.scale + camera.y;
      return x >= 0 && x <= viewport.width && y >= 0 && y <= viewport.height
        ? [
            {
              id,
              distance: Math.hypot(
                x - viewport.width / 2,
                y - viewport.height / 2
              ),
            },
          ]
        : [];
    })
    .sort(
      (a, b) =>
        Number(b.id === selectedId) - Number(a.id === selectedId) ||
        a.distance - b.distance ||
        a.id.localeCompare(b.id)
    );
  return visible[0]?.id;
}
