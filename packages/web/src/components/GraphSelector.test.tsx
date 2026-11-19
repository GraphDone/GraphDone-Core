// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { GraphSelector } from './GraphSelector';

const graph = (id: string, name: string, extra: Record<string, unknown> = {}) => ({
  id, name, type: 'SUBGRAPH', createdBy: 'me', parentGraphId: null, depth: 0, path: [id], nodeCount: 1, edgeCount: 0, isShared: false, ...extra,
});
const project = graph('gs', 'Getting started', { type: 'PROJECT', nodeCount: 0 });
const welcome = graph('w', 'Welcome', { parentGraphId: 'gs', depth: 1, path: ['gs', 'w'], nodeCount: 4 });
const ideas = graph('i', 'Ideas', { parentGraphId: 'gs', depth: 1, path: ['gs', 'i'], nodeCount: 5 });
const release = graph('r', 'Release', { parentGraphId: 'i', depth: 2, path: ['gs', 'i'], nodeCount: 3, edgeCount: 2 });
const sharedWelcome = graph('sw', 'Welcome', { createdBy: 'someone else', isShared: true, edgeCount: 1 });
const available = [project, welcome, ideas, release, sharedWelcome];

const selectGraph = vi.fn();

const row = ({ id, name, type, nodeCount, edgeCount, isShared }: ReturnType<typeof graph>, children: unknown[] = []) =>
  ({ id, name, type, nodeCount, edgeCount, isShared, permissions: 'VIEW', children });

vi.mock('../contexts/GraphContext', () => ({
  useGraph: () => ({
    currentGraph: welcome,
    availableGraphs: available,
    graphHierarchy: [row(project, [row(welcome), row(ideas, [row(release)])]), row(sharedWelcome)],
    selectGraph,
    addExampleProject: vi.fn(),
  }),
}));
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ currentUser: { id: 'me', role: 'USER' }, currentTeam: null }) }));
vi.mock('./ProjectTransfer', () => ({ ProjectTransfer: () => null }));
vi.mock('../lib/offline/engine', () => ({ offlineEnabled: false, localGuest: () => false }));
vi.mock('@apollo/client', async original => ({ ...(await original<typeof import('@apollo/client')>()), useQuery: () => ({ data: undefined }) }));

afterEach(() => cleanup());

function open() {
  const onDeleteGraph = vi.fn();
  const onEditGraph = vi.fn();
  render(<GraphSelector onDeleteGraph={onDeleteGraph} onEditGraph={onEditGraph} />);
  fireEvent.click(screen.getByTestId('graph-selector'));
  const actions = (name: string, index = 0) => {
    const rowElement = within(screen.getByTestId('graph-selector-dropdown')).getAllByText(name, { exact: true })[index].closest('[class*="group/item"]') as HTMLElement;
    const [edit, trash] = within(rowElement).getAllByRole('button').slice(-2);
    return { edit, trash };
  };
  return { onDeleteGraph, onEditGraph, actions };
}

describe('the graph selector edit and delete buttons', () => {
  it('act on the graph whose row was clicked, inside a project too, with the full graph', () => {
    const { onDeleteGraph, onEditGraph, actions } = open();
    fireEvent.click(actions('Ideas').trash);
    expect(onDeleteGraph).toHaveBeenCalledWith(expect.objectContaining({ id: 'i', parentGraphId: 'gs', createdBy: 'me' }));
    fireEvent.click(screen.getByTestId('graph-selector'));
    fireEvent.click(actions('Getting started').edit);
    expect(onEditGraph).toHaveBeenCalledWith(expect.objectContaining({ id: 'gs', type: 'PROJECT' }));
  });

  it("leave the user's own Welcome deletable, so its project can be emptied", () => {
    const { onDeleteGraph, actions } = open();
    const own = actions('Welcome', 0);
    fireEvent.mouseEnter(own.trash);
    expect(screen.queryByText(/System graph/)).toBeNull();
    fireEvent.click(own.trash);
    expect(onDeleteGraph).toHaveBeenCalledWith(expect.objectContaining({ id: 'w', createdBy: 'me' }));
  });

  it("lock another user's Welcome with a readable reason", () => {
    const { onDeleteGraph, actions } = open();
    const shared = actions('Welcome', 1);
    fireEvent.mouseEnter(shared.trash);
    expect(screen.getByText("🔒 System graph — can't be deleted")).toBeTruthy();
    fireEvent.click(shared.trash);
    expect(onDeleteGraph).not.toHaveBeenCalled();
  });
});


it('expands a subgraph and opens its child with its own counts', () => {
  open();
  expect(screen.getByText('Total: 5 Graphs')).toBeTruthy();
  expect(screen.queryByRole('button', { name: /Release 3 items.*2 connections/ })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Expand Ideas' }));
  const release = screen.getByRole('button', { name: /Release 3 items.*2 connections/ });
  fireEvent.click(release);
  expect(selectGraph).toHaveBeenCalledWith('r');
});

it('labels zero, one, and multiple selector counts', () => {
  open();
  const menu = within(screen.getByTestId('graph-selector-dropdown'));
  expect(menu.getByRole('button', { name: 'Welcome 1 item • 1 connection' })).toBeTruthy();
  expect(menu.getByRole('button', { name: /^Ideas 5 items.*0 connections$/ })).toBeTruthy();
  expect(menu.getByTitle('1 sub-graph')).toBeTruthy();
});
