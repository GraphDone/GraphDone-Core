// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DialogManager } from '../useDialogManager';

describe('DialogManager — one thing open at a time, Esc always works', () => {
  let manager: DialogManager;

  beforeEach(() => {
    manager = new DialogManager();
  });

  it('opening an exclusive dialog closes the previously open ones', () => {
    const closeA = vi.fn();
    const closeB = vi.fn();
    manager.register(closeA);
    manager.register(closeB);
    expect(closeA).toHaveBeenCalledTimes(1);
    expect(closeB).not.toHaveBeenCalled();
  });

  it('non-exclusive dialogs stack on top without closing others (confirm-inside-modal)', () => {
    const closeModal = vi.fn();
    const closeConfirm = vi.fn();
    manager.register(closeModal);
    manager.register(closeConfirm, { exclusive: false });
    expect(closeModal).not.toHaveBeenCalled();
    expect(manager.openCount()).toBe(2);
  });

  it('Escape closes only the most recently opened dialog', () => {
    const closeA = vi.fn();
    const closeB = vi.fn();
    manager.register(closeA);
    manager.register(closeB, { exclusive: false });
    const handled = manager.handleEscape();
    expect(handled).toBe(true);
    expect(closeB).toHaveBeenCalledTimes(1);
    expect(closeA).not.toHaveBeenCalled();
  });

  it('Escape returns false when nothing is open (lets other Esc handlers run)', () => {
    expect(manager.handleEscape()).toBe(false);
  });

  it('unregistering removes a dialog without closing the others', () => {
    const closeA = vi.fn();
    const closeB = vi.fn();
    manager.register(closeA);
    const unregB = manager.register(closeB, { exclusive: false });
    unregB();
    expect(closeA).not.toHaveBeenCalled();
    expect(manager.openCount()).toBe(1);
    manager.handleEscape();
    expect(closeA).toHaveBeenCalledTimes(1);
  });

  it('closeAll closes everything', () => {
    const closeA = vi.fn();
    const closeB = vi.fn();
    manager.register(closeA);
    manager.register(closeB, { exclusive: false });
    manager.closeAll();
    expect(closeA).toHaveBeenCalledTimes(1);
    expect(closeB).toHaveBeenCalledTimes(1);
  });

  it('a dialog closed by exclusivity is unregistered (no double-close on closeAll)', () => {
    const closeA = vi.fn();
    manager.register(closeA);
    manager.register(vi.fn()); // closes A
    manager.closeAll();
    expect(closeA).toHaveBeenCalledTimes(1);
  });
});
