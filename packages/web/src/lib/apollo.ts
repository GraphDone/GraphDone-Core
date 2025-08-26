import { ApolloClient, InMemoryCache, createHttpLink, split, from } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { onError } from '@apollo/client/link/error';
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

const authLink = setContext((_, { headers }) => {
  const token = localStorage.getItem('authToken');
  return {
    headers: {
      ...headers,
      authorization: token ? `Bearer ${token}` : '',
    }
  };
});

const errorLink = onError(({ graphQLErrors, networkError, operation, forward }) => {
  if (graphQLErrors) {
    for (const error of graphQLErrors) {
      // Check for authentication errors
      if (error.extensions?.code === 'UNAUTHENTICATED' || 
          error.message.includes('Invalid token') ||
          error.message.includes('Unauthorized')) {
        localStorage.removeItem('authToken');
        localStorage.removeItem('currentUser');
        // Don't reload immediately - let auth context handle it
        return;
      }
    }
  }

  if (networkError) {
    // Handle 401/403 network errors
    if ('statusCode' in networkError && (networkError.statusCode === 401 || networkError.statusCode === 403)) {
      localStorage.removeItem('authToken');
      localStorage.removeItem('currentUser');
      // Don't reload immediately - let auth context handle it
      return;
    }
  }
});

const wsLink = new GraphQLWsLink(
  createClient({
    url: getWebSocketUrl(),
    connectionParams: () => {
      const token = localStorage.getItem('authToken');
      return {
        authorization: token ? `Bearer ${token}` : '',
      };
    },
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
  from([errorLink, authLink, httpLink])
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