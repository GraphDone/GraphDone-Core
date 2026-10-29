import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  indexOverviewBusHits,
  nearestOverviewBus,
} from '../lib/overviewBusHit';
import { placeOverviewBusHint } from '../lib/overviewBusHint';
import type { SchematicCard, SchematicRoute } from '../lib/schematicRouting';

interface Props {
  routes: readonly SchematicRoute[];
  junctions: readonly { x: number; y: number; bus: string }[];
  obstacles: readonly SchematicCard[];
  width: number;
  height: number;
  color: (id: string) => string;
  label: (id: string) => string;
  onHighlight: (id: string | null) => void;
  onInspect: (route: SchematicRoute, trigger: SVGPathElement) => void;
  onFocusLost: (source: string) => void;
}

export function OverviewBusLayer({
  routes,
  junctions,
  obstacles,
  width,
  height,
  color,
  label,
  onHighlight,
  onInspect,
  onFocusLost,
}: Props) {
  const instance = useId().replace(/:/g, '');
  const marker = `lod-arrow-${instance}`;
  const hintId = `lod-bus-hint-${instance}`;
  const [hovered, setHovered] = useState<string | null>(null);
  const [focused, setFocused] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [anchor, setAnchor] = useState({ x: 0, y: 0 });
  const [position, setPosition] = useState({ x: 12, y: 12 });
  const hint = useRef<HTMLDivElement>(null);
  const focusOwner = useRef<{ element: SVGPathElement; source: string } | null>(
    null
  );
  const focusFallback = useRef(onFocusLost);
  useLayoutEffect(() => {
    focusFallback.current = onFocusLost;
  });
  useLayoutEffect(
    () => () => {
      const owned = focusOwner.current;
      if (owned && document.activeElement === owned.element)
        requestAnimationFrame(() => {
          if (document.activeElement === document.body)
            focusFallback.current(owned.source);
        });
    },
    []
  );
  const exitTimer = useRef<ReturnType<typeof setTimeout>>();
  const active = routes.find(route => route.id === (hovered ?? focused));
  const visibleHint = active && dismissed !== active.id;
  const cancelExit = () => clearTimeout(exitTimer.current);
  const leave = () => {
    cancelExit();
    exitTimer.current = setTimeout(() => setHovered(null), 120);
  };
  useEffect(() => {
    setHovered(null);
    setDismissed(null);
    setFocused(previous =>
      routes.some(route => route.id === previous) ? previous : null
    );
  }, [routes]);
  useEffect(() => {
    onHighlight(active?.id ?? null);
  }, [active?.id, onHighlight]);
  useEffect(
    () => () => {
      clearTimeout(exitTimer.current);
      onHighlight(null);
    },
    [onHighlight]
  );
  useLayoutEffect(() => {
    const owned = focusOwner.current;
    if (!owned || owned.element.isConnected) return;
    focusOwner.current = null;
    if (document.activeElement === document.body) onFocusLost(owned.source);
  }, [routes, onFocusLost]);
  useEffect(() => {
    if (!visibleHint) return;
    const dismiss = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        setDismissed(active.id);
      }
    };
    window.addEventListener('keydown', dismiss, true);
    return () => window.removeEventListener('keydown', dismiss, true);
  }, [visibleHint, active]);
  useLayoutEffect(() => {
    if (!hint.current) return;
    const bounds = hint.current.getBoundingClientRect();
    setPosition(
      placeOverviewBusHint(
        anchor,
        width,
        height,
        bounds.width,
        bounds.height,
        obstacles
      )
    );
  }, [anchor, width, height, visibleHint, active, obstacles]);
  const hitGeometry = useMemo(() => indexOverviewBusHits(routes), [routes]);
  const pointerRoute = (
    fallback: SchematicRoute,
    event: { clientX: number; clientY: number; currentTarget: SVGPathElement }
  ) => {
    const bounds = event.currentTarget.ownerSVGElement!.getBoundingClientRect();
    const point = {
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
    };
    const route =
      nearestOverviewBus(
        hitGeometry,
        point,
        hovered ?? focused ?? fallback.id
      ) ?? fallback;
    return {
      route,
      point:
        Number.isFinite(point.x) && Number.isFinite(point.y)
          ? point
          : route.points[0],
    };
  };
  const pointerTarget = (route: SchematicRoute, fallback: SVGPathElement) =>
    Array.from(
      fallback.ownerSVGElement!.querySelectorAll<SVGPathElement>(
        '[data-lod-bus-hit]'
      )
    ).find(element => element.dataset.lodBusHit === route.id) ?? fallback;
  const describe = (route: SchematicRoute) =>
    `${label(route.source)} → ${label(route.target)}: ${route.edgeIds.length} ${route.edgeIds.length === 1 ? 'relationship' : 'relationships'}`;
  return (
    <>
      <svg
        role="group"
        aria-label="Overview connections"
        className="absolute inset-0 h-full w-full"
      >
        <defs>
          <marker
            id={marker}
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="9"
            markerHeight="9"
            markerUnits="userSpaceOnUse"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#cbd5e1" />
          </marker>
        </defs>
        {routes.map(route => (
          <path
            key={route.id}
            data-lod-bundle={route.connections
              .map(connection => connection.type)
              .join(' ')}
            data-lod-bus-source={route.source}
            data-lod-bus-target={route.target}
            data-lod-bus-id={route.bus}
            data-count={route.edgeIds.length}
            data-highlighted={active?.id === route.id}
            data-bus-focused={focused === route.id}
            d={route.points
              .map(
                (point, index) => `${index ? 'L' : 'M'}${point.x},${point.y}`
              )
              .join(' ')}
            fill="none"
            stroke={
              active?.id === route.id || focused === route.id
                ? '#f8fafc'
                : color(route.bus)
            }
            strokeWidth={
              active?.id === route.id || focused === route.id ? 5 : 3.5
            }
            opacity={
              active && active.id !== route.id && focused !== route.id
                ? 0.45
                : 1
            }
            strokeLinejoin="round"
            strokeLinecap="round"
            markerEnd={`url(#${marker})`}
            pointerEvents="none"
            aria-hidden="true"
          />
        ))}
        {junctions.map(point => (
          <circle
            key={`${point.bus}:${point.x}:${point.y}`}
            cx={point.x}
            cy={point.y}
            r="3.5"
            fill={color(point.bus)}
            pointerEvents="none"
            aria-hidden="true"
          />
        ))}
        {routes.map(route => (
          <path
            key={route.id}
            data-lod-bus-hit={route.id}
            role="button"
            tabIndex={0}
            aria-label={`Inspect ${describe(route)}`}
            aria-describedby={
              visibleHint && active.id === route.id ? hintId : undefined
            }
            d={route.points
              .map(
                (point, index) => `${index ? 'L' : 'M'}${point.x},${point.y}`
              )
              .join(' ')}
            fill="none"
            stroke="transparent"
            strokeWidth="24"
            strokeLinejoin="round"
            strokeLinecap="round"
            style={{
              pointerEvents: 'stroke',
              cursor: 'pointer',
              outline: 'none',
            }}
            onPointerDown={event => {
              event.stopPropagation();
              if (event.button === 0) {
                event.preventDefault();
                const selected = pointerRoute(route, event).route;
                pointerTarget(selected, event.currentTarget).focus({
                  preventScroll: true,
                });
              }
            }}
            onPointerEnter={event => {
              cancelExit();
              const selected = pointerRoute(route, event);
              setHovered(selected.route.id);
              setDismissed(null);
              setAnchor(selected.point);
            }}
            onPointerMove={event => {
              cancelExit();
              const selected = pointerRoute(route, event);
              if (selected.route.id !== hovered) {
                setHovered(selected.route.id);
                setDismissed(null);
                setAnchor(selected.point);
              }
            }}
            onPointerLeave={leave}
            onFocus={event => {
              focusOwner.current = {
                element: event.currentTarget,
                source: route.source,
              };
              cancelExit();
              setHovered(null);
              setFocused(route.id);
              setDismissed(null);
              const segments = route.points
                .slice(1)
                .map((point, index) => ({ a: route.points[index], b: point }));
              const longest = segments.sort(
                (a, b) =>
                  Math.abs(b.a.x - b.b.x) +
                  Math.abs(b.a.y - b.b.y) -
                  Math.abs(a.a.x - a.b.x) -
                  Math.abs(a.a.y - a.b.y)
              )[0];
              setAnchor({
                x: (longest.a.x + longest.b.x) / 2,
                y: (longest.a.y + longest.b.y) / 2,
              });
            }}
            onBlur={() => {
              focusOwner.current = null;
              setFocused(null);
            }}
            onClick={event => {
              event.stopPropagation();
              setHovered(null);
              const selected =
                event.detail === 0 ? route : pointerRoute(route, event).route;
              const trigger = pointerTarget(selected, event.currentTarget);
              trigger.focus({ preventScroll: true });
              onInspect(selected, trigger);
            }}
            onKeyDown={event => {
              if (event.key === 'Escape') {
                event.stopPropagation();
                setDismissed(route.id);
              }
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                event.stopPropagation();
                setHovered(null);
                onInspect(route, event.currentTarget);
              }
            }}
          />
        ))}
      </svg>
      {visibleHint && (
        <div
          ref={hint}
          id={hintId}
          role="tooltip"
          data-lod-bus-hint
          onPointerEnter={cancelExit}
          onPointerLeave={leave}
          onWheel={event => event.stopPropagation()}
          className="absolute z-20 pointer-events-auto overflow-auto rounded-xl border border-teal-300/60 bg-slate-950 p-4 text-sm font-medium leading-relaxed text-slate-200 shadow-xl"
          style={{
            left: position.x,
            top: position.y,
            width: Math.min(360, Math.max(0, width - 24)),
            maxHeight: Math.max(44, height - 24),
          }}
        >
          <p className="break-words text-base font-semibold text-white">
            {label(active.source)} → {label(active.target)}
          </p>
          <p className="mt-2">
            {active.edgeIds.length}{' '}
            {active.edgeIds.length === 1 ? 'relationship' : 'relationships'} ·{' '}
            {active.connections
              .map(
                connection =>
                  `${connection.type
                    .replace(/_/g, ' ')
                    .toLowerCase()
                    .replace(/^./, letter =>
                      letter.toUpperCase()
                    )} × ${connection.edgeIds.length}`
              )
              .join(' · ')}
          </p>
          <p className="mt-2 text-teal-200">Click or press Enter to inspect</p>
        </div>
      )}
    </>
  );
}
