// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { GraphSelector } from './GraphSelector';
import { onGraphRequests, requestGraph } from '../lib/graphRequests';

const graph = (id: string, name: string, extra: Record<string, unknown> = {}) => ({
  id, name, type: 'SUBGRAPH', createdBy: 'me', parentGraphId: null, depth: 0, path: [id], nodeCount: 1, edgeCount: 0, isShared: false, ...extra,
});
const project = graph('gs', 'Getting started', { type: 'PROJECT', nodeCount: 0 });
const welcome = graph('w', 'Welcome', { parentGraphId: 'gs', depth: 1, path: ['gs', 'w'], nodeCount: 4 });
const ideas = graph('i', 'Ideas', { parentGraphId: 'gs', depth: 1, path: ['gs', 'i'], nodeCount: 5 });
const sharedWelcome = graph('sw', 'Welcome', { createdBy: 'someone else', isShared: true });
const available = [project, welcome, ideas, sharedWelcome];

const row = ({ id, name, type, nodeCount, edgeCount, isShared }: ReturnType<typeof graph>, children: unknown[] = []) =>
  ({ id, name, type, nodeCount, edgeCount, isShared, permissions: 'VIEW', children });

vi.mock('../contexts/GraphContext', () => ({
  useGraph: () => ({
    currentGraph: welcome,
    availableGraphs: available,
    graphHierarchy: [row(project, [row(welcome), row(ideas)]), row(sharedWelcome)],
    selectGraph: vi.fn(),
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

describe('the phone top bar graph selector', () => {
  it('asks the workspace to create, rename and delete a graph, by name', () => {
    const answer = { create: vi.fn(), edit: vi.fn(), delete: vi.fn() };
    const stop = onGraphRequests(answer);
    render(
      <GraphSelector
        testId="graph-selector-mobile"
        onCreateGraph={() => requestGraph('create')}
        onEditGraph={graph => requestGraph('edit', graph)}
        onDeleteGraph={graph => requestGraph('delete', graph)}
      />
    );
    const list = () => {
      fireEvent.click(screen.getByTestId('graph-selector-mobile'));
      return within(screen.getByTestId('graph-selector-dropdown'));
    };
    fireEvent.click(list().getByRole('button', { name: 'Edit Ideas' }));
    fireEvent.click(list().getByRole('button', { name: 'Delete Ideas' }));
    fireEvent.click(list().getByTitle('Create New Graph'));
    stop();

    expect(answer.edit).toHaveBeenCalledWith(expect.objectContaining({ id: 'i', name: 'Ideas' }));
    expect(answer.delete).toHaveBeenCalledWith(expect.objectContaining({ id: 'i', name: 'Ideas' }));
    expect(answer.create).toHaveBeenCalledTimes(1);
  });
});
