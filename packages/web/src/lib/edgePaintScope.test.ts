import { describe, expect, it } from 'vitest';
import { edgeNeedsPaintGeometry } from './edgePaintScope';

describe('edge paint geometry scope', () => {
  it('keeps visible-priority edges that touch the viewport', () => {
    expect(edgeNeedsPaintGeometry({ _priorityVisible: true, source: { _culled: false }, target: { _culled: true } }, true)).toBe(true);
    expect(edgeNeedsPaintGeometry({ _priorityVisible: true, source: { _culled: true }, target: { _culled: false } }, true)).toBe(true);
  });

  it('skips summarized edges and edges wholly outside an active cull', () => {
    expect(edgeNeedsPaintGeometry({ _priorityVisible: false }, false)).toBe(false);
    expect(edgeNeedsPaintGeometry({ source: { _culled: true }, target: { _culled: true } }, true)).toBe(false);
  });

  it('keeps offscreen geometry when viewport culling is inactive', () => {
    expect(edgeNeedsPaintGeometry({ source: { _culled: true }, target: { _culled: true } }, false)).toBe(true);
  });
});
