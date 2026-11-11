/**
 * Decisions about a user's graphs and projects, kept as pure functions so they
 * are tested without React or a backend (#277).
 */
import { buildStarterWorkspace, type StarterWrite } from './starterWorkspace';

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
 * Whether only the system may edit or delete a graph: a system graph or the
 * shared Welcome. A Welcome graph the user made (the example's first graph) is
 * theirs, so a project holding it can still be emptied and deleted.
 */
export function systemLocked(graph: { id: string; name?: string; createdBy?: string | null }, userId: string | null | undefined): boolean {
  if (graph.createdBy === 'system' || graph.id === 'welcome-graph-shared') return true;
  return graph.name?.toLowerCase() === 'welcome' && (!graph.createdBy || graph.createdBy !== userId);
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

/**
 * Kept in this browser while a new user's starter is being written, so the
 * next page load can finish it. It expires, so a marker left behind can never
 * bring back example graphs the user has since deleted.
 */
export interface StarterMarker {
  hierarchy: boolean;
  startedAt: number;
  /** Writes sent without an answer yet: a later load waits for them to land or time out. */
  inflight: StarterWrite[];
}

export const STARTER_MARKER_TTL_MS = 10 * 60_000;

const isWrite = (value: unknown): value is StarterWrite => {
  const write = value as Partial<Record<string, unknown>> | null;
  if (!write || typeof write.id !== 'string' || typeof write.sentAt !== 'number') return false;
  if (write.kind === 'graphs') return Array.isArray(write.graphs);
  return (write.kind === 'items' || write.kind === 'edges') && typeof write.graphId === 'string'
    && Array.isArray(write.kind === 'items' ? write.titles : write.links);
};

/** The stored marker, or null when there is none, it is malformed, or (given `now`) it has expired. */
export function parseStarterMarker(raw: string | null, now?: number): StarterMarker | null {
  let value: unknown;
  try {
    value = JSON.parse(raw || 'null');
  } catch {
    return null;
  }
  const marker = value as Partial<StarterMarker> | null;
  if (!marker || typeof marker.hierarchy !== 'boolean' || typeof marker.startedAt !== 'number') return null;
  if (now !== undefined && (now - marker.startedAt > STARTER_MARKER_TTL_MS || marker.startedAt > now + 60_000)) return null;
  return { hierarchy: marker.hierarchy, startedAt: marker.startedAt, inflight: Array.isArray(marker.inflight) ? marker.inflight.filter(isWrite) : [] };
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

/**
 * The hosted build holds `limit` graphs per browser workspace or account;
 * null when the example fits. Without a hierarchy the example is one Welcome graph.
 */
export function exampleLimitMessage({ offline, hierarchy, existing, adds, limit }: { offline: boolean; hierarchy: boolean; existing: number; adds: number; limit: number }): string | null {
  if (!offline || existing + adds <= limit) return null;
  const over = existing + adds - limit;
  return hierarchy
    ? `This browser workspace holds up to ${limit} projects and graphs, and the example project adds ${adds}. Delete ${over} first.`
    : `This account holds up to ${limit} graphs. Delete ${over} to add a Welcome graph.`;
}

/** How the selector names the action: the example project, or one Welcome graph without a hierarchy. */
export function exampleAction(hierarchy: boolean) {
  return hierarchy
    ? { label: 'Add example project', busy: 'Adding example project…', failed: 'The example project could not be added.', added: (opened: string) => `Added the example project. "${opened}" is open.` }
    : { label: 'Add a Welcome graph', busy: 'Adding a Welcome graph…', failed: 'The Welcome graph could not be added.', added: (opened: string) => `Added a Welcome graph. "${opened}" is open.` };
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
