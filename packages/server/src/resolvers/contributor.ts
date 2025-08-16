import { Context } from '../context';
import { ContributorType } from '@graphdone/core';

export const contributorResolvers = {
  Query: {
    contributors: async (
      _: any,
      args: {
        type?: ContributorType;
        limit?: number;
        offset?: number;
      },
      { prisma }: Context
    ) => {
      const where: any = {};
      
      if (args.type) where.type = args.type;

      return prisma.contributor.findMany({
        where,
        take: args.limit || 50,
        skip: args.offset || 0,
        include: {
          nodes: {
            include: { node: true }
          }
        }
      });
    },

    contributor: async (_: any, { id }: { id: string }, { prisma }: Context) => {
      return prisma.contributor.findUnique({
        where: { id },
        include: {
          nodes: {
            include: { node: true }
          }
        }
      });
    }
  },

  Mutation: {
    createContributor: async (
      _: any,
      { input }: { input: any },
      { prisma }: Context
    ) => {
      return prisma.contributor.create({
        data: {
          type: input.type,
          name: input.name,
          email: input.email,
          avatarUrl: input.avatarUrl,
          capabilities: input.capabilities,
          metadata: input.metadata
        },
        include: {
          nodes: {
            include: { node: true }
          }
        }
      });
    },

    updateContributor: async (
      _: any,
      { id, input }: { id: string; input: any },
      { prisma }: Context
    ) => {
      return prisma.contributor.update({
        where: { id },
        data: {
          name: input.name,
          email: input.email,
          avatarUrl: input.avatarUrl,
          capabilities: input.capabilities,
          metadata: input.metadata,
          updatedAt: new Date()
        },
        include: {
          nodes: {
            include: { node: true }
          }
        }
      });
    },

    deleteContributor: async (_: any, { id }: { id: string }, { prisma }: Context) => {
      await prisma.contributor.delete({ where: { id } });
      return true;
    },

    addNodeContributor: async (
      _: any,
      { nodeId, contributorId, role }: { nodeId: string; contributorId: string; role?: string },
      { prisma }: Context
    ) => {
      return prisma.nodeContributor.create({
        data: {
          nodeId,
          contributorId,
          role: role || 'contributor'
        },
        include: {
          node: true,
          contributor: true
        }
      });
    },

    removeNodeContributor: async (
      _: any,
      { nodeId, contributorId }: { nodeId: string; contributorId: string },
      { prisma }: Context
    ) => {
      await prisma.nodeContributor.deleteMany({
        where: {
          nodeId,
          contributorId
        }
      });
      return true;
    }
  },

  Contributor: {
    capabilities: (contributor: any) => contributor.capabilities || [],
    nodes: (contributor: any) => contributor.nodes || []
  },

  NodeContributor: {
    node: (nodeContributor: any) => nodeContributor.node,
    contributor: (nodeContributor: any) => nodeContributor.contributor
  }
};