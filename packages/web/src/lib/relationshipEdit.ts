import type { RelationshipType, WorkItemEdge } from '../types/graph';

/** A relationship as saved: what the editor shows and what a flip copies. */
export interface SavedRelationship {
  id: string;
  type: string;
  weight: number;
  sourceId: string;
  targetId: string;
  metadata?: string | null;
}

/** An edge end as the canvas holds it: an id, or (once the force layout binds it) the item itself. */
export function endpointId(end: unknown): string | undefined {
  if (typeof end === 'string') return end || undefined;
  const id = end && typeof end === 'object' ? (end as { id?: unknown }).id : undefined;
  return typeof id === 'string' && id ? id : undefined;
}

/** A relationship from a GraphQL `Edge` (server or offline link), or null when it is missing or incomplete. */
export function savedRelationship(edge: unknown): SavedRelationship | null {
  if (!edge || typeof edge !== 'object') return null;
  const e = edge as { id?: unknown; type?: unknown; weight?: unknown; metadata?: unknown; source?: unknown; target?: unknown };
  const sourceId = endpointId(e.source), targetId = endpointId(e.target);
  if (typeof e.id !== 'string' || !e.id || typeof e.type !== 'string' || !e.type || !sourceId || !targetId) return null;
  return {
    id: e.id,
    type: e.type,
    weight: typeof e.weight === 'number' && Number.isFinite(e.weight) ? e.weight : 1,
    sourceId,
    targetId,
    metadata: typeof e.metadata === 'string' ? e.metadata : null,
  };
}

/** The create input for the same relationship pointing the other way: same type, weight and metadata. */
export function reversedEdgeInput(edge: SavedRelationship) {
  return {
    type: edge.type,
    weight: edge.weight,
    ...(edge.metadata != null ? { metadata: edge.metadata } : {}),
    source: { connect: { where: { node: { id: edge.targetId } } } },
    target: { connect: { where: { node: { id: edge.sourceId } } } },
  };
}

export type FlipOutcome =
  | { ok: true; edge: SavedRelationship }
  | { ok: false; message: string; bothDirections?: SavedRelationship };

export interface FlipOperations {
  /** Save a new relationship; resolves to it as saved, or null when nothing was saved. */
  create(input: ReturnType<typeof reversedEdgeInput>): Promise<SavedRelationship | null>;
  /** Delete one relationship by id. */
  remove(id: string): Promise<void>;
}

const sentence = (error: unknown) => {
  const text = (error instanceof Error ? error.message : String(error ?? '')).trim();
  if (!text) return 'The change could not be saved.';
  return /[.!?]$/.test(text) ? text : `${text}.`;
};

const UNCHANGED = 'The relationship was not changed.';

/**
 * Flip a relationship without ever losing it. The reversed relationship is
 * saved first and the original removed only once it exists. If removing the
 * original fails, the reversed copy is removed again so the relationship stays
 * as it was; only when that cleanup also fails are both directions left, and
 * the message says so.
 */
export async function flipRelationship(edge: SavedRelationship, ops: FlipOperations): Promise<FlipOutcome> {
  if (edge.sourceId === edge.targetId) {
    return { ok: false, message: `This relationship joins an item to itself, so it has no direction to flip. ${UNCHANGED}` };
  }
  let reversed: SavedRelationship | null;
  try {
    reversed = await ops.create(reversedEdgeInput(edge));
  } catch (error) {
    return { ok: false, message: `${sentence(error)} ${UNCHANGED}` };
  }
  const faithful = !!reversed && reversed.id !== edge.id && reversed.sourceId === edge.targetId
    && reversed.targetId === edge.sourceId && reversed.type === edge.type;
  if (!reversed || !faithful) {
    if (reversed && reversed.id !== edge.id) {
      try {
        await ops.remove(reversed.id);
      } catch {
        return { ok: false, message: 'The reversed relationship was saved incorrectly and could not be removed; check this pair\'s relationships.', bothDirections: reversed };
      }
    }
    return { ok: false, message: `The reversed relationship was not saved. ${UNCHANGED}` };
  }
  try {
    await ops.remove(edge.id);
  } catch (error) {
    try {
      await ops.remove(reversed.id);
    } catch {
      return { ok: false, message: `${sentence(error)} Both directions are now saved; delete the one you do not want.`, bothDirections: reversed };
    }
    return { ok: false, message: `${sentence(error)} ${UNCHANGED}` };
  }
  return { ok: true, edge: reversed };
}

/** The canvas's edge for a saved relationship (ends as ids; strength as the canvas derives it). */
export function editorEdge(edge: SavedRelationship): WorkItemEdge {
  return { id: edge.id, source: edge.sourceId, target: edge.targetId, type: edge.type as RelationshipType, strength: edge.weight || 0.8 };
}

/** "Source → Target" by the items' titles. */
export function relationshipLine(edge: Pick<WorkItemEdge, 'source' | 'target'>, items: { id: string; title?: string }[]): string {
  const title = (end: unknown) => {
    const id = endpointId(end);
    return items.find(item => item.id === id)?.title || 'Unknown';
  };
  return `${title(edge.source)} → ${title(edge.target)}`;
}
