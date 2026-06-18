import { describe, it, expect } from 'vitest';
import {
  groupSatisfyingTasks,
  SATISFIES_EDGE_TYPE,
  type CoverageEdge,
  type CoverageWorkItem
} from '../requirementsCoverage';

const req = (id: string, title = id): CoverageWorkItem => ({ id, title, type: 'REQUIREMENT' });
const task = (id: string, title = id, status = 'IN_PROGRESS'): CoverageWorkItem => ({
  id,
  title,
  type: 'TASK',
  status
});
const satisfies = (eid: string, taskId: string, reqId: string): CoverageEdge => ({
  id: eid,
  type: SATISFIES_EDGE_TYPE,
  source: { id: taskId, title: taskId, type: 'TASK' },
  target: { id: reqId, title: reqId, type: 'REQUIREMENT' }
});

describe('groupSatisfyingTasks (ONTOLOGY-2): requirements coverage grouping', () => {
  it('groups satisfying tasks under each requirement (source task -> target requirement)', () => {
    const requirements = [req('r1'), req('r2')];
    const tasks = [task('t1'), task('t2'), task('t3')];
    const edges = [
      satisfies('e1', 't1', 'r1'),
      satisfies('e2', 't2', 'r1'),
      satisfies('e3', 't3', 'r2')
    ];

    const result = groupSatisfyingTasks(requirements, tasks, edges);

    expect(result).toHaveLength(2);
    expect(result[0].requirement.id).toBe('r1');
    expect(result[0].count).toBe(2);
    expect(result[0].satisfyingTasks.map((t) => t.id).sort()).toEqual(['t1', 't2']);
    expect(result[1].requirement.id).toBe('r2');
    expect(result[1].count).toBe(1);
    expect(result[1].satisfyingTasks[0].id).toBe('t3');
  });

  it('resolves full task records (status included) from the tasks list', () => {
    const requirements = [req('r1')];
    const tasks = [task('t1', 'Build login', 'COMPLETED')];
    const edges = [satisfies('e1', 't1', 'r1')];

    const result = groupSatisfyingTasks(requirements, tasks, edges);

    expect(result[0].satisfyingTasks[0].status).toBe('COMPLETED');
    expect(result[0].satisfyingTasks[0].title).toBe('Build login');
  });

  it('falls back to the edge source when the task is not in the tasks list', () => {
    const requirements = [req('r1')];
    const edges = [satisfies('e1', 'tX', 'r1')];

    const result = groupSatisfyingTasks(requirements, [], edges);

    expect(result[0].count).toBe(1);
    expect(result[0].satisfyingTasks[0].id).toBe('tX');
    expect(result[0].satisfyingTasks[0].title).toBe('tX');
  });

  it('reports zero coverage for requirements with no satisfying tasks', () => {
    const requirements = [req('r1'), req('r2')];
    const edges = [satisfies('e1', 't1', 'r1')];

    const result = groupSatisfyingTasks(requirements, [task('t1')], edges);

    expect(result[1].count).toBe(0);
    expect(result[1].satisfyingTasks).toEqual([]);
  });

  it('ignores non-SATISFIES edges and edges pointing at other targets', () => {
    const requirements = [req('r1')];
    const tasks = [task('t1'), task('t2')];
    const edges: CoverageEdge[] = [
      { id: 'e1', type: 'DEPENDS_ON', source: { id: 't1' }, target: { id: 'r1' } },
      satisfies('e2', 't2', 'r-other')
    ];

    const result = groupSatisfyingTasks(requirements, tasks, edges);

    expect(result[0].count).toBe(0);
  });

  it('dedupes a task that satisfies the same requirement via multiple edges', () => {
    const requirements = [req('r1')];
    const tasks = [task('t1')];
    const edges = [satisfies('e1', 't1', 'r1'), satisfies('e2', 't1', 'r1')];

    const result = groupSatisfyingTasks(requirements, tasks, edges);

    expect(result[0].count).toBe(1);
    expect(result[0].satisfyingTasks.map((t) => t.id)).toEqual(['t1']);
  });

  it('accepts string endpoints on edges', () => {
    const requirements = [req('r1')];
    const tasks = [task('t1')];
    const edges: CoverageEdge[] = [
      { id: 'e1', type: SATISFIES_EDGE_TYPE, source: 't1', target: 'r1' }
    ];

    const result = groupSatisfyingTasks(requirements, tasks, edges);

    expect(result[0].count).toBe(1);
    expect(result[0].satisfyingTasks[0].id).toBe('t1');
  });

  it('preserves the requirement input order', () => {
    const requirements = [req('rB'), req('rA'), req('rC')];
    const result = groupSatisfyingTasks(requirements, [], []);
    expect(result.map((r) => r.requirement.id)).toEqual(['rB', 'rA', 'rC']);
  });

  it('returns an empty array when there are no requirements', () => {
    expect(groupSatisfyingTasks([], [task('t1')], [])).toEqual([]);
  });
});
