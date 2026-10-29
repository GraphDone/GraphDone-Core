import { lazy, Suspense, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, FileText, Network, CreditCard } from 'lucide-react';
import { useGraph } from '../contexts/GraphContext';
import { getTypeConfig, getStatusConfig } from '../constants/workItemConstants';
import type { WorkItemType } from '../constants/workItemConstants';
import { NodeSubgraphPreview } from './NodeSubgraphPreview';
import { CopyableId } from './CopyableId';

// Heavy (markdown + Prism) — lazy so it's out of the main bundle until a node's
// contents are first opened.
const NodeContentRenderer = lazy(() => import('./NodeContentRenderer'));

type Mode = 'card' | 'contents' | 'diagram';

interface NodeInspectorProps {
  node: any;
  onClose: () => void;
  onEdit?: () => void;
  compact?: boolean;
  /** Override the root data-testid so an anchored instance is distinguishable
   * from the docked one when both are mounted. */
  rootTestId?: string;
  maxHeight?: string;
}

/**
 * Inspector: shows the selected node's Card (summary), Contents (its description
 * rendered as readable markdown/code), or Diagram (its sub-graph), each at full
 * legible size regardless of canvas zoom. The mode is an explicit, per-node
 * toggle — not a side effect of zooming in. Used both docked (Workspace) and
 * anchored on-canvas (the expand-in-place peek), the latter via `compact`.
 */
export function NodeInspector({ node, onClose, onEdit, compact = false, rootTestId = 'node-inspector', maxHeight }: NodeInspectorProps) {
  const { descendInto } = useGraph();
  useLayoutEffect(() => {
    const trigger = document.activeElement;
    return () => {requestAnimationFrame(() => {
      const active = document.activeElement;
      if (trigger?.isConnected && (active === document.body || !active?.isConnected) && (trigger instanceof HTMLElement || trigger instanceof SVGElement)) trigger.focus({preventScroll:true});
    });};
  }, [node.id]);
  const hasSubgraph = !!node?.subgraphId;
  const [modeByNode, setModeByNode] = useState<Record<string, Mode>>({});
  const mode: Mode = modeByNode[node.id] ?? (node.description ? 'contents' : 'card');
  const setMode = (m: Mode) => setModeByNode((prev) => ({ ...prev, [node.id]: m }));

  const typeCfg = getTypeConfig(node.type as WorkItemType);
  const statusCfg = getStatusConfig(node.status as any);

  return (
    <div
      data-testid={rootTestId}
      style={{ maxHeight }}
      className={`flex flex-col bg-gray-900/95 backdrop-blur-md border border-gray-700/60 rounded-xl shadow-2xl overflow-y-auto ${
        compact ? 'w-full max-h-[60vh]' : 'w-full sm:w-72 max-h-[60vh] sm:max-h-[70vh]'
      }`}
    >
      {/* Header */}
      <div className="shrink-0 flex items-start gap-2 p-3 border-b border-gray-700/60">
        <div className="flex-1 min-w-0">
          <div className="text-xs uppercase tracking-wide" style={{ color: typeCfg.hexColor }}>{typeCfg.label}</div>
          <div className="max-h-24 overflow-y-auto text-base font-semibold text-white [overflow-wrap:anywhere]" tabIndex={0} title={node.title}>{node.title}</div>
          <div className="mt-0.5"><CopyableId id={node.id} /></div>
        </div>
        {onEdit && <button onClick={onEdit} className="min-h-[44px] px-3 rounded-lg text-emerald-300 hover:bg-gray-800">Edit</button>}
        <button onClick={onClose} className="min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-400 hover:text-white rounded hover:bg-gray-700/50" title="Close">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Mode toggle */}
      <InspectorModeTabs key={node.id} mode={mode} onChange={setMode} hasSubgraph={hasSubgraph} />

      {/* Body */}
      <div className="shrink-0">
        {mode === 'card' && (
          <div className="p-3 space-y-3 text-sm">
            <Row label="Type" value={typeCfg.label} color={typeCfg.hexColor} />
            <Row label="Status" value={statusCfg?.label ?? node.status} color={statusCfg?.hexColor} />
            {typeof node.priority === 'number' && <Row label="Priority" value={`${Math.round(node.priority * 100)}%`} />}
            {Array.isArray(node.tags) && node.tags.length > 0 && (
              <div>
                <div className="text-xs text-gray-500 mb-1">Tags</div>
                <div className="flex flex-wrap gap-1">
                  {node.tags.map((t: string) => <span key={t} className="text-xs bg-gray-700/60 text-gray-200 rounded px-1.5 py-0.5">{t}</span>)}
                </div>
              </div>
            )}
            {node.description && (
              <div>
                <div className="text-xs text-gray-500 mb-1">Description (preview)</div>
                <div className="text-xs text-gray-300 line-clamp-3 whitespace-pre-wrap">{node.description}</div>
                <button onClick={() => setMode('contents')} className="text-xs text-blue-400 hover:text-blue-300 mt-1">Read full contents →</button>
              </div>
            )}
          </div>
        )}

        {mode === 'contents' && (
          <div className="p-3">
            <Suspense fallback={<div className="text-sm text-gray-500">Loading…</div>}>
              <NodeContentRenderer content={node.description ?? ''} compact={compact} />
            </Suspense>
          </div>
        )}

        {mode === 'diagram' && (
          hasSubgraph ? (
            <NodeSubgraphPreview
              subgraphId={node.subgraphId}
              subgraphName={node.subgraph?.name}
              onOpen={() => descendInto(node.subgraphId)}
            />
          ) : (
            <div className="p-4 text-sm text-gray-500">This node has no sub-graph diagram.</div>
          )
        )}
      </div>
    </div>
  );
}

function InspectorModeTabs({
  mode,
  onChange,
  hasSubgraph,
}: {
  mode: Mode;
  onChange: (mode: Mode) => void;
  hasSubgraph: boolean;
}) {
  const bar = useRef<HTMLDivElement>(null);
  const hintId = useId();
  const [hovered, setHovered] = useState<Mode | null>(null);
  const [focused, setFocused] = useState<Mode | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [anchor, setAnchor] = useState<{
    left: number;
    top?: number;
    bottom?: number;
  } | null>(null);
  const tooltip = dismissed ? null : (hovered ?? focused);
  const options = [
    { id: 'card', label: 'Card', Icon: CreditCard },
    { id: 'contents', label: 'Contents', Icon: FileText },
    { id: 'diagram', label: 'Diagram', Icon: Network },
  ] as const;
  useLayoutEffect(() => {
    if (!tooltip) {
      setAnchor(null);
      return;
    }
    const button = bar.current?.querySelector(
      `[data-inspector-mode="${tooltip}"]`
    );
    if (!button) return;
    const bounds = button.getBoundingClientRect();
    setAnchor({
      left: Math.max(8, Math.min(window.innerWidth - 232, bounds.left)),
      ...(window.innerHeight - bounds.bottom >= 72
        ? { top: bounds.bottom + 8 }
        : { bottom: window.innerHeight - bounds.top + 8 }),
    });
    const dismiss = () => setDismissed(true);
    const dismissOutside = (event: PointerEvent) => {
      if (!(event.target instanceof Node) || !bar.current?.contains(event.target)) dismiss();
    };
    window.addEventListener('scroll', dismiss, true);
    window.addEventListener('resize', dismiss);
    window.addEventListener('wheel', dismiss, { passive: true, capture: true });
    window.addEventListener('pointerdown', dismissOutside, true);
    return () => {
      window.removeEventListener('scroll', dismiss, true);
      window.removeEventListener('resize', dismiss);
      window.removeEventListener('wheel', dismiss, true);
      window.removeEventListener('pointerdown', dismissOutside, true);
    };
  }, [tooltip]);
  return (
    <>
      <div
        ref={bar}
        role="group"
        aria-label="Inspector views"
        className="shrink-0 flex gap-1 p-2 border-b border-gray-700/60"
      >
        {options.map(({ id, label, Icon }) => {
          const disabled = id === 'diagram' && !hasSubgraph;
          return (
            <button
              key={id}
              type="button"
              data-inspector-mode={id}
              aria-label={label}
              aria-pressed={mode === id}
              aria-disabled={disabled}
              aria-describedby={tooltip === id && anchor ? hintId : undefined}
              onClick={() => {
              if (!disabled) {
                setDismissed(true);
                onChange(id);
              }
              }}
              onMouseEnter={() => {
                setHovered(id);
                setDismissed(false);
              }}
              onMouseLeave={() => setHovered(null)}
              onFocus={() => {
                setFocused(id);
                setHovered(null);
                setDismissed(false);
              }}
              onBlur={() => setFocused(null)}
              onKeyDown={event => {
                if (event.key === 'Escape' && tooltip) {
                  event.stopPropagation();
                  setDismissed(true);
                }
              }}
              className={`flex-1 min-w-11 min-h-11 flex items-center justify-center rounded-lg border transition-colors ${disabled ? 'text-gray-500 border-transparent cursor-not-allowed' : mode === id ? 'bg-emerald-500/25 text-emerald-200 border-emerald-400/40' : 'text-gray-300 hover:bg-gray-700/50 border-transparent'}`}
            >
              <Icon aria-hidden="true" className="h-6 w-6" strokeWidth={2.25} />
            </button>
          );
        })}
      </div>
      {tooltip &&
        anchor &&
        createPortal(
          <span
            id={hintId}
            role="tooltip"
            className="fixed z-[1000000] pointer-events-none w-max max-w-[224px] rounded-lg border border-slate-500 bg-slate-900 px-3 py-2 text-sm font-semibold leading-5 text-slate-100 shadow-lg"
            style={anchor}
          >
            {tooltip === 'diagram' && !hasSubgraph
              ? 'Diagram: No sub-graph'
              : options.find(option => option.id === tooltip)!.label}
          </span>,
          document.body
        )}
    </>
  );
}

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-sm font-medium" style={color ? { color } : undefined}>{value}</span>
    </div>
  );
}
