import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PositionSaveProvider, useLayoutRecovery } from '../usePositionSaveQueue';
import { clearSession, setSession } from '../../lib/authStorage';
import { emptyAccount, type Account } from '../../lib/offline/model';

const fixture = vi.hoisted(() => ({ accounts: new Map<string, Account>(), pause: undefined as Promise<void> | undefined }));
vi.mock('../../lib/offline/store', () => ({
  channel: null,
  readAccount: async (owner: string) => {
    await fixture.pause;
    return structuredClone(fixture.accounts.get(owner) || emptyAccount());
  },
  editAccount: async (owner: string, edit: (account: Account) => unknown) => {
    const account = structuredClone(fixture.accounts.get(owner) || emptyAccount());
    const result = edit(account);
    fixture.accounts.set(owner, account);
    return result;
  },
}));

const token = (id: string) => `header.${btoa(JSON.stringify({ userId: id }))}.signature`;
beforeEach(() => {
  fixture.pause = undefined;
  fixture.accounts.clear();
  localStorage.clear();
  sessionStorage.clear();
  setSession(token('owner-a'), { id: 'owner-a' }, true);
  fixture.accounts.set('owner-a', { ...emptyAccount(), layoutOutbox: { version: 1, graphs: {
    '"missing-graph"': { '"task"': { id: 'task', x: 10, y: 20, updatedAt: 1000, revision: 'pending' } },
  } } });
  vi.stubGlobal('navigator', { locks: { request: (_name: string, _options: unknown, action: () => Promise<unknown>) => action() } });
});
afterEach(() => vi.unstubAllGlobals());

describe('account layout recovery settings', () => {
  it('loads and discards an inaccessible graph without a graph attachment or network send', async () => {
    const { result } = renderHook(() => useLayoutRecovery('owner-a'), { wrapper: PositionSaveProvider });
    await waitFor(() => expect(result.current.scopes).toEqual([{ graphId: 'missing-graph', count: 1 }]));
    await act(() => result.current.discard('missing-graph'));
    await waitFor(() => expect(result.current.scopes).toEqual([]));
    expect(fixture.accounts.get('owner-a')?.layoutOutbox).toBeUndefined();
    expect(fixture.accounts.get('owner-a')?.layoutFences?.counter).toBe(1);
  });

  it('does not show another account receipts or accept a mismatched token and cached user', async () => {
    setSession(token('owner-b'), { id: 'owner-b' }, true);
    const view = renderHook(({ owner }) => useLayoutRecovery(owner), { initialProps: { owner: 'owner-b' }, wrapper: PositionSaveProvider });
    await waitFor(() => expect(view.result.current.loading).toBe(false));
    expect(view.result.current.scopes).toEqual([]);
    act(() => setSession(token('owner-b'), { id: 'owner-a' }, true));
    view.rerender({ owner: 'owner-a' });
    expect(view.result.current.scopes).toEqual([]);
    expect(view.result.current.error).toMatch(/Sign in again/);
    await act(() => view.result.current.discard('missing-graph'));
    expect(fixture.accounts.get('owner-a')?.layoutOutbox).toBeDefined();
  });

  it('stops a pending discard when logout occurs before recovery finishes', async () => {
    const { result } = renderHook(() => useLayoutRecovery('owner-a'), { wrapper: PositionSaveProvider });
    await waitFor(() => expect(result.current.scopes).toHaveLength(1));
    let release!: () => void;
    fixture.pause = new Promise<void>(resolve => { release = resolve; });
    let discard!: Promise<void>;
    act(() => { discard = result.current.discard('missing-graph'); });
    act(() => clearSession());
    await act(async () => { release(); await discard; });
    expect(fixture.accounts.get('owner-a')?.layoutOutbox).toBeDefined();
  });
});
