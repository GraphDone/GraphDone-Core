import { describe, it, expect } from 'vitest';
import { WELCOME_NODES, WELCOME_EDGES } from './onboarding.js';

/**
 * The Welcome graph is the first thing every new user sees, so it must model
 * the layout rules the app enforces everywhere else:
 *   - every node is "placed" (pinned) so the seed positions are authoritative
 *     and don't drift (a node at exactly (0,0) is treated as unplaced/unpinned);
 *   - simple template relationships are ORTHOGONAL — every edge is purely
 *     horizontal or vertical (the user's stated preference for simple graphs);
 *   - connected nodes sit far enough apart for the edge label to fit with only
 *     a small margin (the min-edge-length rule), not crammed together.
 */

// Card footprint (≈ getNodeDimensions) + the min-edge math used by the renderer.
const CARD_W = 170;
const CARD_H = 106;
const LABEL_W = 90;     // a typical relationship label ("Depends On") width
const LABEL_MARGIN = 14;

// Per-axis half-extent the card covers along a horizontal / vertical edge.
const reachH = CARD_W / 2; // 85
const reachV = CARD_H / 2; // 53

describe('Welcome onboarding template', () => {
  it('places every node (no node pinned at the unplaced origin)', () => {
    for (const n of WELCOME_NODES) {
      const atOrigin = n.positionX === 0 && n.positionY === 0;
      expect(atOrigin, `"${n.title}" sits at (0,0) and would be unpinned/drift`).toBe(false);
    }
  });

  it('draws every edge orthogonally (horizontal or vertical)', () => {
    for (const e of WELCOME_EDGES) {
      const s = WELCOME_NODES[e.sourceIndex];
      const t = WELCOME_NODES[e.targetIndex];
      const dx = Math.abs(s.positionX - t.positionX);
      const dy = Math.abs(s.positionY - t.positionY);
      const orthogonal = dx < 1 || dy < 1;
      expect(
        orthogonal,
        `edge ${e.sourceIndex}->${e.targetIndex} ("${s.title}"->"${t.title}") is diagonal: dx=${dx} dy=${dy}`
      ).toBe(true);
    }
  });

  it('spaces connected nodes so the edge label fits with a small margin', () => {
    for (const e of WELCOME_EDGES) {
      const s = WELCOME_NODES[e.sourceIndex];
      const t = WELCOME_NODES[e.targetIndex];
      const dx = Math.abs(s.positionX - t.positionX);
      const dy = Math.abs(s.positionY - t.positionY);
      const horizontal = dy < 1;
      const centerDist = horizontal ? dx : dy;
      const reach = horizontal ? reachH : reachV;
      const gap = centerDist - 2 * reach;
      expect(
        gap,
        `edge ${e.sourceIndex}->${e.targetIndex} gap ${gap.toFixed(0)}px < label ${LABEL_W}+${LABEL_MARGIN}`
      ).toBeGreaterThanOrEqual(LABEL_W + LABEL_MARGIN);
    }
  });

  it('keeps the graph connected (every node touched by an edge)', () => {
    const touched = new Set<number>();
    for (const e of WELCOME_EDGES) {
      touched.add(e.sourceIndex);
      touched.add(e.targetIndex);
    }
    for (let i = 0; i < WELCOME_NODES.length; i++) {
      expect(touched.has(i), `"${WELCOME_NODES[i].title}" has no edges`).toBe(true);
    }
  });

  it('routes no edge straight through a non-endpoint node', () => {
    for (const e of WELCOME_EDGES) {
      const s = WELCOME_NODES[e.sourceIndex];
      const t = WELCOME_NODES[e.targetIndex];
      const horizontal = Math.abs(s.positionY - t.positionY) < 1;
      for (let i = 0; i < WELCOME_NODES.length; i++) {
        if (i === e.sourceIndex || i === e.targetIndex) continue;
        const n = WELCOME_NODES[i];
        const onLine = horizontal
          ? Math.abs(n.positionY - s.positionY) < 1 &&
            n.positionX > Math.min(s.positionX, t.positionX) &&
            n.positionX < Math.max(s.positionX, t.positionX)
          : Math.abs(n.positionX - s.positionX) < 1 &&
            n.positionY > Math.min(s.positionY, t.positionY) &&
            n.positionY < Math.max(s.positionY, t.positionY);
        expect(onLine, `edge ${e.sourceIndex}->${e.targetIndex} passes through "${n.title}"`).toBe(false);
      }
    }
  });
});
