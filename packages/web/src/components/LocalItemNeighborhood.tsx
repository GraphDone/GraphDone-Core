import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Compass,
  FolderTree,
  List,
  Move,
} from 'lucide-react';
import { projectItemNeighborhood } from '../lib/localItemLOD';
import { GRAPH_FONT_FAMILY } from '../lib/graphSymbolLayout';
import {
  denseItemCandidates,
  localCardDimensions,
  localItemSlots,
  nearestDenseItem,
  type LocalCamera,
  type LocalItemObstacle,
} from '../lib/localItemLayout';
import {
  routeSchematicConnections,
  type SchematicCard,
  type SchematicRoute,
} from '../lib/schematicRouting';
import type {
  RelationshipScope,
  SemanticRelationshipIndex,
} from '../lib/semanticRelationships';
import {
  getRelationshipConfig,
  getStatusConfig,
  getTypeConfig,
  type RelationshipType,
  type WorkItemStatus,
  type WorkItemType,
} from '../constants/workItemConstants';
import { OverviewBusLayer } from './OverviewBusLayer';

type Session = {
  focusId: string;
  page: number;
  groupId?: string;
  camera?: LocalCamera;
};
function readLocalView(scope: string | null): {
  session?: Session;
  history: Session[];
  board: boolean;
} {
  try {
    const raw = scope
      ? JSON.parse(
          localStorage.getItem(`graphdone:local-items:${scope}`) ?? 'null'
        )
      : null;
    const valid = (entry: unknown): entry is Session => {
      if (!entry || typeof entry !== 'object') return false;
      const value = entry as Session;
      return (
        typeof value.focusId === 'string' &&
        value.focusId.length <= 256 &&
        Number.isSafeInteger(value.page) &&
        value.page >= 0 &&
        value.page <= 1000000 &&
        (value.groupId === undefined ||
          (typeof value.groupId === 'string' &&
            value.groupId.length <= 16384)) &&
        (value.camera === undefined ||
          ([value.camera.x, value.camera.y, value.camera.scale].every(
            Number.isFinite
          ) &&
            value.camera.scale > 0))
      );
    };
    return {
      session: valid(raw?.session) ? raw.session : undefined,
      history: Array.isArray(raw?.history)
        ? raw.history.filter(valid).slice(-32)
        : [],
      board: raw?.board === true,
    };
  } catch {
    return { history: [], board: false };
  }
}

type Props = {
  graphId: string;
  viewScope: string | null;
  index: SemanticRelationshipIndex;
  representedIds: ReadonlySet<string>;
  camera: LocalCamera;
  selectedId?: string;
  enabled: boolean;
  readPositions: () => readonly { id: string; x: number; y: number }[];
  onActive: (active: boolean) => void;
  onControls: (controls: ReactNode) => void;
  onFooter: (footer: ReactNode) => void;
  onInspect: (id: string) => void;
  onNavigate: (id: string, camera?: LocalCamera) => void;
  onBoard: (active: boolean) => void;
  onBrowse: (
    scope: RelationshipScope,
    trigger: HTMLElement | SVGElement
  ) => void;
};

export function LocalItemNeighborhood({
  graphId,
  viewScope,
  index,
  representedIds,
  camera,
  selectedId,
  enabled,
  readPositions,
  onActive,
  onControls,
  onFooter,
  onInspect,
  onNavigate,
  onBoard,
  onBrowse,
}: Props) {
  const host = useRef<HTMLDivElement>(null);
  const [geometry, setGeometry] = useState({
    width: 0,
    height: 0,
    obstacles: [] as LocalItemObstacle[],
  });
  const [restored] = useState(() => readLocalView(viewScope));
  const [session, setSession] = useState<Session | undefined>(restored.session);
  const [history, setHistory] = useState<Session[]>(restored.history);
  const [board, setBoard] = useState(restored.board);
  useEffect(() => {
    if (!viewScope) return;
    try {
      localStorage.setItem(
        `graphdone:local-items:${viewScope}`,
        JSON.stringify({ session, history: history.slice(-32), board })
      );
    } catch {
      return;
    }
  }, [viewScope, session, history, board]);
  const [highlight, setHighlight] = useState<string | null>(null);
  const origin = useRef<LocalCamera>();
  const worldAnchor = useRef<{ x: number; y: number }>();
  const cameraRef = useRef(camera);
  cameraRef.current = camera;
  const rebasePending = useRef(false);
  const readPoint = useCallback(
    (id?: string) => {
      const point = readPositions().find(item => item.id === id);
      return point ? { x: point.x, y: point.y } : undefined;
    },
    [readPositions]
  );
  const candidates = useMemo(() => denseItemCandidates(index), [index]);
  const candidate =
    enabled && !board && !session
      ? nearestDenseItem(
          candidates,
          new Map(readPositions().map(item => [item.id, item])),
          camera,
          geometry,
          selectedId
        )
      : undefined;
  const focusId = session?.focusId ?? candidate;
  const active =
    enabled &&
    !board &&
    !!focusId &&
    index.byId.has(focusId) &&
    geometry.width > 0 &&
    geometry.height > 0;
  useLayoutEffect(() => {
    const element = host.current;
    if (!element) return;
    const measure = () => {
      const bounds = element.getBoundingClientRect();
      const obstacles = Array.from(
        document.querySelectorAll<HTMLElement>(
          '[data-graph-fit-obstacle="true"], [data-graph-status-dock="true"]'
        )
      )
        .filter(
          item =>
            !item.hasAttribute('data-local-item-card') &&
            (item.getAttribute('role') !== 'region' ||
              item.hasAttribute('data-lod-trace')) &&
            item.dataset.layoutSaveProgress !== 'true'
        )
        .map(item => item.getBoundingClientRect())
        .filter(rect => rect.width > 0 && rect.height > 0)
        .map(rect => ({
          x: rect.left - bounds.left,
          y: rect.top - bounds.top,
          width: rect.width,
          height: rect.height,
        }));
      const next = { width: bounds.width, height: bounds.height, obstacles };
      setGeometry(previous =>
        JSON.stringify(previous) === JSON.stringify(next) ? previous : next
      );
    };
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    document
      .querySelectorAll<HTMLElement>(
        '[data-graph-fit-obstacle="true"], [data-graph-status-dock="true"]'
      )
      .forEach(item => observer.observe(item));
    measure();
    return () => observer.disconnect();
  }, [active, session?.page, session?.groupId]);
  useEffect(() => {
    if (index.byId.size > 0 && session && !index.byId.has(session.focusId)) {
      setSession(undefined);
      setHistory([]);
    }
  }, [session, index]);
  useLayoutEffect(() => {
    if (!active || !focusId) return;
    if (!session) setSession({ focusId, page: 0 });
    if (!origin.current) {
      origin.current = camera;
      worldAnchor.current = readPoint(focusId);
    }
  }, [active, focusId, session, camera, readPoint]);
  useLayoutEffect(() => {
    onActive(active);
    return () => onActive(false);
  }, [active, onActive]);
  const previousEnabled = useRef(enabled);
  useEffect(() => {
    if (enabled && !previousEnabled.current) setBoard(false);
    previousEnabled.current = enabled;
  }, [enabled, graphId]);
  useLayoutEffect(() => {
    onBoard(board);
    return () => onBoard(false);
  }, [board, onBoard]);
  useEffect(() => {
    const organized = () => {
      rebasePending.current = true;
    };
    const started = (event: Event) => {
      if (!(event as CustomEvent<{ manual: boolean }>).detail.manual)
        rebasePending.current = true;
    };
    const settled = (event: Event) => {
      const next = (event as CustomEvent<LocalCamera & { manual: boolean }>)
        .detail;
      const point = readPoint(focusId);
      if (
        point &&
        (point.x * next.scale + next.x < 0 ||
          point.x * next.scale + next.x > geometry.width ||
          point.y * next.scale + next.y < 0 ||
          point.y * next.scale + next.y > geometry.height)
      ) {
        origin.current = undefined;
        worldAnchor.current = undefined;
        setSession(undefined);
        rebasePending.current = false;
        return;
      }
      if (!rebasePending.current && next.manual) return;
      rebasePending.current = false;
      origin.current = next;
      worldAnchor.current = point;
      setGeometry(previous => ({ ...previous }));
    };
    window.addEventListener('graphdone:layout-organized', organized);
    window.addEventListener('graphdone:camera-start', started);
    window.addEventListener('graphdone:camera-settled', settled);
    return () => {
      window.removeEventListener('graphdone:layout-organized', organized);
      window.removeEventListener('graphdone:camera-start', started);
      window.removeEventListener('graphdone:camera-settled', settled);
    };
  }, [focusId, readPoint, geometry.width, geometry.height]);
  useLayoutEffect(() => {
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => {
        origin.current = cameraRef.current;
        worldAnchor.current = readPoint(focusId);
        rebasePending.current = false;
        setGeometry(previous => ({ ...previous }));
      });
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, [geometry.width, geometry.height, readPoint]);
  const initial = useMemo(
    () =>
      projectItemNeighborhood(index, focusId ?? '', {
        capacity: 7,
        page: session?.page ?? 0,
        groupId: session?.groupId,
        representedIds,
      }),
    [index, focusId, session?.page, session?.groupId, representedIds]
  );
  const cell = useMemo(() => {
    const sizes = initial.cards.map(card =>
      localCardDimensions(card, geometry.width)
    );
    return {
      width: Math.max(160, ...sizes.map(size => size.width)),
      height: Math.max(124, ...sizes.map(size => size.height)),
    };
  }, [initial.cards, geometry.width]);
  const layout = useMemo(
    () => localItemSlots(geometry, geometry.obstacles, cell),
    [geometry, cell]
  );
  const model = useMemo(
    () =>
      projectItemNeighborhood(index, focusId ?? '', {
        capacity: layout.slots.length,
        page: session?.page ?? 0,
        groupId: session?.groupId,
        representedIds,
      }),
    [
      index,
      focusId,
      layout.slots.length,
      session?.page,
      session?.groupId,
      representedIds,
    ]
  );
  const cards = useMemo(
    () =>
      model.cards.map((card, i) => {
        const slot = layout.slots[i],
          size = localCardDimensions(card, geometry.width);
        return {
          ...card,
          x: slot.x + (slot.width - size.width) / 2,
          y: slot.y + (slot.height - size.height) / 2,
          width: size.width,
          height: size.height,
          title: size.title,
        };
      }),
    [model.cards, layout.slots, geometry.width]
  );
  const wiring = useMemo(
    () =>
      active
        ? routeSchematicConnections(
            cards,
            model.connections,
            geometry.width,
            geometry.height,
            geometry.obstacles.map((box, i) => ({
              ...box,
              id: `local-control-${i}`,
            })),
            { cardClearance: 20, wireClearance: 16 }
          )
        : undefined,
    [active, cards, model.connections, geometry]
  );
  const drawn =
    wiring?.routes.reduce((sum, route) => sum + route.edgeIds.length, 0) ?? 0;
  const routingDeferred =
    wiring?.deferred.reduce((sum, route) => sum + route.edgeIds.length, 0) ?? 0;
  const navigate = useCallback(
    (next: Session, keep = true) => {
      if (keep && session)
        setHistory(previous => [
          ...previous,
          { ...session, camera: cameraRef.current },
        ]);
      if (next.focusId !== session?.focusId || next.camera) {
        rebasePending.current = true;
        onNavigate(next.focusId, next.camera);
      }
      setSession({
        focusId: next.focusId,
        page: next.page,
        groupId: next.groupId,
      });
    },
    [session, onNavigate]
  );
  const browseFocus = useCallback(
    (trigger: HTMLElement | SVGElement) => {
      if (focusId) onBrowse({ kind: 'node', id: focusId }, trigger);
    },
    [focusId, onBrowse]
  );
  const controls = useMemo(
    () =>
      board && enabled && focusId ? (
        <button
          type="button"
          className="flex min-h-11 items-center gap-2 rounded-xl border border-teal-600 bg-slate-900 px-3 text-sm text-teal-100"
          onClick={() => {
            origin.current = cameraRef.current;
            worldAnchor.current = readPoint(focusId);
            setBoard(false);
          }}
        >
          <Compass size={20} />
          Explore linked items
        </button>
      ) : active && model.focus ? (
        <div
          data-lod-controls="true"
          className="flex flex-wrap items-center gap-2"
          aria-label="Local item navigation"
        >
          <button
            type="button"
            className="min-h-11 max-w-full rounded-xl border border-teal-600 bg-slate-900 px-2 text-sm font-semibold text-teal-100"
            title={`Connections around ${model.focus.title}`}
            onClick={event => browseFocus(event.currentTarget)}
          >
            {model.counts.shownNeighbors} / {model.counts.loadedNeighbors}{' '}
            linked
          </button>
          <button
            type="button"
            aria-label={
              model.page === 0 && history.length > 0
                ? 'Back to previous item'
                : 'Previous linked items'
            }
            title={
              model.page === 0 && history.length > 0
                ? 'Back to previous item'
                : 'Previous linked items'
            }
            disabled={model.page === 0 && history.length === 0}
            onClick={() => {
              if (model.page === 0 && history.length > 0) {
                const previous = history[history.length - 1];
                setHistory(value => value.slice(0, -1));
                navigate(previous, false);
              } else
                navigate(
                  {
                    focusId: focusId!,
                    page: model.page - 1,
                    groupId: session?.groupId,
                  },
                  false
                );
            }}
            className="flex h-11 w-11 items-center justify-center rounded-lg border border-slate-600 bg-slate-900 disabled:opacity-40"
          >
            <ArrowLeft size={20} />
          </button>
          <button
            type="button"
            aria-label="Next linked items"
            title="Next linked items"
            disabled={
              model.page + 1 >= model.pages || model.counts.shownNeighbors === 0
            }
            onClick={() =>
              navigate(
                {
                  focusId: focusId!,
                  page: model.page + 1,
                  groupId: session?.groupId,
                },
                false
              )
            }
            className="flex h-11 w-11 items-center justify-center rounded-lg border border-slate-600 bg-slate-900 disabled:opacity-40"
          >
            <ArrowRight size={20} />
          </button>
        </div>
      ) : null,
    [
      active,
      board,
      enabled,
      readPoint,
      model.focus,
      model.groups,
      model.counts.shownNeighbors,
      model.counts.loadedNeighbors,
      model.page,
      model.pages,
      focusId,
      session?.groupId,
      history,
      navigate,
      browseFocus,
    ]
  );
  const footer = useMemo(
    () =>
      active && model.focus ? (
        <div
          className="max-w-full rounded-xl border border-slate-600 bg-slate-900/95 px-2 py-1 text-sm text-slate-100 shadow-lg"
          data-graph-fit-obstacle="true"
          data-local-item-status="true"
        >
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="min-h-11 flex-1 px-2 text-left font-semibold"
              onClick={event => browseFocus(event.currentTarget)}
            >
              {model.counts.incident} connections
            </button>
            <button
              type="button"
              aria-label="Browse all graph relationships"
              title="Browse all graph relationships"
              className="flex h-11 w-11 items-center justify-center rounded-lg border border-slate-600"
              onClick={event => onBrowse({ kind: 'all' }, event.currentTarget)}
            >
              <List size={20} />
            </button>
            {model.groups.length > 1 && (
              <label
                className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-slate-600 focus-within:outline focus-within:outline-2 focus-within:outline-teal-300"
                title="Linked item group"
              >
                <FolderTree size={20} />
                <select
                  aria-label="Linked item group"
                  value={session?.groupId ?? ''}
                  onChange={event =>
                    navigate(
                      {
                        focusId: focusId!,
                        page: 0,
                        groupId: event.target.value || undefined,
                      },
                      false
                    )
                  }
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                >
                  <option value="">All groups</option>
                  {model.groups.map(group => (
                    <option key={group.id} value={group.id}>
                      {group.label} · {group.members.length}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <button
              type="button"
              aria-label="Edit saved board positions"
              title="Edit saved board positions"
              className="flex h-11 w-11 items-center justify-center rounded-lg border border-slate-600"
              onClick={() => {
                setBoard(true);
                if (focusId) onNavigate(focusId);
              }}
            >
              <Move size={20} />
            </button>
          </div>
          <p className="px-2 text-slate-300">
            {drawn} links shown ·{' '}
            {model.counts.spatialDeferred + routingDeferred} in list
          </p>
          {(model.counts.pending > 0 ||
            model.counts.internal > 0 ||
            model.counts.prioritySummarized > 0) && (
            <p className="px-2 text-slate-300">
              {model.counts.prioritySummarized} by priority ·{' '}
              {model.counts.internal} internal · {model.counts.pending} awaiting
              endpoints
            </p>
          )}
        </div>
      ) : null,
    [
      active,
      model.focus,
      model.counts,
      model.groups,
      drawn,
      routingDeferred,
      browseFocus,
      onBrowse,
      session?.groupId,
      navigate,
      focusId,
      onNavigate,
    ]
  );
  useLayoutEffect(() => {
    onControls(controls);
  }, [controls, onControls]);
  useLayoutEffect(() => {
    onFooter(footer);
  }, [footer, onFooter]);
  useLayoutEffect(
    () => () => {
      onControls(null);
      onFooter(null);
    },
    [onControls, onFooter]
  );
  const cameraOrigin = origin.current ?? camera;
  const anchor = worldAnchor.current;
  const delta =
    anchor && !rebasePending.current
      ? {
          x:
            camera.x -
            cameraOrigin.x +
            anchor.x * (camera.scale - cameraOrigin.scale),
          y:
            camera.y -
            cameraOrigin.y +
            anchor.y * (camera.scale - cameraOrigin.scale),
        }
      : { x: 0, y: 0 };
  const route = wiring?.routes.find(candidate => candidate.id === highlight);
  const cardLabel = useCallback(
    (id: string) => {
      const card = model.cards.find(item => item.id === id);
      return card?.kind === 'item' ? card.item.title : (card?.label ?? id);
    },
    [model.cards]
  );
  const inspectBus = useCallback(
    (bus: SchematicRoute, trigger: SVGPathElement) =>
      onBrowse(
        {
          kind: 'selection',
          label: `${cardLabel(bus.source)} → ${cardLabel(bus.target)}`,
          edgeIds: bus.edgeIds,
        },
        trigger
      ),
    [onBrowse, cardLabel]
  );
  useEffect(() => {
    if (!active) return;
    (window as unknown as { __localItemLOD?: unknown }).__localItemLOD = {
      focusId,
      cards: cards.map(card => ({
        id: card.id,
        kind: card.kind,
        ...(card.kind === 'item'
          ? { originalId: card.item.id }
          : { members: card.members.map(item => item.id) }),
      })),
      counts: model.counts,
      partitionIds: Object.fromEntries(
        Object.entries(model.partitions).map(([key, edges]) => [
          key,
          (edges as readonly import('../lib/semanticLOD').SemanticEdge[]).map(
            edge => edge.id
          ),
        ])
      ),
      routes: wiring?.routes.map(bus => ({
        source: bus.source,
        target: bus.target,
        edgeIds: bus.edgeIds,
      })),
      routingDeferred,
      work: { ...model.work, ...layout.work, routing: wiring?.work },
    };
    return () => {
      delete (window as unknown as { __localItemLOD?: unknown }).__localItemLOD;
    };
  }, [active, focusId, cards, model, wiring, routingDeferred, layout.work]);
  return (
    <div
      ref={host}
      className="local-item-neighborhood absolute inset-0 pointer-events-none"
      data-active={active}
      onClick={event => event.stopPropagation()}
      data-local-focus={active ? focusId : undefined}
    >
      {active && (
        <div
          className="absolute inset-0"
          style={{ transform: `translate(${delta.x}px, ${delta.y}px)` }}
        >
          <OverviewBusLayer
            routes={wiring?.routes ?? []}
            junctions={wiring?.junctions ?? []}
            obstacles={
              [
                ...cards,
                ...geometry.obstacles.map((box, i) => ({
                  ...box,
                  id: `local-control-${i}`,
                })),
              ] as SchematicCard[]
            }
            width={geometry.width}
            height={geometry.height}
            color={busId => {
              const bus = wiring?.routes.find(item => item.bus === busId);
              return getRelationshipConfig(
                (bus?.connections[0]?.type ?? 'DEPENDS_ON') as RelationshipType
              ).hexColor;
            }}
            label={cardLabel}
            onHighlight={setHighlight}
            onInspect={inspectBus}
            onFocusLost={id =>
              host.current
                ?.querySelector<HTMLButtonElement>(
                  `[data-local-open="${CSS.escape(id)}"]`
                )
                ?.focus()
            }
          />
          {cards.map(card => {
            const config =
              card.kind === 'item'
                ? getTypeConfig(card.item.type as WorkItemType)
                : undefined;
            const Icon = config?.icon ?? FolderTree;
            const status =
              card.kind === 'item'
                ? getStatusConfig(card.item.status as WorkItemStatus)
                : undefined;
            const emphasized =
              route && (route.source === card.id || route.target === card.id);
            return (
              <section
                key={card.id}
                data-local-item-card={card.id}
                data-local-kind={card.kind}
                data-original-item={
                  card.kind === 'item' ? card.item.id : undefined
                }
                className="absolute pointer-events-auto overflow-hidden rounded-xl border bg-slate-900 text-slate-100 shadow-xl"
                style={{
                  fontFamily: GRAPH_FONT_FAMILY,
                  left: card.x,
                  top: card.y,
                  width: card.width,
                  height: card.height,
                  borderColor: emphasized
                    ? '#5eead4'
                    : (config?.hexColor ?? '#64748b'),
                  outline: emphasized ? '3px solid #5eead4' : undefined,
                  outlineOffset: 3,
                }}
              >
                <div
                  className="flex h-8 items-center gap-2 border-b border-slate-700 px-3 text-sm font-semibold"
                  style={{ color: config?.hexColor ?? '#5eead4' }}
                >
                  <Icon size={18} />
                  <span>{config?.label ?? 'Linked group'}</span>
                  {card.kind === 'item' && card.isFocus && (
                    <span className="ml-auto text-slate-200">Focus</span>
                  )}
                </div>
                <button
                  type="button"
                  data-local-open={card.id}
                  className="block w-full px-3.5 py-1.5 text-left text-lg font-semibold leading-6 hover:bg-slate-800 focus:outline focus:outline-2 focus:outline-teal-300"
                  title={card.kind === 'item' ? card.item.title : card.label}
                  aria-label={
                    card.kind === 'item'
                      ? `Open ${card.item.title}`
                      : `Explore ${card.label}`
                  }
                  onClick={() =>
                    card.kind === 'item'
                      ? onInspect(card.item.id)
                      : navigate({
                          focusId: focusId!,
                          page: 0,
                          groupId: card.groupId,
                        })
                  }
                >
                  {card.title.lines.map((line, i) => (
                    <span key={i} className="block">
                      {line}
                    </span>
                  ))}
                </button>
                <div className="flex h-11 items-center justify-between border-t border-slate-700 pl-3 text-sm text-slate-300">
                  <span>
                    {card.kind === 'item'
                      ? (status?.label ?? card.item.status)
                      : `${card.members.length} connected items`}
                  </span>
                  <button
                    type="button"
                    className="flex h-11 w-11 items-center justify-center text-teal-200 hover:bg-slate-800"
                    aria-label={
                      card.kind === 'item' && card.isFocus
                        ? 'Browse focused item connections'
                        : card.kind === 'item'
                          ? `Focus on ${card.item.title}`
                          : `Explore ${card.label}`
                    }
                    title={
                      card.kind === 'item' && card.isFocus
                        ? 'Browse focused item connections'
                        : 'Explore these connections'
                    }
                    onClick={event =>
                      card.kind === 'item'
                        ? card.isFocus
                          ? browseFocus(event.currentTarget)
                          : navigate({ focusId: card.item.id, page: 0 })
                        : navigate({
                            focusId: focusId!,
                            page: 0,
                            groupId: card.groupId,
                          })
                    }
                  >
                    <Compass size={20} />
                  </button>
                </div>
              </section>
            );
          })}
          {model.missingGroup && (
            <div
              role="status"
              className="absolute left-16 top-32 rounded-lg bg-slate-900 p-4 text-base"
            >
              That group is no longer available. Choose All linked groups.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
