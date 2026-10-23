import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { ApolloClient, ApolloLink, ApolloProvider, InMemoryCache, Observable, useQuery } from '@apollo/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkItemDetailsModal } from './WorkItemDetailsModal';
import { GET_WORK_ITEMS } from '../lib/queries';
import { UndoStack } from '../lib/undoStack';
import type { WorkItem } from '../types/graph';
import { StrictMode } from 'react';
import { GraphQLError } from 'graphql';

const context = vi.hoisted(() => ({ ownerId: 'owner-a', graphId: 'graph-a', success: vi.fn(), error: vi.fn() }));
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ currentUser: { id: context.ownerId, name: 'Owner', role: 'ADMIN' } }) }));
vi.mock('../contexts/GraphContext', () => ({ useGraph: () => ({ currentGraph: { id: context.graphId, name: 'Test graph' } }) }));
vi.mock('../contexts/NotificationContext', () => ({ useNotifications: () => ({ showSuccess: context.success, showError: context.error, showWarning: vi.fn() }) }));

function workItem(id: string, title: string) {
  return {
    __typename: 'WorkItem', id, title, description: '', type: 'TASK', status: 'ACTIVE',
    priority: 0, dueDate: null, tags: [], metadata: '{}', positionX: 0, positionY: 0,
    positionZ: 0, radius: 1, theta: 0, phi: 0, subgraphId: null, subgraph: null,
    owner: null, assignedTo: null, contributors: [], dependencies: [], dependents: [],
    graph: { __typename: 'Graph', id: 'graph-a', name: 'Test graph', team: null },
    createdAt: '2026-10-23T00:00:00.000Z', updatedAt: '2026-10-23T00:00:00.000Z',
  };
}

function editor() {
  const records = new Map([['item-a', workItem('item-a', 'First item')], ['item-b', workItem('item-b', 'Second item')]]);
  const attempts: Array<{ where: { id: string }; update: Record<string, unknown> }> = [];
  type Failure = Error | 'graphql' | 'empty' | 'wrong-item';
  const mutations: Array<(failure?: Failure) => void> = [];
  const refetches: Array<() => void> = [];
  const undoStack = new UndoStack();
  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new ApolloLink(operation => new Observable(observer => {
      const finish = (data: Record<string, unknown>) => { observer.next({ data }); observer.complete(); };
      if (operation.operationName === 'GetWorkItems') {
        finish({ workItems: [...records.values()] });
      } else if (operation.operationName === 'GetEdges') {
        refetches.push(() => finish({ edges: [] }));
      } else if (operation.operationName === 'UpdateWorkItems') {
        const variables = structuredClone(operation.variables) as (typeof attempts)[number];
        attempts.push(variables);
        mutations.push(failure => {
          if (failure instanceof Error) { observer.error(failure); return; }
          if (failure === 'graphql') {
            observer.next({ errors: [new GraphQLError('Test GraphQL rejection')] });
            observer.complete();
            return;
          }
          if (failure) {
            finish({ updateWorkItems: { __typename: 'UpdateWorkItemsMutationResponse', workItems: failure === 'empty' ? [] : [records.get('item-b')] } });
            return;
          }
          const saved = { ...records.get(variables.where.id)!, ...variables.update } as ReturnType<typeof workItem>;
          records.set(saved.id, saved);
          finish({ updateWorkItems: { __typename: 'UpdateWorkItemsMutationResponse', workItems: [saved] } });
        });
      } else observer.error(new Error(`Unexpected operation ${operation.operationName}`));
    })),
  });
  function Editor({ id, open }: { id: string; open: boolean }) {
    const { data } = useQuery(GET_WORK_ITEMS, { variables: { where: { graph: { id: context.graphId } } } });
    const node = data?.workItems.find((item: WorkItem) => item.id === id) ?? null;
    return <WorkItemDetailsModal isOpen={open} onClose={() => {}} node={node} undoStack={undoStack} />;
  }
  const tree = (id = 'item-a', open = true) => <StrictMode><ApolloProvider client={client}><Editor id={id} open={open} /></ApolloProvider></StrictMode>;
  const view = render(tree());
  return {
    records, attempts, mutations, refetches, undoStack,
    unmount: view.unmount,
    navigate: (id = 'item-a', open = true) => view.rerender(tree(id, open)),
    async acknowledgeMutation() {
      await waitFor(() => expect(mutations).toHaveLength(1));
      await act(async () => { mutations.shift()!(); });
      await waitFor(() => expect(refetches).toHaveLength(1));
    },
    async completeRefetch() {
      await act(async () => { refetches.shift()!(); });
    },
    async failMutation(failure: Failure = new Error('Test write failed')) {
      await waitFor(() => expect(mutations).toHaveLength(1));
      await act(async () => { mutations.shift()!(failure); });
      if (failure === 'empty' || failure === 'wrong-item') {
        await waitFor(() => expect(refetches).toHaveLength(1));
        await act(async () => { refetches.shift()!(); });
      }
    },
  };
}

const title = () => screen.getByRole('textbox', { name: 'Work item title' });
const dueDate = () => screen.getByLabelText('Due date');
const save = () => screen.getByRole('button', { name: /Save changes to work item|No changes to save/ });

beforeEach(() => {
  context.ownerId = 'owner-a';
  context.graphId = 'graph-a';
  vi.clearAllMocks();
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
});

afterEach(() => { vi.unstubAllGlobals(); });

describe('work item save completion', () => {
  it('preserves edits made after the mutation commits while its refetch is pending, then saves and undoes both snapshots', async () => {
    const view = editor();
    await screen.findByRole('textbox', { name: 'Work item title' });
    fireEvent.change(dueDate(), { target: { value: '2026-09-14' } });
    fireEvent.click(save());
    await view.acknowledgeMutation();
    expect(view.records.get('item-a')?.dueDate).toBe('2026-09-14T23:59:59.999Z');
    expect(save()).toBeDisabled();
    fireEvent.change(dueDate(), { target: { value: '' } });
    fireEvent.change(title(), { target: { value: 'A newer title' } });
    await view.completeRefetch();
    await waitFor(() => expect(save()).toBeEnabled());
    expect(dueDate()).toHaveValue('');
    expect(title()).toHaveValue('A newer title');
    expect(view.undoStack.size()).toBe(1);

    fireEvent.click(save());
    await view.acknowledgeMutation();
    expect(view.attempts[1].update).toMatchObject({ dueDate: null, title: 'A newer title' });
    await view.completeRefetch();
    await waitFor(() => expect(save()).toBeDisabled());
    expect(view.undoStack.size()).toBe(2);

    let undo!: Promise<unknown>;
    act(() => { undo = view.undoStack.undo(); });
    await view.acknowledgeMutation();
    expect(view.attempts[2].update).toMatchObject({ title: 'First item', dueDate: '2026-09-14T23:59:59.999Z' });
    await view.completeRefetch();
    await act(async () => { await undo; });
    expect(dueDate()).toHaveValue('2026-09-14');
    expect(title()).toHaveValue('First item');

    act(() => { undo = view.undoStack.undo(); });
    await view.acknowledgeMutation();
    expect(view.attempts[3].update.dueDate).toBeNull();
    await view.completeRefetch();
    await act(async () => { await undo; });
    expect(dueDate()).toHaveValue('');
    expect(view.undoStack.size()).toBe(0);
  });

  it('does not apply a late completion to a different item with a newer draft', async () => {
    const view = editor();
    await screen.findByRole('textbox', { name: 'Work item title' });
    fireEvent.change(title(), { target: { value: 'Saved first item' } });
    fireEvent.click(save());
    await view.acknowledgeMutation();
    view.navigate('item-b');
    fireEvent.change(title(), { target: { value: 'Draft for second item' } });
    await view.completeRefetch();
    await waitFor(() => expect(save()).toBeEnabled());
    expect(title()).toHaveValue('Draft for second item');
    fireEvent.click(save());
    await view.acknowledgeMutation();
    expect(view.attempts[1]).toMatchObject({ where: { id: 'item-b' }, update: { title: 'Draft for second item' } });
    await view.completeRefetch();
  });

  it('does not replace a draft from a later opening of the same item', async () => {
    const view = editor();
    await screen.findByRole('textbox', { name: 'Work item title' });
    fireEvent.change(title(), { target: { value: 'Submitted title' } });
    fireEvent.click(save());
    await view.acknowledgeMutation();
    view.navigate('item-a', false);
    view.navigate('item-a', true);
    fireEvent.change(title(), { target: { value: 'Reopened draft' } });
    await view.completeRefetch();
    await waitFor(() => expect(save()).toBeEnabled());
    expect(title()).toHaveValue('Reopened draft');
  });

  it('retains a deliberate return to the original value across the mutation cache write and refetch', async () => {
    const view = editor();
    await screen.findByRole('textbox', { name: 'Work item title' });
    fireEvent.change(title(), { target: { value: 'Submitted title' } });
    fireEvent.click(save());
    fireEvent.change(title(), { target: { value: 'First item' } });
    await view.acknowledgeMutation();
    expect(title()).toHaveValue('First item');
    await view.completeRefetch();
    await waitFor(() => expect(save()).toBeEnabled());
    expect(title()).toHaveValue('First item');
  });

  it.each(['owner', 'graph'] as const)('ignores success from an earlier %s context', async scope => {
    const view = editor();
    await screen.findByRole('textbox', { name: 'Work item title' });
    fireEvent.change(title(), { target: { value: 'Submitted in old context' } });
    fireEvent.click(save());
    await view.acknowledgeMutation();
    if (scope === 'owner') context.ownerId = 'owner-b';
    else context.graphId = 'graph-b';
    view.navigate();
    await screen.findByRole('textbox', { name: 'Work item title' });
    fireEvent.change(title(), { target: { value: 'Current context draft' } });
    await view.completeRefetch();
    await waitFor(() => expect(save()).toBeEnabled());
    expect(title()).toHaveValue('Current context draft');
    expect(context.success).not.toHaveBeenCalled();
  });

  it('retains a newer draft on failure and retries without registering failed undo history', async () => {
    const view = editor();
    await screen.findByRole('textbox', { name: 'Work item title' });
    fireEvent.change(title(), { target: { value: 'Failed title' } });
    fireEvent.click(save());
    fireEvent.change(title(), { target: { value: 'Retry this newer title' } });
    await view.failMutation();
    await waitFor(() => expect(save()).toBeEnabled());
    expect(title()).toHaveValue('Retry this newer title');
    expect(context.error).toHaveBeenCalledOnce();
    expect(view.undoStack.size()).toBe(0);
    fireEvent.click(save());
    await view.acknowledgeMutation();
    expect(view.attempts[1].update.title).toBe('Retry this newer title');
    await view.completeRefetch();
    expect(view.undoStack.size()).toBe(1);
  });

  it('does not report a stale failure in a different item session', async () => {
    const view = editor();
    await screen.findByRole('textbox', { name: 'Work item title' });
    fireEvent.change(title(), { target: { value: 'Failed title' } });
    fireEvent.click(save());
    view.navigate('item-b');
    fireEvent.change(title(), { target: { value: 'Second item draft' } });
    await view.failMutation();
    await waitFor(() => expect(save()).toBeEnabled());
    expect(title()).toHaveValue('Second item draft');
    expect(context.error).not.toHaveBeenCalled();
  });

  it('preserves unsaved fields before and during undo while updating the saved baseline', async () => {
    const view = editor();
    await screen.findByRole('textbox', { name: 'Work item title' });
    fireEvent.change(title(), { target: { value: 'Saved title' } });
    fireEvent.click(save());
    await view.acknowledgeMutation();
    await view.completeRefetch();
    fireEvent.change(screen.getByPlaceholderText('Enter description'), { target: { value: 'Unsaved description' } });
    let undo!: Promise<unknown>;
    act(() => { undo = view.undoStack.undo(); });
    fireEvent.change(title(), { target: { value: 'Title edited during undo' } });
    await view.acknowledgeMutation();
    await view.completeRefetch();
    await act(async () => { await undo; });
    expect(title()).toHaveValue('Title edited during undo');
    expect(screen.getByPlaceholderText('Enter description')).toHaveValue('Unsaved description');
    expect(save()).toBeEnabled();
    expect(view.records.get('item-a')?.title).toBe('First item');
  });

  it.each(['mounted', 'unmounted'])('does not repopulate history cleared for another graph while a save is pending (%s)', async mode => {
    const view = editor();
    await screen.findByRole('textbox', { name: 'Work item title' });
    fireEvent.change(title(), { target: { value: 'Saved in graph A' } });
    fireEvent.click(save());
    await view.acknowledgeMutation();
    view.undoStack.clear();
    view.undoStack.push({ label: 'Graph B action', undo: vi.fn() });
    if (mode === 'unmounted') view.unmount();
    else {
      context.graphId = 'graph-b';
      view.navigate('item-b');
      await screen.findByRole('textbox', { name: 'Work item title' });
    }
    await view.completeRefetch();
    expect(view.undoStack.size()).toBe(1);
    expect(view.undoStack.peekLabel()).toBe('Graph B action');
  });

  it('keeps a successful save undoable after normal modal unmount when history was not cleared', async () => {
    const view = editor();
    await screen.findByRole('textbox', { name: 'Work item title' });
    fireEvent.change(title(), { target: { value: 'Saved before closing' } });
    fireEvent.click(save());
    await view.acknowledgeMutation();
    view.unmount();
    await view.completeRefetch();
    expect(view.undoStack.size()).toBe(1);
    let undo!: Promise<unknown>;
    act(() => { undo = view.undoStack.undo(); });
    await view.acknowledgeMutation();
    expect(view.attempts[1].update.title).toBe('First item');
    await view.completeRefetch();
    await act(async () => { await undo; });
    expect(view.records.get('item-a')?.title).toBe('First item');
  });

  it.each(['graphql', 'empty', 'wrong-item'] as const)('reports a %s save response and retains the newer draft for retry', async failure => {
    const view = editor();
    await screen.findByRole('textbox', { name: 'Work item title' });
    fireEvent.change(title(), { target: { value: 'Submitted title' } });
    fireEvent.click(save());
    fireEvent.change(title(), { target: { value: 'Keep this newer draft' } });
    await view.failMutation(failure);
    await waitFor(() => expect(save()).toBeEnabled());
    expect(title()).toHaveValue('Keep this newer draft');
    expect(context.error).toHaveBeenCalledOnce();
    expect(context.success).not.toHaveBeenCalled();
    expect(view.undoStack.size()).toBe(0);
    fireEvent.click(save());
    await view.acknowledgeMutation();
    expect(view.attempts[1].update.title).toBe('Keep this newer draft');
    await view.completeRefetch();
    expect(view.undoStack.size()).toBe(1);
  });

  it.each(['graphql', 'empty', 'wrong-item'] as const)('rejects a %s undo acknowledgement without changing the saved form', async failure => {
    const view = editor();
    await screen.findByRole('textbox', { name: 'Work item title' });
    fireEvent.change(title(), { target: { value: 'Confirmed title' } });
    fireEvent.click(save());
    await view.acknowledgeMutation();
    await view.completeRefetch();
    let outcome!: Promise<unknown>;
    act(() => { outcome = view.undoStack.undo().then(() => null, error => error); });
    await view.failMutation(failure);
    let error: unknown;
    await act(async () => { error = await outcome; });
    expect(error).toBeInstanceOf(Error);
    expect(title()).toHaveValue('Confirmed title');
    expect(view.records.get('item-a')?.title).toBe('Confirmed title');
    expect(context.success).toHaveBeenCalledOnce();
    expect(view.undoStack.size()).toBe(0);
  });
});
