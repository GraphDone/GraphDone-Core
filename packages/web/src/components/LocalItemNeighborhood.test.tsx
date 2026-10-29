import { useState, type ReactNode } from 'react';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { LocalItemNeighborhood } from './LocalItemNeighborhood';
import { indexSemanticRelationships } from '../lib/semanticRelationships';

const rectangle = (width: number, height: number) => ({
  x: 0,
  y: 0,
  left: 0,
  top: 0,
  right: width,
  bottom: height,
  width,
  height,
  toJSON: () => ({}),
});
beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    }
  );
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
    function (this: HTMLElement) {
      return this.classList.contains('local-item-neighborhood')
        ? rectangle(1440, 900)
        : rectangle(0, 0);
    }
  );
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
});
const makeIndex = (group = 'Old') => {
  const item = (id: string) => ({
    id,
    title: id,
    type: 'TASK',
    status: 'PROPOSED',
    metadata: { lod: { groupPath: [group] } },
  });
  const items = [
    'A',
    'B',
    ...Array.from({ length: 21 }, (_, i) => `a${i}`),
    ...Array.from({ length: 21 }, (_, i) => `b${i}`),
  ].map(item);
  const edges = ['A', 'B'].flatMap((id, j) =>
    Array.from({ length: 21 }, (_, i) => ({
      id: `${id}${i}`,
      source: id,
      target: `${j ? 'b' : 'a'}${i}`,
      type: 'DEPENDS_ON',
    }))
  );
  return indexSemanticRelationships(items, edges);
};
const readPositions = () => [
  { id: 'A', x: 720, y: 450 },
  { id: 'B', x: 780, y: 450 },
];
const callbacks = {
  onActive: vi.fn(),
  onInspect: vi.fn(),
  onNavigate: vi.fn(),
  onBoard: vi.fn(),
  onBrowse: vi.fn(),
};
type ViewProps = Omit<
  Parameters<typeof LocalItemNeighborhood>[0],
  'onControls' | 'onFooter'
>;
function View(props: ViewProps) {
  const [controls, setControls] = useState<ReactNode>(null),
    [footer, setFooter] = useState<ReactNode>(null);
  return (
    <>
      {controls}
      <LocalItemNeighborhood
        {...props}
        onControls={setControls}
        onFooter={setFooter}
      />
      {footer}
    </>
  );
}
const propsFor = (index = makeIndex()): ViewProps => ({
  graphId: 'owned',
  viewScope: null,
  index,
  representedIds: new Set(index.edges.map(edge => edge.id)),
  readPositions,
  camera: { x: 0, y: 0, scale: 1 },
  selectedId: 'A',
  enabled: true,
  ...callbacks,
});
const focus = (container: HTMLElement) =>
  container
    .querySelector('[data-local-focus]')
    ?.getAttribute('data-local-focus');

it('honors overview search navigation to a nearby focus while the previous focus remains visible', () => {
  const props = propsFor(),
    view = render(<View {...props} />);
  expect(focus(view.container)).toBe('A');
  view.rerender(<View {...props} enabled={false} />);
  view.rerender(
    <View {...props} selectedId="B" camera={{ x: -60, y: 0, scale: 1 }} />
  );
  act(() => {
    window.dispatchEvent(
      new CustomEvent('graphdone:camera-settled', {
        detail: { x: -60, y: 0, scale: 1, manual: false },
      })
    );
  });
  expect(focus(view.container)).toBe('B');
});

it('preserves the working local focus when opening a neighbor inspector without navigating', () => {
  const props = propsFor(),
    view = render(<View {...props} />);
  view.rerender(<View {...props} selectedId="a0" />);
  expect(focus(view.container)).toBe('A');
});

it('offers a direct reset after a persisted filter disappears and only one new group remains', () => {
  const original = makeIndex(),
    groupId = original.hierarchy.paths.get('a0')!.at(-1)!;
  const scope = JSON.stringify(['owned-user', 'owned-graph']);
  localStorage.setItem(
    `graphdone:local-items:${scope}`,
    JSON.stringify({
      session: { focusId: 'A', page: 0, groupId },
      history: [],
      board: false,
    })
  );
  const props = { ...propsFor(original), viewScope: scope },
    view = render(<View {...props} />);
  const changed = makeIndex('Renamed');
  view.rerender(
    <View
      {...props}
      index={changed}
      representedIds={new Set(changed.edges.map(edge => edge.id))}
    />
  );
  expect(
    screen.getByRole('combobox', { name: 'Linked item group' })
  ).toBeInTheDocument();
  fireEvent.click(
    screen.getByRole('button', { name: 'Show all linked items' })
  );
  expect(focus(view.container)).toBe('A');
  expect(
    view.container.querySelectorAll('[data-local-kind="item"]').length
  ).toBeGreaterThan(1);
  expect(
    screen.queryByRole('button', { name: 'Show all linked items' })
  ).toBeNull();
});

it('distinguishes explicit navigation to an already inspected item from opening its inspector', () => {
  const props = propsFor(),
    view = render(<View {...props} />);
  view.rerender(<View {...props} selectedId="B" />);
  expect(focus(view.container)).toBe('A');
  view.rerender(
    <View
      {...props}
      selectedId="B"
      navigationRequest={{ id: 'B', sequence: 1 }}
      camera={{ x: -60, y: 0, scale: 1 }}
    />
  );
  expect(focus(view.container)).toBe('B');
  fireEvent.click(
    screen.getByRole('button', { name: 'Focus on b0' })
  );
  expect(focus(view.container)).toBe('b0');
});
