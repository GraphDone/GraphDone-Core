import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { usePositionSaveQueue } from '../usePositionSaveQueue';

describe('position saving in the graph', () => {
  it('reports an outage once, keeps changes pending, and retries on reconnection', async () => {
    const save = vi.fn().mockRejectedValue(new Error('Connection lost'));
    const onError = vi.fn();
    const { result } = renderHook(() => usePositionSaveQueue(save, onError));
    result.current.queue('task', 12, 34);
    await act(() => result.current.flush());
    expect(onError).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledTimes(1);

    const leaving = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(leaving);
    expect(leaving.defaultPrevented).toBe(true);

    await act(() => result.current.flush());
    expect(onError).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledTimes(2);

    save.mockResolvedValue(undefined);
    act(() => { window.dispatchEvent(new Event('online')); });
    await waitFor(() => expect(save).toHaveBeenCalledTimes(3));
    expect(save).toHaveBeenLastCalledWith({ id: 'task', x: 12, y: 34 });
    await act(() => result.current.flush());
    const savedLeaving = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(savedLeaving);
    expect(savedLeaving.defaultPrevented).toBe(false);
  });

  it('warns before leaving while a save is still in flight and removes listeners on unmount', async () => {
    let resolve!: () => void;
    const pending = new Promise<void>(done => { resolve = done; });
    const save = vi.fn(() => pending);
    const { result, unmount } = renderHook(() => usePositionSaveQueue(save, vi.fn()));
    result.current.queue('task', 1, 2);
    const saving = result.current.flush();
    const leaving = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(leaving);
    expect(leaving.defaultPrevented).toBe(true);
    resolve();
    await act(() => saving);
    unmount();
    window.dispatchEvent(new Event('online'));
    expect(save).toHaveBeenCalledTimes(1);
  });
});
