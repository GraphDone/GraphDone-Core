import { describe, it, expect, vi } from 'vitest';
import { drainWithLimit, createPositionSaveQueue } from '../positionSaveQueue';

const defer = () => { let resolve!: () => void; const p = new Promise<void>((r) => { resolve = r; }); return { p, resolve }; };

describe('drainWithLimit', () => {
  it('never exceeds the concurrency limit and runs every item', async () => {
    let inFlight = 0; let maxInFlight = 0; const done: number[] = [];
    const items = Array.from({ length: 50 }, (_, i) => i);
    await drainWithLimit(items, 4, async (i) => {
      inFlight++; maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 1));
      inFlight--; done.push(i);
    });
    expect(maxInFlight).toBeLessThanOrEqual(4);
    expect(done.sort((a, b) => a - b)).toEqual(items);
  });

  it('handles empty + tiny batches without exceeding item count', async () => {
    let max = 0; let n = 0;
    await drainWithLimit([1, 2], 10, async () => { n++; max = Math.max(max, n); await Promise.resolve(); n--; });
    expect(max).toBeLessThanOrEqual(2);
    await expect(drainWithLimit([], 4, async () => { throw new Error('should not run'); })).resolves.toBeUndefined();
  });
});

describe('createPositionSaveQueue', () => {
  it('coalesces repeated writes for the same node — last position wins', async () => {
    const saved: Array<{ id: string; x: number; y: number }> = [];
    const q = createPositionSaveQueue({ save: async (s) => { saved.push(s); } });
    q.queue('a', 1, 1); q.queue('a', 2, 2); q.queue('a', 9, 9); q.queue('b', 5, 5);
    expect(q.size).toBe(2); // only 2 distinct nodes pending
    await q.flush();
    expect(saved).toHaveLength(2); // one write per node, not 4
    expect(saved.find((s) => s.id === 'a')).toEqual({ id: 'a', x: 9, y: 9 });
  });

  it('caps in-flight writes at the configured concurrency', async () => {
    let inFlight = 0; let max = 0;
    const q = createPositionSaveQueue({
      concurrency: 3,
      save: async () => { inFlight++; max = Math.max(max, inFlight); await new Promise((r) => setTimeout(r, 1)); inFlight--; },
    });
    for (let i = 0; i < 30; i++) q.queue(`n${i}`, i, i);
    await q.flush();
    expect(max).toBeLessThanOrEqual(3);
    expect(q.size).toBe(0);
  });

  it('a save queued mid-flush is not lost (coalesced into a follow-up round)', async () => {
    const saved: string[] = [];
    const gate = defer();
    let first = true;
    const q = createPositionSaveQueue({
      concurrency: 1,
      save: async (s) => {
        saved.push(s.id);
        if (first) { first = false; q.queue('late', 0, 0); await gate.p; } // queue during the flush
      },
    });
    q.queue('early', 0, 0);
    const flushing = q.flush();
    gate.resolve();
    await flushing;
    expect(saved).toContain('early');
    expect(saved).toContain('late');
    expect(q.size).toBe(0);
  });

  it('retains failed writes for a later retry without dropping the rest of the batch', async () => {
    const saved: string[] = [];
    let offline = true;
    const q = createPositionSaveQueue({
      concurrency: 1,
      save: async ({ id }) => {
        if (offline) throw new Error('Connection lost');
        saved.push(id);
      },
    });
    q.queue('a', 1, 2);
    q.queue('b', 3, 4);

    await expect(q.flush()).rejects.toThrow();
    expect(q.size).toBe(2);
    expect(saved).toEqual([]);

    offline = false;
    await q.flush();
    expect(saved).toEqual(['a', 'b']);
    expect(q.size).toBe(0);
  });

  it('keeps the newest position when an older in-flight write fails', async () => {
    const gate = defer();
    const saved: Array<{ id: string; x: number; y: number }> = [];
    let first = true;
    const q = createPositionSaveQueue({
      save: async (position) => {
        if (first) {
          first = false;
          await gate.p;
          throw new Error('Connection lost');
        }
        saved.push(position);
      },
    });
    q.queue('a', 1, 2);
    const failed = expect(q.flush()).rejects.toThrow();
    q.queue('a', 9, 10);
    gate.resolve();
    await failed;

    expect(q.size).toBe(1);
    await q.flush();
    expect(saved).toEqual([{ id: 'a', x: 9, y: 10 }]);
  });

  it('waits for every in-flight save before releasing a failed flush', async () => {
    const gate = defer();
    const failed = defer();
    let inFlight = 0;
    let peak = 0;
    let rejectFirst = true;
    const q = createPositionSaveQueue({
      concurrency: 2,
      save: async ({ id }) => {
        inFlight++;
        peak = Math.max(peak, inFlight);
        try {
          if (id === 'a' && rejectFirst) {
            await Promise.resolve();
            failed.resolve();
            throw new Error('Connection lost');
          }
          if (id === 'b') await gate.p;
        } finally {
          inFlight--;
        }
      },
    });
    q.queue('a', 1, 1);
    q.queue('b', 2, 2);
    let settled = false;
    const first = q.flush();
    const observed = first.catch(() => { settled = true; });
    await failed.p;
    await Promise.resolve();
    let secondSettled = false;
    const second = q.flush().then(
      () => { secondSettled = true; },
      () => { secondSettled = true; },
    );
    await Promise.resolve();
    expect(settled).toBe(false);
    expect(secondSettled).toBe(false);

    gate.resolve();
    await Promise.all([observed, second]);
    expect(inFlight).toBe(0);
    rejectFirst = false;
    await q.flush();
    expect(peak).toBe(2);
    expect(q.size).toBe(0);
  });
});


describe('bounded pending position retention', () => {
  it('counts in-flight tasks toward the bound and retains the newest accepted position', async () => {
    let resolve!: () => void;
    const save = vi.fn().mockImplementationOnce(() => new Promise<void>(done => { resolve = done; })).mockResolvedValue(undefined);
    const queue = createPositionSaveQueue({ save, maxPending: 1 });
    queue.queue('task-a', 1, 2);
    const saving = queue.flush();
    expect(() => queue.queue('task-b', 3, 4)).toThrow('Too many pending layout changes');
    expect(() => queue.queue('task-a', 5, 6)).not.toThrow();
    resolve();
    await saving;
    expect(save.mock.calls.map(([position]) => position)).toEqual([
      { id: 'task-a', x: 1, y: 2 }, { id: 'task-a', x: 5, y: 6 },
    ]);
    expect(() => queue.queue('task-b', 3, 4)).not.toThrow();
    await queue.flush();
    expect(save).toHaveBeenLastCalledWith({ id: 'task-b', x: 3, y: 4 });
  });
});
