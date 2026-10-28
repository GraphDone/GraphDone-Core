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
});
