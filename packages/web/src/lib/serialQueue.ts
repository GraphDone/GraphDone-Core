/**
 * Runs tasks that share a key one after another, in the order they were
 * queued; tasks with different keys run side by side. A failed task does not
 * block the ones after it (its caller still sees the failure).
 *
 * Quick edit saves each change as it happens. Two quick changes to the same
 * item (priority End, then ArrowLeft) would otherwise be two requests in
 * flight at once, and if the first one landed last it would overwrite the
 * second: the person's last choice must be what is stored.
 */
export function createSerialQueue() {
  const tails = new Map<string, Promise<unknown>>();
  return function enqueue<T>(key: string, task: () => Promise<T>): Promise<T> {
    const run = (tails.get(key) ?? Promise.resolve()).then(task, task);
    const tail = run.then(() => undefined, () => undefined);
    tails.set(key, tail);
    void tail.then(() => { if (tails.get(key) === tail) tails.delete(key); });
    return run;
  };
}
