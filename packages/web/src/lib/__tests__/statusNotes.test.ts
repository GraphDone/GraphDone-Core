import { describe, it, expect } from 'vitest';
import {
  getStatusNotes, addStatusNote, editStatusNote, deleteStatusNote, type StatusNote,
} from '../statusNotes';

describe('statusNotes', () => {
  it('returns [] for null / undefined / empty metadata', () => {
    expect(getStatusNotes(null)).toEqual([]);
    expect(getStatusNotes(undefined)).toEqual([]);
    expect(getStatusNotes({})).toEqual([]);
  });

  it('parses metadata whether it is an object or a JSON string', () => {
    const obj = { statusNotes: [{ id: 'a', text: 'hi', at: 1000 }] };
    expect(getStatusNotes(obj)).toHaveLength(1);
    expect(getStatusNotes(JSON.stringify(obj))).toHaveLength(1);
  });

  it('addStatusNote prepends a timestamped note and preserves other metadata', () => {
    const md = { tags: ['x'] };
    const next = addStatusNote(md, 'started work', 1700, 'n1');
    const notes = getStatusNotes(next);
    expect(notes[0]).toEqual<StatusNote>({ id: 'n1', text: 'started work', at: 1700 });
    expect((next as any).tags).toEqual(['x']); // untouched
  });

  it('addStatusNote ignores blank text', () => {
    const next = addStatusNote({}, '   ', 1, 'n');
    expect(getStatusNotes(next)).toEqual([]);
  });

  it('newest note is first after multiple adds', () => {
    let md: any = {};
    md = addStatusNote(md, 'one', 1, 'a');
    md = addStatusNote(md, 'two', 2, 'b');
    expect(getStatusNotes(md).map((n) => n.id)).toEqual(['b', 'a']);
  });

  it('editStatusNote updates only the matching note text', () => {
    let md: any = addStatusNote({}, 'typo', 1, 'a');
    md = addStatusNote(md, 'keep', 2, 'b');
    md = editStatusNote(md, 'a', 'fixed');
    const byId = Object.fromEntries(getStatusNotes(md).map((n) => [n.id, n.text]));
    expect(byId).toEqual({ a: 'fixed', b: 'keep' });
  });

  it('deleteStatusNote removes the matching note', () => {
    let md: any = addStatusNote({}, 'a', 1, 'a');
    md = addStatusNote(md, 'b', 2, 'b');
    md = deleteStatusNote(md, 'a');
    expect(getStatusNotes(md).map((n) => n.id)).toEqual(['b']);
  });
});
