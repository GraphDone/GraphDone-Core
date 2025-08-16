import { Priority } from './types';

export class PriorityCalculator {
  private readonly executiveWeight = 0.4;
  private readonly individualWeight = 0.3;
  private readonly communityWeight = 0.3;

  calculate(priority: Omit<Priority, 'computed'>): Priority {
    const computed = this.normalizeValue(
      priority.executive * this.executiveWeight +
      priority.individual * this.individualWeight +
      priority.community * this.communityWeight
    );

    return {
      ...priority,
      computed
    };
  }

  private normalizeValue(value: number): number {
    return Math.max(0, Math.min(1, value));
  }

  calculateRadiusFromPriority(priority: number): number {
    return 1 - priority;
  }

  migratePriority(
    current: Priority,
    communityBoost: number,
    timeFactor: number = 1
  ): Priority {
    const newCommunity = this.normalizeValue(
      current.community + (communityBoost * timeFactor)
    );

    return this.calculate({
      executive: current.executive,
      individual: current.individual,
      community: newCommunity
    });
  }
}