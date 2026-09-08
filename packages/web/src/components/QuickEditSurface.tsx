import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useDialog } from '../hooks/useDialogManager';
import { useModalA11y } from '../hooks/useModalA11y';

/** Keep the editor reachable when rotating a phone or opening its keyboard. */
export function QuickEditSurface({
  x,
  y,
  onClose,
  children,
}: {
  x: number;
  y: number;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const dragStart = useRef<number | null>(null);
  const [bounds, setBounds] = useState({
    left: 8,
    top: 8,
    width: 320,
    maxHeight: 400,
    sheet: false,
  });
  useDialog(true, onClose);
  useModalA11y(ref, { isOpen: true, label: 'Edit work item' });

  useLayoutEffect(() => {
    const place = () => {
      const viewport = window.visualViewport;
      const width = viewport?.width ?? window.innerWidth;
      const height = viewport?.height ?? window.innerHeight;
      const vx = viewport?.offsetLeft ?? 0;
      const vy = viewport?.offsetTop ?? 0;
      const sheet =
        width < 640 ||
        (height < 500 && window.matchMedia('(pointer: coarse)').matches);
      const editorWidth = Math.min(sheet ? 480 : 352, width - 16);
      const headerBottom = Math.max(vy, ...Array.from(document.querySelectorAll('[data-workspace-header]')).filter(el => el.getClientRects().length).map(el => el.getBoundingClientRect().bottom));
      const topBoundary = height - (headerBottom - vy) >= 420 ? headerBottom : vy;
      const maxHeight = Math.max(80, height - (topBoundary - vy) - 16);
      const editorHeight = Math.min(
        ref.current?.scrollHeight || maxHeight,
        maxHeight
      );
      const left = sheet
        ? vx + (width - editorWidth) / 2
        : Math.max(
            vx + 8,
            Math.min(x - editorWidth / 2, vx + width - editorWidth - 8)
          );
      const top = sheet
        ? vy + height - editorHeight - 8
        : Math.max(
            topBoundary + 8,
            Math.min(y - editorHeight / 2, vy + height - editorHeight - 8)
          );
      setBounds(previous => {
        const next = { left, top, width: editorWidth, maxHeight, sheet };
        return Object.keys(next).every(
          k => previous[k as keyof typeof next] === next[k as keyof typeof next]
        )
          ? previous
          : next;
      });
    };
    place();
    const observer = new ResizeObserver(place);
    if (ref.current) observer.observe(ref.current);
    window.addEventListener('resize', place);
    window.visualViewport?.addEventListener('resize', place);
    window.visualViewport?.addEventListener('scroll', place);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', place);
      window.visualViewport?.removeEventListener('resize', place);
      window.visualViewport?.removeEventListener('scroll', place);
    };
  }, [x, y]);

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[999998] bg-black/20"
        onPointerDown={onClose}
        aria-hidden="true"
      />
      <div
        ref={ref}
        data-testid="quick-edit-surface"
        data-layout={bounds.sheet ? 'sheet' : 'popover'}
        className="fixed z-[999999] overflow-y-auto overscroll-contain rounded-xl bg-gray-900 shadow-2xl"
        style={{
          left: bounds.left,
          top: bounds.top,
          width: bounds.width,
          maxHeight: bounds.maxHeight,
        }}
        onClick={event => event.stopPropagation()}
        onKeyDown={event => {
          if (event.key === 'Escape' && !event.defaultPrevented) {
            event.stopPropagation();
            onClose();
          }
        }}
      >
        {bounds.sheet && (
          <button
            aria-label="Close editor or swipe down"
            className="w-full min-h-[44px] flex justify-center items-center touch-none"
            onClick={onClose}
            onPointerDown={event => {
              dragStart.current = event.clientY;
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerUp={event => {
              if (
                dragStart.current !== null &&
                event.clientY - dragStart.current > 60
              )
                onClose();
              dragStart.current = null;
            }}
          >
            <span className="h-1 w-10 rounded-full bg-gray-500" />
          </button>
        )}
        {children}
      </div>
    </>,
    document.body
  );
}
