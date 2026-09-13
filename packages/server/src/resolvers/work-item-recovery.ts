import { GraphQLError } from 'graphql';
import type { Driver } from 'neo4j-driver';
import { createHash } from 'node:crypto';

const uuid = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value);

export const workItemRecoveryResolvers = {
  Mutation: {
    restoreWorkItem: async (
      _parent: unknown,
      { input }: { input: Record<string, any> },
      context: { driver: Driver | null; user?: { userId: string; role: string } | null },
    ) => {
      if (!context.driver || !context.user) {
        throw new GraphQLError('Authentication required', { extensions: { code: 'UNAUTHENTICATED' } });
      }
      if (context.user.role === 'VIEWER') {
        throw new GraphQLError('This account is read-only', { extensions: { code: 'FORBIDDEN' } });
      }
      const userId = context.user.userId;
      if (!uuid(input.id) || typeof input.graphId !== 'string' || !input.graphId || input.graphId.length > 128) {
        throw new GraphQLError('Invalid task recovery identity', { extensions: { code: 'BAD_USER_INPUT' } });
      }
      if (typeof input.title !== 'string' || !input.title.trim() || input.title.length > 200 ||
          (input.description != null && (typeof input.description !== 'string' || input.description.length > 4000)) ||
          (input.priority != null && (typeof input.priority !== 'number' || !Number.isFinite(input.priority) || input.priority < 0 || input.priority > 1)) ||
          (input.tags != null && (!Array.isArray(input.tags) || input.tags.length > 50 || input.tags.some((tag: unknown) => typeof tag !== 'string' || tag.length > 100))) ||
          (input.metadata != null && (typeof input.metadata !== 'string' || input.metadata.length > 10000))) {
        throw new GraphQLError('Invalid task recovery data', { extensions: { code: 'BAD_USER_INPUT' } });
      }

      const params = {
        id: input.id,
        graphId: input.graphId,
        userId,
        title: input.title.trim(),
        description: input.description ?? null,
        type: input.type,
        status: input.status,
        priority: input.priority ?? 0,
        dueDate: input.dueDate ?? null,
        tags: input.tags ?? [],
        metadata: input.metadata ?? '{}',
        positionX: input.positionX ?? 0,
        positionY: input.positionY ?? 0,
        positionZ: input.positionZ ?? 0,
        radius: input.radius ?? 1,
        theta: input.theta ?? 0,
        phi: input.phi ?? 0,
        priorityComp: input.priorityComp ?? input.priority ?? 0,
        createdAt: input.createdAt ?? null,
      };
      const recoveryDigest = createHash('sha256').update(JSON.stringify(params)).digest('hex');
      const session = context.driver.session();
      try {
        const outcome = await session.executeWrite(async tx => {
          const locked = await tx.run(`
            MATCH (g:Graph {id: $graphId, createdBy: $userId})
            SET g.restoreVersion = coalesce(g.restoreVersion, 0) + 1
            RETURN g.id
          `, params);
          if (!locked.records.length) return { kind: 'conflict' as const };
          const found = await tx.run(`
            MATCH (w:WorkItem {id: $id})
            OPTIONAL MATCH (w)-[:BELONGS_TO]->(g:Graph)
            RETURN w, g.id AS graphId
          `, params);
          if (found.records.length) {
            const record = found.records[0];
            const restored = record.get('w')?.properties;
            return found.records.length === 1 && record.get('graphId') === params.graphId && restored?.recoveryDigest === recoveryDigest
              ? { kind: 'existing' as const, restored }
              : { kind: 'conflict' as const };
          }
          const created = await tx.run(`
            MATCH (g:Graph {id: $graphId, createdBy: $userId})
            CREATE (w:WorkItem {
              id: $id, title: $title, description: $description, type: $type,
              status: $status, priority: $priority, dueDate: $dueDate,
              tags: $tags, metadata: $metadata, positionX: $positionX,
              positionY: $positionY, positionZ: $positionZ, radius: $radius,
              theta: $theta, phi: $phi, priorityComp: $priorityComp,
              recoveryDigest: $recoveryDigest,
              createdAt: CASE WHEN $createdAt IS NULL THEN datetime() ELSE datetime($createdAt) END,
              updatedAt: datetime()
            })-[:BELONGS_TO]->(g)
            WITH w
            OPTIONAL MATCH (u:User {id: $userId})
            FOREACH (_ IN CASE WHEN u IS NULL THEN [] ELSE [1] END | CREATE (u)-[:OWNS]->(w))
            RETURN w
          `, { ...params, recoveryDigest });
          return { kind: 'created' as const, restored: created.records[0]?.get('w')?.properties };
        });
        if (outcome.kind === 'conflict' || !outcome.restored) {
          throw new GraphQLError('The task could not be restored because its identity is unavailable.', { extensions: { code: 'CONFLICT' } });
        }
        return outcome.restored;
      } finally {
        await session.close();
      }
    },
  },
};
