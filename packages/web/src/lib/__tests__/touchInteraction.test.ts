import { describe, it, expect } from 'vitest';
import {
  MIN_TOUCH_TARGET, isTap, isLongPress, touchHitSize, distance, isCoarsePointer,
} from '../touchInteraction';

describe('isTap', () => {
  it('quick + still = tap', () => {
    expect(isTap(120, 3)).toBe(true);
    expect(isTap(0, 0)).toBe(true);
  });
  it('moved past slop = not a tap (it is a drag/pan)', () => {
    expect(isTap(120, 40)).toBe(false);
  });
  it('held too long = not a tap (it is a long-press)', () => {
    expect(isTap(600, 2)).toBe(false);
  });
});

describe('isLongPress', () => {
  it('held + still = long-press', () => {
    expect(isLongPress(600, 4)).toBe(true);
  });
  it('moved = not a long-press', () => {
    expect(isLongPress(600, 40)).toBe(false);
  });
  it('quick = not a long-press', () => {
    expect(isLongPress(120, 2)).toBe(false);
  });
  it('tap and long-press are mutually exclusive across the boundary', () => {
    expect(isTap(499, 0)).toBe(true);
    expect(isLongPress(499, 0)).toBe(false);
    expect(isTap(500, 0)).toBe(false);
    expect(isLongPress(500, 0)).toBe(true);
  });
});

describe('touchHitSize', () => {
  it('enforces the 44px minimum on touch, never shrinking a larger control', () => {
    expect(touchHitSize(16, true)).toBe(MIN_TOUCH_TARGET);
    expect(touchHitSize(24, true)).toBe(44);
    expect(touchHitSize(60, true)).toBe(60);
  });
  it('leaves the visual size untouched on a mouse pointer', () => {
    expect(touchHitSize(16, false)).toBe(16);
  });
});

describe('distance', () => {
  it('is euclidean', () => {
    expect(distance(0, 0, 3, 4)).toBe(5);
    expect(distance(1, 1, 1, 1)).toBe(0);
  });
});

describe('isCoarsePointer', () => {
  it('does not throw without a browser matchMedia', () => {
    expect(typeof isCoarsePointer()).toBe('boolean');
  });
});
