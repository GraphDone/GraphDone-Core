/**
 * Camera fit for item cards whose geometry depends on the presented scale.
 *
 * Cards switch to compact geometry below `detailScale` (see graphItemLayout).
 * Fitting with the geometry of the *current* zoom is therefore not a fixed
 * point: full cards may need a scale below 1, which makes them compact and
 * smaller, so the next fit zooms back above 1 and they become full again. On
 * phones that loop moved the camera every framing pass and hid the focused
 * header controls each time the cards turned compact. This helper always
 * measures cards with the geometry they will have at the returned scale.
 */

export interface FitPoint {
  x: number;
  y: number;
}
export interface FitSize {
  width: number;
  height: number;
}
export interface FitRegion extends FitPoint, FitSize {}
export interface FitObstacle {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface GraphFitInput<T extends FitPoint> {
  /** Size of the camera viewport in screen pixels. */
  width: number;
  height: number;
  /** Screen rectangles (viewport coordinates) the cards should avoid. */
  obstacles: FitObstacle[];
  cards: T[];
  /** Card size in world units when presented at `scale`. */
  dimensionsAt: (card: T, scale: number) => FitSize;
  /** Preferred breathing room around the cards, in world units. */
  padding?: number;
  /** Smallest room accepted to keep full cards at `detailScale`. */
  margin?: number;
  /** Never zoom in past this (a 3-card graph should not fill the screen). */
  maxScale?: number;
  /** Cards at or above this scale use full geometry; below it, compact. */
  detailScale?: number;
}

export interface GraphFit {
  scale: number;
  translateX: number;
  translateY: number;
  region: FitRegion;
}

interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/** Largest obstacle-free rectangles, built from the obstacle edges. */
export function fitRegions(
  width: number,
  height: number,
  obstacles: FitObstacle[]
): FitRegion[] {
  const usable = obstacles.filter(o => o.right > o.left && o.bottom > o.top);
  if (usable.length === 0) return [{ x: 0, y: 0, width, height }];
  const xs = Array.from(
    new Set([0, width, ...usable.flatMap(o => [o.left, o.right])])
  ).sort((a, b) => a - b);
  const ys = Array.from(
    new Set([0, height, ...usable.flatMap(o => [o.top, o.bottom])])
  ).sort((a, b) => a - b);
  const regions: FitRegion[] = [];
  for (let l = 0; l < xs.length - 1; l += 1)
    for (let r = l + 1; r < xs.length; r += 1)
      for (let t = 0; t < ys.length - 1; t += 1)
        for (let b = t + 1; b < ys.length; b += 1) {
          const region = {
            x: xs[l],
            y: ys[t],
            width: xs[r] - xs[l],
            height: ys[b] - ys[t],
          };
          const blocked = usable.some(
            o =>
              region.x < o.right &&
              region.x + region.width > o.left &&
              region.y < o.bottom &&
              region.y + region.height > o.top
          );
          if (!blocked && region.width > 0 && region.height > 0)
            regions.push(region);
        }
  return regions.length > 0 ? regions : [{ x: 0, y: 0, width, height }];
}

export function computeGraphFit<T extends FitPoint>({
  width,
  height,
  obstacles,
  cards,
  dimensionsAt,
  padding = 60,
  margin = 12,
  maxScale = 1.25,
  detailScale = 1,
}: GraphFitInput<T>): GraphFit | null {
  const positioned = cards.filter(
    card => Number.isFinite(card.x) && Number.isFinite(card.y)
  );
  if (positioned.length === 0 || width <= 0 || height <= 0) return null;
  const regions = fitRegions(width, height, obstacles);

  const boundsAt = (scale: number): Bounds => {
    const bounds = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
    for (const card of positioned) {
      const size = dimensionsAt(card, scale);
      bounds.minX = Math.min(bounds.minX, card.x - size.width / 2);
      bounds.maxX = Math.max(bounds.maxX, card.x + size.width / 2);
      bounds.minY = Math.min(bounds.minY, card.y - size.height / 2);
      bounds.maxY = Math.max(bounds.maxY, card.y + size.height / 2);
    }
    return bounds;
  };
  const fitInto = (bounds: Bounds, room: number) => {
    const boundsWidth = Math.max(1, bounds.maxX - bounds.minX + room * 2);
    const boundsHeight = Math.max(1, bounds.maxY - bounds.minY + room * 2);
    const scaleFor = (region: FitRegion) =>
      Math.min(region.width / boundsWidth, region.height / boundsHeight, maxScale);
    let best = regions[0];
    for (const region of regions.slice(1)) {
      const next = scaleFor(region);
      const current = scaleFor(best);
      if (
        next > current ||
        (next === current && region.width * region.height > best.width * best.height)
      )
        best = region;
    }
    return { scale: scaleFor(best), region: best, bounds };
  };

  const full = boundsAt(detailScale);
  let fit = fitInto(full, padding);
  if (fit.scale < detailScale) {
    const tight = fitInto(full, margin);
    if (tight.scale >= detailScale) {
      // Full cards fit at 100% with a smaller margin: keep them readable and
      // keep their header controls instead of shrinking them to symbols.
      fit = { ...tight, scale: detailScale };
    } else {
      // Below detail scale the cards are compact; fit that geometry. Cap just
      // under the threshold so the fitted scale cannot flip them back to full
      // cards that do not fit.
      const compactCeiling = detailScale - 0.001;
      let scale = Math.min(fit.scale, compactCeiling);
      for (let pass = 0; pass < 4; pass += 1) {
        const next = fitInto(boundsAt(scale), padding);
        const nextScale = Math.min(next.scale, compactCeiling);
        fit = { ...next, scale: nextScale };
        if (Math.abs(nextScale - scale) < 1e-4) break;
        scale = nextScale;
      }
    }
  }

  const { bounds, region, scale } = fit;
  return {
    scale,
    translateX: region.x + region.width / 2 - ((bounds.minX + bounds.maxX) / 2) * scale,
    translateY: region.y + region.height / 2 - ((bounds.minY + bounds.maxY) / 2) * scale,
    region,
  };
}
