import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { Lock, Unlock, Maximize2, Orbit, SlidersHorizontal, X } from 'lucide-react';
import {
  GRAPH_OBSTACLES_EVENT,
  RELATIONSHIP_PRIORITY_EVENT,
  RELATIONSHIP_PRIORITY_STORAGE_KEY,
  relationshipPriorityLevel,
  type RelationshipPriorityLevel,
} from '../lib/relationshipPriority';

// Hooks the graph registers on window for controls outside it.
type GraphWindow = Window & { triggerZoomToFit?: () => void; __organizeGraph?: () => void };

const LEVELS: { value: RelationshipPriorityLevel; label: string; hint: string }[] = [
  { value: 'essential', label: 'Essential', hint: 'The most important link between each pair' },
  { value: 'dependencies', label: 'Dependencies', hint: 'Blockers and dependencies' },
  { value: 'all', label: 'All', hint: 'Every connection' },
];

const readLevel = (): RelationshipPriorityLevel => {
  try { return relationshipPriorityLevel(localStorage.getItem(RELATIONSHIP_PRIORITY_STORAGE_KEY)); }
  catch { return 'essential'; }
};

/**
 * The graph's controls on a phone: one column in the bottom-right corner, in
 * thumb reach and clear of the cards' header. Fit and Lock are always there;
 * View (which connections to draw, and Organize) appears only when the graph
 * has connections, since neither does anything without them.
 */
export function PhoneGraphControls({
  locked,
  onToggleLock,
  connectionCount,
  canOrganize,
  overview,
}: {
  /** The graph opens as a group overview (40+ items). */
  overview: boolean;
  locked: boolean;
  onToggleLock: () => void;
  connectionCount: number;
  canOrganize: boolean;
}) {
  const [viewOpen, setViewOpen] = useState(false);
  const [level, setLevel] = useState<RelationshipPriorityLevel>(readLevel);
  const viewButton = useRef<HTMLButtonElement>(null);
  const sheet = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const hasConnections = connectionCount > 0;
  // Unlocking says once what it does, then gets out of the way of the cards.
  const [hintVisible, setHintVisible] = useState(false);
  useEffect(() => {
    setHintVisible(!locked);
    if (locked) return undefined;
    const timer = setTimeout(() => setHintVisible(false), 3000);
    return () => clearTimeout(timer);
  }, [locked]);

  // Sit just above the graph's bottom bar (connections, layout saves, trace
  // panel), which spans the width of a phone; on a short screen where a
  // column would not fit above it, lay the buttons out in a row. A large
  // graph's group overview fills that space with its own panels and keeps
  // the top-right corner free for these buttons instead.
  const stack = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<{ top?: number; bottom?: number; row: boolean }>(overview ? { top: 12, row: false } : { bottom: 12, row: false });
  useLayoutEffect(() => {
    const host = stack.current?.parentElement;
    if (!host) return undefined;
    const measure = () => {
      if (overview || host.querySelector('.graph-container[data-overview]')) {
        setPlace(prev => (prev.top === 12 && !prev.row ? prev : { top: 12, row: false }));
        return;
      }
      const frame = host.getBoundingClientRect();
      // A passive "layout saved" note fades on its own and lets taps through;
      // like the graph's own framing, ignore it so nothing jumps under a tap.
      const docks = Array.from(host.querySelectorAll<HTMLElement>('[data-graph-status-dock="true"] > *'))
        .filter(part => part.dataset.layoutSavePassive !== 'true' && part.dataset.layoutSaveProgress !== 'true')
        .map(part => part.getBoundingClientRect()).filter(rect => rect.height > 0);
      const top = Math.min(frame.bottom, ...docks.map(rect => rect.top));
      const bottom = Math.round(frame.bottom - top) + 12;
      const columnHeight = (hasConnections ? 3 : 2) * 44 + (hasConnections ? 2 : 1) * 8;
      const row = frame.height - bottom - 12 < columnHeight;
      setPlace(prev => (prev.bottom === bottom && prev.row === row && prev.top === undefined ? prev : { bottom, row }));
    };
    measure();
    const resize = new ResizeObserver(measure);
    const watch = () => {
      resize.disconnect();
      resize.observe(host);
      host.querySelectorAll('[data-graph-status-dock="true"]').forEach(dock => resize.observe(dock));
      measure();
    };
    watch();
    // The graph redraws often; look for a new or removed bar once per frame.
    let pending = 0;
    const mutations = new MutationObserver(() => {
      if (!pending) pending = requestAnimationFrame(() => { pending = 0; watch(); });
    });
    mutations.observe(host, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-overview'] });
    return () => { resize.disconnect(); mutations.disconnect(); cancelAnimationFrame(pending); };
  }, [hasConnections, overview]);

  const close = () => {
    setViewOpen(false);
    requestAnimationFrame(() => viewButton.current?.focus({ preventScroll: true }));
  };
  useEffect(() => {
    if (!viewOpen) return undefined;
    setLevel(readLevel());
    sheet.current?.querySelector<HTMLElement>('[aria-pressed="true"], button')?.focus({ preventScroll: true });
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [viewOpen]);
  useEffect(() => { if (!hasConnections) setViewOpen(false); }, [hasConnections]);
  // The sheet covers part of the graph: labels move out from under it while it
  // is open and come back when it closes.
  useEffect(() => {
    const announce = () => { window.dispatchEvent(new CustomEvent(GRAPH_OBSTACLES_EVENT)); };
    announce();
    return announce;
  }, [viewOpen]);

  const choose = (next: RelationshipPriorityLevel) => {
    setLevel(next);
    window.dispatchEvent(new CustomEvent(RELATIONSHIP_PRIORITY_EVENT, { detail: next }));
  };
  const round = 'flex h-11 w-11 items-center justify-center rounded-full border shadow-lg transition-colors';

  return (
    <>
      <div
        ref={stack}
        data-testid="phone-graph-controls"
        data-graph-fit-obstacle="true"
        style={{ top: place.top, bottom: place.bottom }}
        className={`absolute right-3 z-40 flex items-end gap-2 ${place.row ? 'flex-row-reverse' : 'flex-col'}`}
      >
        {hasConnections && (
          <button
            ref={viewButton}
            type="button"
            data-testid="graph-view-options"
            aria-label="View options"
            aria-expanded={viewOpen}
            onClick={() => (viewOpen ? close() : setViewOpen(true))}
            className={`${round} border-gray-600 bg-gray-900 text-gray-100`}
          >
            <SlidersHorizontal aria-hidden="true" className="h-5 w-5" />
          </button>
        )}
        <button
          type="button"
          data-testid="graph-zoom-extents"
          aria-label="Recentre the graph"
          onClick={() => (window as GraphWindow).triggerZoomToFit?.()}
          className={`${round} border-gray-600 bg-gray-900 text-gray-100`}
        >
          <Maximize2 aria-hidden="true" className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2">
          {hintVisible && (
            <span role="status" className="rounded-full bg-gray-900 px-3 py-1.5 text-xs text-green-200 shadow-lg">
              Drag cards to move them
            </span>
          )}
          <button
            type="button"
            data-testid="graph-lock-toggle"
            aria-label="Move cards"
            aria-pressed={!locked}
            onClick={onToggleLock}
            className={`${round} ${locked ? 'border-gray-600 bg-gray-900 text-gray-100' : 'border-green-300 bg-green-700 text-white'}`}
          >
            {locked ? <Lock aria-hidden="true" className="h-5 w-5" /> : <Unlock aria-hidden="true" className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {viewOpen && (
        <div
          ref={sheet}
          role="dialog"
          aria-labelledby={titleId}
          data-testid="graph-view-sheet"
          data-graph-fit-obstacle="true"
          className="absolute inset-x-0 bottom-0 z-50 max-h-[85%] overflow-y-auto overscroll-contain rounded-t-2xl border-t border-gray-700 bg-gray-900 p-4 shadow-2xl"
        >
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 id={titleId} className="text-base font-semibold text-white">View</h2>
            <button type="button" aria-label="Close view options" onClick={close} className="flex h-11 w-11 items-center justify-center rounded-full text-gray-300 hover:bg-gray-800">
              <X aria-hidden="true" className="h-5 w-5" />
            </button>
          </div>
          <fieldset className="space-y-2">
            <legend className="mb-2 text-sm text-gray-300">Connections to draw ({connectionCount} in this graph)</legend>
            {LEVELS.map(option => (
              <button
                key={option.value}
                type="button"
                aria-pressed={level === option.value}
                onClick={() => choose(option.value)}
                className={`flex w-full min-h-11 flex-col items-start rounded-lg border px-3 py-2 text-left ${level === option.value ? 'border-emerald-400 bg-emerald-900/40 text-white' : 'border-gray-700 bg-gray-800 text-gray-100'}`}
              >
                <span className="text-sm font-medium">{option.label}</span>
                <span className="text-xs text-gray-300">{option.hint}</span>
              </button>
            ))}
          </fieldset>
          <button
            type="button"
            data-testid="graph-organize"
            disabled={!canOrganize}
            onClick={() => { (window as GraphWindow).__organizeGraph?.(); close(); }}
            className="mt-4 flex w-full min-h-11 items-center gap-3 rounded-lg border border-teal-500/60 bg-gray-800 px-3 py-2 text-left text-gray-100 disabled:opacity-50"
          >
            <Orbit aria-hidden="true" className="h-5 w-5 shrink-0 text-teal-200" />
            <span>
              <span className="block text-sm font-medium">Organize around connections</span>
              <span className="block text-xs text-gray-300">{canOrganize ? 'Puts the most-connected items in the middle' : 'You can view this graph but not rearrange it'}</span>
            </span>
          </button>
        </div>
      )}
    </>
  );
}
