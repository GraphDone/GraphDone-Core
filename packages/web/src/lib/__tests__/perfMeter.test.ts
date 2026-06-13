import { describe, it, expect } from 'vitest';
import { PerfMeter } from '../perfMeter';

describe('PerfMeter — the numbers behind the debug console', () => {
  it('computes fps from frame timestamps', () => {
    const m = new PerfMeter(120);
    for (let t = 0; t <= 1000; t += 16.67) m.frame(t);
    const s = m.summary();
    expect(s.fps).toBeGreaterThan(55);
    expect(s.fps).toBeLessThan(65);
  });

  it('tracks tick duration stats: avg, p95, worst', () => {
    const m = new PerfMeter(120);
    for (let i = 0; i < 99; i++) m.tick(2);
    m.tick(40); // one stall
    const s = m.summary();
    expect(s.avgTickMs).toBeGreaterThan(2);
    expect(s.avgTickMs).toBeLessThan(3);
    expect(s.worstTickMs).toBe(40);
    expect(s.p95TickMs).toBeLessThanOrEqual(40);
    expect(s.p95TickMs).toBeGreaterThanOrEqual(2);
  });

  it('counts dropped frames (gap > 1.5x the median)', () => {
    const m = new PerfMeter(240);
    let t = 0;
    for (let i = 0; i < 60; i++) { m.frame(t); t += 16; }
    m.frame((t += 100)); // big stall
    for (let i = 0; i < 10; i++) { m.frame(t); t += 16; }
    expect(m.summary().droppedFrames).toBeGreaterThanOrEqual(1);
  });

  it('windows out old samples', () => {
    const m = new PerfMeter(10);
    for (let i = 0; i < 100; i++) m.tick(100);
    for (let i = 0; i < 10; i++) m.tick(1);
    expect(m.summary().avgTickMs).toBeLessThan(2);
  });

  it('returns zeros before any samples', () => {
    const s = new PerfMeter(10).summary();
    expect(s.fps).toBe(0);
    expect(s.avgTickMs).toBe(0);
    expect(s.droppedFrames).toBe(0);
  });
});

import { DriftMeter } from '../perfMeter';

describe('DriftMeter — quantifies node slip/drift (the physics-tuning signal)', () => {
  it('reports ~0 step for nodes that do not move (e.g. pinned)', () => {
    const m = new DriftMeter();
    const nodes = [{ id: 'a', x: 100, y: 100 }, { id: 'b', x: 200, y: 50 }];
    m.sample(nodes);          // prime
    const s = m.sample(nodes); // unchanged
    expect(s.maxStepPx).toBe(0);
    expect(s.movingNodes).toBe(0);
  });

  it('measures the largest and mean per-sample movement', () => {
    const m = new DriftMeter();
    m.sample([{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 0, y: 0 }]);
    const s = m.sample([{ id: 'a', x: 3, y: 4 }, { id: 'b', x: 0, y: 0 }]); // a moved 5px
    expect(s.maxStepPx).toBe(5);
    expect(s.meanStepPx).toBeCloseTo(2.5, 5);
    expect(s.movingNodes).toBe(1);
  });

  it('computes RMS distance from saved positions (snapshot fidelity)', () => {
    const m = new DriftMeter();
    // a is exactly on its saved spot, b is 10px off
    const s = m.sample([
      { id: 'a', x: 50, y: 50, positionX: 50, positionY: 50 },
      { id: 'b', x: 60, y: 50, positionX: 50, positionY: 50 },
    ]);
    // rms = sqrt((0^2 + 10^2)/2) = sqrt(50) ≈ 7.07
    expect(s.rmsFromSavedPx).toBeCloseTo(7.07, 1);
  });

  it('rmsFromSavedPx is 0 when every node sits on its saved position', () => {
    const m = new DriftMeter();
    const s = m.sample([{ id: 'a', x: 5, y: 5, positionX: 5, positionY: 5 }]);
    expect(s.rmsFromSavedPx).toBe(0);
  });

  it('ignores nodes without numeric coordinates', () => {
    const m = new DriftMeter();
    const s = m.sample([{ id: 'a' }, { id: 'b', x: 1, y: 1 }]);
    expect(s.maxStepPx).toBe(0); // first sample, no prev
    expect(() => m.sample([{ id: 'a' }])).not.toThrow();
  });
});
