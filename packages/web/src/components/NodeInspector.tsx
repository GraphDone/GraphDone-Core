import { lazy, Suspense, useState } from 'react';
import { X, FileText, Network, CreditCard } from 'lucide-react';
import { useGraph } from '../contexts/GraphContext';
import { getTypeConfig, getStatusConfig } from '../constants/workItemConstants';
import type { WorkItemType } from '../constants/workItemConstants';
import { NodeSubgraphPreview } from './NodeSubgraphPreview';

// Heavy (markdown + Prism) — lazy so it's out of the main bundle until a node's
// contents are first opened.
const NodeContentRenderer = lazy(() => import('./NodeContentRenderer'));

type Mode = 'card' | 'contents' | 'diagram';

interface NodeInspectorProps {
  node: any;
  onClose: () => void;
}

/**
 * Docked inspector: shows the selected node's Card (summary), Contents (its
 * description rendered as readable markdown/code), or Diagram (its sub-graph),
 * each at full legible size regardless of canvas zoom. The mode is an explicit,
 * per-node toggle — not a side effect of zooming in.
 */
export function NodeInspector({ node, onClose }: NodeInspectorProps) {
  const { descendInto } = useGraph();
  const hasSubgraph = !!node?.subgraphId;
  const [modeByNode, setModeByNode] = useState<Record<string, Mode>>({});
  const mode: Mode = modeByNode[node.id] ?? (node.description ? 'contents' : 'card');
  const setMode = (m: Mode) => setModeByNode((prev) => ({ ...prev, [node.id]: m }));

  const typeCfg = getTypeConfig(node.type as WorkItemType);
  const statusCfg = getStatusConfig(node.status as any);

  return (
    <div
      data-testid="node-inspector"
      className="h-full flex flex-col bg-gray-900/95 backdrop-blur-sm border-l border-gray-700/60 w-full"
    >
      {/* Header */}
      <div className="flex items-start gap-2 p-3 border-b border-gray-700/60">
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-wide" style={{ color: typeCfg.hexColor }}>{typeCfg.label}</div>
          <div className="text-sm font-semibold text-white truncate" title={node.title}>{node.title}</div>
        </div>
        <button onClick={onClose} className="p-1 text-gray-400 hover:text-white rounded hover:bg-gray-700/50" title="Close">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Mode toggle */}
      <div className="flex gap-1 p-2 border-b border-gray-700/60">
        <ModeBtn active={mode === 'card'} onClick={() => setMode('card')} icon={<CreditCard className="h-3.5 w-3.5" />} label="Card" />
        <ModeBtn active={mode === 'contents'} onClick={() => setMode('contents')} icon={<FileText className="h-3.5 w-3.5" />} label="Contents" />
        <ModeBtn active={mode === 'diagram'} onClick={() => setMode('diagram')} icon={<Network className="h-3.5 w-3.5" />} label="Diagram" disabled={!hasSubgraph} title={hasSubgraph ? 'Sub-graph' : 'No sub-graph'} />
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        {mode === 'card' && (
          <div className="p-3 space-y-3 text-sm">
            <Row label="Type" value={typeCfg.label} color={typeCfg.hexColor} />
            <Row label="Status" value={statusCfg?.label ?? node.status} color={statusCfg?.hexColor} />
            {typeof node.priority === 'number' && <Row label="Priority" value={`${Math.round(node.priority * 100)}%`} />}
            {Array.isArray(node.tags) && node.tags.length > 0 && (
              <div>
                <div className="text-xs text-gray-500 mb-1">Tags</div>
                <div className="flex flex-wrap gap-1">
                  {node.tags.map((t: string) => <span key={t} className="text-[11px] bg-gray-700/60 text-gray-200 rounded px-1.5 py-0.5">{t}</span>)}
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
              <NodeContentRenderer content={node.description ?? ''} />
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

function ModeBtn({ active, onClick, icon, label, disabled, title }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; disabled?: boolean; title?: string }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${
        disabled
          ? 'text-gray-600 cursor-not-allowed'
          : active
            ? 'bg-emerald-500/25 text-emerald-200 border border-emerald-400/40'
            : 'text-gray-300 hover:bg-gray-700/50 border border-transparent'
      }`}
    >
      {icon}
      {label}
    </button>
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
