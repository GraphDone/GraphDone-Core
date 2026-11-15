import { ApolloLink, Observable, execute, gql } from '@apollo/client';
import { GraphQLError } from 'graphql';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => { vi.stubEnv('VITE_HOSTED_USAGE', 'true'); });
vi.mock('../offline/engine', () => ({
  offlineEnabled: false, ownerId: () => null, localGuest: () => false, getProject: vi.fn(), useOffline: vi.fn(),
}));
vi.mock('../offline/link', async () => {
  const { ApolloLink } = await import('@apollo/client');
  return { offlineLink: new ApolloLink((operation, forward) => forward(operation)) };
});

import { getToken, setSession } from '../authStorage';
import { handleSessionRevoked, signedOutNavigation } from '../sessionRevoked';
import { errorLink } from '../apollo';
import { authLink } from '../authLink';
import { refreshHostedUsage } from '../hostedUsage';
import { operationsRequest } from '../operations';
import { agentRequest } from '../../components/AgentConnection';

const token = (id: string) => `header.${btoa(JSON.stringify({ uid: id, userId: id }))}.signature`;
const query = gql`query GetWorkItems { workItems { id } }`;
let go: ReturnType<typeof vi.spyOn>;

function failing(kind: 'graphql' | 'network') {
  let fail: (() => void) | undefined;
  const terminal = new ApolloLink(() => new Observable(observer => {
    fail = () => {
      if (kind === 'network') {
        observer.error(Object.assign(new Error('Response not successful'), { statusCode: 401, result: { code: 'SESSION_REVOKED', message: 'Signed out' } }));
      } else {
        observer.next({ errors: [new GraphQLError('Signed out', { extensions: { code: 'SESSION_REVOKED' } })] });
        observer.complete();
      }
    };
  }));
  const done = new Promise<void>(resolve => {
    execute(ApolloLink.from([errorLink, authLink, terminal]), { query }).subscribe({ error: () => resolve(), complete: resolve });
  });
  return { done, ready: () => !!fail, fail: () => fail!() };
}

async function started(kind: 'graphql' | 'network', count: number) {
  const operations = Array.from({ length: count }, () => failing(kind));
  await vi.waitFor(() => expect(operations.every(operation => operation.ready())).toBe(true));
  return operations;
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  setSession(token('owner-a'), { id: 'owner-a' }, true);
  localStorage.setItem('graphdone:owned-local-work', 'kept on this device');
  go = vi.spyOn(signedOutNavigation, 'go').mockImplementation(() => {});
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function expectSignedOutOnce() {
  expect(getToken()).toBeNull();
  expect(localStorage.getItem('currentUser')).toBeNull();
  expect(go).toHaveBeenCalledTimes(1);
  expect(go).toHaveBeenCalledWith('/login?error=signed_out');
  expect(localStorage.getItem('graphdone:owned-local-work')).toBe('kept on this device');
  expect(localStorage.getItem('graphdone:keepLoggedIn')).toBe('true');
}

describe('a signed-out session', () => {
  it.each(['graphql', 'network'] as const)('clears the session and returns to sign-in once when several %s requests fail together', async kind => {
    const operations = await started(kind, 3);
    operations.forEach(operation => operation.fail());
    await Promise.all(operations.map(operation => operation.done));
    expectSignedOutOnce();
  });

  it('ignores a signed-out answer for a session that was already replaced', async () => {
    const [operation] = await started('graphql', 1);
    setSession(token('owner-a-renewed'), { id: 'owner-a' }, true);
    operation.fail();
    await operation.done;
    expect(getToken()).toBe(token('owner-a-renewed'));
    expect(go).not.toHaveBeenCalled();
  });

  it.each([
    ['usage', () => refreshHostedUsage(true)],
    ['operations', () => operationsRequest('/reports')],
    ['agent connection', () => agentRequest('owned-graph', '/tokens')],
  ])('clears the session once when %s requests are refused together', async (_name, request) => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false, status: 401, headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ code: 'SESSION_REVOKED', message: 'Signed out' }),
    })));
    await Promise.allSettled([request(), request(), request()]);
    expectSignedOutOnce();
  });

  it('keeps a local guest and other failures as they are', async () => {
    setSession('local-guest', { id: 'owned-guest' }, true);
    handleSessionRevoked('local-guest');
    expect(getToken()).toBe('local-guest');
    setSession(token('owner-a'), { id: 'owner-a' }, true);
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false, status: 401, headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ code: 'UNAUTHENTICATED', error: 'Expired' }),
    })));
    await Promise.allSettled([operationsRequest('/reports'), agentRequest('owned-graph', '/tokens')]);
    expect(getToken()).toBe(token('owner-a'));
    expect(go).not.toHaveBeenCalled();
  });
});
