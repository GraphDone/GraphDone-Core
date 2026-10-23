import { GraphQLError } from 'graphql';
import type { Driver } from 'neo4j-driver';
import { sqliteAuthStore } from './sqlite-auth.js';

interface FolderContext {
  user?: { userId: string; role: string } | null;
  driver?: Driver | null;
}

interface FolderActor {
  userId: string;
  role: string;
  teamId?: string;
}

interface Folder {
  id: string;
  type: string;
  ownerId?: string | null;
  parentId?: string | null;
}

const deny = () => new GraphQLError('Folder access denied', { extensions: { code: 'FORBIDDEN' } });

export async function folderActor(context: FolderContext, write = false): Promise<FolderActor> {
  const claims = context.user;
  if (!claims) throw new GraphQLError('Authentication required', { extensions: { code: 'UNAUTHENTICATED' } });
  const account = await sqliteAuthStore.findUserById(claims.userId);
  let actor: FolderActor;
  if (account?.isActive) {
    actor = { userId: account.id, role: account.role, teamId: account.team?.id };
  } else if (claims.role === 'GUEST' && /^guest-[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(claims.userId)) {
    actor = { userId: claims.userId, role: 'GUEST' };
  } else {
    throw new GraphQLError('Authentication required', { extensions: { code: 'UNAUTHENTICATED' } });
  }
  if (write && !['USER', 'ADMIN'].includes(actor.role)) throw deny();
  return actor;
}

export async function requireFolderAccess(folderId: string, actor: FolderActor, write = false): Promise<Folder> {
  const folder = await sqliteAuthStore.findFolderById(folderId);
  if (!folder) throw deny();
  if (write && !['USER', 'ADMIN'].includes(actor.role)) throw deny();
  const allowed = folder.type === 'system'
    ? !write || actor.role === 'ADMIN'
    : actor.role !== 'GUEST' && (folder.type === 'user'
      ? folder.ownerId === actor.userId
      : folder.type === 'team' && await sqliteAuthStore.isTeamMember(actor.userId, folder.ownerId));
  if (!allowed) throw deny();
  return folder;
}

export async function folderCreationOwner(input: { type: string; ownerId?: string }, actor: FolderActor) {
  const type = input.type.toLowerCase();
  if (type === 'user' && (!input.ownerId || input.ownerId === actor.userId)) return { type, ownerId: actor.userId };
  if (type === 'system' && actor.role === 'ADMIN' && !input.ownerId) return { type, ownerId: null };
  const teamId = input.ownerId || actor.teamId;
  if (type === 'team' && teamId && await sqliteAuthStore.isTeamMember(actor.userId, teamId)) return { type, ownerId: teamId };
  throw deny();
}

export async function requireFolderParent(folder: Omit<Folder, 'id'> & { id?: string }, parentId: string | null | undefined, actor: FolderActor) {
  if (!parentId) return;
  const visited = new Set(folder.id ? [folder.id] : []);
  let ancestorId: string | null | undefined = parentId;
  while (ancestorId) {
    if (visited.has(ancestorId)) throw new GraphQLError('Folder hierarchy cannot contain a cycle', { extensions: { code: 'BAD_USER_INPUT' } });
    visited.add(ancestorId);
    const parent = await requireFolderAccess(ancestorId, actor, true);
    if (parent.type !== folder.type || parent.ownerId !== folder.ownerId) throw deny();
    ancestorId = parent.parentId;
  }
}

export async function requireFolderDeletion(folderId: string, actor: FolderActor, moveGraphsTo?: string) {
  const folder = await requireFolderAccess(folderId, actor, true);
  const descendants = await sqliteAuthStore.getFolderDescendantIds(folderId);
  for (const descendantId of descendants) {
    const descendant = await requireFolderAccess(descendantId, actor, true);
    if (descendant.type !== folder.type || descendant.ownerId !== folder.ownerId) throw deny();
  }
  if (moveGraphsTo && (moveGraphsTo === folderId || descendants.includes(moveGraphsTo))) {
    throw new GraphQLError('Graph destination must be outside the deleted folder hierarchy', { extensions: { code: 'BAD_USER_INPUT' } });
  }
}

async function readableGraphIds(ids: string[], context: FolderContext, actor: FolderActor, required: boolean) {
  const readable = new Set<string>();
  if (!ids.length) return readable;
  if (!context.driver) {
    if (required) throw new GraphQLError('Graph service unavailable', { extensions: { code: 'SERVICE_UNAVAILABLE' } });
    return readable;
  }
  const session = context.driver.session();
  try {
    const result = await session.run(
      'MATCH (g:Graph) WHERE g.id IN $ids RETURN g.id AS id, g.createdBy AS createdBy, g.isShared AS isShared',
      { ids: [...new Set(ids)] },
    );
    for (const record of result.records) {
      if (record.get('createdBy') === actor.userId || record.get('isShared') === true) readable.add(record.get('id'));
    }
    return readable;
  } finally { await session.close(); }
}

export async function requireGraphAccess(ids: string[], context: FolderContext, actor: FolderActor) {
  const readable = await readableGraphIds(ids, context, actor, true);
  if (ids.some(id => !readable.has(id))) throw deny();
}

export async function visibleFolderGraphs(folderId: string, context: FolderContext, actor: FolderActor) {
  const mappings = await sqliteAuthStore.getFolderGraphs(folderId);
  const readable = await readableGraphIds(mappings.map(mapping => mapping.graphId), context, actor, false);
  return mappings.filter(mapping => readable.has(mapping.graphId));
}

export function folderResponse<T extends Folder>(folder: T) {
  return { ...folder, type: folder.type.toUpperCase() };
}
