import { DateTimeResolver, JSONResolver } from 'graphql-scalars';
import { nodeResolvers } from './node';
import { edgeResolvers } from './edge';
import { contributorResolvers } from './contributor';

export const resolvers = {
  DateTime: DateTimeResolver,
  JSON: JSONResolver,

  Query: {
    ...nodeResolvers.Query,
    ...edgeResolvers.Query,
    ...contributorResolvers.Query,
  },

  Mutation: {
    ...nodeResolvers.Mutation,
    ...edgeResolvers.Mutation,
    ...contributorResolvers.Mutation,
  },

  Subscription: {
    ...nodeResolvers.Subscription,
    ...edgeResolvers.Subscription,
  },

  Node: nodeResolvers.Node,
  Edge: edgeResolvers.Edge,
  Contributor: contributorResolvers.Contributor,
  NodeContributor: contributorResolvers.NodeContributor,
};