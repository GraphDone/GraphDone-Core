import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { isGraphServiceAvailable, type HealthStatus, useHealthStatus } from './useHealthStatus';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

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

describe('useHealthStatus', () => {
  it('checks the configured API origin when the web app and API use different origins', async () => {
    vi.stubEnv('VITE_API_URL', 'http://127.0.0.1:8798/');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => health('available'),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { unmount } = renderHook(() => useHealthStatus());
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('http://127.0.0.1:8798/health'));
    unmount();
  });
});
