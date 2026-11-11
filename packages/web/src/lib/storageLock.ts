/**
 * A best-effort lock shared by the tabs of one browser through localStorage,
 * for pages without Web Locks: `navigator.locks` exists only on HTTPS and
 * localhost, so a self-hosted server reached over plain HTTP has none. A tab
 * writes its id with an expiry, waits a moment, and holds the lock only if its
 * id is still there; while it works it renews the expiry, and a closed tab's
 * lock expires.
 *
 * It is not a true mutual exclusion. localStorage has no compare-and-set, so
 * two tabs whose writes and re-reads interleave badly can both go ahead, and a
 * tab that is frozen (a background tab the browser suspends, a paused
 * debugger) for longer than the expiry stops renewing while it still works, so
 * another tab takes the lock. For the starter workspace the backstop is the
 * resume's duplicate cleanup, which removes the empty duplicate graphs such an
 * overlap can leave.
 */

export interface LockStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface StorageLockOptions {
  store: LockStore;
  ttlMs?: number;
  settleMs?: number;
  retryMs?: number;
  owner?: string;
}

type Held = { owner: string; expiresAt: number };

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

export async function withStorageLock<T>(name: string, task: () => Promise<T>, options: StorageLockOptions): Promise<T> {
  const { store, ttlMs = 15_000, settleMs = 100, retryMs = 250 } = options;
  const owner = options.owner ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  const key = `graphdone:lock:${name}`;
  const read = (): Held | null => {
    try {
      const held = JSON.parse(store.getItem(key) || 'null');
      return held && typeof held.owner === 'string' && typeof held.expiresAt === 'number' ? held : null;
    } catch {
      return null;
    }
  };
  const claim = () => store.setItem(key, JSON.stringify({ owner, expiresAt: Date.now() + ttlMs }));

  for (;;) {
    const held = read();
    if (!held || held.expiresAt <= Date.now()) {
      claim();
      await sleep(settleMs);
      if (read()?.owner === owner) break;
    }
    await sleep(retryMs);
  }

  let working = true;
  void (async () => {
    while (working) {
      await sleep(ttlMs / 3);
      if (working && read()?.owner === owner) claim();
    }
  })();
  try {
    return await task();
  } finally {
    working = false;
    if (read()?.owner === owner) store.removeItem(key);
  }
}
