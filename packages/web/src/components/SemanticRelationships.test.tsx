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
import { SemanticRelationshipBrowser } from './SemanticRelationshipBrowser';
import { indexSemanticRelationships } from '../lib/semanticRelationships';
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
let replaceItems: (value: SemanticItem[]) => void;
let replaceEdges: (value: SemanticEdge[]) => void;
const inspected = vi.fn();
function Fixture() {
  const [camera, setCamera] = useState({ x: 20, y: 30, scale: 0.4 });
  const [selectedId, setSelectedId] = useState<string>();
  const entry = useRef(camera);
  const [sourceItems, setSourceItems] = useState(items);
  replaceItems = setSourceItems;
  const [sourceEdges, setSourceEdges] = useState(edges);
  replaceEdges = setSourceEdges;
  panCamera = () =>
    setCamera(value => ({ ...value, x: value.x + 20, y: value.y + 20 }));
  return (
    <SemanticGraphOverview
      items={sourceItems}
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

it('traces outgoing and incoming buses separately and preserves the trace after source inspection', () => {
  render(<Fixture />);
  openPayments();
  fireEvent.click(
    screen.getByRole('button', { name: 'Trace outgoing connections' })
  );
  expect(
    screen.getByRole('region', { name: 'Connection trace' })
  ).toHaveTextContent('Outgoing · Payments');
  const paths = () =>
    Array.from(document.querySelectorAll('[data-lod-bundle]'));
  expect(paths()).toHaveLength(1);
  expect(paths()[0]).toHaveAttribute('data-count', '2');
  expect(
    screen.getByRole('region', { name: 'Connection trace' })
  ).toHaveTextContent('2 of 6 relationships drawn');
  fireEvent.click(
    screen.getByRole('button', { name: 'Trace incoming connections' })
  );
  expect(paths()).toHaveLength(1);
  expect(paths()[0]).toHaveAttribute('data-count', '1');
  openPayments();
  fireEvent.click(
    screen.getByRole('button', { name: 'Browse 2 internal relationships' })
  );
  fireEvent.click(
    screen.getAllByRole('button', { name: 'Inspect Gateway' })[0]
  );
  fireEvent.click(screen.getByRole('button', { name: 'Back to overview' }));
  expect(
    screen.getByRole('region', { name: 'Connection trace' })
  ).toHaveTextContent('Incoming · Payments');
  expect(paths()).toHaveLength(1);
});

it('pages every connected group in a bounded trace and exposes removal of its live source', () => {
  render(<Fixture />);
  const neighbors = Array.from({ length: 13 }, (_, i) => ({
    ...items[0],
    id: `neighbor-${i}`,
    title: `Neighbor ${i}`,
    metadata: { lod: { groupPath: [`Neighbor ${i}`] } },
  }));
  act(() => {
    replaceItems([...items, ...neighbors]);
    replaceEdges(
      neighbors.map(item => ({
        id: `edge-${item.id}`,
        source: 'n0',
        target: item.id,
        type: 'BLOCKS',
      }))
    );
  });
  fireEvent.click(screen.getByRole('button', { name: '15 groups · 17 items' }));
  fireEvent.click(screen.getByRole('button', { name: /^Payments 3 items/ }));
  fireEvent.click(
    screen.getByRole('button', { name: 'Trace outgoing connections' })
  );
  const seen = new Set<string>();
  let pages = 0;
  while (true) {
    const cards = Array.from(document.querySelectorAll('[data-lod-group]'));
    expect(cards.length).toBeLessThanOrEqual(6);
    expect(cards.some(card => card.textContent?.includes('Payments'))).toBe(
      true
    );
    for (const card of cards) seen.add(card.getAttribute('data-lod-group')!);
    pages++;
    expect(pages).toBeLessThanOrEqual(4);
    const next = screen.getByRole('button', { name: 'Next connected groups' });
    if (next.hasAttribute('disabled')) break;
    fireEvent.click(next);
  }
  expect(seen.size).toBe(14);
  expect(pages).toBe(3);
  act(() => replaceItems(neighbors));
  expect(
    screen.getByRole('region', { name: 'Connection trace' })
  ).toHaveTextContent('This group is no longer present');
  fireEvent.click(
    screen.getByRole('button', { name: 'Exit connection trace' })
  );
  expect(screen.queryByRole('region', { name: 'Connection trace' })).toBeNull();
});

it('removes edges from an open internal view when a live update moves their endpoint out of the group', () => {
  render(<Fixture />);
  openPayments();
  fireEvent.click(
    screen.getByRole('button', { name: 'Browse 2 internal relationships' })
  );
  act(() =>
    replaceItems(
      items.map(item =>
        item.id === 'n1'
          ? { ...item, metadata: { lod: { groupPath: ['Inventory'] } } }
          : item
      )
    )
  );
  expect(edgeIds()).toEqual(['self']);
});

it('includes a newly added member in an already open internal relationship view', () => {
  render(<Fixture />);
  openPayments();
  fireEvent.click(
    screen.getByRole('button', { name: 'Browse 2 internal relationships' })
  );
  act(() => {
    replaceItems([...items, { ...items[0], id: 'added', title: 'New member' }]);
    replaceEdges([
      ...edges,
      { id: 'new-internal', source: 'n0', target: 'added', type: 'BLOCKS' },
    ]);
  });
  expect(edgeIds().sort()).toEqual(['internal', 'new-internal', 'self']);
});

it('resolves both ends of an open bundle against live group membership', () => {
  render(<Fixture />);
  openPayments();
  fireEvent.click(
    screen.getByRole('button', { name: 'Payments → Inventory: 2 BLOCKS' })
  );
  act(() => {
    replaceItems([
      ...items.map(item =>
        item.id === 'n3' ? { ...item, metadata: items[0].metadata } : item
      ),
      { ...items[3], id: 'new-inventory' },
    ]);
    replaceEdges([
      ...edges,
      {
        id: 'new-bundle',
        source: 'n0',
        target: 'new-inventory',
        type: 'BLOCKS',
      },
    ]);
  });
  expect(edgeIds()).toEqual(['new-bundle']);
});

it('accounts for routed, internal and unresolved relationships in the Connections control', () => {
  render(<Fixture />);
  expect(
    screen.getByRole('button', {
      name: '6 relationships, 3 not drawn: 2 internal, 1 awaiting endpoints, 0 external connections in list',
    })
  ).toBeVisible();
});

it('explains when a live regrouping removes the group whose relationships are open', () => {
  render(<Fixture />);
  openPayments();
  fireEvent.click(
    screen.getByRole('button', { name: 'Browse 2 internal relationships' })
  );
  act(() =>
    replaceItems(
      items.map(item => ({
        ...item,
        metadata: { lod: { groupPath: ['Inventory'] } },
      }))
    )
  );
  expect(edgeIds()).toEqual([]);
  expect(
    screen.getByText('This group is no longer present in the loaded graph.')
  ).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Back to groups' }));
  expect(screen.getByRole('region', { name: 'Graph groups' })).toBeVisible();
});

it('bounds relationship rows while retaining search, exact editing and every page', () => {
  const many = Array.from({ length: 501 }, (_, index) => ({
    id: `edge-${String(index).padStart(4, '0')}`,
    source: 'n0',
    target: 'n1',
    type: 'BLOCKS',
  }));
  const edit = vi.fn();
  render(
    <SemanticRelationshipBrowser
      index={indexSemanticRelationships(items, many)}
      scope={{ kind: 'all' }}
      contextFor={() => ''}
      onScope={noop}
      onInspect={noop}
      onBack={noop}
      onEdit={edit}
      visible
    />
  );
  expect(edgeIds()).toEqual(many.slice(0, 250).map(edge => edge.id));
  expect(screen.getByText('501 of 501 relationships')).toBeVisible();
  const pages = within(
    screen.getByRole('navigation', { name: 'Relationship pages' })
  );
  fireEvent.click(pages.getByRole('button', { name: 'Next relationships' }));
  expect(edgeIds()).toEqual(many.slice(250, 500).map(edge => edge.id));
  fireEvent.click(pages.getByRole('button', { name: 'Next relationships' }));
  expect(edgeIds()).toEqual(['edge-0500']);
  expect(
    pages.getByRole('button', { name: 'Next relationships' })
  ).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Find a relationship'), {
    target: { value: 'edge-0003' },
  });
  expect(edgeIds()).toEqual(['edge-0003']);
  fireEvent.click(
    screen.getByRole('button', { name: 'Edit relationship edge-0003' })
  );
  expect(edit).toHaveBeenCalledWith('edge-0003');
  fireEvent.change(screen.getByLabelText('Find a relationship'), {
    target: { value: '' },
  });
  expect(edgeIds()).toEqual(many.slice(0, 250).map(edge => edge.id));
});
