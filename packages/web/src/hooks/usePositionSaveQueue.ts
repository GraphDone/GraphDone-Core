import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { type PositionSave } from '../lib/positionSaveQueue';
import { createRecoverablePositionQueue } from '../lib/recoverablePositionQueue';
import { getSessionOwnerId } from '../lib/authStorage';
import { readLayoutScopes } from '../lib/layoutPersistence';
import { channel } from '../lib/offline/store';

export interface PositionSaveScope { ownerId: string; graphId: string; }
type Attachment = { save: (position: PositionSave) => Promise<void>; onError: (message?: string) => void };
type Entry = PositionSaveScope & {
  queue: ReturnType<typeof createRecoverablePositionQueue>;
  attachment?: Attachment;
  reportedFailure: boolean;
};

function createRegistry() {
  const entries = new Map<string, Entry>();
  const listeners = new Set<() => void>();
  let version = 0;
  let notificationPending = false;
  const changed = () => {
    if (notificationPending) return;
    notificationPending = true;
    queueMicrotask(() => {
      notificationPending = false;
      version++;
      listeners.forEach(listener => listener());
    });
  };
  const get = (scope: PositionSaveScope) => {
    const key = JSON.stringify([scope.ownerId, scope.graphId]);
    let entry = entries.get(key);
    if (!entry) {
      if (entries.size >= 16) {
        for (const [oldKey, old] of entries) {
          if (!old.attachment && !old.queue.size && !old.queue.saving) entries.delete(oldKey);
        }
      }
      if (entries.size >= 16) throw new Error('Pending layouts are full. Return to your earlier graphs and reconnect to save them before editing another graph.');
      const next: Entry = {
        ...scope,
        reportedFailure: false,
        queue: createRecoverablePositionQueue({
          ...scope,
          networkBacked: import.meta.env.VITE_OFFLINE_SYNC !== 'true',
          onChange: changed,
          save: async position => {
            if (getSessionOwnerId() !== next.ownerId || !next.attachment) throw new Error('Layout saving is waiting for its graph and signed-in owner.');
            await next.attachment.save(position);
          },
        }),
      };
      entry = next;
      entries.set(key, entry);
    }
    return entry;
  };
  const flush = async (entry: Entry) => {
    if (!entry.attachment || getSessionOwnerId() !== entry.ownerId) return;
    try {
      await entry.queue.flush();
      entry.reportedFailure = false;
    } catch (error) {
      if (entry.attachment && getSessionOwnerId() === entry.ownerId && !entry.reportedFailure) {
        entry.reportedFailure = true;
        entry.attachment.onError(error instanceof Error ? error.message : undefined);
      }
    }
  };
  return {
    get, flush,
    entries: () => [...entries.values()],
    discardScope: async (scope: PositionSaveScope) => {
      if (getSessionOwnerId() !== scope.ownerId) throw new Error('Sign in as the layout owner before discarding changes.');
      const existing = entries.get(JSON.stringify([scope.ownerId, scope.graphId]));
      const recovered = createRecoverablePositionQueue({ ...scope, networkBacked: true, onChange() {}, save: async () => { throw new Error('Settings cannot send layout changes.'); } });
      await recovered.initialized;
      if (!recovered.state.recovered) throw new Error(recovered.state.storageError || 'Device layout recovery is unavailable.');
      if (getSessionOwnerId() !== scope.ownerId) throw new Error('The signed-in account changed. No further layout changes were discarded.');
      if (existing) await existing.queue.discard();
      if (getSessionOwnerId() !== scope.ownerId) throw new Error('The signed-in account changed. No further layout changes were discarded.');
      await recovered.discard();
      changed();
    },
    peek: (key: string | null) => key ? entries.get(key) : undefined,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    snapshot: () => version,
    reconnect: () => { for (const entry of entries.values()) void flush(entry); },
    hasPending: () => [...entries.values()].some(entry => entry.queue.size || entry.queue.saving),
  };
}

export function useLayoutRecovery(requestedOwnerId?: string) {
  const ownerId = getSessionOwnerId() === requestedOwnerId ? requestedOwnerId : undefined;
  const registry = useContext(PositionSaveContext);
  if (!registry) throw new Error('PositionSaveProvider is required.');
  const version = useSyncExternalStore(registry.subscribe, registry.snapshot);
  const [saved, setSaved] = useState<{ ownerId?: string; scopes: Awaited<ReturnType<typeof readLayoutScopes>>; error: string }>({ scopes: [], error: '' });
  const active = useRef({ ownerId });
  if (active.current.ownerId !== ownerId) active.current = { ownerId };
  const scope = active.current;
  const [busyScope, setBusyScope] = useState<typeof scope>();
  const busy = busyScope === scope;
  const isCurrent = () => active.current === scope && getSessionOwnerId() === ownerId;
  useEffect(() => {
    if (!ownerId || import.meta.env.VITE_OFFLINE_SYNC === 'true') return;
    let cancelled = false;
    let request = 0;
    const refresh = async () => {
      const currentRequest = ++request;
      try {
        const scopes = await readLayoutScopes(ownerId);
        if (!cancelled && currentRequest === request && active.current === scope && getSessionOwnerId() === ownerId) setSaved({ ownerId, scopes, error: '' });
      } catch (error) {
        if (!cancelled && currentRequest === request && active.current === scope && getSessionOwnerId() === ownerId) setSaved({ ownerId, scopes: [], error: error instanceof Error ? error.message : 'Device layout storage is unavailable.' });
      }
    };
    void refresh();
    window.addEventListener('graphdone-local-change', refresh);
    channel?.addEventListener('message', refresh);
    return () => {
      cancelled = true;
      window.removeEventListener('graphdone-local-change', refresh);
      channel?.removeEventListener('message', refresh);
    };
  }, [ownerId, registry, version, scope]);
  const scopes = new Map<string, Set<string>>();
  if (saved.ownerId === ownerId) for (const scope of saved.scopes) scopes.set(scope.graphId, new Set(scope.positions.map(position => position.id)));
  for (const entry of registry.entries().filter(entry => entry.ownerId === ownerId && entry.queue.size)) {
    const ids = scopes.get(entry.graphId) || new Set<string>();
    for (const id of entry.queue.state.positions.keys()) ids.add(id);
    scopes.set(entry.graphId, ids);
  }
  const discard = async (graphId: string) => {
    if (!ownerId || busy) return;
    setBusyScope(scope);
    try {
      await registry.discardScope({ ownerId, graphId });
      if (!isCurrent()) return;
      const scopes = await readLayoutScopes(ownerId);
      if (isCurrent()) setSaved({ ownerId, scopes, error: '' });
    } catch (error) {
      if (isCurrent()) setSaved(previous => ({ ownerId, scopes: previous.ownerId === ownerId ? previous.scopes : [], error: error instanceof Error ? error.message : 'The pending layout could not be discarded.' }));
    } finally { setBusyScope(previous => previous === scope ? undefined : previous); }
  };
  return { scopes: [...scopes].map(([graphId, ids]) => ({ graphId, count: ids.size })), loading: !!ownerId && saved.ownerId !== ownerId, error: requestedOwnerId && !ownerId ? 'Sign in again to inspect this account’s pending layouts.' : saved.ownerId === ownerId ? saved.error : '', busy, discard };
}

const PositionSaveContext = createContext<ReturnType<typeof createRegistry> | null>(null);

export function PositionSaveProvider({ children }: { children: ReactNode }) {
  const registry = useRef<ReturnType<typeof createRegistry>>();
  if (!registry.current) registry.current = createRegistry();
  const value = registry.current;
  useEffect(() => {
    const leaving = (event: BeforeUnloadEvent) => {
      if (value.hasPending()) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('online', value.reconnect);
    window.addEventListener('graphdone-session', value.reconnect);
    window.addEventListener('beforeunload', leaving);
    return () => {
      window.removeEventListener('online', value.reconnect);
      window.removeEventListener('graphdone-session', value.reconnect);
      window.removeEventListener('beforeunload', leaving);
    };
  }, [value]);
  return createElement(PositionSaveContext.Provider, { value }, children);
}

export function usePositionSaveQueue(
  save: (position: PositionSave) => Promise<void>,
  onError: (message?: string) => void,
  scope: PositionSaveScope | null,
) {
  const registry = useContext(PositionSaveContext);
  if (!registry) throw new Error('PositionSaveProvider is required.');
  useSyncExternalStore(registry.subscribe, registry.snapshot);
  const key = scope ? JSON.stringify([scope.ownerId, scope.graphId]) : null;
  const latest = useRef({ save, onError, key });
  latest.current = { save, onError, key };
  const attachment = useMemo<Attachment>(() => ({
    save: position => {
      if (latest.current.key !== key) return Promise.reject(new Error('The active graph changed.'));
      return latest.current.save(position);
    },
    onError: message => { if (latest.current.key === key) latest.current.onError(message); },
  }), [key]);
  const active = useRef<Entry>();
  const [scopeError, setScopeError] = useState<{ key: string | null; message: string }>();

  useEffect(() => {
    if (!scope) return;
    let entry: Entry;
    try { entry = registry.get(scope); }
    catch (error) {
      const message = (error as Error).message;
      setScopeError({ key, message });
      attachment.onError(message);
      return;
    }
    setScopeError(undefined);
    active.current = entry;
    entry.attachment = attachment;
    void registry.flush(entry);
    return () => {
      if (entry.attachment === attachment) entry.attachment = undefined;
      if (active.current === entry) active.current = undefined;
    };
  }, [registry, key, attachment]);

  const queue = useCallback((id: string, x: number, y: number) => {
    const entry = active.current;
    if (!entry || entry.attachment !== attachment || latest.current.key !== key || getSessionOwnerId() !== entry.ownerId) {
      attachment.onError('Layout saving is unavailable. Return to this graph while signed in as its owner before moving tasks.');
      return false;
    }
    try { entry.queue.queue(id, x, y); return true; }
    catch (error) { attachment.onError((error as Error).message); return false; }
  }, [attachment, key]);
  const flush = useCallback(async () => {
    const entry = active.current;
    if (entry && entry.attachment === attachment && latest.current.key === key) await registry.flush(entry);
  }, [registry, attachment, key]);

  const discard = useCallback(async () => {
    const entry = active.current;
    if (!entry || entry.attachment !== attachment || latest.current.key !== key || getSessionOwnerId() !== entry.ownerId) return;
    try { await entry.queue.discard(); entry.reportedFailure = false; }
    catch (error) { attachment.onError((error as Error).message); }
  }, [attachment, key]);

  const entry = registry.peek(key);
  return { queue, flush, discard, error: scopeError?.key === key ? scopeError.message : undefined, state: entry?.queue.state, saving: entry?.queue.saving ?? false };
}
