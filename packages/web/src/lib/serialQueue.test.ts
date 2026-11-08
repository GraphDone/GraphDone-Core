import { describe, expect, it } from 'vitest';
import { createSerialQueue } from './serialQueue';

const deferred = () => {
  let resolve!: () => void, reject!: (error: Error) => void;
  const promise = new Promise<void>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};

describe('createSerialQueue', () => {
  it('starts a task only after the previous one with the same key settles', async () => {
    const enqueue = createSerialQueue();
    const first = deferred();
    const started: string[] = [];
    const a = enqueue('item', async () => { started.push('a'); await first.promise; return 'a'; });
    const b = enqueue('item', async () => { started.push('b'); return 'b'; });
    await Promise.resolve(); await Promise.resolve();
    expect(started).toEqual(['a']);
    first.resolve();
    expect(await a).toBe('a');
    expect(await b).toBe('b');
    expect(started).toEqual(['a', 'b']);
  });

  it('runs different keys side by side', async () => {
    const enqueue = createSerialQueue();
    const blocker = deferred();
    const started: string[] = [];
    void enqueue('one', async () => { started.push('one'); await blocker.promise; });
    await enqueue('two', async () => { started.push('two'); });
    expect(started).toEqual(['one', 'two']);
    blocker.resolve();
  });

  it('keeps going after a failure, and the failing caller still sees it', async () => {
    const enqueue = createSerialQueue();
    const failed = enqueue('item', async () => { throw new Error('offline'); });
    const next = enqueue('item', async () => 'saved');
    await expect(failed).rejects.toThrow('offline');
    expect(await next).toBe('saved');
  });
});
