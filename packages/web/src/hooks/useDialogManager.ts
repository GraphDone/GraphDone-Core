import { useEffect, useRef } from 'react';

/**
 * Dialog Manager
 *
 * Manages the lifecycle of "dialogs" — any pop-up or temporary UI overlay
 * (panels, menus, dropdowns, modals, contextual editors).
 *
 * Friction contract (docs/design/interaction-model.md):
 *  - ONE thing open at a time: opening an exclusive dialog closes whatever
 *    was open before it. Conflicting overlays are a bug, not a feature.
 *    (Pass { exclusive: false } for layered UI like confirm-inside-modal.)
 *  - Escape always closes the top-most dialog. Click-outside closes all.
 *  - Users never hunt for X buttons.
 */

type DialogCloseCallback = () => void;

interface DialogEntry {
  close: DialogCloseCallback;
  exclusive: boolean;
}

export interface RegisterOptions {
  /** Exclusive dialogs close all previously open dialogs. Default true. */
  exclusive?: boolean;
}

export class DialogManager {
  private stack: DialogEntry[] = [];

  register(close: DialogCloseCallback, options: RegisterOptions = {}): () => void {
    const entry: DialogEntry = { close, exclusive: options.exclusive ?? true };

    if (entry.exclusive) {
      const previous = this.stack;
      this.stack = [];
      for (const open of previous) open.close();
    }

    this.stack.push(entry);
    return () => {
      this.stack = this.stack.filter((e) => e !== entry);
    };
  }

  /** Close the most recently opened dialog. Returns true if one was closed. */
  handleEscape(): boolean {
    const top = this.stack.pop();
    if (!top) return false;
    top.close();
    return true;
  }

  closeAll(): void {
    const open = this.stack;
    this.stack = [];
    for (const entry of open) entry.close();
  }

  openCount(): number {
    return this.stack.length;
  }

  hasOpenDialogs(): boolean {
    return this.stack.length > 0;
  }
}

const globalDialogManager = new DialogManager();

// Escape closes the top-most dialog, app-wide. Registered once.
if (typeof window !== 'undefined') {
  window.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    // Let focused inputs handle their own Escape (e.g. cancel inline edit)
    const target = event.target as HTMLElement | null;
    const inEditable =
      target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
    if (!inEditable && globalDialogManager.handleEscape()) {
      event.stopPropagation();
    }
  });
}

export const useDialogManager = () => {
  return {
    closeAllDialogs: () => globalDialogManager.closeAll(),
    hasOpenDialogs: () => globalDialogManager.hasOpenDialogs(),
    registerDialog: (closeCallback: DialogCloseCallback, options?: RegisterOptions) =>
      globalDialogManager.register(closeCallback, options)
  };
};

export const useDialog = (isOpen: boolean, onClose: () => void, options?: RegisterOptions) => {
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const onCloseRef = useRef(onClose);

  // Keep onClose ref updated
  onCloseRef.current = onClose;

  useEffect(() => {
    if (isOpen && !unsubscribeRef.current) {
      unsubscribeRef.current = globalDialogManager.register(() => onCloseRef.current(), options);
    } else if (!isOpen && unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  return {
    register: () => {
      if (isOpen && !unsubscribeRef.current) {
        unsubscribeRef.current = globalDialogManager.register(() => onCloseRef.current(), options);
      }
    },
    unregister: () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    }
  };
};
