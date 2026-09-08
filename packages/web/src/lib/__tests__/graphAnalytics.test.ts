import { describe, expect, it } from 'vitest';
import { summarizeGraph, type AnalyticsItem } from '../graphAnalytics';

const item = (id: string, status: string, priority = 0.5): AnalyticsItem => ({
  id,
  title: id,
  status,
  priority,
  type: 'TASK',
  updatedAt: '2026-09-01T12:00:00Z',
});

describe('live graph analytics', () => {
  it('handles an empty graph without invented progress or NaN', () => {
    expect(summarizeGraph([])).toMatchObject({
      total: 0,
      completed: 0,
      completion: 0,
      averagePriority: 0,
      contributors: [],
    });
  });
  it('counts real statuses and ranks unfinished work before completed work', () => {
    const summary = summarizeGraph([
      item('done', 'COMPLETED', 1),
      item('next', 'PLANNED', 0.9),
      item('blocked', 'BLOCKED', 0.6),
    ]);
    expect(summary).toMatchObject({
      total: 3,
      completed: 1,
      blocked: 1,
      completion: 1 / 3,
    });
    expect(summary.priorities.map(i => i.id)).toEqual(['next', 'blocked']);
  });
  it('deduplicates contributors per item and uses IDs rather than names', () => {
    const a = { id: 'a', name: 'Alex', type: 'HUMAN' };
    const b = { id: 'b', name: 'Alex', type: 'AGENT' };
    const summary = summarizeGraph([
      { ...item('one', 'IN_PROGRESS'), contributors: [a, a, b] },
      { ...item('two', 'COMPLETED'), contributors: [a] },
    ]);
    expect(summary.contributors.map(c => [c.id, c.items])).toEqual([
      ['a', 2],
      ['b', 1],
    ]);
  });
  it('bounds malformed priorities and excludes cancelled work from next actions', () => {
    const summary = summarizeGraph([
      item('bad', 'ACTIVE', NaN),
      item('high', 'ACTIVE', 9),
      item('cancelled', 'CANCELLED'),
    ]);
    expect(Number.isFinite(summary.averagePriority)).toBe(true);
    expect(summary.priorities.map(i => i.id)).toEqual(['high', 'bad']);
  });
});
