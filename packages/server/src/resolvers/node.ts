import { Context } from '../context';
import { NodeType, NodeStatus, PriorityCalculator } from '@graphdone/core';

export const nodeResolvers = {
  Query: {
    nodes: async (
      _: any,
      args: {
        type?: NodeType;
        status?: NodeStatus;
        contributorId?: string;
        priorityThreshold?: number;
        limit?: number;
        offset?: number;
      },
      { prisma }: Context
    ) => {
      const where: any = {};
      
      if (args.type) where.type = args.type;
      if (args.status) where.status = args.status;
      if (args.priorityThreshold) {
        where.priorityComp = { gte: args.priorityThreshold };
      }
      if (args.contributorId) {
        where.contributors = {
          some: { contributorId: args.contributorId }
        };
      }

      return prisma.node.findMany({
        where,
        take: args.limit || 50,
        skip: args.offset || 0,
        orderBy: { priorityComp: 'desc' },
        include: {
          contributors: {
            include: { contributor: true }
          },
          dependencies: {
            include: { dependency: true }
          },
          dependents: {
            include: { node: true }
          },
          sourceEdges: {
            include: { target: true }
          },
          targetEdges: {
            include: { source: true }
          }
        }
      });
    },

    node: async (_: any, { id }: { id: string }, { prisma }: Context) => {
      return prisma.node.findUnique({
        where: { id },
        include: {
          contributors: {
            include: { contributor: true }
          },
          dependencies: {
            include: { dependency: true }
          },
          dependents: {
            include: { node: true }
          },
          sourceEdges: {
            include: { target: true }
          },
          targetEdges: {
            include: { source: true }
          }
        }
      });
    },

    findPath: async (
      _: any,
      { startId, endId }: { startId: string; endId: string },
      { graph }: Context
    ) => {
      return graph.findPath(startId, endId);
    },

    detectCycles: async (_: any, __: any, { graph }: Context) => {
      return graph.detectCycles();
    },

    graphStats: async (_: any, __: any, { prisma, graph }: Context) => {
      const nodeCount = await prisma.node.count();
      const edgeCount = await prisma.edge.count();
      
      const avgPriorityResult = await prisma.node.aggregate({
        _avg: { priorityComp: true }
      });
      
      const cycles = graph.detectCycles();
      
      return {
        nodeCount,
        edgeCount,
        avgPriority: avgPriorityResult._avg.priorityComp || 0,
        cycleCount: cycles.length
      };
    }
  },

  Mutation: {
    createNode: async (
      _: any,
      { input }: { input: any },
      { prisma }: Context
    ) => {
      const priorityCalc = new PriorityCalculator();
      const priority = priorityCalc.calculate({
        executive: input.priority?.executive || 0,
        individual: input.priority?.individual || 0,
        community: input.priority?.community || 0
      });

      const radius = priorityCalc.calculateRadiusFromPriority(priority.computed);
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      return prisma.node.create({
        data: {
          type: input.type,
          title: input.title,
          description: input.description,
          status: input.status || 'PROPOSED',
          radius,
          theta,
          phi,
          priorityExec: priority.executive,
          priorityIndiv: priority.individual,
          priorityComm: priority.community,
          priorityComp: priority.computed,
          metadata: input.metadata
        },
        include: {
          contributors: {
            include: { contributor: true }
          },
          dependencies: {
            include: { dependency: true }
          },
          dependents: {
            include: { node: true }
          },
          sourceEdges: true,
          targetEdges: true
        }
      });
    },

    updateNode: async (
      _: any,
      { id, input }: { id: string; input: any },
      { prisma }: Context
    ) => {
      return prisma.node.update({
        where: { id },
        data: {
          title: input.title,
          description: input.description,
          status: input.status,
          metadata: input.metadata,
          updatedAt: new Date()
        },
        include: {
          contributors: {
            include: { contributor: true }
          },
          dependencies: {
            include: { dependency: true }
          },
          dependents: {
            include: { node: true }
          },
          sourceEdges: true,
          targetEdges: true
        }
      });
    },

    deleteNode: async (_: any, { id }: { id: string }, { prisma }: Context) => {
      await prisma.node.delete({ where: { id } });
      return true;
    },

    updateNodePriority: async (
      _: any,
      { id, priority }: { id: string; priority: any },
      { prisma }: Context
    ) => {
      const node = await prisma.node.findUnique({ where: { id } });
      if (!node) throw new Error('Node not found');

      const priorityCalc = new PriorityCalculator();
      const newPriority = priorityCalc.calculate({
        executive: priority.executive ?? node.priorityExec,
        individual: priority.individual ?? node.priorityIndiv,
        community: priority.community ?? node.priorityComm
      });

      const radius = priorityCalc.calculateRadiusFromPriority(newPriority.computed);

      return prisma.node.update({
        where: { id },
        data: {
          priorityExec: newPriority.executive,
          priorityIndiv: newPriority.individual,
          priorityComm: newPriority.community,
          priorityComp: newPriority.computed,
          radius,
          updatedAt: new Date()
        },
        include: {
          contributors: {
            include: { contributor: true }
          },
          dependencies: {
            include: { dependency: true }
          },
          dependents: {
            include: { node: true }
          },
          sourceEdges: true,
          targetEdges: true
        }
      });
    },

    boostNodePriority: async (
      _: any,
      { id, boost }: { id: string; boost: number },
      { prisma }: Context
    ) => {
      const node = await prisma.node.findUnique({ where: { id } });
      if (!node) throw new Error('Node not found');

      const priorityCalc = new PriorityCalculator();
      const currentPriority = {
        executive: node.priorityExec,
        individual: node.priorityIndiv,
        community: node.priorityComm,
        computed: node.priorityComp
      };

      const boostedPriority = priorityCalc.migratePriority(currentPriority, boost, 1);
      const radius = priorityCalc.calculateRadiusFromPriority(boostedPriority.computed);

      return prisma.node.update({
        where: { id },
        data: {
          priorityComm: boostedPriority.community,
          priorityComp: boostedPriority.computed,
          radius,
          updatedAt: new Date()
        },
        include: {
          contributors: {
            include: { contributor: true }
          },
          dependencies: {
            include: { dependency: true }
          },
          dependents: {
            include: { node: true }
          },
          sourceEdges: true,
          targetEdges: true
        }
      });
    }
  },

  Subscription: {
    nodeUpdated: {
      subscribe: () => {
        // Implement subscription logic
      }
    },
    nodeCreated: {
      subscribe: () => {
        // Implement subscription logic
      }
    },
    nodeDeleted: {
      subscribe: () => {
        // Implement subscription logic
      }
    },
    priorityChanged: {
      subscribe: () => {
        // Implement subscription logic
      }
    }
  },

  Node: {
    position: (node: any) => ({
      radius: node.radius,
      theta: node.theta,
      phi: node.phi
    }),

    priority: (node: any) => ({
      executive: node.priorityExec,
      individual: node.priorityIndiv,
      community: node.priorityComm,
      computed: node.priorityComp
    }),

    dependencies: (node: any) => 
      node.dependencies?.map((dep: any) => dep.dependency) || [],

    dependents: (node: any) => 
      node.dependents?.map((dep: any) => dep.node) || [],

    edges: (node: any) => [
      ...(node.sourceEdges || []),
      ...(node.targetEdges || [])
    ]
  }
};