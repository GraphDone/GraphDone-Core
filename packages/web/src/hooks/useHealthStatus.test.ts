import { describe, expect, it } from 'vitest';
import { isGraphServiceAvailable, type HealthStatus } from './useHealthStatus';

const health = (status: string): HealthStatus => ({
  status: 'healthy',
  check: 'worker-liveness',
  db: 'not_probed',
  services: { graphql: { status } },
});

describe('isGraphServiceAvailable', () => {
  it('accepts a verified service and a zero-read route liveness result', () => {
    expect(isGraphServiceAvailable(health('healthy'))).toBe(true);
    expect(isGraphServiceAvailable(health('available'))).toBe(true);
  });

  it('does not present an unknown, unhealthy, or absent service as online', () => {
    expect(isGraphServiceAvailable(health('not_probed'))).toBe(false);
    expect(isGraphServiceAvailable(health('unhealthy'))).toBe(false);
    expect(isGraphServiceAvailable(null)).toBe(false);
  });
});
