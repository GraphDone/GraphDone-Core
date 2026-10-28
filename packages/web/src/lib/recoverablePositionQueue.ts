import { createPositionSaveQueue, type LayoutReceipt, type PositionSave } from './positionSaveQueue';
import { acknowledgeLayout, persistLayout, readLayout, readLayoutSnapshot } from './layoutPersistence';

export function createRecoverablePositionQueue(options: {
  ownerId: string;
  graphId: string;
  networkBacked: boolean;
  save: (position: PositionSave) => Promise<void>;
  onChange: () => void;
}) {
  const positions = new Map<string, LayoutReceipt>();
  const durable = new Map<string, string>();
  const staged = new Map<string, LayoutReceipt>();
  const accepted = new Map<string, LayoutReceipt>();
  let storageError = '';
  let cleanupError = '';
  let sendError = '';
  let loaded = false;
  let recovered = !options.networkBacked;
  let persisting: Promise<void> | undefined;
  let discarding = false;
  let discardPromise: Promise<void> | undefined;
  let acknowledged = false;
  let observedGeneration = 0;
  let positionsDirty = true;
  let positionSnapshot: ReadonlyMap<string, LayoutReceipt> = new Map();
  const notify = options.onChange;
  const plain = ({ id, x, y }: PositionSave) => ({ id, x, y });
  const forget = (position: LayoutReceipt) => {
    if (positions.get(position.id)?.revision === position.revision) { positions.delete(position.id); positionsDirty = true; }
    if (durable.get(position.id) === position.revision) durable.delete(position.id);
    accepted.delete(position.revision);
    notify();
  };
  const lock = async <T>(id: string, action: () => Promise<T>): Promise<T> => {
    if (!navigator.locks?.request) throw new Error('This browser cannot coordinate safe layout recovery between tabs. Positions remain on this device; use a browser with Web Locks support.');
    return navigator.locks.request(JSON.stringify(['graphdone-layout-v1', options.ownerId, options.graphId, id]), { mode: 'exclusive' }, action);
  };
  const cleanup = async (position: LayoutReceipt) => {
    try {
      const current = (await readLayout(options.ownerId, options.graphId)).find(item => item.id === position.id);
      if (current?.revision === position.revision) await acknowledgeLayout(options.ownerId, options.graphId, [position]);
      forget(position);
      cleanupError = '';
    } catch (error) {
      cleanupError = 'The server accepted this layout, but this device could not clear its receipt. Retry will only clear that receipt.';
      notify();
      throw error;
    }
  };
  const queue = createPositionSaveQueue({
    maxPending: 10000,
    save: async position => {
      if (options.networkBacked) await persist();
      if (positions.get(position.id)?.revision !== position.revision) return;
      if (!options.networkBacked) {
        await options.save(plain(position));
        const current = positions.get(position.id);
        if (current && current.revision === position.revision) forget(current);
        acknowledged = true;
        notify();
        return;
      }
      await lock(position.id, async () => {
        const current = positions.get(position.id);
        if (!current || current.revision !== position.revision) return;
        if (accepted.has(current.revision)) { await cleanup(current); return; }
        const eligible = (await readLayout(options.ownerId, options.graphId)).find(item => item.id === position.id);
        if (eligible?.revision !== position.revision) { forget(current); return; }
        if (positions.get(position.id)?.revision !== position.revision) return;
        await options.save(plain(position));
        accepted.set(current.revision, current);
        acknowledged = true;
        notify();
        await cleanup(current);
      });
    },
  });

  const ready = (async () => {
    try {
      if (options.networkBacked) {
        const snapshot = await readLayoutSnapshot(options.ownerId, options.graphId);
        observedGeneration = snapshot.generation;
        for (const position of snapshot.positions) {
          if (positions.has(position.id)) continue;
          queue.queue(position.id, position.x, position.y, position.revision);
          positions.set(position.id, position);
          positionsDirty = true;
          durable.set(position.id, position.revision);
        }
      }
      recovered = true;
    } catch (error) {
      storageError = error instanceof Error ? error.message : 'Device storage is unavailable.';
    } finally {
      loaded = true;
      notify();
    }
  })();

  const persist = (): Promise<void> => {
    if (persisting) return persisting;
    if (!options.networkBacked) return Promise.resolve();
    persisting = (async () => {
      await ready;
      if (!recovered) {
        const snapshot = await readLayoutSnapshot(options.ownerId, options.graphId);
        observedGeneration = snapshot.generation;
        recovered = true;
        for (const position of snapshot.positions) {
          if (!positions.has(position.id)) {
            queue.queue(position.id, position.x, position.y, position.revision);
            positions.set(position.id, position);
            positionsDirty = true;
            durable.set(position.id, position.revision);
          }
        }
      }
      while (staged.size) {
        const batch = [...staged.values()];
        staged.clear();
        try {
          observedGeneration = await persistLayout(options.ownerId, options.graphId, batch, observedGeneration);
          for (const position of batch) durable.set(position.id, position.revision);
        } catch (error) {
          for (const position of batch) if (!staged.has(position.id)) staged.set(position.id, position);
          throw error;
        }
      }
      storageError = '';
    })().catch(error => {
      storageError = error instanceof Error ? error.message : 'Device storage is unavailable.';
      throw error;
    }).finally(() => { persisting = undefined; notify(); });
    return persisting;
  };

  return {
    initialized: ready,
    queue: (id: string, x: number, y: number) => {
      if (!recovered) throw new Error('Wait for layout recovery before moving tasks.');
      if (discarding) throw new Error('Wait for the pending layout discard to finish.');
      if (!id || !Number.isFinite(x) || !Number.isFinite(y) || Math.abs(x) > 1e9 || Math.abs(y) > 1e9) throw new Error('This layout position is invalid.');
      const position = { id, x, y, revision: crypto.randomUUID(), updatedAt: Date.now() };
      queue.queue(id, x, y, position.revision);
      positions.set(id, position);
      positionsDirty = true;
      if (options.networkBacked) staged.set(id, position);
      acknowledged = false;
      notify();
      if (options.networkBacked) void persist().catch(() => undefined);
    },
    flush: async () => {
      try {
        if (discardPromise) return await discardPromise;
        await ready;
        if (discardPromise) return await discardPromise;
        if (options.networkBacked) await persist();
        if (discardPromise) return await discardPromise;
        if (options.networkBacked) for (const position of [...accepted.values()]) await lock(position.id, () => cleanup(position));
        if (discardPromise) return await discardPromise;
        const flushing = queue.flush();
        notify();
        await flushing;
        sendError = '';
      } catch (error) {
        if (!storageError && !cleanupError) sendError = error instanceof Error ? error.message : 'Layout sending failed. Retry when connected.';
        throw error;
      } finally { notify(); }
    },
    discard: () => {
      if (discardPromise) return discardPromise;
      if (queue.saving) return Promise.reject(new Error('Wait for the current save to finish before discarding unsent positions.'));
      discarding = true;
      notify();
      discardPromise = (async () => {
        let recoveryError = '';
        await ready;
        if (persisting) await persisting.catch(() => undefined);
        if (options.networkBacked) {
          for (const position of [...positions.values()]) {
            if (!durable.has(position.id)) continue;
            const remove = async () => {
              const stored = (await readLayout(options.ownerId, options.graphId)).find(item => item.id === position.id);
              if (stored && (stored.revision === position.revision || stored.revision === durable.get(position.id))) {
                await acknowledgeLayout(options.ownerId, options.graphId, [stored], true);
              }
            };
            if (typeof navigator.locks?.request === 'function') await lock(position.id, remove);
            else await remove();
          }
        }
        if (options.networkBacked) {
          try { observedGeneration = (await readLayoutSnapshot(options.ownerId, options.graphId)).generation; recovered = true; }
          catch (error) {
            if (durable.size) throw error;
            recovered = false;
            recoveryError = error instanceof Error ? error.message : 'Device storage is unavailable.';
          }
        }
        queue.discard();
        positions.clear();
        positionsDirty = true;
        durable.clear();
        staged.clear();
        accepted.clear();
        storageError = recoveryError;
        cleanupError = '';
        sendError = '';
        acknowledged = false;
      })().finally(() => { discarding = false; discardPromise = undefined; notify(); });
      return discardPromise;
    },
    get size() { return positions.size; },
    get saving() { return queue.saving || persisting !== undefined || discarding; },
    get state() {
      if (positionsDirty) { positionSnapshot = new Map(positions); positionsDirty = false; }
      const local = [...positions.values()].filter(position => durable.get(position.id) === position.revision).length;
      const unsent = [...positions.values()].filter(position => !accepted.has(position.revision)).length;
      return { ready: loaded, recovered, pending: positions.size, unsent, cleanupPending: accepted.size, local, storageError, cleanupError, sendError, acknowledged, networkBacked: options.networkBacked, positions: positionSnapshot };
    },
  };
}
