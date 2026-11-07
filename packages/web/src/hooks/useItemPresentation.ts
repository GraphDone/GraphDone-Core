import { useCallback, useLayoutEffect, useMemo, useRef } from 'react';

export interface ItemPresentationRenderer {
  isCurrent: () => boolean;
  renderItems: (resuming: boolean) => void;
  presentOverview: () => void;
}

export function useItemPresentation(overviewActive: boolean, zooming?: () => boolean) {
  const renderer = useRef<ItemPresentationRenderer | null>(null);
  const zoomingRef = useRef(zooming);
  zoomingRef.current = zooming;
  const frame = useRef<number | null>(null);
  const overview = useRef(overviewActive);
  const hidden = useRef(false);
  const cancel = useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
  }, []);
  const refresh = useCallback(() => {
    cancel();
    const current = renderer.current;
    if (!current?.isCurrent()) return;
    if (overview.current) {
      hidden.current = true;
      current.presentOverview();
    } else {
      current.renderItems(hidden.current);
      hidden.current = false;
    }
  }, [cancel]);
  const clear = useCallback(() => {
    cancel();
    renderer.current = null;
    hidden.current = false;
  }, [cancel]);
  const bind = useCallback((next: ItemPresentationRenderer) => {
    cancel();
    renderer.current = next;
    hidden.current = false;
  }, [cancel]);
  const schedule = useCallback(() => {
    cancel();
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      refresh();
    });
  }, [cancel, refresh]);
  useLayoutEffect(() => {
    overview.current = overviewActive;
    // Leaving the overview while a programmatic zoom is still moving: an item pass now
    // would render every card at an intermediate scale and then again when the
    // zoom ends. The zoom's terminal schedule() renders them once instead.
    if (!overviewActive && zoomingRef.current?.()) return;
    refresh();
  }, [overviewActive, refresh]);
  useLayoutEffect(() => clear, [clear]);
  return useMemo(() => ({
    bind, clear, refresh, schedule,
    isOverview: () => overview.current,
  }), [bind, clear, refresh, schedule]);
}
