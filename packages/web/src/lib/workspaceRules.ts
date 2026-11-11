/**
 * Decisions about a user's graphs and projects, kept as pure functions so they
 * are tested without React or a backend (#277).
 */
import { buildStarterWorkspace } from './starterWorkspace';

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

/**
 * Whether the starter has projects with graphs inside them. Signed-in hosted
 * accounts sync to /api/sync, which keeps no parent yet, so they get the
 * single Welcome graph; guests (never synced) and self-hosted get the hierarchy.
 */
export const starterHierarchy = ({ offline, guest }: { offline: boolean; guest: boolean }) => !offline || guest;

/** How many distinct graphs the user can see, own, shared or system. */
export function seenGraphCount(lists: { userGraphs?: GraphRef[]; sharedGraphs?: GraphRef[]; systemGraphs?: GraphRef[] } | null | undefined): number {
  return new Set([...(lists?.userGraphs || []), ...(lists?.sharedGraphs || []), ...(lists?.systemGraphs || [])].map(graph => graph.id)).size;
}

export type StarterStep = 'none' | 'create' | 'finish';

/**
 * A user who can see no graphs gets the starter, an interrupted starter is
 * finished, and anyone else gets nothing: existing workspaces never change.
 */
export function starterStep({ graphsSeen, pending }: { graphsSeen: number; pending: boolean }): StarterStep {
  if (pending) return 'finish';
  return graphsSeen === 0 ? 'create' : 'none';
}

/** The browser-local workspace holds `limit` graphs; null when the example fits. */
export function exampleLimitMessage({ offline, existing, adds, limit }: { offline: boolean; existing: number; adds: number; limit: number }): string | null {
  if (!offline || existing + adds <= limit) return null;
  return `This browser workspace holds up to ${limit} projects and graphs, and the example project adds ${adds}. Delete ${existing + adds - limit} first.`;
}

export interface OwnGraph {
  id: string;
  name: string;
  type: string;
  parentGraphId?: string | null;
  nodeCount?: number | null;
}

const STARTER = buildStarterWorkspace({ hierarchy: true });

/**
 * What is still missing from the user's starter workspace, by name. Once a
 * "Getting started" project exists the full example is being built (projects,
 * then graphs, then items, then each graph's counts last), so every starter
 * project and graph must exist inside the right project with its item count.
 * Without one, only a flat Welcome graph (signed-in hosted, or an account from
 * before #277) is checked.
 */
export function missingStarterGraphs(own: OwnGraph[]): string[] {
  const projectIds = (name: string) =>
    new Set(own.filter(g => g.name === name && g.type === 'PROJECT' && !g.parentGraphId).map(g => g.id));
  const names = new Map(STARTER.projects.map(p => [p.key, p.name]));
  if (!projectIds(STARTER.projects[0].name).size) {
    return own.filter(g => g.name === 'Welcome' && !(g.nodeCount ?? 0)).map(() => 'Welcome items');
  }
  return [
    ...STARTER.projects.filter(p => !projectIds(p.name).size).map(p => `project ${p.name}`),
    ...STARTER.graphs
      .filter(graph => {
        const parents = projectIds(names.get(graph.project!)!);
        return !own.some(g => g.name === graph.name && parents.has(g.parentGraphId ?? '') && g.nodeCount === graph.items.length);
      })
      .map(graph => `${graph.name} (${graph.items.length} items)`),
  ];
}
