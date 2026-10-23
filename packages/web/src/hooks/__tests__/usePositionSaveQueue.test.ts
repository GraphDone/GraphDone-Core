import { createElement, StrictMode } from 'react';
import { act, render, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PositionSaveProvider, usePositionSaveQueue, type PositionSaveScope } from '../usePositionSaveQueue';
import { clearSession, setSession } from '../../lib/authStorage';
import type { PositionSave } from '../../lib/positionSaveQueue';

const token = (id: string) => `header.${btoa(JSON.stringify({ userId: id }))}.signature`;
const scope = { ownerId: 'owner-a', graphId: 'graph-a' };
function navigation(save: (position: PositionSave) => Promise<void>, onError = vi.fn(), initialScope = scope) {
  let queue!: ReturnType<typeof usePositionSaveQueue>;
  function Graph({ currentScope }: { currentScope: PositionSaveScope }) {
    queue = usePositionSaveQueue(save, onError, currentScope);
    return null;
  }
  function App({ graph, currentScope }: { graph: boolean; currentScope: PositionSaveScope }) {
    return createElement(PositionSaveProvider, { children: graph ? createElement(Graph, { currentScope }) : createElement('div', {}, 'List') });
  }
  const view = render(createElement(App, { graph: true, currentScope: initialScope }));
  return {
    get queue() { return queue; },
    go: (graph: boolean, currentScope = initialScope) => view.rerender(createElement(App, { graph, currentScope })),
    unmount: view.unmount,
  };
}
function leaving() {
  const event = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  setSession(token('owner-a'), { id: 'owner-a' }, true);
});

describe('position saving in the graph', () => {
  it('retains failed positions and the unload warning across Graph → List → Graph navigation', async () => {
    const save = vi.fn().mockRejectedValue(new Error('Connection lost'));
    const view = navigation(save);
    view.queue.queue('task', 12, 34);
    await act(() => view.queue.flush());
    view.go(false);
    expect(leaving()).toBe(true);
    save.mockResolvedValue(undefined);
    act(() => { window.dispatchEvent(new Event('online')); });
    expect(save).toHaveBeenCalledTimes(1);
    view.go(true);
    await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
    await act(() => view.queue.flush());
    expect(save).toHaveBeenLastCalledWith({ id: 'task', x: 12, y: 34 });
    expect(leaving()).toBe(false);
  });

  it('reports an outage once, keeps changes pending, and retries on reconnection', async () => {
    const save = vi.fn().mockRejectedValue(new Error('Connection lost'));
    const onError = vi.fn();
    const { result } = renderHook(() => usePositionSaveQueue(save, onError, scope), { wrapper: PositionSaveProvider });
    result.current.queue('task', 12, 34);
    await act(() => result.current.flush());
    expect(onError).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledTimes(1);
    expect(leaving()).toBe(true);
    await act(() => result.current.flush());
    expect(onError).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledTimes(2);
    save.mockResolvedValue(undefined);
    act(() => { window.dispatchEvent(new Event('online')); });
    await waitFor(() => expect(save).toHaveBeenCalledTimes(3));
    expect(save).toHaveBeenLastCalledWith({ id: 'task', x: 12, y: 34 });
    await act(() => result.current.flush());
    expect(leaving()).toBe(false);
  });

  it('preserves newer positions after an in-flight save fails across unmount and remount', async () => {
    let reject!: (error: Error) => void;
    const save = vi.fn().mockImplementationOnce(() => new Promise<void>((_, fail) => { reject = fail; })).mockResolvedValue(undefined);
    const view = navigation(save);
    view.queue.queue('task', 1, 2);
    const saving = view.queue.flush();
    view.go(false);
    expect(leaving()).toBe(true);
    view.go(true);
    view.queue.queue('task', 3, 4);
    reject(new Error('Connection lost'));
    await act(() => saving);
    await act(() => view.queue.flush());
    expect(save.mock.calls.map(([position]) => position)).toEqual([{ id: 'task', x: 1, y: 2 }, { id: 'task', x: 3, y: 4 }]);
    expect(leaving()).toBe(false);
  });

  it('does not send one graph’s pending layout through another graph’s callback', async () => {
    const saves = { 'graph-a': vi.fn().mockRejectedValue(new Error('offline')), 'graph-b': vi.fn().mockResolvedValue(undefined) };
    let queue!: ReturnType<typeof usePositionSaveQueue>;
    function Graph({ graphId }: { graphId: 'graph-a' | 'graph-b' }) {
      queue = usePositionSaveQueue(saves[graphId], vi.fn(), { ...scope, graphId });
      return null;
    }
    const tree = (graphId: 'graph-a' | 'graph-b') => createElement(PositionSaveProvider, { children: createElement(Graph, { graphId }) });
    const view = render(tree('graph-a'));
    queue.queue('same-task', 1, 2);
    await act(() => queue.flush());
    view.rerender(tree('graph-b'));
    queue.queue('same-task', 9, 10);
    await act(() => queue.flush());
    expect(saves['graph-b']).toHaveBeenCalledTimes(1);
    expect(saves['graph-b']).toHaveBeenLastCalledWith({ id: 'same-task', x: 9, y: 10 });
    saves['graph-a'].mockResolvedValue(undefined);
    view.rerender(tree('graph-a'));
    await act(() => queue.flush());
    expect(saves['graph-a']).toHaveBeenLastCalledWith({ id: 'same-task', x: 1, y: 2 });
    expect(leaving()).toBe(false);
  });

  it('pauses old-owner saves immediately on logout or account switch and resumes only for that owner', async () => {
    const resolvers: Array<() => void> = [];
    const save = vi.fn().mockImplementation(() => new Promise<void>(done => { resolvers.push(done); }));
    const view = navigation(save);
    for (let index = 0; index < 5; index++) view.queue.queue(`task-${index}`, index, index);
    const saving = view.queue.flush();
    expect(save).toHaveBeenCalledTimes(4);
    act(() => { clearSession(); });
    view.go(false);
    act(() => { setSession(token('owner-b'), { id: 'owner-b' }, true); });
    view.go(true, { ownerId: 'owner-b', graphId: scope.graphId });
    act(() => { window.dispatchEvent(new Event('online')); });
    expect(save).toHaveBeenCalledTimes(4);
    resolvers.forEach(resolve => resolve());
    await act(() => saving);
    expect(save).toHaveBeenCalledTimes(4);
    view.go(false);
    save.mockResolvedValue(undefined);
    act(() => { setSession(token('owner-a'), { id: 'owner-a' }, true); });
    view.go(true);
    await act(() => view.queue.flush());
    expect(save).toHaveBeenCalledTimes(5);
    expect(save).toHaveBeenLastCalledWith({ id: 'task-4', x: 4, y: 4 });
    expect(leaving()).toBe(false);
  });

  it('keeps the original owner’s failed layout isolated until the same account and graph return', async () => {
    const save = vi.fn().mockRejectedValue(new Error('offline'));
    const view = navigation(save);
    view.queue.queue('task', 1, 2);
    await act(() => view.queue.flush());
    act(() => { clearSession(); window.dispatchEvent(new Event('online')); });
    expect(save).toHaveBeenCalledTimes(1);
    view.go(false);
    act(() => { setSession(token('owner-b'), { id: 'owner-b' }, true); });
    view.go(true, { ownerId: 'owner-b', graphId: scope.graphId });
    await act(() => view.queue.flush());
    expect(save).toHaveBeenCalledTimes(1);
    save.mockResolvedValue(undefined);
    view.queue.queue('task', 8, 9);
    await act(() => view.queue.flush());
    expect(save).toHaveBeenLastCalledWith({ id: 'task', x: 8, y: 9 });
    view.go(false);
    act(() => { setSession(token('owner-a'), { id: 'owner-a' }, true); });
    view.go(true);
    await act(() => view.queue.flush());
    expect(save).toHaveBeenLastCalledWith({ id: 'task', x: 1, y: 2 });
    expect(leaving()).toBe(false);
  });

  it('refuses excess graph scopes explicitly without evicting pending positions', async () => {
    const save = vi.fn().mockRejectedValue(new Error('offline'));
    const onError = vi.fn();
    const view = navigation(save, onError);
    for (let index = 0; index < 16; index++) {
      view.go(true, { ...scope, graphId: `graph-${index}` });
      expect(view.queue.queue('task', index, index)).toBe(true);
      await act(() => view.queue.flush());
    }
    view.go(true, { ...scope, graphId: 'graph-overflow' });
    expect(onError).toHaveBeenCalledWith(expect.stringContaining('Pending layouts are full'));
    expect(view.queue.queue('task', 100, 100)).toBe(false);
    save.mockResolvedValue(undefined);
    view.go(true, { ...scope, graphId: 'graph-0' });
    await act(() => view.queue.flush());
    expect(save).toHaveBeenLastCalledWith({ id: 'task', x: 0, y: 0 });
  });

  it('preserves the provider queue through StrictMode effect cleanup and removes listeners on final unmount', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const wrapper = ({ children }: { children: React.ReactNode }) => createElement(StrictMode, {}, createElement(PositionSaveProvider, { children }));
    const { result, unmount } = renderHook(() => usePositionSaveQueue(save, vi.fn(), scope), { wrapper });
    result.current.queue('task', 1, 2);
    await act(() => result.current.flush());
    expect(save).toHaveBeenCalledTimes(1);
    unmount();
    window.dispatchEvent(new Event('online'));
    expect(leaving()).toBe(false);
    expect(save).toHaveBeenCalledTimes(1);
  });
});
