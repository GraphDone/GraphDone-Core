// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as d3 from 'd3';
import { spawnCelebration, __resetCelebrations } from '../celebration';

describe('spawnCelebration (LIVE-3)', () => {
  let layer: d3.Selection<SVGGElement, unknown, null, undefined>;

  beforeEach(() => {
    vi.useFakeTimers();
    __resetCelebrations();
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    svg.appendChild(g);
    document.body.appendChild(svg);
    layer = d3.select(g as SVGGElement);
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('spawns a burst group that never blocks input', () => {
    expect(spawnCelebration(layer, 'n1', 10, 20, '#4ade80')).toBe(true);
    const burst = layer.select<SVGGElement>('.celebration-burst');
    expect(burst.empty()).toBe(false);
    expect(burst.style('pointer-events')).toBe('none');
  });

  it('allows at most one concurrent celebration per node', () => {
    expect(spawnCelebration(layer, 'n1', 0, 0, '#fff')).toBe(true);
    expect(spawnCelebration(layer, 'n1', 0, 0, '#fff')).toBe(false);
    expect(spawnCelebration(layer, 'n2', 0, 0, '#fff')).toBe(true);
    expect(layer.selectAll('.celebration-burst').size()).toBe(2);
  });

  it('cleans up within 1.2s and allows the node to celebrate again', () => {
    spawnCelebration(layer, 'n1', 0, 0, '#fff');
    vi.advanceTimersByTime(1250);
    expect(layer.selectAll('.celebration-burst').size()).toBe(0);
    expect(spawnCelebration(layer, 'n1', 0, 0, '#fff')).toBe(true);
  });
});
