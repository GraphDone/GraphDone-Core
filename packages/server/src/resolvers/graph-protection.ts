import { GraphQLError } from 'graphql';
import { Driver } from 'neo4j-driver';

const PROTECTED_GRAPHS = ['welcome-graph-shared'];

async function isProtectedGraph(driver: Driver, graphId: string): Promise<boolean> {
  if (PROTECTED_GRAPHS.includes(graphId)) {
    return true;
  }

  const session = driver.session();
  try {
    const result = await session.run(
      `MATCH (g:Graph {id: $graphId}) RETURN g.id IN $protectedIds AS isProtected`,
      { graphId, protectedIds: PROTECTED_GRAPHS }
    );
    return result.records[0]?.get('isProtected') || false;
  } finally {
    await session.close();
  }
}


export const graphProtectionResolvers = {
  Mutation: {
    // Protect graphs from deletion
    deleteGraphs: async (
      _parent: any,
      args: { where?: { id?: string; id_IN?: string[] } },
      context: { driver: Driver | null; user?: { userId: string; role: string } | null }
    ) => {
      if (!context.driver) {
        throw new GraphQLError('Database connection unavailable');
      }
      if (!context.user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' }
        });
      }
      if (!['USER', 'ADMIN'].includes(context.user.role)) {
        throw new GraphQLError('This account is read-only', {
          extensions: { code: 'FORBIDDEN' }
        });
      }

      const graphId = args.where?.id;
      const graphIds = args.where?.id_IN;
      if (Boolean(graphId) === Boolean(graphIds)) {
        throw new GraphQLError('Delete projects by one id or one bounded id list', {
          extensions: { code: 'BAD_USER_INPUT' }
        });
      }
      const idsToCheck = graphId ? [graphId] : (graphIds || []);
      if (!idsToCheck.length || idsToCheck.length > 100 || idsToCheck.some(id => typeof id !== 'string' || !id || id.length > 128)) {
        throw new GraphQLError('Delete projects by one id or a bounded id list', {
          extensions: { code: 'BAD_USER_INPUT' }
        });
      }

      for (const id of idsToCheck) {
        if (await isProtectedGraph(context.driver, id)) {
          throw new GraphQLError('The Welcome graph is read-only and cannot be deleted. This is a system tutorial graph for all users.', {
            extensions: {
              code: 'FORBIDDEN',
              protectedGraph: true,
              graphId: id
            }
          });
        }
      }

      const session = context.driver.session();
      try {
        const result = await session.run(
          `
          MATCH (g:Graph {createdBy: $userId})
          WHERE g.id = $id ${graphIds ? 'OR g.id IN $ids' : ''}
          DETACH DELETE g
          RETURN count(g) AS nodesDeleted
          `,
          { id: graphId, ids: graphIds, userId: context.user.userId }
        );

        return {
          nodesDeleted: result.records[0]?.get('nodesDeleted')?.toNumber() || 0
        };
      } finally {
        await session.close();
      }
    }

  }
};
