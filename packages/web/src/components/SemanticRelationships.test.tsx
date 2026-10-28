import { useRef, useState } from 'react';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { SemanticGraphOverview } from './SemanticGraphOverview';
import type { SemanticEdge, SemanticItem } from '../lib/semanticLOD';

const items: SemanticItem[] = ['Gateway', 'Queue', 'Worker', 'Inventory'].map(
  (title, index) => ({
    id: `n${index}`,
    title,
    type: 'TASK',
    status: 'ACTIVE',
    metadata: {
      lod: {
        groupPath:
          index < 3
            ? ['Payments', index < 2 ? 'API' : 'Workers']
            : ['Inventory'],
      },
    },
  })
);
const edges: SemanticEdge[] = [
  { id: 'internal', source: 'n0', target: 'n1', type: 'DEPENDS_ON' },
  { id: 'self', source: 'n0', target: 'n0', type: 'BLOCKS' },
  { id: 'parallel-a', source: 'n0', target: 'n3', type: 'BLOCKS' },
  { id: 'parallel-b', source: 'n0', target: 'n3', type: 'BLOCKS' },
  { id: 'reverse', source: 'n3', target: 'n0', type: 'DEPENDS_ON' },
  { id: 'pending', source: 'n0', target: 'unloaded', type: 'ENABLES' },
];
const noop = () => {};
const positions = vi.fn(() =>
  items.map((item, index) => ({ id: item.id, x: index * 40, y: index * 20 }))
);
let panCamera: () => void;
let replaceEdges: (value: SemanticEdge[]) => void;
const inspected = vi.fn();
function Fixture() {
  const [camera, setCamera] = useState({ x: 20, y: 30, scale: 0.4 });
  const [selectedId, setSelectedId] = useState<string>();
  const entry = useRef(camera);
  const [sourceEdges, setSourceEdges] = useState(edges);
  replaceEdges = setSourceEdges;
  panCamera = () =>
    setCamera(value => ({ ...value, x: value.x + 20, y: value.y + 20 }));
  return (
    <SemanticGraphOverview
      items={items}
      edges={sourceEdges}
      camera={camera}
      selectedId={selectedId}
      readPositions={positions}
      onActiveChange={noop}
      onBrowse={noop}
      onInspect={(id, begin) => {
        inspected(id, begin);
        if (begin) entry.current = camera;
        setSelectedId(id);
        setCamera({ x: 100, y: 120, scale: 1.2 });
      }}
      onBack={() => setCamera(entry.current)}
    />
  );
}
const openGroups = () =>
  fireEvent.click(screen.getByRole('button', { name: '2 groups · 4 items' }));
const openPayments = () => {
  openGroups();
  fireEvent.click(screen.getByRole('button', { name: /^Payments 3 items/ }));
};
const edgeIds = () =>
  Array.from(document.querySelectorAll<HTMLElement>('[data-lod-edge-id]')).map(
    row => row.dataset.lodEdgeId
  );
beforeEach(() => {
  inspected.mockClear();
  positions.mockClear();
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(private callback: (entries: unknown[]) => void) {}
      observe() {
        this.callback([{ contentRect: { width: 1440, height: 900 } }]);
      }
      disconnect() {}
    }
  );
  vi.stubGlobal('requestAnimationFrame', () => 1);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it('exposes every original relationship once, including parallel, self and pending endpoints', () => {
  render(<Fixture />);
  openGroups();
  fireEvent.click(
    screen.getByRole('button', { name: 'Browse 6 relationships' })
  );
  expect(edgeIds().sort()).toEqual(edges.map(edge => edge.id).sort());
  const pending = document.querySelector(
    '[data-lod-edge-id="pending"]'
  ) as HTMLElement;
  expect(within(pending).getByText('unloaded')).toBeVisible();
  expect(within(pending).getByText('Endpoint not loaded')).toBeVisible();
  expect(
    within(pending).queryByRole('button', { name: 'Inspect unloaded' })
  ).toBeNull();
  fireEvent.change(screen.getByLabelText('Relationship type'), {
    target: { value: 'BLOCKS' },
  });
  expect(edgeIds().sort()).toEqual(['parallel-a', 'parallel-b', 'self']);
  expect(screen.getByText('3 of 6 relationships')).toBeVisible();
});

it('opens the exact internal partition and directional bundle without merging identities', () => {
  render(<Fixture />);
  openPayments();
  fireEvent.click(
    screen.getByRole('button', { name: 'Browse 2 internal relationships' })
  );
  expect(edgeIds().sort()).toEqual(['internal', 'self']);
  fireEvent.click(screen.getByRole('button', { name: 'Back to groups' }));
  fireEvent.click(
    screen.getByRole('button', { name: 'Payments → Inventory: 2 BLOCKS' })
  );
  expect(edgeIds().sort()).toEqual(['parallel-a', 'parallel-b']);
  expect(
    screen.getByRole('region', { name: 'Graph relationships' })
  ).toHaveTextContent('Payments → Inventory');
});

it('preserves relationship context, selection and the overview cut after source inspection', () => {
  render(<Fixture />);
  openPayments();
  fireEvent.click(
    screen.getByRole('button', { name: 'Payments → Inventory: 2 BLOCKS' })
  );
  fireEvent.click(
    screen.getAllByRole('button', { name: 'Inspect Inventory' })[0]
  );
  expect(inspected).toHaveBeenLastCalledWith('n3', true);
  expect(
    screen.queryByRole('region', { name: 'Graph relationships' })
  ).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Back to overview' }));
  expect(edgeIds().sort()).toEqual(['parallel-a', 'parallel-b']);
  expect(document.querySelectorAll('[data-lod-group]')).toHaveLength(2);
  expect(
    document.querySelector('[data-lod-group][aria-current="true"]')
  ).toHaveTextContent('Inventory');
});

it('distinguishes incoming and outgoing original directions in a focused neighborhood', () => {
  render(<Fixture />);
  openPayments();
  fireEvent.click(
    screen.getByRole('button', { name: 'Relationships of Gateway' })
  );
  fireEvent.change(screen.getByLabelText('Relationship direction'), {
    target: { value: 'outgoing' },
  });
  expect(edgeIds().sort()).toEqual([
    'internal',
    'parallel-a',
    'parallel-b',
    'pending',
    'self',
  ]);
  fireEvent.change(screen.getByLabelText('Relationship direction'), {
    target: { value: 'incoming' },
  });
  expect(edgeIds().sort()).toEqual(['reverse', 'self']);
  expect(
    screen.getByText(
      'Source → target follows the stored relationship direction.'
    )
  ).toBeVisible();
});

it('retains a safe focus target when a live edge removal removes the inspected endpoint button', () => {
  render(<Fixture />);
  openGroups();
  fireEvent.click(
    screen.getByRole('button', { name: 'Browse 6 relationships' })
  );
  screen.getAllByRole('button', { name: 'Inspect Inventory' })[0].focus();
  act(() => replaceEdges([]));
  expect(screen.getByRole('button', { name: 'Back to groups' })).toHaveFocus();
  expect(screen.getByText('0 of 0 relationships')).toBeVisible();
});

it('keeps schematic lanes fixed and does no source-position scan for a camera pan', () => {
  render(<Fixture />);
  const paths = () =>
    Array.from(document.querySelectorAll('[data-lod-bundle]')).map(path =>
      path.getAttribute('d')
    );
  const before = paths();
  expect(before.length).toBeGreaterThan(0);
  positions.mockClear();
  act(() => panCamera());
  expect(paths()).toEqual(before);
  expect(positions).not.toHaveBeenCalled();
});
