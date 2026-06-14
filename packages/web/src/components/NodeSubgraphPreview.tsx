import { useQuery } from '@apollo/client';
import { Maximize2 } from 'lucide-react';
import { GET_WORK_ITEMS, GET_EDGES } from '../lib/queries';
import { getTypeConfig } from '../constants/workItemConstants';
import type { WorkItemType } from '../constants/workItemConstants';

/**
 * A STATIC, legible render of a node's sub-graph (its "diagram"), drawn from the
 * sub-graph's persisted node positions — no force simulation. Lets you READ a
 * diagram at a useful scale without navigating away; "Open" descends into it.
 */
interface NodeSubgraphPreviewProps {
  subgraphId: string;
  subgraphName?: string;
  onOpen: () => void;
}

export function NodeSubgraphPreview({ subgraphId, subgraphName, onOpen }: NodeSubgraphPreviewProps) {
  // A preview is a thumbnail — cap the payload so even a 1000-node sub-graph
  // loads fast and stays legible. "Open" shows the full thing.
  const PREVIEW_LIMIT = 300;
  const { data: wiData, loading } = useQuery(GET_WORK_ITEMS, {
    variables: { where: { graph: { id: subgraphId } }, options: { limit: PREVIEW_LIMIT } },
    fetchPolicy: 'cache-and-network',
  });
  const { data: edgeData } = useQuery(GET_EDGES, {
    variables: { where: { source: { graph: { id: subgraphId } } }, options: { limit: 600 } },
    fetchPolicy: 'cache-and-network',
  });

  const nodes: any[] = wiData?.workItems ?? [];
  const edges: any[] = edgeData?.edges ?? [];

  if (loading && nodes.length === 0) {
    return <div className="text-sm text-gray-500 p-4">Loading diagram…</div>;
  }
  if (nodes.length === 0) {
    return (
      <div className="p-4 space-y-3">
        <div className="text-sm text-gray-500">This sub-graph is empty.</div>
        <OpenButton onOpen={onOpen} name={subgraphName} />
      </div>
    );
  }

  // Bounds from persisted positions, scaled to fit the preview viewBox.
  const W = 320;
  const H = 240;
  const pad = 30;
  const xs = nodes.map((n) => n.positionX ?? 0);
  const ys = nodes.map((n) => n.positionY ?? 0);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = Math.max(1, maxX - minX);
  const spanY = Math.max(1, maxY - minY);
  const scale = Math.min((W - pad * 2) / spanX, (H - pad * 2) / spanY);
  const ox = (W - spanX * scale) / 2;
  const oy = (H - spanY * scale) / 2;
  const toX = (x: number) => ox + (x - minX) * scale;
  const toY = (y: number) => oy + (y - minY) * scale;
  const byId: Record<string, any> = {};
  for (const n of nodes) byId[n.id] = n;

  // Cap labels so a dense sub-graph stays readable, not a wall of text.
  const showLabels = nodes.length <= 40;

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400">{nodes.length} nodes · {edges.length} edges</span>
        <OpenButton onOpen={onOpen} name={subgraphName} />
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-lg bg-gray-900/60 border border-gray-700/50" data-testid="subgraph-preview">
        {edges.map((e) => {
          const s = byId[typeof e.source === 'object' ? e.source?.id : e.source];
          const t = byId[typeof e.target === 'object' ? e.target?.id : e.target];
          if (!s || !t) return null;
          return (
            <line key={e.id} x1={toX(s.positionX ?? 0)} y1={toY(s.positionY ?? 0)} x2={toX(t.positionX ?? 0)} y2={toY(t.positionY ?? 0)} stroke="#4b5563" strokeWidth={0.75} strokeOpacity={0.6} />
          );
        })}
        {nodes.map((n) => {
          const color = getTypeConfig(n.type as WorkItemType).hexColor;
          const x = toX(n.positionX ?? 0);
          const y = toY(n.positionY ?? 0);
          return (
            <g key={n.id}>
              <circle cx={x} cy={y} r={3.5} fill={color} fillOpacity={0.9} />
              {showLabels && (
                <text x={x + 5} y={y + 3} fontSize={6} fill="#cbd5e1">
                  {String(n.title).slice(0, 18)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function OpenButton({ onOpen, name }: { onOpen: () => void; name?: string }) {
  return (
    <button
      onClick={onOpen}
      className="flex items-center gap-1.5 text-xs font-medium text-indigo-300 hover:text-white bg-indigo-500/20 hover:bg-indigo-500/40 border border-indigo-400/30 rounded-lg px-2.5 py-1 transition-colors"
      title={name ? `Open ${name}` : 'Open sub-graph'}
    >
      <Maximize2 className="h-3.5 w-3.5" />
      Open
    </button>
  );
}
