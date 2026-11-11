// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { ApolloClient, ApolloLink, ApolloProvider, InMemoryCache, Observable } from '@apollo/client';
import { getMainDefinition } from '@apollo/client/utilities';
import { valueFromASTUntyped, type FieldNode, type SelectionSetNode } from 'graphql';
import { GraphProvider, useGraph } from './GraphContext';
import { EXAMPLE_PENDING_TAG, buildStarterWorkspace } from '../lib/starterWorkspace';
import type { GraphContextType } from '../types/graph';

const user = { id: 'me', role: 'USER', name: 'New user' };
const team = { id: 'team-1', name: 'Team' };
vi.mock('./AuthContext', () => ({ useAuth: () => ({ currentUser: user, currentTeam: team }) }));
vi.mock('../lib/offline/engine', () => ({ offlineEnabled: false, localGuest: () => false }));

type Row = Record<string, unknown>;
const get = (value: unknown, path: string): unknown => path.split('.').reduce<unknown>((at, key) => (at as Row | undefined)?.[key], value);

/**
 * The self-hosted backend in memory, answering the operations GraphProvider
 * sends. The example's Welcome graph write waits until `release()`, so a test
 * can act while the example is still being written.
 */
function fakeBackend() {
  const graphs: Row[] = [];
  const items: Row[] = [];
  const edges: Row[] = [];
  const operations: string[] = [];
  let next = 0;
  let release: () => void = () => undefined;
  let held = false;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const id = (prefix: string) => `${prefix}-${++next}`;
  const graphRow = (input: Row): Row => ({
    __typename: 'Graph', id: id('graph'), description: '', status: 'ACTIVE', parentGraphId: null, teamId: 'team-1', tags: [],
    defaultRole: 'USER', depth: 0, path: [], isShared: false, nodeCount: 0, edgeCount: 0, contributorCount: 1, lastActivity: null,
    settings: null, permissions: null, shareSettings: null, createdAt: `2026-11-10T00:00:${String(next).padStart(2, '0')}Z`, updatedAt: null,
    ...input, parentGraph: undefined,
  });
  const inGraph = (where: unknown) => get(where, 'graph.id') ?? get(where, 'source.graph.id') ?? get(where, 'OR.0.source.graph.id');
  const resolve = async (name: string, args: Row): Promise<unknown> => {
    switch (name) {
      case 'graphs': {
        const where = (args.where || {}) as Row;
        return graphs.filter(g => Object.entries(where).every(([key, value]) => g[key] === value));
      }
      case 'createGraphs': {
        if ((args.input as Row[]).some(input => input.name === 'Welcome') && !held) {
          held = true;
          await gate;
        }
        const created = (args.input as Row[]).map(input => graphRow(input));
        graphs.push(...created);
        return { __typename: 'CreateGraphsMutationResponse', graphs: created };
      }
      case 'updateGraphs': {
        const graph = graphs.find(g => g.id === get(args, 'where.id'))!;
        Object.assign(graph, args.update as Row);
        return { __typename: 'UpdateGraphsMutationResponse', graphs: [graph] };
      }
      case 'deleteGraphs':
        graphs.splice(graphs.findIndex(g => g.id === get(args, 'where.id')), 1);
        return { __typename: 'DeleteInfo', nodesDeleted: 1 };
      case 'workItems':
        return items.filter(item => get(item, 'graph.id') === inGraph(args.where));
      case 'edges':
        return edges.filter(edge => get(edge, 'source.graph.id') === inGraph(args.where));
      case 'createWorkItems': {
        const inputs = args.input as Row[];
        const graph = graphs.find(g => g.id === get(inputs[0], 'graph.connect.where.node.id'))!;
        const created = inputs.map(({ owner: _owner, graph: _graph, ...input }) => ({ __typename: 'WorkItem', id: id('item'), ...input, graph }));
        items.push(...created);
        return { __typename: 'CreateWorkItemsMutationResponse', workItems: created };
      }
      case 'createEdges': {
        const created = (args.input as Row[]).map(input => ({
          __typename: 'Edge', id: id('edge'), type: input.type,
          source: items.find(item => item.id === get(input, 'source.connect.where.node.id')),
          target: items.find(item => item.id === get(input, 'target.connect.where.node.id')),
        }));
        edges.push(...created);
        return { __typename: 'CreateEdgesMutationResponse', edges: created };
      }
      default:
        throw new Error(`The fake backend does not answer ${name}`);
    }
  };
  const project = (value: unknown, selection: SelectionSetNode | undefined): unknown => {
    if (value == null) return null;
    if (Array.isArray(value)) return value.map(entry => project(entry, selection));
    if (!selection) return value;
    const out: Row = {};
    for (const field of selection.selections as FieldNode[]) {
      const key = field.alias?.value || field.name.value;
      out[key] = field.name.value === '__typename' ? (value as Row).__typename : project((value as Row)[field.name.value], field.selectionSet);
    }
    return out;
  };
  const link = new ApolloLink(operation => new Observable(observer => {
    operations.push(operation.operationName);
    const definition = getMainDefinition(operation.query) as { selectionSet: SelectionSetNode };
    (async () => {
      const data: Row = {};
      for (const field of definition.selectionSet.selections as FieldNode[]) {
        const args = Object.fromEntries((field.arguments || []).map(arg => [arg.name.value, valueFromASTUntyped(arg.value, operation.variables)]));
        data[field.alias?.value || field.name.value] = project(await resolve(field.name.value, args), field.selectionSet);
      }
      observer.next({ data });
      observer.complete();
    })().catch(error => observer.error(error));
  }));
  return { graphs, items, edges, operations, link, release, isHeld: () => held };
}

let graph: GraphContextType;
function Probe() {
  graph = useGraph();
  return null;
}

async function start(backend: ReturnType<typeof fakeBackend>) {
  const client = new ApolloClient({ link: backend.link, cache: new InMemoryCache() });
  render(<ApolloProvider client={client}><GraphProvider><Probe /></GraphProvider></ApolloProvider>);
}

const plan = buildStarterWorkspace({ hierarchy: true });
const exampleDone = (backend: ReturnType<typeof fakeBackend>) => {
  const names = [...plan.projects, ...plan.graphs].map(g => g.name);
  return names.every(name => backend.graphs.some(g => g.name === name))
    && !backend.graphs.some(g => (g.tags as string[] | undefined)?.includes(EXAMPLE_PENDING_TAG))
    && localStorage.getItem('graphdone:starter-pending:me') === null;
};
const named = (backend: ReturnType<typeof fakeBackend>, name: string) => backend.graphs.find(g => g.name === name)!;

beforeEach(() => localStorage.clear());
afterEach(() => cleanup());

describe('a new user while the example project is still being written', () => {
  it('keeps a graph they create meanwhile open, instead of switching to Welcome', async () => {
    const backend = fakeBackend();
    await start(backend);
    await waitFor(() => expect(backend.isHeld()).toBe(true), { timeout: 5000 });

    let mine: { id: string } | undefined;
    await act(async () => {
      mine = await graph.createGraph({ name: 'My plan', type: 'PROJECT', teamId: 'team-1', createdBy: 'me' });
    });
    backend.release();
    await waitFor(() => expect(exampleDone(backend)).toBe(true), { timeout: 10000 });

    expect(graph.currentGraph?.name).toBe('My plan');
    expect(localStorage.getItem('currentGraphId')).toBe(mine!.id);
  });

  it('keeps a graph picked in another tab meanwhile, instead of switching to Welcome', async () => {
    const backend = fakeBackend();
    await start(backend);
    await waitFor(() => expect(backend.isHeld()).toBe(true), { timeout: 5000 });

    const smoke = { __typename: 'Graph', id: 'smoke', name: 'Smoke', type: 'PROJECT', createdBy: 'me', isShared: true, parentGraphId: null, tags: [], path: [], depth: 0 };
    backend.graphs.push(smoke);
    localStorage.setItem('currentGraphId', 'smoke');
    backend.release();
    await waitFor(() => expect(exampleDone(backend)).toBe(true), { timeout: 10000 });

    expect(localStorage.getItem('currentGraphId')).toBe('smoke');
    await waitFor(() => expect(graph.currentGraph?.name).toBe('Smoke'));
  });

  it('opens Welcome when they picked nothing', async () => {
    const backend = fakeBackend();
    await start(backend);
    await waitFor(() => expect(backend.isHeld()).toBe(true), { timeout: 5000 });
    backend.release();
    await waitFor(() => expect(exampleDone(backend)).toBe(true), { timeout: 10000 });

    expect(graph.currentGraph?.name).toBe('Welcome');
    expect(localStorage.getItem('currentGraphId')).toBe(named(backend, 'Welcome').id);
  });

  it('reads what it wrote with its own small queries, never the views\' item and connection queries', async () => {
    const backend = fakeBackend();
    localStorage.setItem('graphdone:starter-pending:me', JSON.stringify({ hierarchy: true, startedAt: Date.now(), inflight: [] }));
    backend.graphs.push({ __typename: 'Graph', id: 'gs', name: 'Getting started', type: 'PROJECT', createdBy: 'me', parentGraphId: null, tags: ['example', EXAMPLE_PENDING_TAG], path: [], depth: 0 });
    await start(backend);
    await waitFor(() => expect(backend.isHeld()).toBe(true), { timeout: 5000 });
    backend.release();
    await waitFor(() => expect(exampleDone(backend)).toBe(true), { timeout: 10000 });

    expect(backend.operations).toContain('StarterContent');
    expect(backend.operations).not.toContain('GetWorkItems');
    expect(backend.operations).not.toContain('GetEdges');
    expect(backend.graphs.filter(g => g.name === 'Getting started'), 'the resume kept the existing project').toHaveLength(1);
  });
});
