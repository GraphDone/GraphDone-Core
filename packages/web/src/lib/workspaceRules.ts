/**
 * Decisions about a user's graphs and projects, kept as pure functions so they
 * are tested without React or a backend (#277).
 */

export interface GraphRef {
  id: string;
  name: string;
  parentGraphId?: string | null;
}

export const projectDeleteMessage = (name: string, graphs: number) =>
  `${name} holds ${graphs} graph${graphs === 1 ? '' : 's'}. Delete or move them first.`;

/** Why a project cannot be deleted yet, or null when nothing sits inside it. */
export function projectDeleteBlock(graph: GraphRef, graphs: Array<Partial<GraphRef>>): string | null {
  const inside = graphs.filter(other => other.parentGraphId === graph.id).length;
  return inside ? projectDeleteMessage(graph.name, inside) : null;
}
