import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CPUMonitor as Monitor } from '../src/utils/cpu-monitor';

const sample = vi.hoisted(() => ({ user: 0, system: 0, idle: 0, userStep: 0, systemStep: 0, idleStep: 100, now: 0 }));
vi.mock('os', async importOriginal => {
  const actual = await importOriginal<typeof import('os')>();
  return {
    ...actual,
    cpus: () => [{
      model: 'controlled CPU sample', speed: 1000,
      times: { user: sample.user += sample.userStep, nice: 0, sys: sample.system += sample.systemStep, idle: sample.idle += sample.idleStep, irq: 0 },
    }],
  };
});
vi.mock('perf_hooks', async importOriginal => {
  const actual = await importOriginal<typeof import('perf_hooks')>();
  return { ...actual, performance: { now: () => sample.now } };
});

let monitor: Monitor;
let cpu: typeof import('../src/utils/cpu-monitor');
function load(user: number, idle: number, system = 0) {
  sample.userStep = user;
  sample.idleStep = idle;
  sample.systemStep = system;
}

beforeEach(async () => {
  vi.useFakeTimers();
  vi.resetModules();
  Object.assign(sample, { user: 0, system: 0, idle: 0, userStep: 0, systemStep: 0, idleStep: 100, now: 0 });
  cpu = await import('../src/utils/cpu-monitor');
  monitor = cpu.CPUMonitor.getInstance();
  monitor.disableTestMode();
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe('CPU protection with deterministic samples', () => {
  it('measures busy CPU deltas and enforces the production threshold', () => {
    load(60, 25, 15);
    expect(monitor.getCurrentCPUUsage()).toEqual({ user: 60, system: 15, idle: 25, total: 100, percentage: 75 });
    expect(monitor.shouldThrottle()).toEqual({ throttle: false });
    load(90, 10);
    expect(monitor.shouldThrottle()).toEqual({ throttle: true, reason: 'CPU usage too high (90.0% > 80%)', waitMs: 100 });
  });

  it('rejects sustained CPU exhaustion after bounded retries without running work', async () => {
    load(100, 0);
    const work = vi.fn().mockResolvedValue('should not run');
    const result = expect(cpu.withCPUThrottling(work, 'controlled operation')).rejects.toThrow('CPU exhaustion protection activated for controlled operation');
    await vi.advanceTimersByTimeAsync(300);
    await result;
    expect(work).not.toHaveBeenCalled();
  });

  it('executes once after CPU usage recovers within the retry budget', async () => {
    load(100, 0);
    const work = vi.fn().mockResolvedValue('saved');
    const result = monitor.executeWithThrottling(work);
    expect(work).not.toHaveBeenCalled();
    load(0, 100);
    await vi.advanceTimersByTimeAsync(100);
    await expect(result).resolves.toBe('saved');
    expect(work).toHaveBeenCalledTimes(1);
  });

  it('limits operation rate and permits work in the next time window', () => {
    for (let index = 0; index < 1000; index++) monitor.recordOperation();
    expect(monitor.shouldThrottle()).toEqual({ throttle: true, reason: 'Operation rate limit exceeded (1000/1000 per 1000ms)', waitMs: 1000 });
    sample.now = 1000;
    expect(monitor.shouldThrottle()).toEqual({ throttle: false });
  });

  it('retains sustained-load protection after the instantaneous sample recovers', () => {
    load(100, 0);
    for (let index = 0; index < 10; index++) monitor.getCurrentCPUUsage();
    load(0, 100);
    const stress = cpu.isSystemUnderStress();
    expect(stress.stressed).toBe(true);
    expect(stress.metrics.current).toBe(0);
    expect(stress.metrics.average).toBe(90);
    expect(stress.metrics.testMode).toBe(false);
  });

  it('blocks GraphService before opening a database session under CPU stress', async () => {
    const { GraphService } = await import('../src/services/graph-service');
    const session = vi.fn();
    const service = new GraphService({ session } as any);
    load(100, 0);
    await expect(service.createNode({ title: 'CPU protected node', type: 'TASK' })).rejects.toThrow('System under CPU stress - operation blocked');
    expect(session).not.toHaveBeenCalled();
  });

  it('does not retry a failed operation after work has begun', async () => {
    const failure = new Error('database unavailable');
    const work = vi.fn().mockRejectedValue(failure);
    await expect(monitor.executeWithThrottling(work)).rejects.toBe(failure);
    expect(work).toHaveBeenCalledTimes(1);
  });
});
