type Rect = { x: number; y: number; width: number; height: number };
type Card = Rect & { id: string };

export function frameOrganizedNeighborhood(
  cards: readonly Card[],
  focus: string,
  viewport: { width: number; height: number },
  obstacles: readonly Rect[],
  scale: number,
  preferred: { x: number; y: number }
) {
  const center = cards.find(card => card.id === focus);
  if (!center) return preferred;
  const nearby = [...cards]
    .sort(
      (a, b) =>
        Math.hypot(a.x - center.x, a.y - center.y) -
          Math.hypot(b.x - center.x, b.y - center.y) || a.id.localeCompare(b.id)
    )
    .slice(0, 32);
  const projected = nearby.map(card => ({
    ...card,
    x: (card.x - center.x) * scale,
    y: (card.y - center.y) * scale,
    width: card.width * scale,
    height: card.height * scale,
  }));
  const minX = 20 + (center.width * scale) / 2,
    maxX = viewport.width - 20 - (center.width * scale) / 2;
  const minY = Math.max(
      20 + (center.height * scale) / 2,
      preferred.y - viewport.height / 4
    ),
    maxY = Math.min(
      viewport.height - 20 - (center.height * scale) / 2,
      preferred.y + viewport.height / 4
    );
  const x = Math.max(minX, Math.min(preferred.x, maxX));
  const ys = [preferred.y, viewport.height / 2, minY, maxY];
  for (const card of projected)
    for (const obstacle of obstacles) {
      ys.push(
        obstacle.y - card.height / 2 - 20 - card.y,
        obstacle.y + obstacle.height + card.height / 2 + 20 - card.y
      );
    }
  const candidates = (
    values: number[],
    low: number,
    high: number,
    preferredValue: number
  ) =>
    [...new Set(values.map(value => Math.max(low, Math.min(value, high))))]
      .sort(
        (a, b) =>
          Math.abs(a - preferredValue) - Math.abs(b - preferredValue) || a - b
      )
      .slice(0, 16);
  let best = { x, y: preferred.y },
    bestWhole = -1,
    bestCovered = Infinity,
    bestDistance = Infinity;
  for (const y of candidates(ys, minY, maxY, preferred.y)) {
    let covered = 0,
      whole = 0;
    for (const card of projected) {
      const left = x + card.x - card.width / 2,
        top = y + card.y - card.height / 2,
        right = left + card.width,
        bottom = top + card.height;
      if (
        left >= 12 &&
        right <= viewport.width - 12 &&
        top >= 12 &&
        bottom <= viewport.height - 12
      )
        whole++;
      for (const obstacle of obstacles) {
        const overlap =
          Math.max(
            0,
            Math.min(right, obstacle.x + obstacle.width + 12) -
              Math.max(left, obstacle.x - 12)
          ) *
          Math.max(
            0,
            Math.min(bottom, obstacle.y + obstacle.height + 12) -
              Math.max(top, obstacle.y - 12)
          );
        covered += overlap * (card.id === focus ? 10 : 1);
      }
    }
    const distance = Math.abs(y - preferred.y);
    if (
      whole > bestWhole ||
      (whole === bestWhole &&
        (covered < bestCovered ||
          (covered === bestCovered && distance < bestDistance)))
    ) {
      bestWhole = whole;
      bestCovered = covered;
      bestDistance = distance;
      best = { x, y };
    }
  }
  return best;
}
