import type { Graph } from '../types/graph';

/**
 * Creating, renaming and deleting a graph, asked for from outside the
 * workspace page and answered by Workspace, which owns those dialogs. The
 * phone's top bar (Layout) has its own graph selector; like its "New work
 * item" button ('graphdone-create-task'), it sends a window event.
 */
export const GRAPH_REQUESTS = {
  create: 'graphdone-create-graph',
  edit: 'graphdone-edit-graph',
  delete: 'graphdone-delete-graph',
} as const;

/** Asks the workspace to create a graph, or to edit or delete `graph` (an edit or delete without one is ignored). */
export function requestGraph(kind: keyof typeof GRAPH_REQUESTS, graph?: Graph): void {
  window.dispatchEvent(new CustomEvent(GRAPH_REQUESTS[kind], { detail: { graph } }));
}

export interface GraphRequestHandlers {
  create(): void;
  edit(graph: Graph): void;
  delete(graph: Graph): void;
}

/** Answers graph requests until the returned function is called. An edit or delete without a graph is ignored. */
export function onGraphRequests(handlers: GraphRequestHandlers): () => void {
  const stops = (Object.keys(GRAPH_REQUESTS) as Array<keyof typeof GRAPH_REQUESTS>).map(kind => {
    const listener = (event: Event) => {
      const graph = (event as CustomEvent<{ graph?: Graph }>).detail?.graph;
      if (kind === 'create') handlers.create();
      else if (graph) handlers[kind](graph);
    };
    window.addEventListener(GRAPH_REQUESTS[kind], listener);
    return () => window.removeEventListener(GRAPH_REQUESTS[kind], listener);
  });
  return () => stops.forEach(stop => stop());
}
