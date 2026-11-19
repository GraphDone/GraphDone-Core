// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import { beginNodeDetails, releaseNodeDetails, shouldCreateNodeDetails } from './lazyNodeDetails';

describe('lazy node details viewport', () => {
  const viewport = { width: 1000, height: 600 };

  it('includes visible cards and the pan margin', () => {
    expect(shouldCreateNodeDetails({ x: 500, y: 300 }, { x: 0, y: 0, k: 1 }, viewport)).toBe(true);
    expect(shouldCreateNodeDetails({ x: -250, y: 300 }, { x: 0, y: 0, k: 1 }, viewport)).toBe(true);
    expect(shouldCreateNodeDetails({ x: -301, y: 300 }, { x: 0, y: 0, k: 1 }, viewport)).toBe(false);
  });

  it('uses the live camera transform', () => {
    const node = { x: 2000, y: 1000 };
    expect(shouldCreateNodeDetails(node, { x: 0, y: 0, k: 1 }, viewport)).toBe(false);
    expect(shouldCreateNodeDetails(node, { x: -1600, y: -700, k: 1 }, viewport)).toBe(true);
    expect(shouldCreateNodeDetails(node, { x: 0, y: 0, k: 0.25 }, viewport)).toBe(true);
  });
});

describe('lazy node detail lifecycle', () => {
  it('hydrates once, retains active cards, then permits rehydration after release', () => {
    const card = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    expect(beginNodeDetails(card)).toBe(true);
    expect(beginNodeDetails(card)).toBe(false);
    let removed = 0;
    expect(releaseNodeDetails(card, true, () => removed++)).toBe(false);
    expect(card.hasAttribute('data-node-details')).toBe(true);
    expect(releaseNodeDetails(card, false, () => removed++)).toBe(true);
    expect(removed).toBe(1);
    expect(card.hasAttribute('data-node-details')).toBe(false);
    expect(beginNodeDetails(card)).toBe(true);
  });
});
