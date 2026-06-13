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

export interface DriftSummary {
  /** largest single-node movement since the previous sample, px */
  maxStepPx: number;
  /** mean movement across all nodes since the previous sample, px */
  meanStepPx: number;
  /** how many nodes moved more than ~0.5px since the previous sample */
  movingNodes: number;
  /** RMS distance of nodes from their saved (positionX/Y) position, px —
   * the direct measure of "how far has the layout drifted from what was saved" */
  rmsFromSavedPx: number;
}

type DriftNode = { id: string; x?: number; y?: number; positionX?: number; positionY?: number };

/**
 * Quantifies node MOVEMENT — i.e. "slip and drift" — which the PerfMeter
 * (frame health) deliberately does not. Pure: feed it node positions each
 * sample. Pinned/settled nodes report ~0 step; an unstable layout reports
 * persistent non-zero steps, and rmsFromSavedPx shows snapshot fidelity.
 */
export class DriftMeter {
  private prev = new Map<string, { x: number; y: number }>();

  sample(nodes: DriftNode[]): DriftSummary {
    let maxStep = 0;
    let sumStep = 0;
    let moving = 0;
    let sumSqFromSaved = 0;
    let counted = 0;

    for (const n of nodes) {
      if (typeof n.x !== 'number' || typeof n.y !== 'number') continue;
      counted++;
      const last = this.prev.get(n.id);
      if (last) {
        const step = Math.hypot(n.x - last.x, n.y - last.y);
        maxStep = Math.max(maxStep, step);
        sumStep += step;
        if (step > 0.5) moving++;
      }
      this.prev.set(n.id, { x: n.x, y: n.y });

      if (typeof n.positionX === 'number' && typeof n.positionY === 'number') {
        const d = Math.hypot(n.x - n.positionX, n.y - n.positionY);
        sumSqFromSaved += d * d;
      }
    }

    const round = (v: number) => Math.round(v * 100) / 100;
    return {
      maxStepPx: round(maxStep),
      meanStepPx: counted ? round(sumStep / counted) : 0,
      movingNodes: moving,
      rmsFromSavedPx: counted ? round(Math.sqrt(sumSqFromSaved / counted)) : 0,
    };
  }

  reset(): void {
    this.prev.clear();
  }
}
