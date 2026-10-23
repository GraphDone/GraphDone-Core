import { offlineLink } from './offline/link';
import { ownerId, offlineEnabled } from './offline/engine';
import { ApolloClient, ApolloLink, InMemoryCache, createHttpLink, split, from } from '@apollo/client';
import { authLink } from './authLink';
import { onError } from '@apollo/client/link/error';
import { getMainDefinition } from '@apollo/client/utilities';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { createClient } from 'graphql-ws';
import { cloudFailure, preserveCloudDraft, refreshHostedUsage } from './hostedUsage';
import { getToken, clearSession } from './authStorage';

// Dynamically construct GraphQL URLs based on current host
const getGraphQLUrl = () => {
  if (import.meta.env.VITE_GRAPHQL_URL) {
    return import.meta.env.VITE_GRAPHQL_URL;
  }
  // Use /api/graphql through nginx proxy (works with Docker deployment)
  return `/api/graphql`;
};

const getWebSocketUrl = () => {
  if (import.meta.env.VITE_GRAPHQL_WS_URL) {
    return import.meta.env.VITE_GRAPHQL_WS_URL;
  }
  // Use /api/graphql for WebSocket through nginx proxy
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/api/graphql`;
};

const httpLink = createHttpLink({
  uri: getGraphQLUrl(),
});

const errorLink = onError(({ graphQLErrors, networkError, operation, forward }) => {
  if (graphQLErrors?.length || networkError) {
    const definition = getMainDefinition(operation.query);
    const expectedOwnerId = operation.getContext().expectedOwnerId;
    if ((expectedOwnerId === undefined || expectedOwnerId === ownerId()) && definition.kind === 'OperationDefinition' && definition.operation === 'mutation' && /workitem|edge|graph/i.test(operation.operationName)) preserveCloudDraft(operation.operationName, operation.variables);
    for (const error of graphQLErrors || []) cloudFailure(String(error.extensions?.code || ''));
    if (networkError && 'result' in networkError) cloudFailure((networkError.result as any)?.code);
  }
  if (graphQLErrors) {
    for (const error of graphQLErrors) {
      // Check for authentication errors
      if (error.extensions?.code === 'UNAUTHENTICATED' || 
          error.message.includes('Invalid token') ||
          error.message.includes('Unauthorized')) {
        if (!offlineEnabled || !ownerId()) clearSession();
        // Don't reload immediately - let auth context handle it
        return;
      }
    }
  }

  if (networkError) {
    // Handle 401/403 network errors
    if ('statusCode' in networkError && (networkError.statusCode === 401 || networkError.statusCode === 403)) {
      if (!offlineEnabled || !ownerId()) clearSession();
      // Don't reload immediately - let auth context handle it
      return;
    }
  }
});

const wsLink = new GraphQLWsLink(
  createClient({
    url: getWebSocketUrl(),
    connectionParams: () => {
      const token = getToken();
      return {
        authorization: token ? `Bearer ${token}` : '',
      };
    },
  })
);

const usageLink = new ApolloLink((operation,forward) => forward(operation).map(result => { void refreshHostedUsage(); return result; }));

const splitLink = split(
  ({ query }) => {
    const definition = getMainDefinition(query);
    return (
      definition.kind === 'OperationDefinition' &&
      definition.operation === 'subscription'
    );
  },
  wsLink,
  from([offlineLink, errorLink, authLink, usageLink, httpLink])
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
let cacheOwner=ownerId();
window.addEventListener('graphdone-session',()=>{const next=ownerId();if(next!==cacheOwner){cacheOwner=next;void apolloClient.clearStore();}});
window.addEventListener('graphdone-sync-refresh',()=>{void apolloClient.refetchQueries({include:['GetGraphs','GetGraphsByUser','GetGraph','GetWorkItems','GetWorkItemById','GetEdges']}).catch(()=>{});});
