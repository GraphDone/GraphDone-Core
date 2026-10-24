import { getStatusNotes } from './statusNotes';

export interface ActivityWorkItem {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  metadata?: string | Record<string, unknown> | null;
}

export interface RecordedActivity {
  id: string;
  kind: 'created' | 'updated' | 'note';
  at: number;
  itemId: string;
  itemTitle: string;
  status: string;
  text: string;
}

/** Only timestamps and notes we actually store. updatedAt does not identify
 * the changed field or actor, and editable notes are not an audit log. */
export function recordedActivity(items: ActivityWorkItem[]): RecordedActivity[] {
  const result: RecordedActivity[] = [];
  for (const item of items) {
    const base = { itemId: item.id, itemTitle: item.title, status: item.status };
    const created = Date.parse(item.createdAt);
    const updated = Date.parse(item.updatedAt);
    if (Number.isFinite(created)) result.push({ ...base, id: `${item.id}:created`, kind: 'created', at: created, text: 'Work item created' });
    if (Number.isFinite(updated) && updated > created) result.push({ ...base, id: `${item.id}:updated`, kind: 'updated', at: updated, text: 'Latest saved update' });
    for (const note of getStatusNotes(item.metadata)) {
      if (typeof note.at === 'number' && Number.isFinite(note.at) && note.text.trim()) {
        result.push({ ...base, id: `${item.id}:note:${note.id}`, kind: 'note', at: note.at, text: note.text });
      }
    }
  }
  return result.sort((a, b) => b.at - a.at || a.id.localeCompare(b.id));
}
