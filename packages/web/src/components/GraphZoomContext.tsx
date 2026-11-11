import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { gql, useQuery } from '@apollo/client';
import {
  fitLabel,
  fitLines,
  graphFrame,
  INITIAL_ZOOM_STATE,
  minZoomScale,
  nextZoomState,
  plural,
  Rect,
  ZoomGraph,
  zoomContextOf,
  ZoomLevel,
  zoomLayout,
  zoomLevelOf,
  ZOOMED_OUT,
} from '../lib/graphZoomContext';

/**
 * Zoom-out levels for the graph view (#277): the graph's own labelled frame,
 * the other graphs beside it, and the projects they belong to. Drawn in world
 * coordinates inside the graph's SVG, so it pans and zooms with the items; the
 * zoom handler sets this group's transform together with the items' group.
 * Labels are counter-scaled to a fixed on-screen size.
 */
export interface GraphZoomContextProps {
  graphs: readonly ZoomGraph[];
  currentGraphId: string | null;
  camera: { x: number; y: number; scale: number };
  readPositions: () => readonly { x?: number; y?: number }[];
  itemSize: (item: any) => { width: number; height: number };
  overview: boolean;
  onOpen: (graphId: string) => void;
  onLevel: (level: ZoomLevel, minScale: number) => void;
}

const NAME_PX = 15;
/** Item counts for the graphs around this one. The stored `nodeCount` is not
 * kept current by every backend, so ask for the live count; a backend without
 * aggregates (the browser-local workspace) answers `nodeCount` live instead. */
export const ZOOM_GRAPH_COUNTS = gql`
  query ZoomGraphCounts($ids: [ID!]) {
    graphs(where: { id_IN: $ids }) {
      id
      nodeCount
      workItemsAggregate { count }
    }
  }
`;
const SUB_PX = 12;

function useViewport(ref: React.RefObject<SVGGElement>) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const svg = ref.current?.ownerSVGElement;
    if (!svg) return;
    const read = () => {
      const r = svg.getBoundingClientRect();
      setSize(prev => (prev.w === r.width && prev.h === r.height ? prev : { w: r.width, h: r.height }));
    };
    read();
    const observer = new ResizeObserver(read);
    observer.observe(svg);
    return () => observer.disconnect();
  }, [ref]);
  return size;
}

const sameRect = (a: Rect | null, b: Rect | null) =>
  a === b ||
  (!!a && !!b && Math.abs(a.x - b.x) < 1 && Math.abs(a.y - b.y) < 1 && Math.abs(a.w - b.w) < 1 && Math.abs(a.h - b.h) < 1);

function Label({ x, y, k, name, detail, anchor = 'start', maxPx, backing = false }: {
  x: number; y: number; k: number; name: string; detail: string; anchor?: 'start' | 'middle'; maxPx: number; backing?: boolean;
}) {
  const nameLines = fitLines(name, maxPx, NAME_PX);
  const shownDetail = fitLabel(detail, maxPx, SUB_PX);
  if (!nameLines.length) return null;
  // A backing keeps the label legible where it sits over items.
  const widthPx = Math.max(...nameLines.map(line => line.length * NAME_PX * 0.6), shownDetail.length * SUB_PX * 0.6) + 16;
  const heightPx = nameLines.length * (NAME_PX + 3) + (shownDetail ? SUB_PX + 6 : 0) + 12;
  return (
    <>
    {backing && (
      <rect className="zoom-label-backing" x={x - 8 / k} y={y - (NAME_PX + 4) / k} width={widthPx / k} height={heightPx / k} rx={8 / k} ry={8 / k} />
    )}
    <text className="zoom-label" x={x} y={y} textAnchor={anchor} style={{ fontSize: NAME_PX / k }}>
      {nameLines.map((line, index) => (
        <tspan key={index} className="zoom-label-name" x={x} dy={index ? (NAME_PX + 3) / k : 0}>{line}</tspan>
      ))}
      {shownDetail && (
        <tspan className="zoom-label-detail" x={x} dy={(SUB_PX + 6) / k} style={{ fontSize: SUB_PX / k }}>
          {shownDetail}
        </tspan>
      )}
    </text>
    </>
  );
}

function Tile({ id, openId = id, rect, k, name, detail, viewportShort, interactive, labelled, onOpen, kind, labelAbove = false, holdsGraphs = true }: {
  id: string; openId?: string; rect: Rect; labelAbove?: boolean; holdsGraphs?: boolean; k: number; name: string; detail: string; viewportShort: number;
  interactive: boolean; labelled: boolean; onOpen: (id: string) => void; kind: 'graph' | 'project';
}) {
  const ref = useRef<SVGGElement>(null);
  const openRef = useRef(onOpen);
  openRef.current = onOpen;
  const sizeRef = useRef(0);
  sizeRef.current = Math.max(rect.w, rect.h) * k;
  useEffect(() => {
    const el = ref.current;
    if (!el || !interactive || kind !== 'graph') return;
    // Zooming in over a tile that already fills much of the screen opens it:
    // the person is diving into that graph. (d3's zoom stops wheel events at
    // the SVG, so this listens on the tile itself.)
    let opened = false; // one gesture opens the graph once
    const wheel = (event: WheelEvent) => {
      if (opened || event.deltaY >= 0 || sizeRef.current < 0.42 * viewportShort) return;
      opened = true;
      openRef.current(openId);
    };
    el.addEventListener('wheel', wheel, { passive: true });
    return () => el.removeEventListener('wheel', wheel);
  }, [openId, interactive, kind, viewportShort]);
  const radius = 14 / k;
  // A top-level graph with no graphs inside is shown beside the projects but is
  // still a graph, so it is announced as one.
  const noun = kind === 'project' && !holdsGraphs ? 'graph' : kind;
  const label = `${name} ${noun}, ${detail}`;
  return (
    <g
      ref={ref}
      className={`zoom-tile zoom-tile-${kind}`}
      data-zoom-tile={kind === 'graph' ? id : undefined}
      data-zoom-project={kind === 'project' ? id : undefined}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={interactive ? label : undefined}
      onClick={interactive ? () => onOpen(openId) : undefined}
      onKeyDown={interactive ? event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpen(openId);
        }
      } : undefined}
    >
      <rect className="zoom-tile-bg" x={rect.x} y={rect.y} width={rect.w} height={rect.h} rx={radius} ry={radius} vectorEffect="non-scaling-stroke" />
      {labelled && (
        <Label
          x={labelAbove ? rect.x : rect.x + 14 / k}
          y={labelAbove ? rect.y - (SUB_PX + 14) / k : rect.y + (14 + NAME_PX) / k}
          k={k}
          name={name}
          detail={detail}
          maxPx={labelAbove ? Math.max(rect.w * k, 180) : rect.w * k - 28}
        />
      )}
    </g>
  );
}

export function GraphZoomContext({ graphs, currentGraphId, camera, readPositions, itemSize, overview, onOpen, onLevel }: GraphZoomContextProps) {
  const ref = useRef<SVGGElement>(null);
  const viewport = useViewport(ref);
  const k = camera.scale || 1;

  // Item positions move while the layout settles; re-read them a few times a
  // second instead of on every simulation tick.
  const [frame, setFrame] = useState<Rect | null>(null);
  const readFrame = useRef(() => {});
  readFrame.current = () => {
    const items = readPositions();
    const next = graphFrame(items, index => itemSize(items[index]));
    setFrame(prev => (sameRect(prev, next) ? prev : next));
  };
  // Every level above 0 needs the camera below ZOOMED_OUT, so at normal zoom
  // the frame is read once per graph and not kept up to date (a 2000-item graph
  // re-measures every card to frame it).
  const zoomedOut = k < ZOOMED_OUT;
  useEffect(() => {
    readFrame.current();
    if (!zoomedOut) return undefined;
    const timer = window.setInterval(() => readFrame.current(), 400);
    return () => window.clearInterval(timer);
  }, [currentGraphId, zoomedOut]);
  // A zoom gesture or animation fires many camera changes a second; framing a
  // large graph measures every card, so do it at most every 150 ms (and once
  // more when the gesture stops).
  const frameTimer = useRef<number | null>(null);
  useEffect(() => {
    if (!zoomedOut || frameTimer.current !== null) return;
    frameTimer.current = window.setTimeout(() => {
      frameTimer.current = null;
      readFrame.current();
    }, 150);
  }, [k, zoomedOut]);
  useEffect(() => () => { if (frameTimer.current !== null) window.clearTimeout(frameTimer.current); }, []);

  useLayoutEffect(() => {
    ref.current?.setAttribute('transform', `translate(${camera.x},${camera.y}) scale(${k})`);
  }, [camera.x, camera.y, k]);

  const [countsWanted, setCountsWanted] = useState(false);
  const ids = useMemo(() => graphs.map(graph => graph.id), [graphs]);
  const { data: countData } = useQuery<{ graphs: { id: string; nodeCount?: number | null; workItemsAggregate?: { count: number } | null }[] }>(
    ZOOM_GRAPH_COUNTS,
    { variables: { ids }, skip: !countsWanted || !ids.length, fetchPolicy: 'cache-and-network' }
  );
  const counted = useMemo(() => {
    if (!countData?.graphs) return graphs;
    const live = new Map(countData.graphs.map(g => [g.id, g.workItemsAggregate?.count ?? g.nodeCount ?? undefined]));
    return graphs.map(graph => (live.get(graph.id) === undefined ? graph : { ...graph, nodeCount: live.get(graph.id) }));
  }, [graphs, countData]);
  const context = useMemo(() => (currentGraphId ? zoomContextOf(counted, currentGraphId) : null), [counted, currentGraphId]);
  const portrait = viewport.h > viewport.w * 1.2;
  const layout = useMemo(() => (context && frame ? zoomLayout(context, frame, portrait) : null), [context, frame, portrait]);

  const state = useRef(INITIAL_ZOOM_STATE);
  const stateGraph = useRef(currentGraphId);
  if (stateGraph.current !== currentGraphId) {
    stateGraph.current = currentGraphId;
    state.current = INITIAL_ZOOM_STATE;
  }
  if (layout && viewport.w > 0) {
    state.current = nextZoomState(state.current, {
      scale: k,
      viewport,
      frame: layout.frame,
      overview,
      hasSiblings: layout.siblings.length > 0,
      cluster: layout.cluster,
    });
  }
  const level: ZoomLevel = layout ? zoomLevelOf(state.current, overview) : 0;
  const minScale = layout && viewport.w > 0 ? minZoomScale(layout.span, viewport) : 0.1;

  const onLevelRef = useRef(onLevel);
  onLevelRef.current = onLevel;
  useEffect(() => { onLevelRef.current(level, minScale); }, [level, minScale]);
  useEffect(() => { if (level >= 2) setCountsWanted(true); }, [level]);

  const short = Math.max(1, Math.min(viewport.w, viewport.h));
  const content = (() => {
    if (!layout || !context || level === 0) return null;
    const { frame: f } = layout;
    const radius = 18 / k;
    const items = plural(readPositions().length, 'item');
    return (
      <>
        {level === 3 && layout.projects.map(({ project, rect }) => (
          <g key={`p-${project.graph.id}`}>
            {!project.current && project.children.slice(0, 9).map((child, index, shown) => {
              const cols = Math.ceil(Math.sqrt(shown.length));
              const rows = Math.ceil(shown.length / cols);
              const pad = rect.w * 0.08;
              const top = rect.h * 0.3;
              const cw = (rect.w - pad * 2) / cols;
              const ch = (rect.h - top - pad) / rows;
              return (
                <rect key={child.id} className="zoom-child" x={rect.x + pad + (index % cols) * cw + cw * 0.08} y={rect.y + top + Math.floor(index / cols) * ch + ch * 0.08}
                  width={cw * 0.84} height={ch * 0.84} rx={8 / k} ry={8 / k} vectorEffect="non-scaling-stroke" />
              );
            })}
            <Tile
              id={project.graph.id}
              openId={project.children[0]?.id ?? project.graph.id}
              rect={rect}
              k={k}
              kind="project"
              holdsGraphs={project.children.length > 0}
              name={project.graph.name}
              detail={project.children.length ? `${plural(project.children.length, 'graph')} · ${plural(project.items, 'item')}` : plural(project.items, 'item')}
              viewportShort={short}
              interactive={!project.current}
              labelled
              labelAbove
              onOpen={onOpen}
            />
          </g>
        ))}
        {level >= 2 && layout.siblings.map(({ graph, rect }) => {
          const children = context.childCount.get(graph.id) ?? 0;
          return (
            <Tile
              key={graph.id}
              id={graph.id}
              rect={rect}
              k={k}
              kind="graph"
              name={graph.name}
              detail={children ? `${plural(children, 'graph')}` : plural(graph.nodeCount ?? 0, 'item')}
              viewportShort={short}
              interactive={level === 2}
              labelled={level === 2}
              onOpen={onOpen}
            />
          );
        })}
        {level === 2 && layout.moreSiblings > 0 && (() => {
          const last = layout.siblings[layout.siblings.length - 1]?.rect;
          if (!last) return null;
          return (
            <text className="zoom-label zoom-more" x={last.x + last.w / 2} y={last.y + last.h + 28 / k} textAnchor="middle" style={{ fontSize: SUB_PX / k }}>
              {`+${layout.moreSiblings} more in the graph list`}
            </text>
          );
        })()}
        <rect className="zoom-frame" x={f.x} y={f.y} width={f.w} height={f.h} rx={radius} ry={radius} vectorEffect="non-scaling-stroke" />
        {level <= 2 && (
          <g className="zoom-frame-label" data-zoom-frame={context.current.id}>
            {/* Alone, the label sits above the frame; with neighbours around it
                (one may be directly above), it moves inside like theirs. */}
            <Label
              x={level === 2 ? f.x + 14 / k : f.x}
              y={level === 2 ? f.y + (14 + NAME_PX) / k : f.y - (SUB_PX + 14) / k}
              k={k}
              name={context.current.name}
              detail={items}
              maxPx={level === 2 ? Math.max(f.w * k - 28, 120) : Math.max(f.w * k, 180)}
              backing={level === 2}
            />
          </g>
        )}
      </>
    );
  })();

  return (
    <g ref={ref} className="graph-zoom-context" data-level={level}>
      {content}
    </g>
  );
}
