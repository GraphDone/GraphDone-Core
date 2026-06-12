import { describe, it, expect, vi } from 'vitest';
import { UndoStack } from '../undoStack';

describe('UndoStack (FLOW-3): a few dozen steps, continuously updated', () => {
  it('undoes the most recent action first (LIFO)', async () => {
    const stack = new UndoStack();
    const order: string[] = [];
    stack.push({ label: 'first', undo: () => { order.push('first'); } });
    stack.push({ label: 'second', undo: () => { order.push('second'); } });
    await stack.undo();
    await stack.undo();
    expect(order).toEqual(['second', 'first']);
  });

  it('reports what would be undone (for button labels)', () => {
    const stack = new UndoStack();
    expect(stack.peekLabel()).toBeNull();
    stack.push({ label: 'Create item', undo: () => {} });
    expect(stack.peekLabel()).toBe('Create item');
    expect(stack.canUndo()).toBe(true);
  });

  it('caps the queue at its capacity, dropping the oldest', async () => {
    const stack = new UndoStack(36);
    const undone: number[] = [];
    for (let i = 0; i < 50; i++) stack.push({ label: `a${i}`, undo: () => { undone.push(i); } });
    expect(stack.size()).toBe(36);
    while (stack.canUndo()) await stack.undo();
    expect(undone[0]).toBe(49);
    expect(undone.length).toBe(36);
    expect(undone[undone.length - 1]).toBe(14); // 50-36
  });

  it('notifies listeners on every change (push, undo, clear)', async () => {
    const stack = new UndoStack();
    const listener = vi.fn();
    stack.onChange(listener);
    stack.push({ label: 'x', undo: () => {} });
    await stack.undo();
    stack.clear();
    expect(listener).toHaveBeenCalledTimes(3);
  });

  it('a failing undo surfaces the error and removes the action anyway', async () => {
    const stack = new UndoStack();
    stack.push({ label: 'bad', undo: () => { throw new Error('server said no'); } });
    await expect(stack.undo()).rejects.toThrow('server said no');
    expect(stack.canUndo()).toBe(false);
  });

  it('supports async inverse operations', async () => {
    const stack = new UndoStack();
    let done = false;
    stack.push({ label: 'async', undo: async () => { await Promise.resolve(); done = true; } });
    await stack.undo();
    expect(done).toBe(true);
  });

  it('undo on an empty stack is a safe no-op returning null', async () => {
    expect(await new UndoStack().undo()).toBeNull();
  });
});
