import type { SchematicCard, SchematicPoint } from './schematicRouting';

export function placeOverviewBusHint(
  anchor: SchematicPoint,
  width: number,
  height: number,
  hintWidth: number,
  hintHeight: number,
  obstacles: readonly SchematicCard[]
) {
  const maxX = Math.max(12, width - hintWidth - 12),
    maxY = Math.max(12, height - hintHeight - 12);
  const clampX = (x: number) => Math.max(12, Math.min(x, maxX));
  const clampY = (y: number) => Math.max(12, Math.min(y, maxY));
  const candidatesX = [
    ...new Set(
      [
        12,
        maxX,
        anchor.x + 28,
        anchor.x - hintWidth - 28,
        ...obstacles.flatMap(rect => [
          rect.x - hintWidth - 12,
          rect.x + rect.width + 12,
        ]),
      ].map(clampX)
    ),
  ];
  const candidatesY = [
    ...new Set(
      [
        12,
        maxY,
        anchor.y + 28,
        anchor.y - hintHeight - 28,
        ...obstacles.flatMap(rect => [
          rect.y - hintHeight - 12,
          rect.y + rect.height + 12,
        ]),
      ].map(clampY)
    ),
  ];
  const xs = [
    ...new Set([
      12,
      maxX,
      ...candidatesX
        .sort(
          (a, b) =>
            Math.abs(a + hintWidth / 2 - anchor.x) -
            Math.abs(b + hintWidth / 2 - anchor.x)
        )
        .slice(0, 14),
    ]),
  ];
  const ys = [
    ...new Set([
      12,
      maxY,
      ...candidatesY
        .sort(
          (a, b) =>
            Math.abs(a + hintHeight / 2 - anchor.y) -
            Math.abs(b + hintHeight / 2 - anchor.y)
        )
        .slice(0, 14),
    ]),
  ];
  let best = { x: clampX(anchor.x + 16), y: clampY(anchor.y + 16) };
  let bestScore = Infinity;
  let bestPointerOverlap = Infinity;
  for (const x of xs)
    for (const y of ys) {
      const pointerOverlap =
        Math.max(
          0,
          Math.min(x + hintWidth, anchor.x + 12) - Math.max(x, anchor.x - 12)
        ) *
        Math.max(
          0,
          Math.min(y + hintHeight, anchor.y + 12) - Math.max(y, anchor.y - 12)
        );
      const overlap = obstacles.reduce(
        (area, rect) =>
          area +
          Math.max(
            0,
            Math.min(x + hintWidth + 8, rect.x + rect.width) -
              Math.max(x - 8, rect.x)
          ) *
            Math.max(
              0,
              Math.min(y + hintHeight + 8, rect.y + rect.height) -
                Math.max(y - 8, rect.y)
            ),
        0
      );
      const distance =
        Math.abs(x + hintWidth / 2 - anchor.x) +
        Math.abs(y + hintHeight / 2 - anchor.y);
      const score = overlap * (width + height + 1) + distance;
      if (
        pointerOverlap < bestPointerOverlap ||
        (pointerOverlap === bestPointerOverlap && score < bestScore)
      ) {
        best = { x, y };
        bestScore = score;
        bestPointerOverlap = pointerOverlap;
      }
    }
  return best;
}
