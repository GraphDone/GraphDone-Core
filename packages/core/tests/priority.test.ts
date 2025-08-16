import { describe, it, expect, beforeEach } from 'vitest';
import { PriorityCalculator } from '../src/priority';

describe('PriorityCalculator', () => {
  let calculator: PriorityCalculator;

  beforeEach(() => {
    calculator = new PriorityCalculator();
  });

  describe('calculate', () => {
    it('should calculate weighted priority correctly', () => {
      const priority = calculator.calculate({
        executive: 0.8,
        individual: 0.6,
        community: 0.4
      });

      expect(priority.computed).toBeCloseTo(0.62);
      expect(priority.executive).toBe(0.8);
      expect(priority.individual).toBe(0.6);
      expect(priority.community).toBe(0.4);
    });

    it('should normalize computed value between 0 and 1', () => {
      const priority = calculator.calculate({
        executive: 2,
        individual: 2,
        community: 2
      });

      expect(priority.computed).toBe(1);
    });

    it('should handle zero priorities', () => {
      const priority = calculator.calculate({
        executive: 0,
        individual: 0,
        community: 0
      });

      expect(priority.computed).toBe(0);
    });
  });

  describe('calculateRadiusFromPriority', () => {
    it('should calculate correct radius for high priority', () => {
      const radius = calculator.calculateRadiusFromPriority(0.9);
      expect(radius).toBeCloseTo(0.1);
    });

    it('should calculate correct radius for low priority', () => {
      const radius = calculator.calculateRadiusFromPriority(0.1);
      expect(radius).toBeCloseTo(0.9);
    });

    it('should return 0 radius for priority 1', () => {
      const radius = calculator.calculateRadiusFromPriority(1);
      expect(radius).toBe(0);
    });
  });

  describe('migratePriority', () => {
    it('should boost community priority', () => {
      const current = {
        executive: 0.5,
        individual: 0.5,
        community: 0.3,
        computed: 0.44
      };

      const migrated = calculator.migratePriority(current, 0.2, 1);
      
      expect(migrated.community).toBeCloseTo(0.5);
      expect(migrated.executive).toBe(0.5);
      expect(migrated.individual).toBe(0.5);
      expect(migrated.computed).toBeGreaterThan(current.computed);
    });

    it('should apply time factor to boost', () => {
      const current = {
        executive: 0.5,
        individual: 0.5,
        community: 0.3,
        computed: 0.44
      };

      const migrated = calculator.migratePriority(current, 0.2, 0.5);
      
      expect(migrated.community).toBeCloseTo(0.4);
    });

    it('should not exceed maximum community value', () => {
      const current = {
        executive: 0.5,
        individual: 0.5,
        community: 0.9,
        computed: 0.64
      };

      const migrated = calculator.migratePriority(current, 0.5, 1);
      
      expect(migrated.community).toBe(1);
    });
  });
});