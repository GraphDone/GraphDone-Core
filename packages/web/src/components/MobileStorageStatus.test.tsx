import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MobileStorageStatus } from './MobileStorageStatus';

const fixture = vi.hoisted(() => ({
  guest: true,
  usage: null as null | { status: string },
  state: {
    ready: true,
    online: true,
    pending: 1,
    conflicts: [] as unknown[],
    error: '',
  },
}));

vi.mock('../lib/offline/engine', () => ({
  offlineEnabled: true,
  localGuest: () => fixture.guest,
  useOffline: () => fixture.state,
}));
vi.mock('../lib/hostedUsage', () => ({
  hostedUsageEnabled: true,
  useHostedUsage: () => ({ usage: fixture.usage, error: '' }),
}));

beforeEach(() => {
  fixture.guest = true;
  fixture.usage = null;
  fixture.state.pending = 1;
});

describe('MobileStorageStatus', () => {
  it('describes pending guest work as device-only because it will never upload', () => {
    render(
      <MemoryRouter>
        <MobileStorageStatus expanded />
      </MemoryRouter>
    );
    const status = screen.getByTestId('mobile-storage-status');
    expect(status.textContent).toContain('Saved on this device');
    expect(status.textContent).not.toContain('waiting to sync');
    expect(status.getAttribute('aria-label')).toBe(
      'Saved on this device — storage and allowance details'
    );
  });

  it('keeps the pending-sync state for a signed-in account', () => {
    fixture.guest = false;
    render(
      <MemoryRouter>
        <MobileStorageStatus />
      </MemoryRouter>
    );
    const status = screen.getByTestId('mobile-storage-status');
    expect(status.textContent).toContain('Pending');
    expect(status.getAttribute('aria-label')).toBe(
      'Saved locally · waiting to sync — storage and allowance details'
    );
  });

  it('names the action that stopped when the cloud allowance is exhausted', () => {
    fixture.guest = false;
    fixture.usage = { status: 'PERSONAL_LIMIT' };
    fixture.state.pending = 0;
    const { rerender } = render(
      <MemoryRouter>
        <MobileStorageStatus />
      </MemoryRouter>
    );
    const status = screen.getByTestId('mobile-storage-status');
    expect(status.textContent).toBe('Paused');
    expect(status.textContent).not.toContain('Local only');
    expect(status.getAttribute('aria-label')).toBe(
      'Saved locally · sync paused — storage and allowance details'
    );
    rerender(
      <MemoryRouter>
        <MobileStorageStatus expanded />
      </MemoryRouter>
    );
    expect(status.textContent).toContain('Saved locally · sync paused');
  });
});
