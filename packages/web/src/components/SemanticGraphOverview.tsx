import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  prioritySemanticBundles,
  projectRelationshipPriority,
  relationshipPriorityTier,
  type RelationshipPriorityLevel,
} from '../lib/relationshipPriority';
import {
  getRelationshipConfig,
  type RelationshipType,
} from '../constants/workItemConstants';
import { GraphStatusDock } from './GraphStatusDock';
import {
  overviewAtScale,
  placeOverviewLabels,
  buildSemanticHierarchy,
  projectSemanticHierarchy,
  semanticDepthAtScale,
  automaticSemanticExpansion,
  overviewLabelCapacity,
  type SemanticEdge,
  type SemanticItem,
} from '../lib/semanticLOD';
import {
  indexSemanticRelationships,
  type RelationshipScope,
} from '../lib/semanticRelationships';
import { SemanticRelationshipBrowser } from './SemanticRelationshipBrowser';
import { routeSchematicConnections } from '../lib/schematicRouting';
import {
  projectSemanticTrace,
  type SemanticTraceSelection,
} from '../lib/semanticTrace';
import { SemanticTraceControls } from './SemanticTraceControls';

interface Props {
  items: readonly SemanticItem[];
  edges: readonly SemanticEdge[];
  camera: { x: number; y: number; scale: number };
  readPositions: () => readonly { id: string; x: number; y: number }[];
  onActiveChange: (active: boolean) => void;
  onInspect: (id: string, beginSession: boolean) => void;
  selectedId?: string;
  onBrowse: () => void;
  layoutStatus?: ReactNode;
  onBack: () => void;
  relationshipPriority?: {
    level: RelationshipPriorityLevel;
    representedIds: ReadonlySet<string>;
  };
  relationshipControl?: ReactNode;
}

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
  layoutStatus,
  relationshipPriority,
  relationshipControl,
}: Props) {
  const hierarchy = useMemo(
    () => buildSemanticHierarchy(items, edges),
    [items, edges]
  );
  const relationshipIndex = useMemo(
    () => indexSemanticRelationships(items, edges, hierarchy),
    [items, edges, hierarchy]
  );
  const [relationshipScope, setRelationshipScope] =
    useState<RelationshipScope | null>(null);
  const [relationshipFocus, setRelationshipFocus] = useState<string>();
  const [trace, setTrace] = useState<SemanticTraceSelection | null>(null);
  const relationshipGroup = useRef<string | null>(null);
  const relationshipTrigger = useRef<string | null>(null);
  const host = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [obstacles, setObstacles] = useState<
    Array<{ left: number; right: number; top: number; bottom: number }>
  >([]);
  useLayoutEffect(() => {
    const bounds = host.current?.getBoundingClientRect();
    const measured = bounds
      ? Array.from(
          document.querySelectorAll<HTMLElement>(
            '[data-graph-fit-obstacle="true"]'
          )
        )
          .filter(
            element =>
              element.getAttribute('role') !== 'region' ||
              element.hasAttribute('data-lod-trace')
          )
          .map(element => element.getBoundingClientRect())
          .filter(rect => rect.width > 0 && rect.height > 0)
          .map(rect => ({
            left: rect.left - bounds.left,
            right: rect.right - bounds.left,
            top: rect.top - bounds.top,
            bottom: rect.bottom - bounds.top,
          }))
      : [];
    setObstacles(previous =>
      JSON.stringify(previous) === JSON.stringify(measured)
        ? previous
        : measured
    );
  });
  const obstacleKey = JSON.stringify(obstacles);
  const [mode, setMode] = useState<'auto' | 'overview' | 'items'>('auto');
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(
    () => new Set()
  );
  const [automaticDepth, setAutomaticDepth] = useState(() =>
    semanticDepthAtScale(1, camera.scale)
  );
  const expansionKey = useMemo(
    () =>
      JSON.stringify(
        [
          ...(mode === 'auto'
            ? automaticSemanticExpansion(
                hierarchy,
                automaticDepth,
                overviewLabelCapacity(size.width, size.height, obstacles)
              )
            : expanded),
        ]
          .filter(id => hierarchy.groups.get(id)?.children.length)
          .sort()
      ),
    [
      hierarchy,
      mode,
      automaticDepth,
      expanded,
      size.width,
      size.height,
      obstacleKey,
    ]
  );
  const effectiveExpanded = useMemo(
    () => new Set<string>(JSON.parse(expansionKey)),
    [expansionKey]
  );
  const projection = useMemo(
    () => projectSemanticHierarchy(hierarchy, effectiveExpanded),
    [hierarchy, effectiveExpanded]
  );
  const representedBundles = useMemo(() => {
    if (!relationshipPriority) return projection.bundles;
    const representedIds = new Set(relationshipPriority.representedIds);
    if (trace) {
      const endpoint = trace.direction === 'incoming' ? 'target' : 'source';
      const related = projection.bundles
        .filter(bundle => bundle[endpoint] === trace.groupId)
        .flatMap(bundle => bundle.edges);
      const scoped = projectRelationshipPriority(
        items,
        related,
        relationshipPriority.level
      );
      for (const edge of scoped.represented) representedIds.add(edge.id);
    }
    return prioritySemanticBundles(projection.bundles, representedIds);
  }, [
    projection,
    relationshipPriority,
    items,
    trace?.groupId,
    trace?.direction,
  ]);
  const [automatic, setAutomatic] = useState(() =>
    overviewAtScale(false, camera.scale)
  );
  const [groupId, setGroupId] = useState<string | null>(null);
  const [browse, setBrowse] = useState(false);
  const [search, setSearch] = useState('');
  const [canReturn, setCanReturn] = useState(false);
  const returnMode = useRef<typeof mode>('auto');
  const returnAutomatic = useRef({ depth: automaticDepth, active: automatic });
  const focusedSummary = useRef<{
    element: HTMLButtonElement;
    memberIds: string[];
  } | null>(null);
  const returnExpanded = useRef<ReadonlySet<string>>(new Set());
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
  const traceProjection = useMemo(
    () =>
      trace
        ? projectSemanticTrace(
            projection.groups,
            projection.bundles,
            trace,
            overviewLabelCapacity(size.width, size.height, obstacles)
          )
        : null,
    [projection, trace, size.width, size.height, obstacleKey]
  );
  const traceBundleIds = useMemo(
    () =>
      traceProjection
        ? new Set(traceProjection.bundles.map(bundle => bundle.id))
        : null,
    [traceProjection]
  );
  useEffect(() => {
    setAutomatic(previous => overviewAtScale(previous, camera.scale));
    setAutomaticDepth(previous => semanticDepthAtScale(previous, camera.scale));
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
  const layout = useMemo(() => {
    if (!active) return { placed: [], hidden: [] };
    if (traceProjection) {
      return placeOverviewLabels(
        traceProjection.groups.map((entry, index) => ({
          id: entry.id,
          x: size.width * (index === 0 ? 0.25 : 0.75),
          y:
            index === 0
              ? size.height / 2
              : (size.height * index) / traceProjection.groups.length,
        })),
        size.width,
        size.height,
        obstacles
      );
    }
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
    return placeOverviewLabels(anchors, size.width, size.height, obstacles);
  }, [
    projection,
    traceProjection,
    size.width,
    size.height,
    obstacleKey,
    active,
    readPositions,
  ]);
  const placed = layout.placed;
  useLayoutEffect(() => {
    const focused = focusedSummary.current;
    if (!focused || focused.element.isConnected) return;
    focusedSummary.current = null;
    if (document.activeElement !== document.body) return;
    const member =
      selectedId &&
      focused.memberIds.includes(selectedId) &&
      projection.membership.has(selectedId)
        ? selectedId
        : focused.memberIds.find(id => projection.membership.has(id));
    const representative = member
      ? projection.membership.get(member)
      : undefined;
    const target = Array.from(
      host.current?.querySelectorAll<HTMLButtonElement>('[data-lod-group]') ??
        []
    ).find(element => element.dataset.lodGroup === representative);
    (target ?? groupListButton.current)?.focus();
  }, [projection, layout, active, selectedId]);
  const hidden = layout.hidden;
  const groupsById = new Map(projection.groups.map(entry => [entry.id, entry]));
  const wiring = useMemo(
    () =>
      active
        ? routeSchematicConnections(
            layout.placed,
            (traceBundleIds
              ? representedBundles.filter(bundle =>
                  traceBundleIds.has(bundle.id)
                )
              : representedBundles
            ).map(bundle => ({
              id: bundle.id,
              source: bundle.source,
              target: bundle.target,
              type: bundle.type,
              edgeIds: bundle.edges.map(edge => edge.id),
              priority: relationshipPriority
                ? relationshipPriorityTier(bundle.type)
                : undefined,
            })),
            size.width,
            size.height,
            obstacles.map((rect, index) => ({
              id: `control-${index}`,
              x: rect.left,
              y: rect.top,
              width: rect.right - rect.left,
              height: rect.bottom - rect.top,
            })),
            {
              sharedEndpoint:
                trace?.direction === 'incoming' ? 'target' : 'source',
            }
          )
        : null,
    [
      active,
      layout,
      projection,
      traceProjection,
      traceBundleIds,
      representedBundles,
      relationshipPriority,
      trace?.direction,
      size.width,
      size.height,
      obstacleKey,
    ]
  );
  const drawnConnections = (wiring?.routes ?? []).reduce(
    (count, bus) => count + bus.edgeIds.length,
    0
  );
  const collapsedConnections =
    representedBundles.reduce(
      (count, bundle) => count + bundle.edges.length,
      0
    ) - drawnConnections;
  const summarizedConnections =
    projection.bundles.reduce(
      (count, bundle) => count + bundle.edges.length,
      0
    ) -
    representedBundles.reduce(
      (count, bundle) => count + bundle.edges.length,
      0
    );
  const internalConnections = projection.groups.reduce(
    (count, group) => count + group.internalEdges.length,
    0
  );
  const pendingConnections = projection.pendingEdges.length;
  const notDrawnConnections =
    collapsedConnections +
    summarizedConnections +
    internalConnections +
    pendingConnections;
  const busTypes = new Map<string, string>();
  for (const route of wiring?.routes ?? []) {
    for (const connection of route.connections) {
      const current = busTypes.get(route.bus);
      if (
        !current ||
        relationshipPriorityTier(connection.type) <
          relationshipPriorityTier(current) ||
        (relationshipPriorityTier(connection.type) ===
          relationshipPriorityTier(current) &&
          connection.type < current)
      )
        busTypes.set(route.bus, connection.type);
    }
  }
  const busColors = [
    '#5eead4',
    '#a5b4fc',
    '#fbbf24',
    '#f9a8d4',
    '#7dd3fc',
    '#c4b5fd',
  ];
  const busColor = (id: string) =>
    relationshipPriority && busTypes.has(id)
      ? getRelationshipConfig(busTypes.get(id)! as RelationshipType).hexColor
      : busColors[
          Array.from(id).reduce(
            (hash, char) => (hash * 31 + char.charCodeAt(0)) >>> 0,
            0
          ) % busColors.length
        ];
  const openGroup = (id: string) => {
    if (!browse) returnFocus.current = document.activeElement as HTMLElement;
    setGroupId(id);
    setBrowse(true);
    setSearch('');
  };
  const closeBrowser = (clearRelationships = true) => {
    setBrowse(false);
    if (clearRelationships) setRelationshipScope(null);
    setGroupId(null);
    setSearch('');
    (returnFocus.current?.isConnected
      ? returnFocus.current
      : groupListButton.current
    )?.focus();
  };
  const back = () => {
    if (relationshipScope) {
      setGroupId(relationshipGroup.current);
      setBrowse(true);
    } else closeBrowser();
    setMode(returnMode.current);
    setExpanded(returnExpanded.current);
    setAutomaticDepth(returnAutomatic.current.depth);
    setAutomatic(returnAutomatic.current.active);
    setCanReturn(false);
    onBack();
  };
  const inspect = (id: string) => {
    if (!canReturn) {
      returnMode.current = mode;
      returnAutomatic.current = { depth: automaticDepth, active: automatic };
      returnExpanded.current = new Set(effectiveExpanded);
    }
    if (relationshipScope) {
      relationshipGroup.current = groupId;
      setRelationshipFocus(id);
    }
    setCanReturn(true);
    closeBrowser(false);
    setMode('auto');
    onInspect(id, !canReturn);
    requestAnimationFrame(() => backButton.current?.focus());
  };
  const openRelationships = (scope: RelationshipScope, trigger: string) => {
    relationshipTrigger.current = trigger;
    setRelationshipFocus(undefined);
    setRelationshipScope(scope);
  };
  useLayoutEffect(() => {
    if (!browse || relationshipScope || !relationshipTrigger.current) return;
    const trigger = Array.from(
      host.current?.querySelectorAll<HTMLButtonElement>(
        '[data-lod-relationships]'
      ) ?? []
    ).find(
      button => button.dataset.lodRelationships === relationshipTrigger.current
    );
    (trigger ?? closeButton.current)?.focus();
    relationshipTrigger.current = null;
  }, [browse, relationshipScope]);
  const groupLabel = (id: string) => {
    const entry = groupsById.get(id);
    return entry
      ? [
          ...entry.ancestors.map(
            ancestor => hierarchy.groups.get(ancestor)!.label
          ),
          entry.isDirect ? 'Direct items' : entry.label,
        ].join(' / ')
      : 'No visible summary';
  };
  return (
    <div
      ref={host}
      className="semantic-overview absolute inset-0 pointer-events-none"
      data-active={active}
      data-priority-summarized={summarizedConnections}
      data-geometry-deferred={collapsedConnections}
      data-internal-relationships={internalConnections}
      data-pending-relationships={pendingConnections}
      onClick={event => event.stopPropagation()}
    >
      <div
        data-lod-controls="true"
        data-graph-fit-obstacle="true"
        className="absolute left-3 top-3 right-36 md:left-16 md:right-40 flex flex-wrap items-center gap-2 md:gap-3 pointer-events-auto text-base"
      >
        <label className="flex min-h-11 items-center gap-3 rounded-xl bg-slate-900/95 px-3 py-2 text-slate-200 border border-slate-600 shadow-lg">
          Detail
          <select
            aria-label="Graph detail"
            value={mode}
            onChange={event => {
              const next = event.target.value as typeof mode;
              setTrace(null);
              if (next === 'overview') setExpanded(new Set());
              setMode(next);
              closeBrowser();
            }}
            className="rounded-lg bg-slate-800 px-2 py-1 text-base font-medium text-white"
          >
            <option value="auto">Auto</option>
            <option value="overview">Overview</option>
            <option value="items">Items</option>
          </select>
        </label>
        {relationshipControl}
        <button
          ref={groupListButton}
          aria-label={`${projection.groups.length} groups · ${items.length} items`}
          className="flex md:block items-center justify-center gap-2 rounded-xl bg-slate-900/95 border border-slate-600 px-3 py-1 min-h-11 md:w-32 md:h-14 max-w-full text-slate-100 shadow-lg"
          onClick={() => {
            returnFocus.current = document.activeElement as HTMLElement;
            setRelationshipScope(null);
            setBrowse(true);
            setGroupId(null);
          }}
        >
          <span className="md:block">{projection.groups.length} groups</span>
          <span className="md:hidden" aria-hidden="true">
            ·
          </span>
          <span className="md:block">{items.length} items</span>
        </button>
        {mode === 'overview' && effectiveExpanded.size > 0 && (
          <button
            className="rounded bg-gray-950/95 border border-gray-600 px-3 py-2 min-h-11 text-gray-100"
            onClick={() => {
              setExpanded(new Set());
              setTrace(null);
              setMode('overview');
              closeBrowser();
              groupListButton.current?.focus();
            }}
          >
            Top-level groups
          </button>
        )}
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
            {wiring?.routes.map(bus => (
              <path
                key={bus.id}
                data-lod-bundle={bus.connections
                  .map(connection => connection.type)
                  .join(' ')}
                data-lod-bus-source={bus.source}
                data-lod-bus-target={bus.target}
                data-lod-bus-id={bus.bus}
                data-count={bus.edgeIds.length}
                d={bus.points
                  .map(
                    (point, index) =>
                      `${index ? 'L' : 'M'}${point.x},${point.y}`
                  )
                  .join(' ')}
                fill="none"
                stroke={busColor(bus.bus)}
                strokeWidth="3.5"
                strokeLinejoin="round"
                strokeLinecap="round"
                markerEnd={`url(#${markerId})`}
              >
                <title>{`${groupsById.get(bus.source)!.label} → ${groupsById.get(bus.target)!.label}: ${bus.edgeIds.length} relationships · ${bus.connections.map(connection => `${connection.edgeIds.length} ${connection.type}`).join(', ')}`}</title>
              </path>
            ))}
            {wiring?.junctions.map(point => (
              <circle
                key={`${point.bus}:${point.x}:${point.y}`}
                cx={point.x}
                cy={point.y}
                r="3.5"
                fill={busColor(point.bus)}
              />
            ))}
          </svg>
          {placed.map(entry => {
            const summary = groupsById.get(entry.id)!;
            return (
              <button
                key={entry.id}
                data-lod-group={summary.id}
                onFocus={event => {
                  focusedSummary.current = {
                    element: event.currentTarget,
                    memberIds: summary.members.map(item => item.id),
                  };
                }}
                onBlur={event => {
                  if (focusedSummary.current?.element === event.currentTarget)
                    focusedSummary.current = null;
                }}
                aria-current={
                  summary.members.some(item => item.id === selectedId)
                    ? 'true'
                    : undefined
                }
                className="absolute pointer-events-auto overflow-hidden rounded-xl border border-slate-600 bg-gradient-to-br from-slate-800 to-slate-950 text-left px-4 py-3 shadow-lg shadow-black/30 hover:border-teal-300 focus:outline focus:outline-2 focus:outline-teal-300"
                style={{
                  left: entry.x,
                  top: entry.y,
                  width: entry.width,
                  height: entry.height,
                }}
                title={[
                  ...summary.ancestors.map(
                    id => hierarchy.groups.get(id)!.label
                  ),
                  summary.isDirect ? 'Direct items' : summary.label,
                ].join(' / ')}
                aria-label={`${[...summary.ancestors.map(id => hierarchy.groups.get(id)!.label), summary.isDirect ? 'Direct items' : summary.label].join(' / ')}, ${summary.members.length} items, ${summary.blocked} blocked`}
                onClick={() => openGroup(summary.id)}
              >
                <span className="block truncate border-l-2 border-teal-400 pl-2 text-lg leading-6 font-semibold tracking-tight text-slate-50">
                  {summary.members.some(item => item.id === selectedId)
                    ? '● '
                    : ''}
                  {summary.label}
                </span>
                <span className="mt-1 block text-sm leading-5 text-slate-200">
                  {summary.members.length} items ·{' '}
                  {summary.internalEdges.length} internal links
                </span>
                <span className="block truncate text-sm leading-5 text-slate-400">
                  {summary.ancestors.length > 0
                    ? summary.ancestors
                        .map(id => hierarchy.groups.get(id)!.label)
                        .join(' / ')
                    : `${summary.blocked} blocked · ${summary.completed} completed`}
                </span>
              </button>
            );
          })}
        </>
      )}
      {active && (
        <GraphStatusDock>
          {layoutStatus}
          {trace && traceProjection && (
            <SemanticTraceControls
              selection={trace}
              label={
                traceProjection.focus
                  ? groupLabel(traceProjection.focus.id)
                  : undefined
              }
              page={traceProjection.page}
              pages={traceProjection.pages}
              shownNeighbors={traceProjection.shownNeighbors}
              totalNeighbors={traceProjection.totalNeighbors}
              hasRoom={traceProjection.hasRoom}
              drawn={drawnConnections}
              total={edges.length}
              onChange={setTrace}
              onExit={() => {
                setTrace(null);
                groupListButton.current?.focus();
              }}
            />
          )}
          {active && (
            <button
              data-graph-fit-obstacle="true"
              data-lod-controls="true"
              className="pointer-events-auto rounded-xl bg-slate-900/95 border border-slate-600 px-4 py-2 min-w-36 min-h-14 text-sm leading-5 text-slate-100 shadow-lg"
              aria-label={`${edges.length} relationships, ${notDrawnConnections} not drawn: ${internalConnections} internal, ${pendingConnections} awaiting endpoints, ${summarizedConnections} summarized by priority, ${collapsedConnections} external connections in list`}
              onClick={() => {
                returnFocus.current = document.activeElement as HTMLElement;
                setBrowse(true);
                setGroupId(null);
                openRelationships({ kind: 'all' }, 'all');
              }}
            >
              <span className="block">Connections</span>
              <span
                className={`block ${notDrawnConnections ? 'text-amber-200' : 'text-emerald-200'}`}
              >
                {notDrawnConnections
                  ? `${notDrawnConnections} not drawn`
                  : 'Browse all'}
              </span>
            </button>
          )}
        </GraphStatusDock>
      )}
      {relationshipScope && (
        <SemanticRelationshipBrowser
          index={relationshipIndex}
          scope={relationshipScope}
          visible={browse}
          contextFor={id => groupLabel(projection.membership.get(id) ?? '')}
          onScope={setRelationshipScope}
          onInspect={inspect}
          focusId={relationshipFocus}
          onBack={() => setRelationshipScope(null)}
        />
      )}
      {browse && !relationshipScope && (
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
              onClick={() => closeBrowser()}
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
              <p className="text-sm text-gray-300 mb-3">
                {group.members.length} items · {group.internalEdges.length}{' '}
                internal relationships · {group.blocked} blocked ·{' '}
                {group.completed} completed · grouped by {group.basis}
              </p>
              <div className="flex flex-wrap gap-2 mb-3">
                {(['outgoing', 'incoming'] as const).map(direction => (
                  <button
                    key={direction}
                    className="min-h-11 rounded border border-emerald-700 px-3 text-sm text-emerald-200"
                    onClick={() => {
                      setExpanded(new Set(effectiveExpanded));
                      setMode('overview');
                      setTrace({ groupId: group.id, direction, page: 0 });
                      closeBrowser();
                      requestAnimationFrame(() =>
                        host.current
                          ?.querySelector<HTMLButtonElement>(
                            '[data-lod-trace] button'
                          )
                          ?.focus()
                      );
                    }}
                  >
                    Trace {direction} connections
                  </button>
                ))}
              </div>
              <button
                data-lod-relationships="internal"
                onClick={() =>
                  openRelationships(
                    {
                      kind: 'internal',
                      group: { id: group.hierarchyId, direct: group.isDirect },
                    },
                    'internal'
                  )
                }
                className="min-h-11 mb-3 text-sm text-emerald-200"
              >
                Browse {group.internalEdges.length} internal relationships
              </button>
              {group.ancestors.length > 0 && (
                <nav
                  aria-label="Group path"
                  className="flex flex-wrap gap-2 mb-3"
                >
                  {group.ancestors.map((id, index) => (
                    <button
                      key={id}
                      className="min-h-11 rounded border border-gray-700 px-3 py-2 text-sm text-left break-words text-emerald-200"
                      aria-label={`Collapse to ${group.ancestors
                        .slice(0, index + 1)
                        .map(ancestor => hierarchy.groups.get(ancestor)!.label)
                        .join(' / ')}`}
                      onClick={() => {
                        const next = new Set(effectiveExpanded);
                        setTrace(null);
                        next.delete(id);
                        setExpanded(next);
                        setMode('overview');
                        setGroupId(null);
                        setSearch('');
                        requestAnimationFrame(() =>
                          closeButton.current?.focus()
                        );
                      }}
                    >
                      {hierarchy.groups.get(id)!.label}
                    </button>
                  ))}
                </nav>
              )}
              {group.children.length > 0 && (
                <button
                  className="w-full min-h-11 rounded border border-emerald-700 px-3 py-2 mb-3 text-sm text-left text-emerald-200"
                  onClick={() => {
                    setTrace(null);
                    setExpanded(
                      new Set([...effectiveExpanded, group.hierarchyId])
                    );
                    setMode('overview');
                    setGroupId(null);
                    setSearch('');
                    requestAnimationFrame(() => closeButton.current?.focus());
                  }}
                >
                  Show {group.children.length} subgroups
                </button>
              )}
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
                        onClick={() => inspect(item.id)}
                      >
                        <span className="block text-sm break-words">
                          {item.title}
                        </span>
                        <span className="text-sm text-gray-400">
                          {item.type} · {item.status}
                        </span>
                      </button>
                      <button
                        data-lod-relationships={`node:${item.id}`}
                        aria-label={`Relationships of ${item.title}`}
                        onClick={() =>
                          openRelationships(
                            { kind: 'node', id: item.id },
                            `node:${item.id}`
                          )
                        }
                        className="min-h-11 text-sm text-emerald-200 px-3"
                      >
                        Relationships
                      </button>
                    </li>
                  ))}
              </ul>
              <h3 className="mt-4 mb-2 text-sm font-semibold">
                Relationships between groups
              </h3>
              <ul className="space-y-2 text-sm">
                {projection.bundles
                  .filter(
                    bundle =>
                      bundle.source === group.id || bundle.target === group.id
                  )
                  .map(bundle => (
                    <li key={bundle.id}>
                      <button
                        data-lod-relationships={bundle.id}
                        className="min-h-11 text-left text-emerald-200"
                        onClick={() =>
                          openRelationships(
                            {
                              kind: 'bundle',
                              source: {
                                id: groupsById.get(bundle.source)!.hierarchyId,
                                direct: groupsById.get(bundle.source)!.isDirect,
                              },
                              target: {
                                id: groupsById.get(bundle.target)!.hierarchyId,
                                direct: groupsById.get(bundle.target)!.isDirect,
                              },
                              type: bundle.type,
                            },
                            bundle.id
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
              <p className="text-sm text-gray-300 mb-3">
                {items.length} loaded items · {edges.length} loaded
                relationships
                {projection.pendingEdges.length > 0
                  ? ` · ${projection.pendingEdges.length} awaiting endpoints`
                  : ''}
              </p>
              <button
                data-lod-relationships="all"
                onClick={() => openRelationships({ kind: 'all' }, 'all')}
                className="min-h-11 mb-3 text-sm text-emerald-200"
              >
                Browse {edges.length} relationships
              </button>
              <ul className="space-y-2">
                {projection.groups.map(entry => (
                  <li key={entry.id}>
                    <button
                      onClick={() => openGroup(entry.id)}
                      aria-current={
                        entry.members.some(item => item.id === selectedId)
                          ? 'true'
                          : undefined
                      }
                      className="w-full rounded bg-gray-900 p-3 text-left text-sm"
                    >
                      <span className="block break-words">
                        {[
                          ...entry.ancestors.map(
                            id => hierarchy.groups.get(id)!.label
                          ),
                          entry.isDirect ? 'Direct items' : entry.label,
                        ].join(' / ')}
                      </span>
                      <span className="text-sm text-gray-300">
                        {entry.members.length} items · {entry.blocked} blocked ·{' '}
                        {entry.basis}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              {projection.diagnostics.map(message => (
                <p key={message} className="mt-3 text-sm text-amber-200">
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
