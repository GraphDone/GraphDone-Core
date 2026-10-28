/**
 * Coalescing, concurrency-bounded queue for node-position writes (#95).
 *
 * A large-graph reflow moves hundreds of nodes at once; persisting each with its
 * own mutation fired N parallel writes — a D1 write-amplification spike. This
 * queue (a) coalesces repeated writes for the same node (last position wins) and
 * (b) drains them with a hard cap on in-flight writes, so a 500-node reflow does
 * at most `concurrency` writes at a time instead of 500 in parallel. The pure
 * pieces are unit-tested with an injected `save`.
 */
export interface PositionSave { id: string; x: number; y: number; revision?: string; }
export interface LayoutReceipt extends PositionSave { revision: string; updatedAt: number; }

/** Run `worker` over `items` with at most `limit` in flight; resolve when all done. */
export async function drainWithLimit<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  const queue = [...items];
  const runNext = async (): Promise<void> => {
    const item = queue.shift();
    if (item === undefined) return;
    await worker(item);
    return runNext();
  };
  const n = Math.max(1, Math.min(limit, items.length));
  await Promise.all(Array.from({ length: n }, () => runNext()));
}

export function createPositionSaveQueue(opts: {
  save: (s: PositionSave) => Promise<void>;
  concurrency?: number;
  maxPending?: number;
}) {
  const pending = new Map<string, PositionSave>();
  const retainedIds = new Set<string>();
  const concurrency = opts.concurrency ?? 4;
  let flushing: Promise<void> | undefined;
  let generation = 0;

  /** Queue/overwrite a node's pending position (last write wins — coalesced). */
  const queue = (id: string, x: number, y: number, revision?: string): void => {
    if (!retainedIds.has(id) && retainedIds.size >= (opts.maxPending ?? Infinity)) {
      throw new Error('Too many pending layout changes. Reconnect and save before moving more tasks.');
    }
    retainedIds.add(id);
    pending.set(id, { id, x, y, ...(revision ? { revision } : {}) });
  };

  const drain = async (): Promise<void> => {
    while (pending.size > 0) {
      const batch = [...pending.values()];
      const batchGeneration = generation;
      pending.clear();
      const failures: unknown[] = [];
      await drainWithLimit(batch, concurrency, async (position) => {
        if (generation !== batchGeneration) return;
        try {
          await opts.save(position);
          if (generation === batchGeneration && !pending.has(position.id)) retainedIds.delete(position.id);
        } catch (error) {
          if (generation !== batchGeneration) return;
          if (!pending.has(position.id)) pending.set(position.id, position);
          failures.push(error);
        }
      });
      if (failures.length) throw failures[0];
    }
  };

  const flush = (): Promise<void> => {
    if (flushing) return flushing;
    if (pending.size === 0) return Promise.resolve();
    flushing = drain().finally(() => { flushing = undefined; });
    return flushing;
  };

  return {
    queue,
    flush,
    discard: () => { generation++; pending.clear(); retainedIds.clear(); },
    get size() { return pending.size; },
    get saving() { return flushing !== undefined; },
  };
}
