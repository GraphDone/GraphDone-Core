import { describe, it, expect } from 'vitest';
import {
  isActiveStatus,
  isBlockedStatus,
  isCompletedStatus,
  nodeLifeClasses,
  priorityGlowStep,
  nodeGlowFilter
} from '../nodeAnimations';

describe('status detection across the legacy case variants', () => {
  it('recognizes in-progress/active statuses', () => {
    for (const s of ['IN_PROGRESS', 'In Progress', 'ACTIVE', 'Active']) {
      expect(isActiveStatus(s), s).toBe(true);
    }
    expect(isActiveStatus('COMPLETED')).toBe(false);
    expect(isActiveStatus('PROPOSED')).toBe(false);
  });

  it('recognizes blocked statuses', () => {
    for (const s of ['BLOCKED', 'Blocked']) {
      expect(isBlockedStatus(s), s).toBe(true);
    }
    expect(isBlockedStatus('IN_PROGRESS')).toBe(false);
  });

  it('recognizes the four completed variants used across the codebase', () => {
    for (const s of ['COMPLETED', 'Completed', 'Done', 'DONE']) {
      expect(isCompletedStatus(s), s).toBe(true);
    }
    expect(isCompletedStatus('BLOCKED')).toBe(false);
  });
});

describe('nodeLifeClasses (LIVE-1, LIVE-4)', () => {
  it('marks in-progress nodes as breathing', () => {
    expect(nodeLifeClasses('IN_PROGRESS')).toContain('node-breathing');
  });

  it('marks blocked nodes as stuck', () => {
    expect(nodeLifeClasses('BLOCKED')).toContain('node-stuck');
  });

  it('marks completed nodes as settled', () => {
    expect(nodeLifeClasses('DONE')).toContain('node-settled');
  });

  it('gives neutral statuses no life classes', () => {
    expect(nodeLifeClasses('PROPOSED')).toBe('');
    expect(nodeLifeClasses(undefined)).toBe('');
  });
});

describe('priorityGlowStep (LIVE-5): 4 visually distinct steps', () => {
  it('maps the priority range onto steps 0..3', () => {
    expect(priorityGlowStep(0)).toBe(0);
    expect(priorityGlowStep(0.19)).toBe(0);
    expect(priorityGlowStep(0.2)).toBe(1);
    expect(priorityGlowStep(0.5)).toBe(2);
    expect(priorityGlowStep(0.79)).toBe(2);
    expect(priorityGlowStep(0.8)).toBe(3);
    expect(priorityGlowStep(1)).toBe(3);
  });

  it('clamps out-of-range and missing priorities safely', () => {
    expect(priorityGlowStep(-1)).toBe(0);
    expect(priorityGlowStep(2)).toBe(3);
    expect(priorityGlowStep(undefined)).toBe(0);
    expect(priorityGlowStep(Number.NaN)).toBe(0);
  });
});

describe('nodeGlowFilter (LIVE-5 + ADAPT-3 gating)', () => {
  const baseShadow = 'url(#node-drop-shadow)';

  it('returns only the base shadow when glow is disabled (LOW tier)', () => {
    expect(nodeGlowFilter(0.9, '#4ade80', false)).toBe(baseShadow);
  });

  it('returns only the base shadow at glow step 0', () => {
    expect(nodeGlowFilter(0.1, '#4ade80', true)).toBe(baseShadow);
  });

  it('appends a colored drop-shadow that grows with priority', () => {
    const mid = nodeGlowFilter(0.5, '#4ade80', true);
    const high = nodeGlowFilter(0.9, '#4ade80', true);
    expect(mid).toContain(baseShadow);
    expect(mid).toContain('drop-shadow');
    expect(mid).toContain('#4ade80');
    const radius = (s: string) => Number(/drop-shadow\(0 0 (\d+(?:\.\d+)?)px/.exec(s)?.[1]);
    expect(radius(high)).toBeGreaterThan(radius(mid));
  });
});
