import {
  organizationAdjacency,
  organizeTopology,
  type OrganizationEdge,
} from './topologyOrganization';
import { placeOverviewLabels, type OverviewAnchor } from './semanticLOD';

export function organizeOverview(
  anchors: readonly OverviewAnchor[],
  connections: readonly OrganizationEdge[],
  width: number,
  height: number,
  obstacles: readonly {
    left: number;
    right: number;
    top: number;
    bottom: number;
  }[]
) {
  const adjacency = organizationAdjacency(anchors, connections);
  const topology = organizeTopology(
    anchors,
    connections,
    () => ({ width: 240, height: 96 }),
    { width, height }
  );
  const points = [...topology.positions.values()];
  const left = Math.min(...points.map(p => p.x)),
    right = Math.max(...points.map(p => p.x));
  const top = Math.min(...points.map(p => p.y)),
    bottom = Math.max(...points.map(p => p.y));
  const scale = Math.min(
    1,
    Math.max(0, width - 300) / Math.max(1, right - left),
    Math.max(0, height - 250) / Math.max(1, bottom - top)
  );
  const ordered = [...anchors].sort(
    (a, b) =>
      adjacency.get(b.id)!.length - adjacency.get(a.id)!.length ||
      a.id.localeCompare(b.id)
  );
  const targets = ordered.map(anchor => {
    const point = topology.positions.get(anchor.id)!;
    return {
      ...anchor,
      x: width / 2 + (point.x - (left + right) / 2) * scale,
      y: height / 2 + (point.y - (top + bottom) / 2) * scale,
    };
  });
  const layout = placeOverviewLabels(targets, width, height, obstacles, true);
  const byId = new Map(layout.placed.map(card => [card.id, card]));
  const pinned = new Set(
    topology.components
      .filter(component => component.kind === 'hub')
      .map(component => component.center)
  );
  const score = () =>
    layout.placed.reduce(
      (sum, card) =>
        sum +
        (adjacency.get(card.id) ?? []).reduce((subtotal, id) => {
          const other = byId.get(id);
          return (
            subtotal +
            (other
              ? Math.abs(card.x - other.x) + Math.abs(card.y - other.y)
              : 0)
          );
        }, 0),
      0
    ) / 2;
  const work = {
    candidates: 0,
    maxCandidates: 1024,
    passes: 0,
    before: score(),
    after: 0,
  };
  for (let pass = 0; pass < 4 && work.candidates < work.maxCandidates; pass++) {
    let improved = false;
    work.passes++;
    for (let i = 0; i < layout.placed.length; i++)
      for (let j = i + 1; j < layout.placed.length; j++) {
        const a = layout.placed[i],
          b = layout.placed[j];
        if (
          pinned.has(a.id) ||
          pinned.has(b.id) ||
          work.candidates >= work.maxCandidates
        )
          continue;
        work.candidates++;
        const before = score(),
          ax = a.x,
          ay = a.y;
        a.x = b.x;
        a.y = b.y;
        b.x = ax;
        b.y = ay;
        if (score() + 0.01 < before) improved = true;
        else {
          b.x = a.x;
          b.y = a.y;
          a.x = ax;
          a.y = ay;
        }
      }
    if (!improved) break;
  }
  work.after = score();
  return { ...layout, work };
}
