import { useEffect, useRef, useState, useCallback } from 'react';
import { getTypeConfig } from '../constants/workItemConstants';
import type { WorkItemType } from '../constants/workItemConstants';

interface MiniMapNode {
  x: number;
  y: number;
  type?: string;
}

interface Viewport {
  x: number;
  y: number;
  k: number;
}

/**
 * The minimap, for real this time: the graph publishes node positions and the
 * viewport via window.updateMiniMapPositions / window.updateMiniMapViewport
 * (the contract the tick handler has always used), this renders dots colored
 * by type plus the viewport rectangle, and clicking navigates the main view
 * through window.miniMapNavigate(graphX, graphY).
 */
export function MiniMap({ width = 192, height = 128 }: { width?: number; height?: number }) {
  const [nodes, setNodes] = useState<Record<string, MiniMapNode>>({});
  const [viewport, setViewport] = useState<Viewport | null>(null);
  const nodeTypesRef = useRef<Record<string, string>>({});
  // Live minimap-px <-> graph-coord conversion params, updated each render so
  // the native (non-passive) wheel/touch listeners can map a gesture point to
  // a graph point and drive the main view's zoom.
  const geomRef = useRef({ minX: 0, minY: 0, offsetX: 0, offsetY: 0, scale: 1, k: 1 });
  const svgElRef = useRef<SVGSVGElement>(null);

  // Wheel + pinch on the minimap zoom the MAIN view (centered on the gesture
  // point). Attached natively with passive:false so we can preventDefault and
  // stop the page from scrolling while zooming the map.
  useEffect(() => {
    const el = svgElRef.current;
    if (!el) return undefined;
    const toGraph = (clientX: number, clientY: number) => {
      const r = el.getBoundingClientRect();
      const g = geomRef.current;
      return {
        x: g.minX + (clientX - r.left - g.offsetX) / g.scale,
        y: g.minY + (clientY - r.top - g.offsetY) / g.scale,
      };
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const p = toGraph(e.clientX, e.clientY);
      const factor = e.deltaY < 0 ? 1.18 : 1 / 1.18;
      (window as any).miniMapZoom?.(p.x, p.y, geomRef.current.k * factor);
    };
    let pinchDist0 = 0;
    let pinchK0 = 1;
    const dist = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const mid = (t: TouchList) => ({ x: (t[0].clientX + t[1].clientX) / 2, y: (t[0].clientY + t[1].clientY) / 2 });
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) { pinchDist0 = dist(e.touches); pinchK0 = geomRef.current.k; }
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && pinchDist0 > 0) {
        e.preventDefault();
        const m = mid(e.touches);
        const p = toGraph(m.x, m.y);
        (window as any).miniMapZoom?.(p.x, p.y, pinchK0 * (dist(e.touches) / pinchDist0));
      }
    };
    const onTouchEnd = () => { pinchDist0 = 0; };
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('touchstart', onTouchStart, { passive: false });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd);
    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
    };
    // Re-run when the svg appears: the minimap renders a "No nodes yet" div
    // first (svg ref null), then the <svg> once positions arrive — attach then.
  }, [Object.keys(nodes).length > 0]);

  useEffect(() => {
    (window as any).updateMiniMapPositions = (positions: Record<string, { x: number; y: number; type?: string }>) => {
      setNodes((prev) => {
        // Cheap change detection to avoid re-render storms from the tick loop
        const prevKeys = Object.keys(prev);
        const nextKeys = Object.keys(positions);
        if (prevKeys.length === nextKeys.length) {
          let changed = false;
          for (const k of nextKeys) {
            const a = prev[k];
            const b = positions[k];
            if (!a || Math.abs(a.x - b.x) > 1 || Math.abs(a.y - b.y) > 1) {
              changed = true;
              break;
            }
          }
          if (!changed) return prev;
        }
        return { ...positions };
      });
    };
    (window as any).updateMiniMapTypes = (types: Record<string, string>) => {
      nodeTypesRef.current = types;
    };
    (window as any).updateMiniMapViewport = (v: Viewport) => setViewport({ ...v });
    return () => {
      delete (window as any).updateMiniMapPositions;
      delete (window as any).updateMiniMapTypes;
      delete (window as any).updateMiniMapViewport;
    };
  }, []);

  const entries = Object.entries(nodes);

  // Graph-space bounding box of all nodes, padded
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [, n] of entries) {
    minX = Math.min(minX, n.x);
    maxX = Math.max(maxX, n.x);
    minY = Math.min(minY, n.y);
    maxY = Math.max(maxY, n.y);
  }
  const pad = 120;
  minX -= pad; maxX += pad; minY -= pad; maxY += pad;
  const spanX = Math.max(1, maxX - minX);
  const spanY = Math.max(1, maxY - minY);
  const scale = Math.min(width / spanX, height / spanY);
  const offsetX = (width - spanX * scale) / 2;
  const offsetY = (height - spanY * scale) / 2;
  geomRef.current = { minX, minY, offsetX, offsetY, scale, k: viewport?.k || 1 };

  const toMini = useCallback(
    (gx: number, gy: number) => ({
      x: offsetX + (gx - minX) * scale,
      y: offsetY + (gy - minY) * scale
    }),
    [offsetX, offsetY, minX, minY, scale]
  );

  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const graphX = minX + (mx - offsetX) / scale;
    const graphY = minY + (my - offsetY) / scale;
    (window as any).miniMapNavigate?.(graphX, graphY);
  };

  // Viewport rectangle in minimap coordinates: the main view shows graph
  // region [(0,0)..(W,H)] mapped by transform t → graph coords (px - t.x)/k
  let viewRect: { x: number; y: number; w: number; h: number } | null = null;
  if (viewport && entries.length > 0) {
    const container = document.querySelector('.graph-container');
    const vw = container?.clientWidth || window.innerWidth;
    const vh = container?.clientHeight || window.innerHeight;
    const g0 = { x: (0 - viewport.x) / viewport.k, y: (0 - viewport.y) / viewport.k };
    const g1 = { x: (vw - viewport.x) / viewport.k, y: (vh - viewport.y) / viewport.k };
    const p0 = toMini(g0.x, g0.y);
    const p1 = toMini(g1.x, g1.y);
    viewRect = { x: p0.x, y: p0.y, w: p1.x - p0.x, h: p1.y - p0.y };
  }

  if (entries.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center text-gray-500 text-xs">
        No nodes yet
      </div>
    );
  }

  return (
    <svg
      ref={svgElRef}
      width="100%"
      height="100%"
      viewBox={`0 0 ${width} ${height}`}
      onClick={handleClick}
      className="cursor-pointer"
      data-testid="mini-map"
    >
      {viewRect && (
        <rect
          x={viewRect.x}
          y={viewRect.y}
          width={Math.max(4, viewRect.w)}
          height={Math.max(4, viewRect.h)}
          fill="rgba(74, 222, 128, 0.08)"
          stroke="rgba(74, 222, 128, 0.7)"
          strokeWidth="1"
          rx="2"
        />
      )}
      {entries.map(([id, n]) => {
        const p = toMini(n.x, n.y);
        const type = nodeTypesRef.current[id];
        const color = type ? getTypeConfig(type as WorkItemType).hexColor : '#9ca3af';
        return <circle key={id} cx={p.x} cy={p.y} r={2.5} fill={color} fillOpacity={0.9} />;
      })}
    </svg>
  );
}
