/**
 * Status notes — timestamped, editable free-text updates attached to a work item,
 * stored under its `metadata.statusNotes` (so no schema change beyond the
 * existing metadata JSON field). Pure helpers; the UI + persistence layer call
 * these and write the returned metadata back via updateWorkItems.
 */

export interface StatusNote {
  id: string;
  text: string;
  at: number; // unix ms
}

type Meta = Record<string, any> | string | null | undefined;

function parse(metadata: Meta): Record<string, any> {
  if (!metadata) return {};
  if (typeof metadata === 'string') {
    try { return JSON.parse(metadata) || {}; } catch { return {}; }
  }
  return { ...metadata };
}

export function getStatusNotes(metadata: Meta): StatusNote[] {
  const m = parse(metadata);
  const notes = Array.isArray(m.statusNotes) ? m.statusNotes : [];
  return notes.filter((n: any) => n && typeof n.id === 'string' && typeof n.text === 'string');
}

/** Prepend a new timestamped note (newest first). Blank text is ignored. */
export function addStatusNote(metadata: Meta, text: string, at: number, id: string): Record<string, any> {
  const m = parse(metadata);
  const t = (text || '').trim();
  if (!t) return m;
  const notes = getStatusNotes(m);
  return { ...m, statusNotes: [{ id, text: t, at }, ...notes] };
}

export function editStatusNote(metadata: Meta, id: string, text: string): Record<string, any> {
  const m = parse(metadata);
  const notes = getStatusNotes(m).map((n) => (n.id === id ? { ...n, text: (text || '').trim() } : n));
  return { ...m, statusNotes: notes };
}

export function deleteStatusNote(metadata: Meta, id: string): Record<string, any> {
  const m = parse(metadata);
  const notes = getStatusNotes(m).filter((n) => n.id !== id);
  return { ...m, statusNotes: notes };
}
