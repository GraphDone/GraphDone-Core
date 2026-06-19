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
export interface PositionSave { id: string; x: number; y: number; }

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
}) {
  const pending = new Map<string, PositionSave>();
  const concurrency = opts.concurrency ?? 4;
  let flushing = false;

  /** Queue/overwrite a node's pending position (last write wins — coalesced). */
  const queue = (id: string, x: number, y: number): void => {
    pending.set(id, { id, x, y });
  };

  /** Drain all pending writes with bounded concurrency. Saves queued mid-flush
   *  coalesce into a follow-up round so nothing is lost. */
  const flush = async (): Promise<void> => {
    if (flushing || pending.size === 0) return;
    flushing = true;
    try {
      const batch = [...pending.values()];
      pending.clear();
      await drainWithLimit(batch, concurrency, opts.save);
    } finally {
      flushing = false;
    }
    if (pending.size > 0) await flush();
  };

  return {
    queue,
    flush,
    get size() { return pending.size; },
  };
}
