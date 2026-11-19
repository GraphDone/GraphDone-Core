// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UpdateGraphModal } from './UpdateGraphModal';

const state = vi.hoisted(() => ({ allowed: true, updateGraph: vi.fn() }));
vi.mock('../contexts/GraphContext', () => ({ useGraph: () => ({
  availableGraphs: [], updateGraph: state.updateGraph, canEditGraph: () => state.allowed,
}) }));
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ currentTeam: null }) }));
vi.mock('../contexts/NotificationContext', () => ({ useNotifications: () => ({ showSuccess: vi.fn(), showError: vi.fn() }) }));

const graph = { id: 'g', name: 'Owned', type: 'PROJECT', permissions: 'OWNER' } as any;
afterEach(() => { cleanup(); state.allowed = true; vi.clearAllMocks(); });

describe('live graph edit permissions', () => {
  it('closes an already-open dialog when edit access is revoked and stays closed after regrant', async () => {
    const onClose = vi.fn();
    const view = render(<UpdateGraphModal isOpen graphToEdit={graph} onClose={onClose} />);
    expect(screen.getByRole('dialog', { name: 'Edit graph' })).toBeTruthy();
    state.allowed = false;
    view.rerender(<UpdateGraphModal isOpen graphToEdit={graph} onClose={onClose} />);
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('dialog', { name: 'Edit graph' })).toBeNull();
    state.allowed = true;
    view.rerender(<UpdateGraphModal isOpen={false} graphToEdit={null} onClose={onClose} />);
    expect(screen.queryByRole('dialog', { name: 'Edit graph' })).toBeNull();
    expect(state.updateGraph).not.toHaveBeenCalled();
  });
});
