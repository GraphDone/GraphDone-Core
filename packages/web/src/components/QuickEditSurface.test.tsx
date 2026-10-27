import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QuickEditSurface } from './QuickEditSurface';
import { NodeQuickEdit } from './NodeQuickEdit';

type PaintCallback = (timestamp: number) => void;
let frames: Map<number, PaintCallback>;
let frameId = 0;

beforeEach(() => {
  frames = new Map();
  vi.stubGlobal('requestAnimationFrame', (callback: PaintCallback) => {
    const id = ++frameId;
    frames.set(id, callback);
    return id;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
  vi.stubGlobal('ResizeObserver', class {
    observe() {}
    disconnect() {}
  });
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })));
  vi.spyOn(HTMLElement.prototype, 'getClientRects').mockReturnValue([
    { x: 0, y: 0, width: 100, height: 40, top: 0, left: 0, right: 100, bottom: 40 },
  ] as unknown as DOMRectList);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function paint() {
  const pending = [...frames.values()];
  frames.clear();
  act(() => pending.forEach(callback => callback(16)));
}

function editor() {
  render(<button>Open editor</button>);
  const trigger = screen.getByRole('button', { name: 'Open editor' });
  trigger.focus();
  const onCommit = vi.fn();
  const view = render(
    <QuickEditSurface x={200} y={200} onClose={vi.fn()}>
      <NodeQuickEdit
        node={{ id: 'owned-item', title: 'Original title', type: 'TASK', status: 'PROPOSED', metadata: {} }}
        onClose={vi.fn()}
        onCommit={onCommit}
      />
    </QuickEditSurface>
  );
  return { ...view, trigger, onCommit };
}

describe('quick editor initial focus', () => {
  it('keeps a chosen status-note field focused when deferred autofocus runs', () => {
    const { onCommit } = editor();
    const note = screen.getByTestId('quick-note-input');
    note.focus();
    paint();
    expect(note).toHaveFocus();
    fireEvent.change(document.activeElement!, { target: { value: 'Ready for review' } });
    expect(screen.getByTestId('quick-title')).toHaveValue('Original title');
    expect(screen.getByTestId('quick-note-add')).toBeEnabled();
    fireEvent.click(screen.getByTestId('quick-note-add'));
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit.mock.calls[0][0].update).not.toHaveProperty('title');
    expect(onCommit.mock.calls[0][0].update.metadata).toContain('Ready for review');
  });

  it('focuses the first field when focus is still on the opening trigger', () => {
    editor();
    paint();
    expect(screen.getByTestId('quick-title')).toHaveFocus();
  });

  it('focuses the first field when focus has fallen back to the body', () => {
    const { trigger } = editor();
    trigger.blur();
    paint();
    expect(screen.getByTestId('quick-title')).toHaveFocus();
  });

  it('preserves focus deliberately moved outside the editor', () => {
    editor();
    render(<button>Another action</button>);
    const action = screen.getByRole('button', { name: 'Another action' });
    action.focus();
    paint();
    expect(action).toHaveFocus();
  });

  it('keeps keyboard focus cycling through the editor', () => {
    editor();
    paint();
    const surface = screen.getByTestId('quick-edit-surface');
    const first = screen.getByRole('button', { name: 'Close quick edit' });
    const fields = surface.querySelectorAll<HTMLElement>('button:not([disabled]),input,textarea');
    const last = fields[fields.length - 1];
    first.focus();
    fireEvent.keyDown(first, { key: 'Tab', shiftKey: true });
    expect(last).toHaveFocus();
    fireEvent.keyDown(last, { key: 'Tab' });
    expect(first).toHaveFocus();
  });

  it('cancels pending autofocus when the editor unmounts', () => {
    const { unmount, trigger } = editor();
    expect(frames.size).toBe(1);
    unmount();
    expect(frames.size).toBe(0);
    paint();
    expect(trigger).toHaveFocus();
  });
});
