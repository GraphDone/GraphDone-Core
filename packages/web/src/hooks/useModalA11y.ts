import { RefObject, useEffect } from 'react';

/**
 * Accessibility primitive for modal dialogs. When `isOpen`, it:
 *  - marks the container role="dialog" aria-modal="true" (keeps an existing role)
 *    and gives it an accessible name (aria-label / aria-labelledby);
 *  - moves focus into the dialog on open (the first form field if there is one,
 *    else the first focusable, else the container);
 *  - traps Tab / Shift+Tab so KEYBOARD focus cycles within the dialog instead of
 *    tabbing out to the page behind it;
 *  - restores focus to the trigger on close (only when focus fell back to <body>,
 *    so it never fights a close that deliberately moved focus elsewhere).
 *
 * Scope note: this is a Tab-focus trap + aria-modal hint. It does NOT make the
 * background `inert`, so it doesn't block mouse clicks or an AT virtual cursor
 * from reaching content behind the dialog — pair it with `useDialog` (Escape /
 * click-outside) and rely on the visual backdrop for pointer dismissal.
 */

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[contenteditable]:not([contenteditable="false"])',
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
  if (el === document.activeElement) return true;
  if (el.getClientRects().length === 0) return false;
  const cs = getComputedStyle(el);
  return cs.visibility !== 'hidden' && cs.display !== 'none';
}

const isField = (el: HTMLElement) =>
  /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) && (el as HTMLInputElement).type !== 'hidden';

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
      // Defer past paint so portaled fields/buttons exist before we grab focus,
      // and prefer the first real form field over an icon-only Close button.
      raf = requestAnimationFrame(() => {
        const items = focusables();
        const target = items.find(isField) || items[0];
        if (target) {
          target.focus({ preventScroll: true });
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
      // Restore focus to the trigger ONLY if focus dropped to <body> as the
      // dialog unmounted — never override a close that intentionally moved focus.
      const active = document.activeElement as HTMLElement | null;
      const focusDropped = !active || active === document.body;
      if (
        focusDropped &&
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
