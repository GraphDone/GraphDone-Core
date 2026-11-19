import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PositionSaveProvider, usePositionSaveQueue } from '../usePositionSaveQueue';
import { setSession } from '../../lib/authStorage';
import { emptyAccount, type Account } from '../../lib/offline/model';

const fixture = vi.hoisted(() => ({ accounts: new Map<string, Account>() }));
vi.mock('../../lib/offline/store', () => ({
  readAccount: async (owner: string) => structuredClone(fixture.accounts.get(owner) || emptyAccount()),
  editAccount: async (owner: string, edit: (account: Account) => unknown) => {
    const account = structuredClone(fixture.accounts.get(owner) || emptyAccount());
    const result = edit(account);
    fixture.accounts.set(owner, account);
    return result;
  },
}));

const scope = { ownerId: 'durable-owner', graphId: 'durable-graph' };
const token = (id: string) => `header.${btoa(JSON.stringify({ userId: id }))}.signature`;
afterEach(() => vi.unstubAllGlobals());
beforeEach(() => {
  const locks = new Map<string, Promise<unknown>>();
  vi.stubGlobal('navigator', { locks: {
    request: (name: string, _options: unknown, action: () => Promise<unknown>) => {
      const operation = (locks.get(name) || Promise.resolve()).catch(() => undefined).then(action);
      locks.set(name, operation.catch(() => undefined));
      return operation;
    },
  } });
  fixture.accounts.clear();
  localStorage.clear();
  sessionStorage.clear();
  setSession(token(scope.ownerId), { id: scope.ownerId }, true);
});

describe('durable layout recovery', () => {
  it('recovers the newest unsent position after the entire provider is replaced', async () => {
    const offline = vi.fn().mockRejectedValue(new Error('owned network outage'));
    const first = renderHook(() => usePositionSaveQueue(offline, vi.fn(), scope), { wrapper: PositionSaveProvider });
    await waitFor(() => expect(first.result.current.state?.recovered).toBe(true));
    act(() => { first.result.current.queue('task', 1, 2); first.result.current.queue('task', 9, 10); });
    await act(() => first.result.current.flush());
    first.unmount();
    const online = vi.fn().mockResolvedValue(undefined);
    const second = renderHook(() => usePositionSaveQueue(online, vi.fn(), scope), { wrapper: PositionSaveProvider });
    await act(() => second.result.current.flush());
    expect(online).toHaveBeenCalledExactlyOnceWith({ id: 'task', x: 9, y: 10 });
    expect(JSON.stringify([...fixture.accounts.values()])).not.toMatch(/authToken|signature|header\./);
    second.unmount();
  });

  it('shows the owner’s saved receipt without sending it until graph editing returns', async () => {
    const failing = vi.fn().mockRejectedValue(new Error('Offline'));
    const author = renderHook(() => usePositionSaveQueue(failing, vi.fn(), scope), { wrapper: PositionSaveProvider });
    await waitFor(() => expect(author.result.current.state?.recovered).toBe(true));
    act(() => { author.result.current.queue('task', 9, 10); });
    await act(() => author.result.current.flush());
    author.unmount();

    const send = vi.fn().mockResolvedValue(undefined);
    const viewer = renderHook(({ editable }) => usePositionSaveQueue(send, vi.fn(), scope, editable), {
      initialProps: { editable: false }, wrapper: PositionSaveProvider,
    });
    await act(() => viewer.result.current.flush());
    expect(send).not.toHaveBeenCalled();
    expect(viewer.result.current.state).toMatchObject({ pending: 1, local: 1, unsent: 1 });
    expect(viewer.result.current.state?.sendError).toContain('The task position was not saved');
    act(() => { expect(viewer.result.current.queue('other', 2, 3)).toBe(false); });
    viewer.rerender({ editable: true });
    await waitFor(() => expect(viewer.result.current.state?.pending).toBe(0));
    expect(send).toHaveBeenCalledExactlyOnceWith({ id: 'task', x: 9, y: 10 });
    viewer.unmount();
  });

  it('starts a fresh drain when editing returns during an earlier rejected save', async () => {
    let rejectFirst!: (error: Error) => void;
    const blocked = new Promise<void>((_, reject) => { rejectFirst = reject; });
    const send = vi.fn().mockReturnValueOnce(blocked).mockResolvedValue(undefined);
    const onError = vi.fn();
    const owner = renderHook(({ editable }) => usePositionSaveQueue(send, onError, scope, editable), {
      initialProps: { editable: true }, wrapper: PositionSaveProvider,
    });
    await waitFor(() => expect(owner.result.current.state?.recovered).toBe(true));
    act(() => { owner.result.current.queue('task', 12, 14); void owner.result.current.flush(); });
    await waitFor(() => expect(send).toHaveBeenCalledTimes(1));
    owner.rerender({ editable: false });
    owner.rerender({ editable: true });
    await act(async () => { rejectFirst(new Error('Earlier attempt denied')); });
    await waitFor(() => expect(owner.result.current.state?.pending).toBe(0));
    expect(send).toHaveBeenCalledTimes(2);
    expect(onError).not.toHaveBeenCalled();
    owner.unmount();
  });

  it('hides receipts after a session change even when the component still has the old owner', async () => {
    const save = vi.fn().mockRejectedValue(new Error('Offline'));
    const owner = renderHook(() => usePositionSaveQueue(save, vi.fn(), scope), { wrapper: PositionSaveProvider });
    await waitFor(() => expect(owner.result.current.state?.recovered).toBe(true));
    act(() => { owner.result.current.queue('task', 1, 2); });
    await act(() => owner.result.current.flush());
    expect(owner.result.current.state?.pending).toBe(1);
    act(() => { setSession(token('other'), { id: 'other' }, true); });
    await waitFor(() => expect(owner.result.current.state).toBeUndefined());
    owner.unmount();
  });

});
