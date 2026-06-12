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
