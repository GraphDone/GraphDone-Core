import { Context } from '../context';
import { EdgeType } from '@graphdone/core';

export const edgeResolvers = {
  Query: {
    edges: async (
      _: any,
      args: {
        sourceId?: string;
        targetId?: string;
        type?: EdgeType;
        limit?: number;
        offset?: number;
      },
      { prisma }: Context
    ) => {
      const where: any = {};
      
      if (args.sourceId) where.sourceId = args.sourceId;
      if (args.targetId) where.targetId = args.targetId;
      if (args.type) where.type = args.type;

      return prisma.edge.findMany({
        where,
        take: args.limit || 50,
        skip: args.offset || 0,
        include: {
          source: true,
          target: true
        }
      });
    },

    edge: async (_: any, { id }: { id: string }, { prisma }: Context) => {
      return prisma.edge.findUnique({
        where: { id },
        include: {
          source: true,
          target: true
        }
      });
    }
  },

  Mutation: {
    createEdge: async (
      _: any,
      { input }: { input: any },
      { prisma }: Context
    ) => {
      const edge = await prisma.edge.create({
        data: {
          sourceId: input.sourceId,
          targetId: input.targetId,
          type: input.type,
          weight: input.weight || 1.0,
          metadata: input.metadata
        },
        include: {
          source: true,
          target: true
        }
      });

      if (input.type === 'DEPENDENCY') {
        await prisma.nodeDependency.create({
          data: {
            nodeId: input.sourceId,
            dependencyId: input.targetId
          }
        });
      }

      return edge;
    },

    updateEdge: async (
      _: any,
      { id, input }: { id: string; input: any },
      { prisma }: Context
    ) => {
      return prisma.edge.update({
        where: { id },
        data: {
          weight: input.weight,
          metadata: input.metadata
        },
        include: {
          source: true,
          target: true
        }
      });
    },

    deleteEdge: async (_: any, { id }: { id: string }, { prisma }: Context) => {
      const edge = await prisma.edge.findUnique({ where: { id } });
      if (!edge) return false;

      if (edge.type === 'DEPENDENCY') {
        await prisma.nodeDependency.deleteMany({
          where: {
            nodeId: edge.sourceId,
            dependencyId: edge.targetId
          }
        });
      }

      await prisma.edge.delete({ where: { id } });
      return true;
    }
  },

  Subscription: {
    edgeUpdated: {
      subscribe: () => {
        // Implement subscription logic
      }
    },
    edgeCreated: {
      subscribe: () => {
        // Implement subscription logic
      }
    },
    edgeDeleted: {
      subscribe: () => {
        // Implement subscription logic
      }
    }
  },

  Edge: {
    source: (edge: any) => edge.source,
    target: (edge: any) => edge.target
  }
};