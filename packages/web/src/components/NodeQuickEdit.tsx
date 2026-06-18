import { useState } from 'react';
import { X } from 'lucide-react';
import {
  getTypeConfig, getStatusConfig, TYPE_OPTIONS, STATUS_OPTIONS,
  type WorkItemType, type WorkItemStatus,
} from '../constants/workItemConstants';

export interface QuickEditCommit {
  update: Record<string, any>;
  prev: Record<string, any>;
  label: string;
}

interface NodeQuickEditProps {
  node: any;
  /** Persist one field change (optimistic); parent wires the mutation + undo. */
  onCommit: (c: QuickEditCommit) => void;
  onClose: () => void;
  rootTestId?: string;
}

const TYPES = TYPE_OPTIONS.filter((t) => t.value !== 'all');
const STATUSES = STATUS_OPTIONS.filter((s) => s.value !== 'all');

/**
 * Quick in-context node editor (PR #87): a compact popover anchored to a node on
 * the canvas that edits every field — title, description, type, priority,
 * status — without opening the heavy details modal. Each field saves immediately
 * (optimistic) via onCommit, which the parent turns into an updateWorkItems
 * mutation + an undo entry. Positioning is handled by the parent (like the inline
 * rename box).
 */
export function NodeQuickEdit({ node, onCommit, onClose, rootTestId = 'node-quick-edit' }: NodeQuickEditProps) {
  const [title, setTitle] = useState<string>(node.title || '');
  const [description, setDescription] = useState<string>(node.description || '');
  const [priority, setPriority] = useState<number>(Math.round(((node.priority ?? 0) as number) * 100));

  const typeCfg = getTypeConfig(node.type as WorkItemType);

  const commitTitle = () => {
    const t = title.trim();
    if (t && t !== (node.title || '')) onCommit({ update: { title: t }, prev: { title: node.title || '' }, label: 'Edit title' });
  };
  const commitDescription = () => {
    if (description !== (node.description || '')) onCommit({ update: { description }, prev: { description: node.description || '' }, label: 'Edit description' });
  };
  const commitPriority = () => {
    const p = priority / 100;
    if (Math.abs(p - (node.priority ?? 0)) > 0.001) onCommit({ update: { priority: p }, prev: { priority: node.priority ?? 0 }, label: 'Edit priority' });
  };
  const commitType = (value: string) => {
    if (value !== node.type) onCommit({ update: { type: value }, prev: { type: node.type }, label: 'Change type' });
  };
  const commitStatus = (value: string) => {
    if (value !== node.status) onCommit({ update: { status: value }, prev: { status: node.status }, label: 'Change status' });
  };

  return (
    <div
      data-testid={rootTestId}
      className="w-72 bg-gray-900/95 backdrop-blur-md border border-gray-700/60 rounded-xl shadow-2xl overflow-hidden text-sm"
      onPointerDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-700/60">
        <span className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: typeCfg.hexColor }}>{typeCfg.label}</span>
        <span className="text-[10px] text-gray-500">Quick edit</span>
        <button onClick={onClose} className="ml-auto p-1 text-gray-400 hover:text-white rounded hover:bg-gray-700/50" title="Close" aria-label="Close quick edit">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="p-3 space-y-3 max-h-[60vh] overflow-y-auto">
        {/* Title */}
        <label className="block">
          <span className="block text-[11px] text-gray-500 mb-1">Title</span>
          <input
            data-testid="quick-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commitTitle(); } }}
            className="w-full px-2 py-1.5 rounded-lg bg-gray-800 border border-gray-700 text-white outline-none focus:border-emerald-400"
          />
        </label>

        {/* Description */}
        <label className="block">
          <span className="block text-[11px] text-gray-500 mb-1">Description</span>
          <textarea
            data-testid="quick-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={commitDescription}
            rows={3}
            className="w-full px-2 py-1.5 rounded-lg bg-gray-800 border border-gray-700 text-gray-200 outline-none focus:border-emerald-400 resize-y"
          />
        </label>

        {/* Type */}
        <div>
          <span className="block text-[11px] text-gray-500 mb-1">Type</span>
          <div className="flex flex-wrap gap-1" data-testid="quick-type">
            {TYPES.map((t) => {
              const active = t.value === node.type;
              return (
                <button
                  key={t.value}
                  onClick={() => commitType(t.value)}
                  className={`px-2 py-0.5 rounded-full text-[11px] border transition-colors ${active ? 'text-white' : 'text-gray-300 hover:text-white border-gray-700 hover:border-gray-500'}`}
                  style={active ? { backgroundColor: `${t.hexColor}33`, borderColor: t.hexColor, color: t.hexColor } : undefined}
                  title={t.label}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Priority */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] text-gray-500">Priority</span>
            <span className="text-[11px] font-semibold text-gray-300" data-testid="quick-priority-value">{priority}%</span>
          </div>
          <input
            type="range" min={0} max={100} step={5}
            value={priority}
            data-testid="quick-priority"
            onChange={(e) => setPriority(Number(e.target.value))}
            onMouseUp={commitPriority}
            onTouchEnd={commitPriority}
            onKeyUp={commitPriority}
            className="w-full accent-emerald-400"
          />
        </div>

        {/* Status */}
        <div>
          <span className="block text-[11px] text-gray-500 mb-1">Status</span>
          <div className="flex flex-wrap gap-1" data-testid="quick-status">
            {STATUSES.map((s) => {
              const active = s.value === node.status;
              const cfg = getStatusConfig(s.value as WorkItemStatus);
              return (
                <button
                  key={s.value}
                  onClick={() => commitStatus(s.value)}
                  className={`px-2 py-0.5 rounded-full text-[11px] border transition-colors ${active ? '' : 'text-gray-300 hover:text-white border-gray-700 hover:border-gray-500'}`}
                  style={active ? { backgroundColor: `${cfg.hexColor}33`, borderColor: cfg.hexColor, color: cfg.hexColor } : undefined}
                  title={s.label}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
