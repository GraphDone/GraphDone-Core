import { useCallback, useRef, useEffect } from 'react';

/**
 * Dialog Manager Hook
 * 
 * Manages the lifecycle of "dialogs" - any pop-up or temporary UI overlay designed for 
 * selection options or viewing parameters upon click. This includes panels, menus, 
 * dropdowns, overlays, and any other temporary UI elements.
 * 
 * Philosophy: Dialogs should close when users click outside them (on empty graph space)
 * to make the UI more efficient. Users shouldn't have to hunt for X buttons.
 */

type DialogCloseCallback = () => void;

class DialogManager {
  private callbacks = new Set<DialogCloseCallback>();

  register(callback: DialogCloseCallback): () => void {
    this.callbacks.add(callback);
    return () => {
      this.callbacks.delete(callback);
    };
  }

  closeAll(): void {
    this.callbacks.forEach(callback => callback());
  }

  hasOpenDialogs(): boolean {
    return this.callbacks.size > 0;
  }
}

const globalDialogManager = new DialogManager();

export const useDialogManager = () => {
  return {
    closeAllDialogs: () => globalDialogManager.closeAll(),
    hasOpenDialogs: () => globalDialogManager.hasOpenDialogs(),
    registerDialog: (closeCallback: DialogCloseCallback) => globalDialogManager.register(closeCallback)
  };
};

export const useDialog = (isOpen: boolean, onClose: () => void) => {
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const onCloseRef = useRef(onClose);
  
  // Keep onClose ref updated
  onCloseRef.current = onClose;

  useEffect(() => {
    if (isOpen && !unsubscribeRef.current) {
      unsubscribeRef.current = globalDialogManager.register(() => onCloseRef.current());
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
  }, [isOpen]);

  return { 
    register: () => {
      if (isOpen && !unsubscribeRef.current) {
        unsubscribeRef.current = globalDialogManager.register(() => onCloseRef.current());
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