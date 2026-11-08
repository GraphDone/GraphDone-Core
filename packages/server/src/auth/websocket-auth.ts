import type { ServerOptions } from 'graphql-ws';
import type { WebSocket } from 'ws';
import { GraphQLError } from 'graphql';
import { resolveActiveAuthUser } from '../middleware/auth.js';

type ConnectionParams = Record<string, unknown>;
type Extra = { socket: WebSocket };
type Guard = Pick<ServerOptions<ConnectionParams, Extra>, 'onConnect' | 'onNext'>;

export const webSocketAuthentication: Guard = {
  onConnect: async context => {
    const header = context.connectionParams?.authorization ?? context.connectionParams?.Authorization;
    if (header === undefined) return true;
    return typeof header === 'string' && Boolean(await resolveActiveAuthUser(header));
  },
  onNext: async context => {
    const header = context.connectionParams?.authorization ?? context.connectionParams?.Authorization;
    if (header !== undefined && (typeof header !== 'string' || !await resolveActiveAuthUser(header))) {
      context.extra.socket.close(4403, 'Session expired');
      return { errors: [new GraphQLError('Session expired', { extensions: { code: 'UNAUTHENTICATED' } })] };
    }
    return undefined;
  },
};
