import { ApolloClient, ApolloLink, ApolloProvider, InMemoryCache, Observable, execute, gql } from '@apollo/client';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyAccount, type Account, type Snapshot } from './model';

const fixture = vi.hoisted(() => ({ account: null as Account | null, graphId: 'project', showSuccess: vi.fn(), showError: vi.fn() }));
vi.mock('./store', () => ({
  readAccount: async () => structuredClone(fixture.account),
  editAccount: async (_owner: string, edit: (account: Account) => unknown) => {
    const account = structuredClone(fixture.account!);
    const result = edit(account);
    fixture.account = account;
    return result;
  },
}));
vi.mock('./engine', () => ({
  offlineEnabled: true,
  ownerId: () => 'owner',
  sessionAccountId: () => 'owner',
  localGuest: () => false,
  primaryProjectId: () => 'primary',
  listProjects: async () => Object.values(fixture.account!.projects).flatMap(p => p.local ? [p.local.project] : []),
  getProject: async (id: string) => {
    const project = fixture.account!.projects[id]?.local;
    if (!project) throw new Error('Unknown project');
    return structuredClone(project);
  },
}));
vi.mock('../authStorage', () => ({ getUserRaw: () => JSON.stringify({ id: 'owner', role: 'USER' }) }));
vi.mock('../../contexts/GraphContext', () => ({ useGraph: () => ({ currentGraph: { id: fixture.graphId, name: fixture.graphId }, deleteGraph: vi.fn() }) }));
vi.mock('../../contexts/NotificationContext', () => ({ useNotifications: () => ({ showSuccess: fixture.showSuccess, showError: fixture.showError }) }));

import { offlineLink } from './link';
import { DeleteGraphModal } from '../../components/DeleteGraphModal';

const snapshot = (id: string, ids: string[]): Snapshot => ({
  project: { id, name: id, owner_id: 'owner' },
  nodes: ids.map(id => ({ id, title: id, type: 'TASK', status: 'PROPOSED', priority: 0, position_x: 0, position_y: 0 })),
  edges: [],
  notes: [],
});

const run = (query: ReturnType<typeof gql>, variables: Record<string, unknown>) =>
  new Promise<any>((resolve, reject) => {
    execute(offlineLink, { query, variables }).subscribe({ next: resolve, error: reject });
  });

describe('offline GraphQL bulk selection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fixture.graphId = 'project';
    fixture.account = emptyAccount();
    for (const s of [snapshot('project', ['a', 'b', 'c']), snapshot('other', ['d'])]) {
      fixture.account.projects[s.project.id] = { base: structuredClone(s), local: s, checkedAt: 0 };
    }
    localStorage.setItem('currentGraphId', 'other');
  });

  it('deletes only the selected IDs in the explicitly selected project', async () => {
    const result = await run(gql`
      mutation DeleteSelected($where: WorkItemWhere!) {
        deleteWorkItems(where: $where) { nodesDeleted relationshipsDeleted }
      }
    `, { where: { graph: { id: 'project' }, id_IN: ['a', 'c', 'd'] } });

    expect(result.data.deleteWorkItems.nodesDeleted).toBe(2);
    expect(fixture.account!.projects.project.local!.nodes.map(n => n.id)).toEqual(['b']);
    expect(fixture.account!.projects.other.local!.nodes.map(n => n.id)).toEqual(['d']);
  });

  it('supports an empty ID selection without deleting any work', async () => {
    const result = await run(gql`
      mutation DeleteSelected($where: WorkItemWhere!) {
        deleteWorkItems(where: $where) { nodesDeleted }
      }
    `, { where: { graph: { id: 'project' }, id_IN: [] } });

    expect(result.data.deleteWorkItems.nodesDeleted).toBe(0);
    expect(fixture.account!.projects.project.local!.nodes).toHaveLength(3);
  });

  it('combines ID selection with nested OR/AND filters', async () => {
    const result = await run(gql`
      query Selected($where: WorkItemWhere!) { workItems(where: $where) { id } }
    `, { where: { graph: { id: 'project' }, AND: [{ id_IN: ['a', 'b'] }, { OR: [{ id: 'b' }, { id: 'c' }] }] } });

    expect(result.data.workItems).toEqual([{ id: 'b' }]);
  });

  it('deletes the confirmed modal selection and refreshes the visible work items', async () => {
    const client = new ApolloClient({ link: offlineLink, cache: new InMemoryCache() });
    render(createElement(ApolloProvider, { client, children: createElement(DeleteGraphModal, { isOpen: true, onClose: vi.fn() }) }));
    fireEvent.click(await screen.findByRole('button', { name: 'Delete All Unconnected Work Items (3)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, Delete All' }));

    await waitFor(() => expect(fixture.showSuccess).toHaveBeenCalledWith(
      'Work Items Deletion Completed Successfully!',
      'Removed 3 work items from project.',
    ));
    expect(fixture.showError).not.toHaveBeenCalled();
    expect(fixture.account!.projects.project.local!.nodes).toEqual([]);
    expect(fixture.account!.projects.other.local!.nodes.map(n => n.id)).toEqual(['d']);
    expect(screen.queryByRole('button', { name: /Delete All Unconnected/ })).toBeNull();
    client.stop();
  });

  it('does not announce a successful deletion when the adapter deleted no items', async () => {
    const noDeletion = new ApolloLink((operation, forward) => operation.operationName === 'DeleteWorkItems'
      ? new Observable(observer => {
        observer.next({ data: { deleteWorkItems: { nodesDeleted: 0, relationshipsDeleted: 0 } } });
        observer.complete();
      })
      : forward(operation));
    const client = new ApolloClient({ link: noDeletion.concat(offlineLink), cache: new InMemoryCache() });
    render(createElement(ApolloProvider, { client, children: createElement(DeleteGraphModal, { isOpen: true, onClose: vi.fn() }) }));
    fireEvent.click(await screen.findByRole('button', { name: 'Delete All Unconnected Work Items (3)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, Delete All' }));

    await waitFor(() => expect(fixture.showError).toHaveBeenCalledWith('Bulk Delete Failed', expect.stringContaining('Not all selected work items')));
    expect(fixture.showSuccess).not.toHaveBeenCalled();
    expect(fixture.account!.projects.project.local!.nodes).toHaveLength(3);
    expect(screen.getByRole('button', { name: 'Delete All Unconnected Work Items (3)' })).not.toBeNull();
    client.stop();
  });

  it('waits for connection results before offering deletion and preserves connected tasks', async () => {
    fixture.account!.projects.project.local!.edges.push({ id: 'ab', source_id: 'a', target_id: 'b', type: 'DEPENDS_ON', weight: 1 });
    let releaseEdges!: () => void;
    let delayed = false;
    const delayEdges = new ApolloLink((operation, forward) => operation.operationName === 'GetEdges' && !delayed
      ? new Observable(observer => { delayed = true; releaseEdges = () => forward(operation).subscribe(observer); })
      : forward(operation));
    const client = new ApolloClient({ link: delayEdges.concat(offlineLink), cache: new InMemoryCache() });
    render(createElement(ApolloProvider, { client, children: createElement(DeleteGraphModal, { isOpen: true, onClose: vi.fn() }) }));
    await screen.findByText('Graph Contains Active Work Items');
    expect(screen.queryByRole('button', { name: /Delete All Unconnected/ })).toBeNull();

    await act(async () => { releaseEdges(); });
    fireEvent.click(await screen.findByRole('button', { name: 'Delete All Unconnected Work Items (1)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, Delete All' }));
    await waitFor(() => expect(fixture.account!.projects.project.local!.nodes.map(n => n.id)).toEqual(['a', 'b']));
    expect(fixture.account!.projects.project.local!.edges.map(e => e.id)).toEqual(['ab']);
    await waitFor(() => expect(fixture.showSuccess).toHaveBeenCalled());
    client.stop();
  });

  it('fails closed when connections cannot be loaded', async () => {
    const failedEdges = new ApolloLink((operation, forward) => operation.operationName === 'GetEdges'
      ? new Observable(observer => { observer.error(new Error('Connection query failed')); })
      : forward(operation));
    const client = new ApolloClient({ link: failedEdges.concat(offlineLink), cache: new InMemoryCache() });
    render(createElement(ApolloProvider, { client, children: createElement(DeleteGraphModal, { isOpen: true, onClose: vi.fn() }) }));
    await screen.findByText('Graph Contains Active Work Items');
    expect(screen.queryByRole('button', { name: /Delete All Unconnected/ })).toBeNull();
    expect(screen.getByRole('alert').textContent).toContain('Deletion is unavailable');
    expect(fixture.account!.projects.project.local!.nodes).toHaveLength(3);
    client.stop();
  });

  it('does not reuse connection evidence after the selected graph changes', async () => {
    const delayOtherEdges = new ApolloLink((operation, forward) => operation.operationName === 'GetEdges' && operation.variables.where.source.graph.id === 'other'
      ? new Observable(() => {})
      : forward(operation));
    const client = new ApolloClient({ link: delayOtherEdges.concat(offlineLink), cache: new InMemoryCache() });
    const element = () => createElement(ApolloProvider, { client, children: createElement(DeleteGraphModal, { isOpen: true, onClose: vi.fn() }) });
    const { rerender } = render(element());
    await screen.findByRole('button', { name: 'Delete All Unconnected Work Items (3)' });
    fixture.graphId = 'other';
    rerender(element());
    await waitFor(() => expect(screen.getByText('This graph contains', { exact: false }).textContent).toContain('1 work item'));
    expect(screen.queryByRole('button', { name: /Delete All Unconnected/ })).toBeNull();
    expect(fixture.account!.projects.other.local!.nodes.map(n => n.id)).toEqual(['d']);
    client.stop();
  });
});
