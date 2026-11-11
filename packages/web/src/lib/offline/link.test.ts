import { ApolloClient, ApolloLink, ApolloProvider, InMemoryCache, Observable, execute, gql } from '@apollo/client';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyAccount, type Account, type Snapshot } from './model';

const fixture = vi.hoisted(() => ({ account: null as Account | null, graphId: 'project', graphs: [] as Array<{ id: string; name: string; parentGraphId?: string | null }>, guest: false, showSuccess: vi.fn(), showError: vi.fn() }));
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
  localGuest: () => fixture.guest,
  primaryProjectId: () => 'primary',
  listProjects: async () => Object.values(fixture.account!.projects).flatMap(p => p.local ? [p.local.project] : []),
  getProject: async (id: string) => {
    const project = fixture.account!.projects[id]?.local;
    if (!project) throw new Error('Unknown project');
    return structuredClone(project);
  },
}));
vi.mock('../authStorage', () => ({ getUserRaw: () => JSON.stringify({ id: 'owner', role: 'USER' }) }));
vi.mock('../../contexts/GraphContext', () => ({ useGraph: () => ({ currentGraph: { id: fixture.graphId, name: fixture.graphId }, availableGraphs: fixture.graphs, deleteGraph: vi.fn() }) }));
vi.mock('../../contexts/NotificationContext', () => ({ useNotifications: () => ({ showSuccess: fixture.showSuccess, showError: fixture.showError }) }));

import { offlineLink } from './link';
import { DeleteGraphModal } from '../../components/DeleteGraphModal';
import { CREATE_GRAPH, CREATE_STARTER_GRAPHS, GET_GRAPHS, UPDATE_GRAPH, DELETE_GRAPH } from '../../graphql/graph';
import { CREATE_EDGE, CREATE_WORK_ITEM, GET_EDGES, GET_WORK_ITEMS } from '../queries';
import { buildStarterWorkspace, createStarterWorkspace, type StarterApi } from '../starterWorkspace';

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
    fixture.graphs = [];
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

  it('inspects the graph that was clicked, not the one that is open', async () => {
    const client = new ApolloClient({ link: offlineLink, cache: new InMemoryCache() });
    const other = { id: 'other', name: 'other' } as never;
    render(createElement(ApolloProvider, { client, children: createElement(DeleteGraphModal, { isOpen: true, onClose: vi.fn(), graph: other }) }));
    expect(await screen.findByRole('button', { name: 'Delete All Unconnected Work Items (1)' })).not.toBeNull();
    expect(screen.getByText('"other"')).not.toBeNull();
    client.stop();
  });

  it('refuses a project that still holds graphs before anyone types its name', async () => {
    fixture.graphs = [
      { id: 'project', name: 'Getting started', parentGraphId: null },
      ...['Welcome', 'Plan a launch', 'Fix bugs', 'Ideas'].map(name => ({ id: name, name, parentGraphId: 'project' })),
    ];
    const asked: string[] = [];
    const spy = new ApolloLink((operation, forward) => { asked.push(operation.operationName); return forward(operation); });
    const client = new ApolloClient({ link: spy.concat(offlineLink), cache: new InMemoryCache() });
    const project = { id: 'project', name: 'Getting started' } as never;
    render(createElement(ApolloProvider, { client, children: createElement(DeleteGraphModal, { isOpen: true, onClose: vi.fn(), graph: project }) }));
    expect(screen.getByRole('alert').textContent).toBe('Getting started holds 4 graphs. Delete or move them first.');
    expect(screen.getByText('This project still holds graphs')).not.toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('button', { name: /Delete/ })).toBeNull();
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); });
    expect(asked).toEqual([]);
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

type Shaped = { id: string; name: string; [field: string]: unknown };

describe('offline graph hierarchy', () => {
  const graphs = async () => (await run(GET_GRAPHS, {})).data.graphs as Shaped[];
  const byName = (list: Shaped[], name: string) => list.find(g => g.name === name);
  const create = async (input: Record<string, unknown>) => (await run(CREATE_GRAPH, { input })).data.createGraphs.graphs[0];
  const move = (id: string, parentGraphId: string | null) => run(UPDATE_GRAPH, { id, input: { parentGraphId } });

  beforeEach(() => {
    vi.clearAllMocks();
    fixture.guest = true;
    fixture.account = emptyAccount();
    for (const s of [snapshot('project', ['a']), snapshot('other', [])]) {
      fixture.account.projects[s.project.id] = { base: null, local: s, checkedAt: 0 };
    }
  });

  it('reads rows saved before the hierarchy existed as top-level projects', async () => {
    fixture.guest = false;
    expect((await graphs()).map(g => [g.name, g.type, g.parentGraphId, g.depth, g.path])).toEqual([
      ['project', 'PROJECT', null, 0, []],
      ['other', 'PROJECT', null, 0, []],
    ]);
  });

  it('round-trips a guest graph created inside a project', async () => {
    const child = await create({ name: 'Inside', type: 'SUBGRAPH', parentGraphId: 'project', depth: 1, path: ['project'] });
    expect(child).toMatchObject({ type: 'SUBGRAPH', parentGraphId: 'project', depth: 1, path: ['project'] });
    const grandchild = await create({ name: 'Deeper', type: 'SUBGRAPH', parentGraphId: child.id });
    expect(grandchild).toMatchObject({ parentGraphId: child.id, depth: 2, path: ['project', child.id] });
    const listed = await graphs();
    expect(byName(listed, 'Inside')).toMatchObject({ id: child.id, type: 'SUBGRAPH', parentGraphId: 'project', depth: 1, path: ['project'] });
    expect(byName(listed, 'Deeper')).toMatchObject({ parentGraphId: child.id, depth: 2, path: ['project', child.id] });
    expect(fixture.account!.projects[child.id].local!.project).toMatchObject({ type: 'SUBGRAPH', parent_id: 'project' });
    expect((await run(gql`query($p: String) { graphs(where: { parentGraphId: $p }) { name } }`, { p: 'project' })).data.graphs).toEqual([{ name: 'Inside' }]);
  });

  it('rejects a parent that does not exist or a type that is not a graph type', async () => {
    await expect(create({ name: 'Lost', type: 'SUBGRAPH', parentGraphId: 'missing' })).rejects.toThrow('The parent project does not exist.');
    await expect(create({ name: 'Odd', type: 'FOLDER' })).rejects.toThrow(/Choose a project/);
    expect(Object.keys(fixture.account!.projects)).toEqual(['project', 'other']);
  });

  it('keeps a signed-in account flat, because its sync has no parent column yet', async () => {
    fixture.guest = false;
    const created = await create({ name: 'Flat', type: 'SUBGRAPH', parentGraphId: 'project' });
    expect(created).toMatchObject({ type: 'PROJECT', parentGraphId: null, depth: 0, path: [] });
    expect(fixture.account!.projects[created.id].local!.project).not.toHaveProperty('parent_id');
    await move('other', 'project');
    expect(byName(await graphs(), 'other')).toMatchObject({ parentGraphId: null, depth: 0 });
  });

  it('moves a graph to another parent or the top level, and refuses cycles', async () => {
    const child = await create({ name: 'Inside', type: 'SUBGRAPH', parentGraphId: 'project' });
    await move('other', child.id);
    expect(byName(await graphs(), 'other')).toMatchObject({ parentGraphId: child.id, depth: 2, path: ['project', child.id] });
    await expect(move('project', 'other')).rejects.toThrow('A graph cannot be moved inside itself.');
    await expect(move('project', 'project')).rejects.toThrow('A graph cannot be moved inside itself.');
    await expect(move('other', 'missing')).rejects.toThrow('The parent project does not exist.');
    await move('other', null);
    expect(byName(await graphs(), 'other')).toMatchObject({ parentGraphId: null, depth: 0, path: [] });
    expect(byName(await graphs(), 'project')).toMatchObject({ parentGraphId: null, depth: 0 });
  });

  it('refuses to delete a project that still has graphs, so none is left without its parent', async () => {
    const child = await create({ name: 'Inside', type: 'SUBGRAPH', parentGraphId: 'other' });
    await expect(run(DELETE_GRAPH, { id: 'other' })).rejects.toThrow('other holds 1 graph. Delete or move them first.');
    expect(fixture.account!.projects.other.local).not.toBeNull();
    await run(DELETE_GRAPH, { id: child.id });
    await run(DELETE_GRAPH, { id: 'other' });
    expect((await graphs()).map(g => g.name)).toEqual(['project']);
  });

  it('a child whose parent row is gone still shows, at the top level', async () => {
    const child = await create({ name: 'Inside', type: 'SUBGRAPH', parentGraphId: 'other' });
    fixture.account!.projects.other.local = null;
    expect(byName(await graphs(), 'Inside')).toMatchObject({ id: child.id, parentGraphId: null, depth: 0, path: [] });
  });

  it('builds the whole starter workspace for a guest, and Welcome is the graph that opens', async () => {
    fixture.account = emptyAccount();
    const api: StarterApi = {
      createGraphs: async inputs => (await run(CREATE_STARTER_GRAPHS, { input: inputs.map(input => ({ ...input, status: 'ACTIVE', createdBy: 'owner' })) })).data.createGraphs.graphs,
      createItems: async (graphId, items) => (await run(CREATE_WORK_ITEM, {
        input: items.map(item => ({ title: item.title, description: item.description, type: item.type, status: item.status, priority: item.priority, positionX: item.x, positionY: item.y, tags: item.tags, graph: { connect: { where: { node: { id: graphId } } } } })),
      })).data.createWorkItems.workItems.map((w: Shaped) => w.id),
      createEdges: async edges => { await run(CREATE_EDGE, { input: edges.map(e => ({ type: e.type, source: { connect: { where: { node: { id: e.sourceId } } } }, target: { connect: { where: { node: { id: e.targetId } } } } })) }); },
      setCounts: async (id, counts) => { await run(UPDATE_GRAPH, { id, input: { ...counts, lastActivity: new Date().toISOString() } }); },
    };
    const plan = buildStarterWorkspace({ hierarchy: true });
    const created = await createStarterWorkspace(plan, api);
    const listed = await graphs();
    expect(listed).toHaveLength(7);
    const project = (key: string) => created.ids[key];
    for (const p of plan.projects) expect(listed.find(g => g.id === project(p.key))).toMatchObject({ name: p.name, type: 'PROJECT', parentGraphId: null, depth: 0, nodeCount: 0 });
    for (const g of plan.graphs) {
      expect(listed.find(x => x.id === created.ids[g.key])).toMatchObject({
        name: g.name, type: 'SUBGRAPH', parentGraphId: project(g.project!), depth: 1, path: [project(g.project!)], nodeCount: g.items.length, edgeCount: g.edges.length,
      });
    }
    const welcome = created.ids.welcome;
    const items = (await run(GET_WORK_ITEMS, { where: { graph: { id: welcome } } })).data.workItems;
    expect(items.map((w: Shaped) => [w.title, w.positionX, w.positionY])).toEqual([
      ['Welcome to GraphDone', 0, -100], ['Create your first work item', -150, 50], ['Connect work items together', 150, 50], ['Explore different views', 0, 200],
    ]);
    expect((await run(GET_EDGES, { where: { source: { graph: { id: welcome } } } })).data.edges).toHaveLength(3);
  });
});
