/**
 * Rolling performance meter for the graph view. Feeds the debug console
 * (FloatingConsole) and window.__graphPerf so visual-dynamics work is always
 * measured, never guessed. Pure logic — timestamps are injected.
 */

export interface PerfSummary {
  fps: number;
  avgTickMs: number;
  p95TickMs: number;
  worstTickMs: number;
  droppedFrames: number;
  samples: number;
}

export class PerfMeter {
  private tickDurations: number[] = [];
  private frameTimes: number[] = [];
  private readonly windowSize: number;

  constructor(windowSize = 240) {
    this.windowSize = windowSize;
  }

  /** Record one simulation tick's duration in ms. */
  tick(durationMs: number): void {
    this.tickDurations.push(durationMs);
    if (this.tickDurations.length > this.windowSize) this.tickDurations.shift();
  }

  /** Record a frame timestamp (ms, monotonic). */
  frame(timestampMs: number): void {
    this.frameTimes.push(timestampMs);
    if (this.frameTimes.length > this.windowSize) this.frameTimes.shift();
  }

  summary(): PerfSummary {
    const ticks = this.tickDurations;
    const frames = this.frameTimes;

    let fps = 0;
    let droppedFrames = 0;
    if (frames.length >= 2) {
      const gaps: number[] = [];
      for (let i = 1; i < frames.length; i++) gaps.push(frames[i] - frames[i - 1]);
      const span = frames[frames.length - 1] - frames[0];
      fps = span > 0 ? ((frames.length - 1) * 1000) / span : 0;
      const sorted = [...gaps].sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)] || 0;
      if (median > 0) droppedFrames = gaps.filter((g) => g > median * 1.5).length;
    }

    let avgTickMs = 0;
    let p95TickMs = 0;
    let worstTickMs = 0;
    if (ticks.length > 0) {
      avgTickMs = ticks.reduce((a, b) => a + b, 0) / ticks.length;
      const sorted = [...ticks].sort((a, b) => a - b);
      p95TickMs = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
      worstTickMs = sorted[sorted.length - 1];
    }

    return {
      fps: Math.round(fps * 10) / 10,
      avgTickMs: Math.round(avgTickMs * 100) / 100,
      p95TickMs: Math.round(p95TickMs * 100) / 100,
      worstTickMs: Math.round(worstTickMs * 100) / 100,
      droppedFrames,
      samples: ticks.length
    };
  }
}
