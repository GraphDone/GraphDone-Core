import { useState } from 'react';
import { X, Trash2 } from 'lucide-react';
import {
  getTypeConfig, getStatusConfig, TYPE_OPTIONS, STATUS_OPTIONS,
  type WorkItemType, type WorkItemStatus,
} from '../constants/workItemConstants';
import { getStatusNotes, addStatusNote, editStatusNote, deleteStatusNote } from '../lib/statusNotes';

function noteId(): string {
  try { return crypto.randomUUID(); } catch { return `n-${Date.now()}-${Math.round(Math.random() * 1e6)}`; }
}
function fmtTime(at: number): string {
  try { return new Date(at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch { return ''; }
}

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
  // Status notes live in metadata.statusNotes. Keep a local copy so the list
  // stays correct within the session regardless of prop-refresh timing.
  const [meta, setMeta] = useState<any>(node.metadata ?? {});
  const [noteText, setNoteText] = useState('');
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const notes = getStatusNotes(meta);

  const commitMeta = (next: Record<string, any>) => {
    // metadata is a String field (JSON-as-string) in the schema — serialize on
    // write; reads parse it back via getStatusNotes.
    const prevStr = typeof meta === 'string' ? meta : JSON.stringify(meta ?? {});
    setMeta(next);
    onCommit({ update: { metadata: JSON.stringify(next) }, prev: { metadata: prevStr }, label: 'Status note' });
  };
  const addNote = () => {
    const t = noteText.trim();
    if (!t) return;
    commitMeta(addStatusNote(meta, t, Date.now(), noteId()));
    setNoteText('');
  };

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

        {/* Status notes — timestamped, editable updates (like comments) */}
        <div data-testid="quick-status-notes">
          <span className="block text-[11px] text-gray-500 mb-1">Status notes</span>
          <div className="flex gap-1">
            <input
              data-testid="quick-note-input"
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addNote(); } }}
              placeholder="Add a status update…"
              className="flex-1 min-w-0 px-2 py-1.5 rounded-lg bg-gray-800 border border-gray-700 text-gray-200 outline-none focus:border-emerald-400"
            />
            <button
              data-testid="quick-note-add"
              onClick={addNote}
              disabled={!noteText.trim()}
              className="px-2 py-1.5 rounded-lg bg-emerald-600/80 hover:bg-emerald-500 text-white text-[11px] font-medium disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Add
            </button>
          </div>
          {notes.length > 0 && (
            <ul className="mt-2 space-y-1.5" data-testid="quick-note-list">
              {notes.map((n) => (
                <li key={n.id} className="group rounded-lg bg-gray-800/60 border border-gray-700/60 px-2 py-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-500">{fmtTime(n.at)}</span>
                    <button
                      onClick={() => commitMeta(deleteStatusNote(meta, n.id))}
                      className="ml-auto p-0.5 text-gray-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Delete note" aria-label="Delete note"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                  {editingNote === n.id ? (
                    <input
                      autoFocus
                      defaultValue={n.text}
                      onBlur={(e) => { commitMeta(editStatusNote(meta, n.id, e.target.value)); setEditingNote(null); }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') { commitMeta(editStatusNote(meta, n.id, (e.target as HTMLInputElement).value)); setEditingNote(null); }
                        if (e.key === 'Escape') setEditingNote(null);
                      }}
                      className="mt-1 w-full px-1.5 py-1 rounded bg-gray-900 border border-emerald-400 text-gray-100 text-[12px] outline-none"
                    />
                  ) : (
                    <div className="text-[12px] text-gray-200 whitespace-pre-wrap cursor-text" onClick={() => setEditingNote(n.id)} title="Click to edit">
                      {n.text}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
