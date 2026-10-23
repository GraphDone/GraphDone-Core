import { describe, it, expect } from 'vitest';
import {
  rankTaskAssignments,
  DEFAULT_WEIGHTS,
  type ContributorProfile,
  type OpenTask
} from '../src/services/assignment-synthesis';

// MCP-1 (#28): pure synthesis behind suggest_task_assignment. Ranking is a pure
// function of (open tasks, contributor expertise + availability) so it can be
// asserted deterministically without Neo4j.

const expert = (workType: string, level: 'Expert' | 'Proficient' | 'Beginner', completionRate?: number) => ({
  workType,
  level,
  completionRate
});

describe('rankTaskAssignments (MCP-1 / #28)', () => {
  it('returns one suggestion per open task, preserving identity', () => {
    const tasks: OpenTask[] = [
      { id: 't1', title: 'Fix login bug', type: 'BUG' },
      { id: 't2', title: 'Build dashboard', type: 'FEATURE' }
    ];
    const contributors: ContributorProfile[] = [
      { id: 'c1', name: 'Ada', activeItems: 2, expertise: [expert('BUG', 'Expert')] }
    ];

    const result = rankTaskAssignments(tasks, contributors);

    expect(result).toHaveLength(2);
    expect(result.map(r => r.taskId)).toEqual(['t1', 't2']);
    expect(result[0].taskTitle).toBe('Fix login bug');
    expect(result[0].taskType).toBe('BUG');
  });

  it('ranks the matching expert above a beginner for the same task', () => {
    const tasks: OpenTask[] = [{ id: 't1', title: 'Fix bug', type: 'BUG' }];
    const contributors: ContributorProfile[] = [
      { id: 'beginner', name: 'Bea', activeItems: 0, expertise: [expert('BUG', 'Beginner')] },
      { id: 'expert', name: 'Eli', activeItems: 0, expertise: [expert('BUG', 'Expert')] }
    ];

    const [suggestion] = rankTaskAssignments(tasks, contributors);

    expect(suggestion.bestCandidate?.contributorId).toBe('expert');
    expect(suggestion.bestCandidate?.matchedLevel).toBe('Expert');
    expect(suggestion.candidates[0].score).toBeGreaterThan(suggestion.candidates[1].score);
  });

  it('penalizes overloaded contributors so a free proficient can win over a busy expert', () => {
    const tasks: OpenTask[] = [{ id: 't1', title: 'Ship feature', type: 'FEATURE' }];
    const contributors: ContributorProfile[] = [
      {
        id: 'busy-expert',
        name: 'Max',
        activeItems: 20,
        capacityStatus: 'overloaded',
        expertise: [expert('FEATURE', 'Expert')]
      },
      {
        id: 'free-proficient',
        name: 'Nia',
        activeItems: 0,
        capacityStatus: 'available',
        expertise: [expert('FEATURE', 'Proficient')]
      }
    ];

    const [suggestion] = rankTaskAssignments(tasks, contributors, {
      weights: { expertiseWeight: 0.5, availabilityWeight: 0.5 }
    });

    expect(suggestion.bestCandidate?.contributorId).toBe('free-proficient');
    const overloaded = suggestion.candidates.find(c => c.contributorId === 'busy-expert');
    expect(overloaded?.availabilityScore).toBe(0);
  });

  it('gives a contributor with no matching expertise an expertise score of zero', () => {
    const tasks: OpenTask[] = [{ id: 't1', title: 'Design API', type: 'STORY' }];
    const contributors: ContributorProfile[] = [
      { id: 'c1', name: 'Sam', activeItems: 1, expertise: [expert('BUG', 'Expert')] }
    ];

    const [suggestion] = rankTaskAssignments(tasks, contributors);

    expect(suggestion.candidates[0].expertiseScore).toBe(0);
    expect(suggestion.candidates[0].matchedLevel).toBeNull();
  });

  it('honors maxCandidatesPerTask', () => {
    const tasks: OpenTask[] = [{ id: 't1', title: 'Task', type: 'TASK' }];
    const contributors: ContributorProfile[] = Array.from({ length: 5 }, (_, i) => ({
      id: `c${i}`,
      name: `Person ${i}`,
      activeItems: i,
      expertise: [expert('TASK', 'Proficient')]
    }));

    const [suggestion] = rankTaskAssignments(tasks, contributors, { maxCandidatesPerTask: 2 });

    expect(suggestion.candidates).toHaveLength(2);
  });

  it('produces a null bestCandidate and empty candidates when no contributors exist', () => {
    const tasks: OpenTask[] = [{ id: 't1', title: 'Orphan task', type: 'TASK' }];

    const [suggestion] = rankTaskAssignments(tasks, []);

    expect(suggestion.bestCandidate).toBeNull();
    expect(suggestion.candidates).toEqual([]);
  });

  it('returns no suggestions for an empty task list', () => {
    const contributors: ContributorProfile[] = [
      { id: 'c1', name: 'Ada', activeItems: 0, expertise: [expert('BUG', 'Expert')] }
    ];

    expect(rankTaskAssignments([], contributors)).toEqual([]);
  });

  it('keeps all component scores within the normalized 0..1 range', () => {
    const tasks: OpenTask[] = [{ id: 't1', title: 'Task', type: 'BUG' }];
    const contributors: ContributorProfile[] = [
      { id: 'c1', name: 'Over', activeItems: 999, expertise: [expert('BUG', 'Expert', 1)] },
      { id: 'c2', name: 'Neg', activeItems: -5, expertise: [expert('BUG', 'Expert', 5)] }
    ];

    const [suggestion] = rankTaskAssignments(tasks, contributors);

    for (const candidate of suggestion.candidates) {
      expect(candidate.score).toBeGreaterThanOrEqual(0);
      expect(candidate.score).toBeLessThanOrEqual(1);
      expect(candidate.expertiseScore).toBeGreaterThanOrEqual(0);
      expect(candidate.expertiseScore).toBeLessThanOrEqual(1);
      expect(candidate.availabilityScore).toBeGreaterThanOrEqual(0);
      expect(candidate.availabilityScore).toBeLessThanOrEqual(1);
    }
  });

  it('breaks ties deterministically by contributor id', () => {
    const tasks: OpenTask[] = [{ id: 't1', title: 'Task', type: 'TASK' }];
    const contributors: ContributorProfile[] = [
      { id: 'zeb', name: 'Zeb', activeItems: 3, expertise: [expert('TASK', 'Expert')] },
      { id: 'abe', name: 'Abe', activeItems: 3, expertise: [expert('TASK', 'Expert')] }
    ];

    const [suggestion] = rankTaskAssignments(tasks, contributors);

    expect(suggestion.candidates[0].contributorId).toBe('abe');
    expect(suggestion.candidates[0].score).toBe(suggestion.candidates[1].score);
  });

  it('normalizes weights so equal raw weights split influence evenly', () => {
    expect(DEFAULT_WEIGHTS.expertiseWeight + DEFAULT_WEIGHTS.availabilityWeight).toBeCloseTo(1);

    const tasks: OpenTask[] = [{ id: 't1', title: 'Task', type: 'BUG' }];
    const contributors: ContributorProfile[] = [
      { id: 'c1', name: 'Ada', activeItems: 0, expertise: [expert('BUG', 'Expert')] }
    ];

    const [suggestion] = rankTaskAssignments(tasks, contributors, {
      weights: { expertiseWeight: 10, availabilityWeight: 10 }
    });

    expect(suggestion.candidates[0].score).toBeCloseTo(1);
  });
});
