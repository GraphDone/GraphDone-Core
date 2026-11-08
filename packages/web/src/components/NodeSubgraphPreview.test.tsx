import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useQuery } from '@apollo/client';
import { GET_WORK_ITEMS, GET_EDGES } from '../lib/queries';
import { NodeSubgraphPreview } from './NodeSubgraphPreview';

vi.mock('@apollo/client', async importOriginal => ({
  ...(await importOriginal<typeof import('@apollo/client')>()),
  useQuery: vi.fn(),
}));
let itemsResult: {
  data?: { workItems: unknown[] };
  loading: boolean;
  error?: Error;
};
let edgesResult: {
  data?: { edges: unknown[] };
  loading: boolean;
  error?: Error;
};
beforeEach(() => {
  itemsResult = { data: { workItems: [] }, loading: false };
  edgesResult = { data: { edges: [] }, loading: false };
  vi.mocked(useQuery).mockImplementation(((query: unknown) =>
    query === GET_WORK_ITEMS ? itemsResult : edgesResult) as typeof useQuery);
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it('keeps navigation available during loading, errors and an actually empty graph', () => {
  const open = vi.fn();
  itemsResult = { loading: true };
  const { rerender } = render(
    <NodeSubgraphPreview subgraphId="child" onOpen={open} />
  );
  expect(screen.getByRole('status')).toHaveTextContent('Loading diagram');
  expect(screen.queryByText('This sub-graph is empty.')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Open graph' }));
  expect(open).toHaveBeenCalledOnce();
  itemsResult = { loading: false, error: new Error('unavailable') };
  rerender(<NodeSubgraphPreview subgraphId="child" onOpen={open} />);
  expect(screen.getByRole('alert')).toHaveTextContent('could not load');
  expect(screen.queryByText('This sub-graph is empty.')).toBeNull();
  itemsResult = { loading: false, data: { workItems: [] } };
  rerender(<NodeSubgraphPreview subgraphId="child" onOpen={open} />);
  expect(screen.getByText('This sub-graph is empty.')).toBeVisible();
});

it('labels the capped preview honestly and renders bounded readable examples instead of tiny SVG text', () => {
  const title = 'AAA 配送サービス / ' + 'unbrokentitle'.repeat(12);
  itemsResult.data!.workItems = Array.from({ length: 300 }, (_, i) => ({
    id: String(i),
    title: i === 0 ? title : `Node ${i}`,
    type: 'TASK',
    status: 'ACTIVE',
    metadata: { lod: { groupPath: [`Service ${i % 12}`] } },
  }));
  edgesResult.data!.edges = Array.from({ length: 600 }, (_, i) => ({
    id: String(i),
    type: 'BLOCKS',
    source: String(i % 300),
    target: String((i + 1) % 300),
  }));
  const { container } = render(
    <NodeSubgraphPreview subgraphId="child" onOpen={() => {}} />
  );
  expect(screen.getByText('300+ items · 600+ connections')).toBeVisible();
  expect(
    screen.getByText('Partial preview. Open the graph for all details.')
  ).toBeVisible();
  expect(screen.getByText(title)).toBeVisible();
  expect(container.querySelectorAll('[data-preview-group]')).toHaveLength(4);
  expect(container.querySelectorAll('[data-preview-item]')).toHaveLength(8);
  expect(container.querySelectorAll('[data-preview-connection]')).toHaveLength(
    3
  );
  expect(
    container.querySelectorAll(
      'svg:not([aria-hidden="true"]) text, svg:not([aria-hidden="true"]) line'
    )
  ).toHaveLength(0);
  expect(useQuery).toHaveBeenCalledWith(
    GET_WORK_ITEMS,
    expect.objectContaining({
      variables: { where: { graph: { id: 'child' } }, options: { limit: 300 } },
    })
  );
  expect(useQuery).toHaveBeenCalledWith(
    GET_EDGES,
    expect.objectContaining({
      variables: {
        where: {
          OR: [
            { source: { graph: { id: 'child' } } },
            { target: { graph: { id: 'child' } } },
          ],
        },
        options: { limit: 600 },
      },
    })
  );
});

it('distinguishes loading and unavailable connections from an empty relationship set', () => {
  itemsResult.data!.workItems = [
    { id: 'n', title: 'Gateway', type: 'TASK', status: 'ACTIVE' },
  ];
  edgesResult = { loading: true };
  const { rerender } = render(
    <NodeSubgraphPreview subgraphId="child" onOpen={() => {}} />
  );
  expect(screen.getByText(/loading connections/)).toBeVisible();
  edgesResult = { loading: false, error: new Error('unavailable') };
  rerender(<NodeSubgraphPreview subgraphId="child" onOpen={() => {}} />);
  expect(screen.getByText(/connections unavailable/)).toBeVisible();
  expect(screen.queryByText(/0 connections/)).toBeNull();
});
