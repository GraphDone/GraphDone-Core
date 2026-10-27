import { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  overviewAtScale,
  placeOverviewLabels,
  projectSemanticGraph,
  type SemanticEdge,
  type SemanticItem,
} from '../lib/semanticLOD';

interface Props {
  items: readonly SemanticItem[];
  edges: readonly SemanticEdge[];
  camera: { x: number; y: number; scale: number };
  readPositions: () => readonly { id: string; x: number; y: number }[];
  onActiveChange: (active: boolean) => void;
  onInspect: (id: string, beginSession: boolean) => void;
  selectedId?: string;
  onBrowse: () => void;
  onBack: () => void;
}

/** A display-only companion to the existing D3 camera. Summary labels are placed
 * in screen space and linked to source centroids. No projected object is editable
 * or persisted. The complete group/member list is the fallback when the screen
 * cannot fit every label (especially on phones). */
export function SemanticGraphOverview({
  items,
  edges,
  camera,
  readPositions,
  onActiveChange,
  onInspect,
  onBack,
  selectedId,
  onBrowse,
}: Props) {
  const projection = useMemo(
    () => projectSemanticGraph(items, edges),
    [items, edges]
  );
  const host = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [mode, setMode] = useState<'auto' | 'overview' | 'items'>('auto');
  const [automatic, setAutomatic] = useState(() =>
    overviewAtScale(false, camera.scale)
  );
  const [groupId, setGroupId] = useState<string | null>(null);
  const [browse, setBrowse] = useState(false);
  const [search, setSearch] = useState('');
  const [canReturn, setCanReturn] = useState(false);
  const returnMode = useRef<typeof mode>('auto');
  const closeButton = useRef<HTMLButtonElement>(null);
  const backButton = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const groupListButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (browse) {
      onBrowse();
      closeButton.current?.focus();
    }
  }, [browse, onBrowse]);
  const active = mode === 'overview' || (mode === 'auto' && automatic);
  const markerId = `lod-arrow-${useId().replace(/:/g, '')}`;
  const group = projection.groups.find(candidate => candidate.id === groupId);
  useEffect(() => {
    setAutomatic(previous => overviewAtScale(previous, camera.scale));
  }, [camera.scale]);
  useEffect(() => {
    onActiveChange(active);
    return () => onActiveChange(false);
  }, [active, onActiveChange]);
  useEffect(() => {
    if (!host.current) return;
    const observer = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      setSize({ width, height });
    });
    observer.observe(host.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (groupId && !group) {
      setGroupId(null);
      setSearch('');
    }
  }, [groupId, group]);
  const positions = new Map(
    readPositions().map(position => [position.id, position])
  );
  const anchors = projection.groups.map(entry => {
    const points = entry.members
      .map(item => positions.get(item.id))
      .filter(
        point => point && Number.isFinite(point.x) && Number.isFinite(point.y)
      );
    const x =
      points.reduce((sum, point) => sum + point!.x, 0) / (points.length || 1);
    const y =
      points.reduce((sum, point) => sum + point!.y, 0) / (points.length || 1);
    return {
      id: entry.id,
      x: x * camera.scale + camera.x,
      y: y * camera.scale + camera.y,
    };
  });
  const bounds = host.current?.getBoundingClientRect();
  const obstacles = bounds
    ? Array.from(
        document.querySelectorAll<HTMLElement>(
          '[data-graph-fit-obstacle="true"]'
        )
      )
        .filter(element => element.getAttribute('role') !== 'region')
        .map(element => element.getBoundingClientRect())
        .filter(rect => rect.width > 0 && rect.height > 0)
        .map(rect => ({
          left: rect.left - bounds.left,
          right: rect.right - bounds.left,
          top: rect.top - bounds.top,
          bottom: rect.bottom - bounds.top,
        }))
    : [];
  const obstacleKey = JSON.stringify(obstacles);
  // Keep slots fixed through camera gestures. Leaders still follow live source
  // anchors; only changed membership/viewport/controls triggers label placement.
  const layout = useMemo(
    () => placeOverviewLabels(anchors, size.width, size.height, obstacles),
    [projection, size.width, size.height, obstacleKey, active]
  );
  const anchorById = new Map(anchors.map(anchor => [anchor.id, anchor]));
  const placed = layout.placed.map(entry => ({
    ...entry,
    anchorX: anchorById.get(entry.id)!.x,
    anchorY: anchorById.get(entry.id)!.y,
  }));
  const hidden = layout.hidden;
  const placedById = new Map(placed.map(entry => [entry.id, entry]));
  const groupsById = new Map(projection.groups.map(entry => [entry.id, entry]));
  const openGroup = (id: string) => {
    if (!browse) returnFocus.current = document.activeElement as HTMLElement;
    setGroupId(id);
    setBrowse(true);
    setSearch('');
  };
  const closeBrowser = () => {
    setBrowse(false);
    setGroupId(null);
    setSearch('');
    (returnFocus.current?.isConnected
      ? returnFocus.current
      : groupListButton.current
    )?.focus();
  };
  const back = () => {
    closeBrowser();
    setMode(returnMode.current);
    setCanReturn(false);
    onBack();
  };
  return (
    <div
      ref={host}
      className="semantic-overview absolute inset-0 pointer-events-none"
      data-active={active}
      onClick={event => event.stopPropagation()}
    >
      <div
        data-lod-controls="true"
        data-graph-fit-obstacle="true"
        className="absolute left-3 top-3 right-36 md:left-16 md:right-40 flex flex-wrap items-center gap-2 pointer-events-auto text-xs"
      >
        <label className="flex items-center gap-2 rounded bg-gray-950/95 px-2 py-1.5 text-gray-200 border border-gray-600">
          Detail
          <select
            aria-label="Graph detail"
            value={mode}
            onChange={event => {
              setMode(event.target.value as typeof mode);
              closeBrowser();
            }}
            className="bg-gray-900 text-white"
          >
            <option value="auto">Auto</option>
            <option value="overview">Overview</option>
            <option value="items">Items</option>
          </select>
        </label>
        <button
          ref={groupListButton}
          className="rounded bg-gray-950/95 border border-gray-600 px-3 py-2 text-gray-100"
          onClick={() => {
            returnFocus.current = document.activeElement as HTMLElement;
            setBrowse(true);
            setGroupId(null);
          }}
        >
          {projection.groups.length} groups · {items.length} items
        </button>
        {canReturn && (
          <button
            ref={backButton}
            className="rounded bg-gray-950/95 border border-emerald-600 px-3 py-2 text-emerald-200"
            onClick={back}
          >
            Back to overview
          </button>
        )}
        {active && hidden.length > 0 && (
          <span className="rounded bg-gray-950/95 p-2 text-gray-200">
            {hidden.length} more in group list
          </span>
        )}
      </div>
      {active && (
        <>
          <svg className="absolute inset-0 h-full w-full" aria-hidden="true">
            <defs>
              <marker
                id={markerId}
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="7"
                markerHeight="7"
                markerUnits="userSpaceOnUse"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#94a3b8" />
              </marker>
            </defs>
            {projection.bundles.map(bundle => {
              const source = placedById.get(bundle.source),
                target = placedById.get(bundle.target);
              if (!source || !target) return null;
              // Curve from the right side of the source to the left of the target.
              // Opposing directions use opposite sides; typed counts live in the list.
              const x1 = source.x + source.width,
                y1 = source.y + source.height / 2;
              const x2 = target.x,
                y2 = target.y + target.height / 2;
              return (
                <path
                  key={bundle.id}
                  data-lod-bundle={bundle.type}
                  data-count={bundle.edges.length}
                  d={`M${x1},${y1} C${x1 + 36},${y1} ${x2 - 36},${y2} ${x2},${y2}`}
                  fill="none"
                  stroke={bundle.type === 'BLOCKS' ? '#fb7185' : '#64748b'}
                  strokeWidth={Math.min(
                    4,
                    1 + Math.log2(bundle.edges.length + 1)
                  )}
                  markerEnd={`url(#${markerId})`}
                  opacity="0.7"
                >
                  <title>{`${groupsById.get(bundle.source)!.label} → ${groupsById.get(bundle.target)!.label}: ${bundle.edges.length} ${bundle.type}`}</title>
                </path>
              );
            })}
            {placed.map(entry => (
              <g key={entry.id}>
                <line
                  x1={entry.x + entry.width / 2}
                  y1={entry.y + entry.height / 2}
                  x2={entry.anchorX}
                  y2={entry.anchorY}
                  stroke="#64748b"
                  strokeDasharray="3 5"
                  opacity="0.5"
                />
                <circle
                  cx={entry.anchorX}
                  cy={entry.anchorY}
                  r="3"
                  fill="#6ee7b7"
                />
              </g>
            ))}
          </svg>
          {placed.map(entry => {
            const summary = groupsById.get(entry.id)!;
            return (
              <button
                key={entry.id}
                data-lod-group={summary.id}
                className="absolute pointer-events-auto rounded-lg border border-emerald-700 bg-gray-950 text-left px-3 py-2 shadow-lg hover:border-emerald-300 focus:outline focus:outline-2 focus:outline-emerald-300"
                style={{
                  left: entry.x,
                  top: entry.y,
                  width: entry.width,
                  height: entry.height,
                }}
                aria-label={`${summary.label}, ${summary.members.length} items, ${summary.blocked} blocked`}
                onClick={() => openGroup(summary.id)}
              >
                <span className="block truncate text-sm font-semibold text-emerald-100">
                  {summary.members.some(item => item.id === selectedId)
                    ? '● '
                    : ''}
                  {summary.label}
                </span>
                <span className="block text-xs text-gray-200">
                  {summary.members.length} items ·{' '}
                  {summary.internalEdges.length} internal links
                </span>
                <span className="block text-xs text-gray-300">
                  {summary.blocked} blocked · {summary.completed} completed
                </span>
              </button>
            );
          })}
        </>
      )}
      {browse && (
        <section
          data-lod-controls="true"
          role="region"
          aria-label={group ? `${group.label} members` : 'Graph groups'}
          onKeyDown={event => {
            if (event.key === 'Escape') {
              event.stopPropagation();
              closeBrowser();
            }
          }}
          className="absolute inset-x-3 top-28 bottom-3 sm:top-16 sm:inset-x-auto sm:left-16 sm:w-96 pointer-events-auto overflow-auto rounded-xl border border-gray-600 bg-gray-950 p-4 text-gray-100 shadow-xl"
          data-graph-fit-obstacle="true"
        >
          <div className="flex gap-2 items-start justify-between mb-3">
            <h2 className="text-base font-semibold break-words">
              {group?.label ?? 'Graph groups'}
            </h2>
            <button
              ref={closeButton}
              aria-label="Close group browser"
              onClick={closeBrowser}
              className="shrink-0 rounded border border-gray-600 px-3 py-2"
            >
              Close
            </button>
          </div>
          {group ? (
            <>
              <button
                onClick={() => {
                  setGroupId(null);
                  setSearch('');
                }}
                className="text-sm text-emerald-300 mb-3"
              >
                All groups
              </button>
              <p className="text-xs text-gray-300 mb-3">
                {group.members.length} items · {group.internalEdges.length}{' '}
                internal relationships · grouped by {group.basis}
              </p>
              <label className="block text-sm">
                Find an item
                <input
                  value={search}
                  onChange={event => setSearch(event.target.value)}
                  className="mt-1 mb-3 w-full rounded border border-gray-600 bg-gray-900 p-2"
                />
              </label>
              <ul className="space-y-1">
                {group.members
                  .filter(item =>
                    `${item.title} ${item.id}`
                      .toLocaleLowerCase()
                      .includes(search.toLocaleLowerCase())
                  )
                  .map(item => (
                    <li key={item.id}>
                      <button
                        className="w-full rounded bg-gray-900 p-3 text-left hover:bg-gray-800"
                        onClick={() => {
                          if (!canReturn) returnMode.current = mode;
                          setCanReturn(true);
                          closeBrowser();
                          setMode('auto');
                          onInspect(item.id, !canReturn);
                          requestAnimationFrame(() =>
                            backButton.current?.focus()
                          );
                        }}
                      >
                        <span className="block text-sm break-words">
                          {item.title}
                        </span>
                        <span className="text-xs text-gray-400">
                          {item.type} · {item.status}
                        </span>
                      </button>
                    </li>
                  ))}
              </ul>
              <h3 className="mt-4 mb-2 text-sm font-semibold">
                Relationships between groups
              </h3>
              <ul className="space-y-2 text-xs">
                {projection.bundles
                  .filter(
                    bundle =>
                      bundle.source === group.id || bundle.target === group.id
                  )
                  .map(bundle => (
                    <li key={bundle.id}>
                      <button
                        className="text-left text-emerald-200"
                        onClick={() =>
                          openGroup(
                            bundle.source === group.id
                              ? bundle.target
                              : bundle.source
                          )
                        }
                      >
                        {groupsById.get(bundle.source)!.label} →{' '}
                        {groupsById.get(bundle.target)!.label}:{' '}
                        {bundle.edges.length} {bundle.type}
                      </button>
                    </li>
                  ))}
              </ul>
            </>
          ) : (
            <>
              <p className="text-xs text-gray-300 mb-3">
                {items.length} loaded items · {edges.length} loaded
                relationships
                {projection.pendingEdges.length > 0
                  ? ` · ${projection.pendingEdges.length} awaiting endpoints`
                  : ''}
              </p>
              <ul className="space-y-2">
                {projection.groups.map(entry => (
                  <li key={entry.id}>
                    <button
                      onClick={() => openGroup(entry.id)}
                      className="w-full rounded bg-gray-900 p-3 text-left text-sm"
                    >
                      <span className="block break-words">{entry.label}</span>
                      <span className="text-xs text-gray-300">
                        {entry.members.length} items · {entry.blocked} blocked ·{' '}
                        {entry.basis}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              {projection.diagnostics.map(message => (
                <p key={message} className="mt-3 text-xs text-amber-200">
                  {message}
                </p>
              ))}
            </>
          )}
        </section>
      )}
    </div>
  );
}
