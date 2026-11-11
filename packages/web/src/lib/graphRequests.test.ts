import { describe, expect, it, vi } from 'vitest';
import { GRAPH_REQUESTS, onGraphRequests, requestGraph } from './graphRequests';
import type { Graph } from '../types/graph';

const graph = { id: 'g1', name: 'Plan a launch' } as Graph;
const handlers = () => ({ create: vi.fn(), edit: vi.fn(), delete: vi.fn() });

describe('graph requests from outside the workspace page', () => {
  it('reach the workspace: create, and edit or delete with the graph that was picked', () => {
    const answer = handlers();
    const stop = onGraphRequests(answer);
    requestGraph('create');
    requestGraph('edit', graph);
    requestGraph('delete', graph);
    stop();

    expect(answer.create).toHaveBeenCalledTimes(1);
    expect(answer.edit).toHaveBeenCalledWith(graph);
    expect(answer.delete).toHaveBeenCalledWith(graph);
  });

  it('stop reaching it once the workspace has gone', () => {
    const answer = handlers();
    onGraphRequests(answer)();
    requestGraph('create');
    requestGraph('delete', graph);

    expect(answer.create).not.toHaveBeenCalled();
    expect(answer.delete).not.toHaveBeenCalled();
  });

  it('ignore an edit or delete that names no graph', () => {
    const answer = handlers();
    const stop = onGraphRequests(answer);
    window.dispatchEvent(new CustomEvent(GRAPH_REQUESTS.edit));
    window.dispatchEvent(new CustomEvent(GRAPH_REQUESTS.delete, { detail: {} }));
    stop();

    expect(answer.edit).not.toHaveBeenCalled();
    expect(answer.delete).not.toHaveBeenCalled();
  });
});
