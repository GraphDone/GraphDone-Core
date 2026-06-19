import { describe, it, expect } from 'vitest';
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
});
