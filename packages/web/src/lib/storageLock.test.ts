import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { withStorageLock, type LockStore } from './storageLock';

const memoryStore = (): LockStore & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return {
    data,
    getItem: key => data.get(key) ?? null,
    setItem: (key, value) => { data.set(key, value); },
    removeItem: key => { data.delete(key); },
  };
};

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

describe('the localStorage lock used without Web Locks', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'Date'] });
    vi.setSystemTime(1_000_000);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('lets two tabs that ask at the same moment work one after the other', async () => {
    const store = memoryStore();
    const log: string[] = [];
    const tab = (owner: string) => withStorageLock('starter', async () => {
      log.push(`${owner} starts`);
      await wait(2000);
      log.push(`${owner} ends`);
      return owner;
    }, { store, owner });
    const both = Promise.all([tab('A'), tab('B')]);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(await both).toEqual(['A', 'B']);
    expect(log).toHaveLength(4);
    expect(log[0].split(' ')[0]).toBe(log[1].split(' ')[0]);
    expect(log[1]).toMatch(/ends$/);
    expect(store.data.size, 'released').toBe(0);
  });

  it('lets only the last of two tabs that claimed at the same moment go ahead', async () => {
    const store = memoryStore();
    let staleReads = 1;
    const staleForB: LockStore = { ...store, getItem: key => (staleReads-- > 0 ? null : store.getItem(key)) };
    const running: string[] = [];
    const overlaps: string[] = [];
    const tab = (owner: string, view: LockStore) => withStorageLock('starter', async () => {
      if (running.length) overlaps.push(`${owner} with ${running.join(', ')}`);
      running.push(owner);
      await wait(2000);
      running.splice(running.indexOf(owner), 1);
      return owner;
    }, { store: view, owner });
    const a = tab('A', store);
    const b = tab('B', staleForB);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(await Promise.all([a, b])).toEqual(['A', 'B']);
    expect(overlaps).toEqual([]);
  });

  it('keeps the lock past its expiry while the work goes on', async () => {
    const store = memoryStore();
    const log: string[] = [];
    const slow = withStorageLock('starter', async () => { log.push('slow starts'); await wait(60_000); log.push('slow ends'); }, { store, owner: 'slow' });
    await vi.advanceTimersByTimeAsync(1000);
    const next = withStorageLock('starter', async () => { log.push('next starts'); }, { store, owner: 'next' });
    await vi.advanceTimersByTimeAsync(45_000);
    expect(log).toEqual(['slow starts']);
    await vi.advanceTimersByTimeAsync(20_000);
    await Promise.all([slow, next]);
    expect(log).toEqual(['slow starts', 'slow ends', 'next starts']);
  });

  it('takes over the lock of a tab that closed without releasing it, once it expires', async () => {
    const store = memoryStore();
    store.setItem('graphdone:lock:starter', JSON.stringify({ owner: 'closed tab', expiresAt: Date.now() + 15_000 }));
    let started = false;
    const work = withStorageLock('starter', async () => { started = true; }, { store, owner: 'me' });
    await vi.advanceTimersByTimeAsync(14_000);
    expect(started).toBe(false);
    await vi.advanceTimersByTimeAsync(2000);
    await work;
    expect(started).toBe(true);
  });

  it('releases the lock when the work fails', async () => {
    const store = memoryStore();
    const failing = withStorageLock('starter', async () => { throw new Error('write failed'); }, { store, owner: 'me' });
    const settled = failing.catch(error => error.message);
    await vi.advanceTimersByTimeAsync(1000);
    expect(await settled).toBe('write failed');
    expect(store.data.size).toBe(0);
  });
});
