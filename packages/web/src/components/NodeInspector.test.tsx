import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { NodeInspector } from './NodeInspector';

vi.mock('../contexts/GraphContext', () => ({
  useGraph: () => ({ descendInto: vi.fn() }),
}));

afterEach(cleanup);
const node = { id: 'parent', title: 'Parent', type: 'TASK', status: 'ACTIVE' };

it('explains an unavailable diagram without changing the current inspector mode', () => {
  render(<NodeInspector node={node} onClose={() => {}} />);
  const diagram = screen.getByRole('button', { name: 'Diagram' });
  expect(diagram).toHaveAttribute('aria-disabled', 'true');
  fireEvent.focus(diagram);
  expect(screen.getByRole('tooltip')).toHaveTextContent(
    'Diagram: No sub-graph'
  );
  fireEvent.click(diagram);
  expect(screen.getByRole('button', { name: 'Card' })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  expect(diagram).toHaveAttribute('aria-pressed', 'false');
  fireEvent.keyDown(diagram, { key: 'Escape' });
  expect(screen.queryByRole('tooltip')).toBeNull();
});

it('keeps one tooltip, clears it on scrolling and resets it for another inspected node', () => {
  const { rerender } = render(<NodeInspector node={node} onClose={() => {}} />);
  const card = screen.getByRole('button', { name: 'Card' });
  const contents = screen.getByRole('button', {
    name: 'Contents',
  });
  fireEvent.focus(card);
  fireEvent.mouseEnter(contents);
  expect(screen.getAllByRole('tooltip')).toHaveLength(1);
  expect(screen.getByRole('tooltip')).toHaveTextContent('Contents');
  fireEvent.scroll(window);
  expect(screen.queryByRole('tooltip')).toBeNull();
  fireEvent.mouseEnter(contents);
  expect(screen.getByRole('tooltip')).toBeVisible();
  fireEvent.wheel(window);
  expect(screen.queryByRole('tooltip')).toBeNull();
  fireEvent.mouseEnter(contents);
  expect(screen.getByRole('tooltip')).toBeVisible();
  fireEvent.pointerDown(document.body);
  expect(screen.queryByRole('tooltip')).toBeNull();
  fireEvent.mouseEnter(contents);
  expect(screen.getByRole('tooltip')).toBeVisible();
  rerender(
    <NodeInspector node={{ ...node, id: 'another' }} onClose={() => {}} />
  );
  expect(screen.queryByRole('tooltip')).toBeNull();
});

it('returns keyboard focus to the original item trigger when the inspector closes', () => {
  const frames: ((time: number) => void)[] = [];
  vi.stubGlobal('requestAnimationFrame', (callback: (time: number) => void) => {
    frames.push(callback);
    return frames.length;
  });
  try {
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();
    const { unmount } = render(
      <NodeInspector node={node} onClose={() => {}} />
    );
    screen.getByRole('button', { name: 'Close' }).focus();
    unmount();
    for (const callback of frames) callback(0);
    expect(trigger).toHaveFocus();
    trigger.remove();
  } finally {
    vi.unstubAllGlobals();
  }
});
