import {
  createEdgeRoute,
  pointOnEdgeRoute,
  projectEdgeRoutePointer,
} from './edgeRouteGeometry';
import type { SchematicPoint, SchematicRoute } from './schematicRouting';

export const indexOverviewBusHits = (routes: readonly SchematicRoute[]) =>
  routes.map(route => ({ route, geometry: createEdgeRoute(route.points) }));

export function nearestOverviewBus(
  hits: ReturnType<typeof indexOverviewBusHits>,
  point: SchematicPoint,
  preferred: string
) {
  let best = hits.find(hit => hit.route.id === preferred)?.route;
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return best;
  let bestDistance = Infinity;
  for (const { route, geometry } of hits) {
    if (!geometry) continue;
    const nearest = pointOnEdgeRoute(
      geometry,
      projectEdgeRoutePointer(geometry, point)
    );
    const distance = Math.hypot(point.x - nearest.x, point.y - nearest.y);
    if (
      distance < bestDistance - 1e-6 ||
      (Math.abs(distance - bestDistance) <= 1e-6 && route.id === preferred)
    ) {
      best = route;
      bestDistance = distance;
    }
  }
  return best;
}
