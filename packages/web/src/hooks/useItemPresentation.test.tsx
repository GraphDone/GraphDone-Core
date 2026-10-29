import { useLayoutEffect, useRef, useState } from 'react';
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { SemanticGraphOverview } from '../components/SemanticGraphOverview';
import { useItemPresentation, type ItemPresentationRenderer } from './useItemPresentation';

const frames = new Map<number, () => void>();
let nextFrame = 0;
const flushFrames = () => act(() => {
  const pending = [...frames.values()];
  frames.clear();
  pending.forEach(callback => callback());
});
beforeEach(() => {
  frames.clear();
  vi.stubGlobal('requestAnimationFrame', (callback: () => void) => {
    frames.set(++nextFrame, callback);
    return nextFrame;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
  vi.stubGlobal('ResizeObserver', class {
    constructor(private callback: (entries: unknown[]) => void) {}
    observe() { this.callback([{ contentRect: { width: 1440, height: 900 } }]); }
    disconnect() {}
  });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const renderer = (): ItemPresentationRenderer => ({
  isCurrent: () => true,
  renderItems: vi.fn(),
  presentOverview: vi.fn(),
});

it('coalesces terminal zoom work after overview ownership commits', () => {
  const { result, rerender } = renderHook(({ active }) => useItemPresentation(active), { initialProps: { active: false } });
  const draw = renderer();
  result.current.bind(draw);
  result.current.schedule();
  result.current.schedule();
  expect(frames.size).toBe(1);
  rerender({ active: true });
  flushFrames();
  expect(draw.renderItems).not.toHaveBeenCalled();
  expect(draw.presentOverview).toHaveBeenCalledTimes(1);
  result.current.schedule();
  flushFrames();
  expect(draw.renderItems).not.toHaveBeenCalled();
  expect(draw.presentOverview).toHaveBeenCalledTimes(2);
  rerender({ active: false });
  expect(draw.renderItems).toHaveBeenCalledTimes(1);
  expect(draw.renderItems).toHaveBeenLastCalledWith(true);
  result.current.refresh();
  expect(draw.renderItems).toHaveBeenLastCalledWith(false);
});

it('cancels detached work and refuses a renderer whose simulation is no longer current', () => {
  const { result, unmount } = renderHook(() => useItemPresentation(false));
  const old = renderer(), next = renderer();
  result.current.bind(old);
  result.current.schedule();
  result.current.bind(next);
  flushFrames();
  expect(old.renderItems).not.toHaveBeenCalled();
  expect(next.renderItems).not.toHaveBeenCalled();
  next.isCurrent = () => false;
  result.current.schedule();
  flushFrames();
  expect(next.renderItems).not.toHaveBeenCalled();
  next.isCurrent = () => true;
  result.current.schedule();
  unmount();
  expect(frames.size).toBe(0);
  flushFrames();
  expect(next.renderItems).not.toHaveBeenCalled();
});

const items = [{ id: 'a', title: 'Alpha', type: 'TASK', status: 'ACTIVE' }, { id: 'b', title: 'Beta', type: 'TASK', status: 'ACTIVE' }];
const edges = [{ id: 'ab', source: 'a', target: 'b', type: 'BLOCKS' }];
const positions = () => [{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 100, y: 0 }];
const noop = () => {};
let zoom: (scale: number) => void;
let reviseEdges: () => void;
const drawn: { scale: number; revision: number; overview: string | undefined }[] = [];
function Fixture() {
  const [scale, setScale] = useState(1.2);
  const [active, setActive] = useState(false);
  const [revision, setRevision] = useState(0);
  const current = useRef({ scale, revision });
  current.current = { scale, revision };
  const host = useRef<HTMLDivElement>(null);
  const presentation = useItemPresentation(active);
  zoom = next => { setScale(next); presentation.schedule(); };
  reviseEdges = () => setRevision(value => value + 1);
  useLayoutEffect(() => {
    presentation.bind({
      isCurrent: () => !!host.current,
      renderItems: () => {
        const value = current.current;
        drawn.push({ ...value, overview: host.current?.dataset.overview });
        host.current?.querySelector('text')?.replaceChildren(`Card ${value.scale}`);
        host.current?.querySelector('path')?.setAttribute('d', `M0,0 L${value.scale * 100},${value.revision}`);
      },
      presentOverview: noop,
    });
    presentation.refresh();
  }, [presentation]);
  useLayoutEffect(() => presentation.refresh(), [revision, presentation]);
  return <div ref={host} data-overview={active || undefined}>
    <svg style={{ display: active ? 'none' : undefined }}><text /><path /></svg>
    <SemanticGraphOverview items={items} edges={edges} camera={{ x: 0, y: 0, scale }} readPositions={positions}
      onActiveChange={setActive} onBrowse={noop} onInspect={noop} onBack={noop} />
  </div>;
}

it('refreshes cards and current relationships before paint on automatic exit and manual Items without another zoom', () => {
  drawn.length = 0;
  const { container } = render(<Fixture />);
  act(() => zoom(0.4));
  flushFrames();
  const beforeHidden = drawn.length;
  act(() => { zoom(0.2); reviseEdges(); });
  flushFrames();
  expect(drawn).toHaveLength(beforeHidden);
  fireEvent.change(screen.getByRole('combobox', { name: 'Graph detail' }), { target: { value: 'items' } });
  expect(drawn.at(-1)).toEqual({ scale: 0.2, revision: 1, overview: undefined });
  expect(container.querySelector('svg > text')?.textContent).toBe('Card 0.2');
  expect(container.querySelector('svg > path')?.getAttribute('d')).toBe('M0,0 L20,1');
  fireEvent.change(screen.getByRole('combobox', { name: 'Graph detail' }), { target: { value: 'auto' } });
  act(() => { zoom(0.1); reviseEdges(); });
  flushFrames();
  const hiddenAgain = drawn.length;
  act(() => zoom(1.2));
  expect(drawn.length).toBe(hiddenAgain + 1);
  expect(drawn.at(-1)).toEqual({ scale: 1.2, revision: 2, overview: undefined });
  flushFrames();
  expect(drawn.length).toBe(hiddenAgain + 1);
  expect(container.querySelector('svg > path')?.getAttribute('d')).toBe('M0,0 L120,2');
});
