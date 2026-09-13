import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MobileStorageStatus } from './MobileStorageStatus';

const fixture = vi.hoisted(() => ({
  guest: true,
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
  useHostedUsage: () => ({ usage: null, error: '' }),
}));

beforeEach(() => {
  fixture.guest = true;
  fixture.state.pending = 1;
});

describe('MobileStorageStatus', () => {
  it('describes pending guest work as device-only because it will never upload', () => {
    render(<MemoryRouter><MobileStorageStatus expanded /></MemoryRouter>);
    const status = screen.getByTestId('mobile-storage-status');
    expect(status.textContent).toContain('Saved on this device');
    expect(status.textContent).not.toContain('waiting to sync');
    expect(status.getAttribute('aria-label')).toBe('Saved on this device — storage and allowance details');
  });

  it('keeps the pending-sync state for a signed-in account', () => {
    fixture.guest = false;
    render(<MemoryRouter><MobileStorageStatus /></MemoryRouter>);
    const status = screen.getByTestId('mobile-storage-status');
    expect(status.textContent).toContain('Pending');
    expect(status.getAttribute('aria-label')).toBe('Saved locally · waiting to sync — storage and allowance details');
  });
});
