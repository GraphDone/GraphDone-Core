interface PlacedCard {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Repair intersecting card rectangles once, before painting a saved layout.
 * Non-overlapping cards keep their exact coordinates. This is placement, not
 * a continuously running force: settled cards cannot shake against pins.
 */
export function separateCards<T extends { id: string; x?: number; y?: number }>(
  nodes: T[],
  dimensions: (node: T) => { width: number; height: number },
  gap = 24,
): Set<string> {
  const moved = new Set<string>();
  // Stable ordering makes a repair identical across refreshes and API ordering.
  const cards = [...nodes].sort((a, b) => a.id.localeCompare(b.id))
    .map(node => ({ node, size: dimensions(node) }));
  let cellWidth = 1;
  let cellHeight = 1;
  for (const { size } of cards) {
    cellWidth = Math.max(cellWidth, size.width + gap);
    cellHeight = Math.max(cellHeight, size.height + gap);
  }
  // The separation between colliding centers is less than one cell along
  // each axis, including the gap. Only the neighboring cells can obstruct us.
  const rows = new Map<number, Map<number, PlacedCard[]>>();
  const free = (x: number, y: number, width: number, height: number) => {
    const col = Math.floor(x / cellWidth);
    const row = Math.floor(y / cellHeight);
    for (let j = row - 1; j <= row + 1; j++) {
      const columns = rows.get(j);
      if (!columns) continue;
      for (let i = col - 1; i <= col + 1; i++) {
        const occupants = columns.get(i);
        if (!occupants) continue;
        for (const card of occupants) {
          if (Math.abs(x - card.x) < (width + card.width) / 2 + gap &&
              Math.abs(y - card.y) < (height + card.height) / 2 + gap) return false;
        }
      }
    }
    return true;
  };

  for (const { node, size: { width, height } } of cards) {
    const originalX = node.x ?? 0;
    const originalY = node.y ?? 0;
    let x = originalX;
    let y = originalY;
    if (!free(x, y, width, height)) {
      // Visit each square perimeter in the same row-major order as the saved
      // layout repair. Middle rows have only the two side positions.
      search: for (let ring = 1; ring <= nodes.length; ring++) {
        for (let dy = -ring; dy <= ring; dy++) {
          const stride = Math.abs(dy) === ring ? 1 : 2 * ring;
          for (let dx = -ring; dx <= ring; dx += stride) {
            const candidateX = originalX + dx * (width + gap);
            const candidateY = originalY + dy * (height + gap);
            if (free(candidateX, candidateY, width, height)) {
              x = candidateX;
              y = candidateY;
              break search;
            }
          }
        }
      }
      node.x = x;
      node.y = y;
      moved.add(node.id);
    }
    const row = Math.floor(y / cellHeight);
    const col = Math.floor(x / cellWidth);
    const columns = rows.get(row) ?? new Map<number, PlacedCard[]>();
    if (!rows.has(row)) rows.set(row, columns);
    const occupants = columns.get(col) ?? [];
    if (!columns.has(col)) columns.set(col, occupants);
    occupants.push({ x, y, width, height });
  }
  return moved;
}
