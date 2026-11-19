// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DeleteGraphModal } from './DeleteGraphModal';
import { GET_WORK_ITEMS, GET_EDGES, DELETE_WORK_ITEM, DELETE_EDGE } from '../lib/queries';

const state = vi.hoisted(() => ({ allowed: true, deleteEdge: vi.fn(), deleteWorkItem: vi.fn(), deleteGraph: vi.fn() }));
vi.mock('../contexts/GraphContext', () => ({ useGraph: () => ({
  currentGraph: null, deleteGraph: state.deleteGraph, canDeleteGraph: () => state.allowed,
}) }));
vi.mock('../contexts/NotificationContext', () => ({ useNotifications: () => ({ showSuccess: vi.fn(), showError: vi.fn() }) }));
vi.mock('@apollo/client', async original => ({
  ...(await original<typeof import('@apollo/client')>()),
  useQuery: (query: unknown) => query === GET_WORK_ITEMS
    ? { data: { workItems: [{ id: 'a', title: 'A', type: 'TASK' }, { id: 'b', title: 'B', type: 'TASK' }] }, loading: false }
    : query === GET_EDGES
      ? { data: { edges: [
          { id: 'e1', source: { id: 'a', title: 'A' }, target: { id: 'b', title: 'B' } },
          { id: 'e2', source: { id: 'b', title: 'B' }, target: { id: 'a', title: 'A' } },
        ] }, loading: false }
      : { data: { graphs: [] }, loading: false },
  useMutation: (mutation: unknown) => [mutation === DELETE_EDGE ? state.deleteEdge : mutation === DELETE_WORK_ITEM ? state.deleteWorkItem : vi.fn()],
}));

const graph = { id: 'g', name: 'Owned', type: 'PROJECT', permissions: 'OWNER' } as any;
afterEach(() => { cleanup(); state.allowed = true; vi.clearAllMocks(); });

describe('live graph delete permissions', () => {
  it('closes an already-open dialog when delete access is revoked', async () => {
    const onClose = vi.fn();
    const view = render(<DeleteGraphModal isOpen graph={graph} onClose={onClose} />);
    expect(screen.getByRole('dialog', { name: 'Delete graph' })).toBeTruthy();
    state.allowed = false;
    view.rerender(<DeleteGraphModal isOpen graph={graph} onClose={onClose} />);
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it('does not dispatch later edge deletions after access is revoked mid-cleanup', async () => {
    let finishFirst!: () => void;
    state.deleteEdge.mockImplementationOnce(() => new Promise<void>(resolve => { finishFirst = resolve; }));
    const view = render(<DeleteGraphModal isOpen graph={graph} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Disconnect All Connections' }));
    expect(state.deleteEdge).toHaveBeenCalledTimes(1);
    state.allowed = false;
    view.rerender(<DeleteGraphModal isOpen graph={graph} onClose={vi.fn()} />);
    await act(async () => { finishFirst(); await Promise.resolve(); });
    expect(state.deleteEdge).toHaveBeenCalledTimes(1);
  });
});
