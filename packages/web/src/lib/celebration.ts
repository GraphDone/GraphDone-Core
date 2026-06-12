/**
 * LIVE-3: completing work deserves a moment of joy.
 *
 * A celebration is a ≤1.2s ring ripple + particle burst from the node, in
 * the node's type color. Contract (from docs/USER_STORIES.md): it never
 * blocks input, at most one runs per node at a time, and callers gate it on
 * the quality profile (particleCelebrations) which already folds in
 * prefers-reduced-motion.
 */

import * as d3 from 'd3';

const activeNodes = new Set<string>();

const LIFETIME_MS = 1200;
const PARTICLE_COUNT = 14;

export function spawnCelebration(
  layer: d3.Selection<SVGGElement, unknown, null, undefined>,
  nodeId: string,
  x: number,
  y: number,
  color: string
): boolean {
  if (activeNodes.has(nodeId)) return false;
  activeNodes.add(nodeId);

  const burst = layer
    .append('g')
    .attr('class', 'celebration-burst')
    .attr('transform', `translate(${x},${y})`)
    .style('pointer-events', 'none');

  burst
    .append('circle')
    .attr('r', 12)
    .attr('fill', 'none')
    .attr('stroke', color)
    .attr('stroke-width', 3)
    .attr('opacity', 0.9)
    .transition()
    .duration(700)
    .ease(d3.easeCubicOut)
    .attr('r', 95)
    .attr('stroke-width', 0.5)
    .attr('opacity', 0)
    .remove();

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const angle = (i / PARTICLE_COUNT) * 2 * Math.PI + (i % 2) * 0.2;
    const distance = 55 + (i % 3) * 28;
    burst
      .append('circle')
      .attr('r', 2.5 + (i % 3))
      .attr('fill', color)
      .attr('opacity', 1)
      .transition()
      .duration(850 + (i % 3) * 150)
      .ease(d3.easeCubicOut)
      .attr('cx', Math.cos(angle) * distance)
      .attr('cy', Math.sin(angle) * distance)
      .attr('r', 0.5)
      .attr('opacity', 0)
      .remove();
  }

  setTimeout(() => {
    burst.remove();
    activeNodes.delete(nodeId);
  }, LIFETIME_MS);

  return true;
}

/** Test hook: clear the per-node concurrency guard. */
export function __resetCelebrations(): void {
  activeNodes.clear();
}
