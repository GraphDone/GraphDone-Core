import { ApolloClient, InMemoryCache, createHttpLink, split } from '@apollo/client';
import { getMainDefinition } from '@apollo/client/utilities';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { createClient } from 'graphql-ws';

// Dynamically construct GraphQL URLs based on current host
const getGraphQLUrl = () => {
  if (import.meta.env.VITE_GRAPHQL_URL) {
    return import.meta.env.VITE_GRAPHQL_URL;
  }
  // Use same hostname but port 4127 for GraphQL
  const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
  return `${protocol}//${window.location.hostname}:4127/graphql`;
};

const getWebSocketUrl = () => {
  if (import.meta.env.VITE_GRAPHQL_WS_URL) {
    return import.meta.env.VITE_GRAPHQL_WS_URL;
  }
  // Use same hostname but port 4127 for WebSocket
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.hostname}:4127/graphql`;
};

const httpLink = createHttpLink({
  uri: getGraphQLUrl(),
});

const wsLink = new GraphQLWsLink(
  createClient({
    url: getWebSocketUrl(),
  })
);

const splitLink = split(
  ({ query }) => {
    const definition = getMainDefinition(query);
    return (
      definition.kind === 'OperationDefinition' &&
      definition.operation === 'subscription'
    );
  },
  wsLink,
  httpLink
);

export const apolloClient = new ApolloClient({
  link: splitLink,
  cache: new InMemoryCache({
    typePolicies: {
      Node: {
        fields: {
          dependencies: {
            merge(_existing = [], incoming) {
              return incoming;
            }
          },
          dependents: {
            merge(_existing = [], incoming) {
              return incoming;
            }
          },
          contributors: {
            merge(_existing = [], incoming) {
              return incoming;
            }
          }
        }
      }
    }
  }),
  defaultOptions: {
    watchQuery: {
      errorPolicy: 'all'
    },
    query: {
      errorPolicy: 'all'
    }
  }
});