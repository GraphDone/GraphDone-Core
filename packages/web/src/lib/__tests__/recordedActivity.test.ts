import { describe, expect, it } from 'vitest';
import { recordedActivity } from '../recordedActivity';

const item = { id: 'work', title: 'Ship it', status: 'COMPLETED', createdAt: '2026-09-01T00:00:00Z', updatedAt: '2026-09-02T00:00:00Z' };
describe('recorded activity', () => {
  it('does not invent completion, assignment, or priority events from a snapshot', () => {
    expect(recordedActivity([item]).map(e => e.kind)).toEqual(['updated', 'created']);
    expect(recordedActivity([item])).toEqual(recordedActivity([item]));
  });
  it('includes persisted notes without assuming an author and sorts by recorded time', () => {
    const events = recordedActivity([{ ...item, metadata: JSON.stringify({ statusNotes: [{ id: 'n1', text: 'Tests passed; ready for review.', at: Date.parse('2026-09-03') }] }) }]);
    expect(events[0]).toMatchObject({ kind: 'note', text: 'Tests passed; ready for review.', itemId: 'work' });
    expect(events[0]).not.toHaveProperty('user');
  });
  it('ignores malformed dates, notes and metadata and does not duplicate creation', () => {
    expect(recordedActivity([{ ...item, updatedAt: item.createdAt, metadata: '{broken' }])).toHaveLength(1);
    expect(recordedActivity([{ ...item, createdAt: 'invalid', updatedAt: 'invalid', metadata: { statusNotes: [{ id: 'n', text: 'oops' }] } }])).toEqual([]);
  });
});
