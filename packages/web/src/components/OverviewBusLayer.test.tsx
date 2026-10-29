import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { OverviewBusLayer } from './OverviewBusLayer';
import type { SchematicRoute } from '../lib/schematicRouting';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it('gives new keyboard focus ownership over a stationary hover and keeps a persistent focus cue', () => {
  vi.stubGlobal('requestAnimationFrame', () => 1);
  const routes: SchematicRoute[] = ['A', 'B'].map((id, index) => ({
    id,
    bus: id,
    source: id,
    target: `${id} target`,
    edgeIds: [`edge-${id}`],
    connections: [
      {
        id,
        source: id,
        target: `${id} target`,
        type: 'BLOCKS',
        edgeIds: [`edge-${id}`],
      },
    ],
    points: [
      { x: 100, y: 100 + index * 100 },
      { x: 400, y: 100 + index * 100 },
    ],
  }));
  const highlight = vi.fn(),
    inspect = vi.fn();
  const { container } = render(
    <OverviewBusLayer
      routes={routes}
      junctions={[]}
      obstacles={[]}
      width={800}
      height={600}
      color={() => '#5eead4'}
      label={id => id}
      onHighlight={highlight}
      onInspect={inspect}
      onFocusLost={() => {}}
    />
  );
  const a = screen.getByRole('button', {
    name: 'Inspect A → A target: 1 relationship',
  });
  const b = screen.getByRole('button', {
    name: 'Inspect B → B target: 1 relationship',
  });
  fireEvent.pointerEnter(a, { clientX: 200, clientY: 100 });
  expect(highlight).toHaveBeenLastCalledWith('A');
  act(() => b.focus());
  expect(b).toHaveFocus();
  expect(highlight).toHaveBeenLastCalledWith('B');
  expect(screen.getByRole('tooltip').textContent).toContain('B → B target');
  expect(b.getAttribute('aria-describedby')).toBe(
    screen.getByRole('tooltip').id
  );
  fireEvent.pointerEnter(a, { clientX: 200, clientY: 100 });
  expect(highlight).toHaveBeenLastCalledWith('A');
  expect(b).toHaveFocus();
  const focused = container.querySelector('[data-bus-focused="true"]')!;
  expect(focused.getAttribute('data-lod-bus-source')).toBe('B');
  expect(focused.getAttribute('stroke-width')).toBe('5');
  expect(focused.getAttribute('opacity')).toBe('1');
  fireEvent.keyDown(b, { key: 'Enter' });
  expect(inspect).toHaveBeenLastCalledWith(routes[1], b);
});

it('resolves hover, movement and click to the nearest bus despite overlapping pointer targets', () => {
  vi.stubGlobal('requestAnimationFrame', () => 1);
  vi.stubGlobal('PointerEvent', MouseEvent);
  const routes: SchematicRoute[] = ['A', 'B'].map((id, index) => ({
    id,
    bus: id,
    source: id,
    target: `${id} target`,
    edgeIds: [`edge-${id}`],
    connections: [
      {
        id,
        source: id,
        target: `${id} target`,
        type: 'BLOCKS',
        edgeIds: [`edge-${id}`],
      },
    ],
    points: [
      { x: 100, y: 100 + index * 6 },
      { x: 400, y: 100 + index * 6 },
    ],
  }));
  const highlight = vi.fn(),
    inspect = vi.fn();
  render(
    <OverviewBusLayer
      routes={routes}
      junctions={[]}
      obstacles={[]}
      width={800}
      height={600}
      color={() => '#5eead4'}
      label={id => id}
      onHighlight={highlight}
      onInspect={inspect}
      onFocusLost={() => {}}
    />
  );
  const a = screen.getByRole('button', {
    name: 'Inspect A → A target: 1 relationship',
  });
  const b = screen.getByRole('button', {
    name: 'Inspect B → B target: 1 relationship',
  });
  fireEvent.pointerEnter(b, { clientX: 200, clientY: 100 });
  expect(highlight).toHaveBeenLastCalledWith('A');
  fireEvent.pointerMove(b, { clientX: 200, clientY: 106 });
  expect(highlight).toHaveBeenLastCalledWith('B');
  fireEvent.pointerMove(b, { clientX: 200, clientY: 100 });
  expect(highlight).toHaveBeenLastCalledWith('A');
  fireEvent.click(b, { clientX: 200, clientY: 100, detail: 1 });
  expect(inspect).toHaveBeenLastCalledWith(routes[0], a);
  expect(a).toHaveFocus();
});
