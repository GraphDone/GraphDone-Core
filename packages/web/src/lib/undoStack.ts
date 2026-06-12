/**
 * Undo queue (FLOW-3): experimentation must be safe, so every graph
 * mutation registers its inverse here. A few dozen steps, continuously
 * updated. Ctrl/Cmd+Z and the canvas context-menu Undo button (touch users)
 * both drain it.
 *
 * Pure and framework-free; the component layer supplies the inverse
 * operations (GraphQL mutations) and renders state via onChange.
 */

export interface UndoableAction {
  /** Human label, shown on the Undo button: "Undo: Create item" */
  label: string;
  /** The inverse operation. May be async (server mutation). */
  undo: () => void | Promise<void>;
}

type Listener = () => void;

export class UndoStack {
  private stack: UndoableAction[] = [];
  private listeners: Listener[] = [];
  private readonly capacity: number;

  constructor(capacity = 36) {
    this.capacity = capacity;
  }

  push(action: UndoableAction): void {
    this.stack.push(action);
    if (this.stack.length > this.capacity) this.stack.shift();
    this.emit();
  }

  /**
   * Pop and run the most recent inverse. The action is removed even if its
   * undo throws — a broken inverse must not jam the whole queue.
   */
  async undo(): Promise<UndoableAction | null> {
    const action = this.stack.pop() ?? null;
    if (!action) return null;
    this.emit();
    await action.undo();
    return action;
  }

  canUndo(): boolean {
    return this.stack.length > 0;
  }

  peekLabel(): string | null {
    return this.stack[this.stack.length - 1]?.label ?? null;
  }

  size(): number {
    return this.stack.length;
  }

  clear(): void {
    this.stack = [];
    this.emit();
  }

  onChange(listener: Listener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private emit(): void {
    for (const l of this.listeners) l();
  }
}
