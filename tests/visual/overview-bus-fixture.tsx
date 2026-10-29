import { createRoot } from 'react-dom/client';
import { OverviewBusLayer } from '../../packages/web/src/components/OverviewBusLayer';
import type { SchematicRoute } from '../../packages/web/src/lib/schematicRouting';

const routes: SchematicRoute[] = ['A', 'B'].map((id, index) => ({
  id,
  bus: id,
  source: id,
  target: `${id} target`,
  edgeIds: [`edge-${id}`],
  connections: [
    {
      id,
      source: id,
      target: `${id} target`,
      type: 'BLOCKS',
      edgeIds: [`edge-${id}`],
    },
  ],
  points: [
    { x: 100, y: 100 + index * 6 },
    { x: 400, y: 100 + index * 6 },
  ],
}));
createRoot(document.getElementById('fixture')!).render(
  <OverviewBusLayer
    routes={routes}
    junctions={[]}
    obstacles={[]}
    width={800}
    height={600}
    color={() => '#5eead4'}
    label={id => id}
    onHighlight={id => {
      document.body.dataset.highlightedBus = id ?? '';
    }}
    onInspect={(route, trigger) => {
      document.body.dataset.inspectedBus = route.id;
      document.body.dataset.returnBus = trigger.dataset.lodBusHit;
    }}
    onFocusLost={() => {}}
  />
);
