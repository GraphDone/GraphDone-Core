import { RefObject, useEffect } from 'react';

/**
 * Accessibility primitive for modal dialogs. When `isOpen`, it:
 *  - marks the container as role="dialog" aria-modal="true" (keeps an existing
 *    role if one is already set) and labels it (aria-label / aria-labelledby);
 *  - moves focus into the dialog on open (first focusable, or the container);
 *  - traps Tab / Shift+Tab so keyboard focus cycles WITHIN the dialog instead of
 *    leaking to the page behind it;
 *  - restores focus to whatever was focused before it opened (the trigger) on
 *    close, so keyboard users land back where they were.
 *
 * Pair it with `useDialog` (Escape / click-outside) for the full contract.
 */

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

interface ModalA11yOptions {
  isOpen: boolean;
  /** Accessible name for the dialog (used when there's no visible heading id). */
  label?: string;
  /** id of a visible heading element; takes precedence over `label`. */
  labelledBy?: string;
  /** Move focus into the dialog on open (default true). Pass false when the
   *  component already manages its own initial focus. */
  initialFocus?: boolean;
}

function isVisible(el: HTMLElement): boolean {
  return el.offsetWidth > 0 || el.offsetHeight > 0 || el === document.activeElement;
}

export function useModalA11y(ref: RefObject<HTMLElement>, opts: ModalA11yOptions): void {
  const { isOpen, label, labelledBy, initialFocus = true } = opts;

  useEffect(() => {
    const el = ref.current;
    if (!isOpen || !el) return;

    if (!el.getAttribute('role')) el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    if (labelledBy) el.setAttribute('aria-labelledby', labelledBy);
    else if (label && !el.getAttribute('aria-labelledby')) el.setAttribute('aria-label', label);

    const previouslyFocused = document.activeElement as HTMLElement | null;

    const focusables = () =>
      Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(isVisible);

    let raf = 0;
    if (initialFocus) {
      // Defer past paint so portaled inputs/buttons exist before we grab focus.
      raf = requestAnimationFrame(() => {
        const items = focusables();
        if (items[0]) {
          items[0].focus({ preventScroll: true });
        } else {
          if (!el.getAttribute('tabindex')) el.setAttribute('tabindex', '-1');
          el.focus({ preventScroll: true });
        }
      });
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) {
        e.preventDefault();
        el.focus({ preventScroll: true });
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey) {
        if (active === first || !el.contains(active)) {
          e.preventDefault();
          last.focus({ preventScroll: true });
        }
      } else if (active === last || !el.contains(active)) {
        e.preventDefault();
        first.focus({ preventScroll: true });
      }
    };
    el.addEventListener('keydown', onKeyDown);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      el.removeEventListener('keydown', onKeyDown);
      if (
        previouslyFocused &&
        previouslyFocused !== document.body &&
        document.contains(previouslyFocused) &&
        typeof previouslyFocused.focus === 'function'
      ) {
        previouslyFocused.focus({ preventScroll: true });
      }
    };
  }, [isOpen, label, labelledBy, initialFocus, ref]);
}
