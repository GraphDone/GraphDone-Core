import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { createPositionSaveQueue, type PositionSave } from '../lib/positionSaveQueue';
import { getSessionOwnerId } from '../lib/authStorage';

export interface PositionSaveScope { ownerId: string; graphId: string; }
type Attachment = { save: (position: PositionSave) => Promise<void>; onError: (message?: string) => void };
type Entry = PositionSaveScope & {
  queue: ReturnType<typeof createPositionSaveQueue>;
  attachment?: Attachment;
  reportedFailure: boolean;
};

function createRegistry() {
  const entries = new Map<string, Entry>();
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
        queue: createPositionSaveQueue({
          maxPending: 10000,
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
    } catch {
      if (entry.attachment && getSessionOwnerId() === entry.ownerId && !entry.reportedFailure) {
        entry.reportedFailure = true;
        entry.attachment.onError();
      }
    }
  };
  return {
    get, flush,
    reconnect: () => { for (const entry of entries.values()) void flush(entry); },
    hasPending: () => [...entries.values()].some(entry => entry.queue.size || entry.queue.saving),
  };
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

  useEffect(() => {
    if (!scope) return;
    let entry: Entry;
    try { entry = registry.get(scope); }
    catch (error) { attachment.onError((error as Error).message); return; }
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

  return { queue, flush };
}
