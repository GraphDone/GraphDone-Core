import { useRef, useState } from 'react';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { SemanticGraphOverview } from './SemanticGraphOverview';
import * as routing from '../lib/schematicRouting';
import type { SemanticItem } from '../lib/semanticLOD';
import { projectRelationshipPriority } from '../lib/relationshipPriority';

const items: SemanticItem[] = Array.from({ length: 4 }, (_, index) => ({
  id: `n${index}`,
  title: `Node ${index}`,
  type: 'TASK',
  status: 'ACTIVE',
  metadata: { lod: { groupPath: ['System', index % 2 ? 'A' : 'B'] } },
}));
const edges: [] = [];
const noop = () => {};
const positions = () =>
  items.map((item, index) => ({ id: item.id, x: index * 40, y: index * 20 }));
let changeScale: (scale: number) => void;
let replaceItems: (items: SemanticItem[]) => void;
function Fixture() {
  const [camera, setCamera] = useState({ x: 0, y: 0, scale: 0.4 });
  const [source, setSource] = useState(items);
  const entryScale = useRef(0.4);
  changeScale = scale => setCamera({ x: 0, y: 0, scale });
  replaceItems = setSource;
  return (
    <>
      <button>External action</button>
      <SemanticGraphOverview
        items={source}
        edges={edges}
        camera={camera}
        readPositions={positions}
        onActiveChange={noop}
        onBrowse={noop}
        onInspect={() => {
          entryScale.current = camera.scale;
          changeScale(1.2);
        }}
        onBack={() => changeScale(entryScale.current)}
      />
    </>
  );
}
const summaries = () =>
  Array.from(document.querySelectorAll<HTMLButtonElement>('[data-lod-group]'));
const ids = () => summaries().map(element => element.dataset.lodGroup);
beforeEach(() => {
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

it('restores Auto hysteresis history when inspection returns to the same camera', () => {
  render(<Fixture />);
  const before = ids();
  expect(before).toHaveLength(1);
  fireEvent.click(screen.getByRole('button', { name: '1 groups · 4 items' }));
  fireEvent.click(screen.getByRole('button', { name: /^System 4 items/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Node 0 TASK · ACTIVE' }));
  expect(summaries()).toHaveLength(0);
  fireEvent.click(screen.getByRole('button', { name: 'Back to overview' }));
  expect(ids()).toEqual(before);
  act(() => changeScale(0.44));
  expect(ids()).toEqual(before);
  act(() => changeScale(0.46));
  expect(summaries()).toHaveLength(2);
});

it('moves focus to the visible descendant and back to its parent as the cut changes', () => {
  render(<Fixture />);
  summaries()[0].focus();
  act(() => changeScale(0.46));
  expect(summaries()).toHaveLength(2);
  expect(summaries()).toContain(document.activeElement);
  const focusedChild = document.activeElement;
  act(() => changeScale(0.44));
  expect(document.activeElement).toBe(focusedChild);
  act(() => changeScale(0.2));
  expect(summaries()).toHaveLength(1);
  expect(summaries()[0]).toHaveFocus();
});

it('keeps an available focus target when a live update removes the focused summary', () => {
  render(<Fixture />);
  summaries()[0].focus();
  act(() => replaceItems([]));
  expect(
    screen.getByRole('button', { name: '0 groups · 0 items' })
  ).toHaveFocus();
});

it('does not take focus from another control when the old cut disappears', () => {
  render(<Fixture />);
  summaries()[0].focus();
  const other = screen.getByRole('button', { name: 'External action' });
  other.focus();
  act(() => changeScale(0.46));
  expect(other).toHaveFocus();
});

it('restores readable Auto summaries when returning within the overview visibility band', () => {
  render(<Fixture />);
  act(() => changeScale(1.1));
  const before = ids();
  expect(before).toHaveLength(2);
  fireEvent.click(summaries()[0]);
  fireEvent.click(
    screen.getAllByRole('button', { name: /^Node \d+ TASK · ACTIVE$/ })[0]
  );
  expect(summaries()).toHaveLength(0);
  fireEvent.click(screen.getByRole('button', { name: 'Back to overview' }));
  expect(ids()).toEqual(before);
});

it('does no hidden overview routing and resumes the current summaries on return', () => {
  const route = vi.spyOn(routing, 'routeSchematicConnections');
  render(<Fixture />);
  expect(route).toHaveBeenCalled();
  act(() => changeScale(1.2));
  expect(summaries()).toHaveLength(0);
  route.mockClear();
  act(() => replaceItems(items.slice(0, 2)));
  act(() => changeScale(1.8));
  expect(route).not.toHaveBeenCalled();
  expect(
    screen.getByRole('button', { name: '2 groups · 2 items' })
  ).toBeVisible();
  act(() => changeScale(0.2));
  expect(route).toHaveBeenCalled();
  expect(summaries()).toHaveLength(1);
  expect(summaries()[0]).toHaveAccessibleName(/System, 2 items/);
  route.mockRestore();
});

it('keeps original member-pair fallback inside a directional trace and restores global priority on exit', () => {
  const source = items.map((item, index) => ({
    ...item,
    metadata: { lod: { groupPath: [index < 2 ? 'Left' : 'Right'] } },
  }));
  const relationships = [
    { id: 'block', source: 'n0', target: 'n2', type: 'BLOCKS' },
    { id: 'reverse', source: 'n2', target: 'n0', type: 'DEPENDS_ON' },
    { id: 'lower', source: 'n2', target: 'n0', type: 'REFERENCES' },
    { id: 'fallback', source: 'n3', target: 'n1', type: 'REFERENCES' },
    { id: 'internal', source: 'n0', target: 'n1', type: 'CONTAINS' },
    { id: 'pending', source: 'n0', target: 'absent', type: 'BLOCKS' },
  ];
  const original = JSON.stringify({ source, relationships });
  const route = vi.spyOn(routing, 'routeSchematicConnections');
  const fixture = (level: 'essential' | 'dependencies' | 'all') => (
    <SemanticGraphOverview
      items={source}
      edges={relationships}
      camera={{ x: 0, y: 0, scale: 0.2 }}
      readPositions={positions}
      onActiveChange={noop}
      onBrowse={noop}
      onInspect={noop}
      onBack={noop}
      relationshipPriority={projectRelationshipPriority(
        source,
        relationships,
        level
      )}
    />
  );
  const { container, rerender } = render(fixture('essential'));
  const routed = () =>
    route.mock.calls
      .at(-1)![1]
      .flatMap(bundle => bundle.edgeIds)
      .sort();
  const overview = container.querySelector('.semantic-overview')!;
  expect(routed()).toEqual(['block', 'fallback']);
  expect(overview).toHaveAttribute('data-priority-summarized', '2');
  fireEvent.click(
    screen.getByRole('button', { name: 'Left, 2 items, 0 blocked' })
  );
  fireEvent.click(
    screen.getByRole('button', { name: 'Trace incoming connections' })
  );
  expect(routed()).toEqual(['fallback', 'reverse']);
  expect(overview).toHaveAttribute('data-priority-summarized', '1');
  expect(overview).toHaveAttribute('data-geometry-deferred', '1');
  expect(overview).toHaveAttribute('data-internal-relationships', '1');
  expect(overview).toHaveAttribute('data-pending-relationships', '1');
  rerender(fixture('all'));
  expect(routed()).toEqual(['fallback', 'lower', 'reverse']);
  expect(overview).toHaveAttribute('data-priority-summarized', '0');
  rerender(fixture('essential'));
  fireEvent.click(
    screen.getByRole('button', { name: 'Trace outgoing connections' })
  );
  expect(routed()).toEqual(['block']);
  fireEvent.click(
    screen.getByRole('button', { name: 'Exit connection trace' })
  );
  expect(routed()).toEqual(['block', 'fallback']);
  expect(overview).toHaveAttribute('data-priority-summarized', '2');
  expect(JSON.stringify({ source, relationships })).toBe(original);
  route.mockRestore();
});
