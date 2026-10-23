import { ApolloLink, Observable, execute, gql } from '@apollo/client';
import { GraphQLError } from 'graphql';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { waitFor } from '@testing-library/react';
import { getToken, setSession } from '../authStorage';

const effects = vi.hoisted(() => ({ preserveCloudDraft: vi.fn(), cloudFailure: vi.fn() }));
vi.mock('../offline/engine', () => ({ offlineEnabled: false, ownerId: () => null }));
vi.mock('../offline/link', async () => {
  const { ApolloLink } = await import('@apollo/client');
  return { offlineLink: new ApolloLink((operation, forward) => forward(operation)) };
});
vi.mock('../hostedUsage', () => ({ ...effects, refreshHostedUsage: vi.fn() }));
import { errorLink } from '../apollo';
import { authLink } from '../authLink';

const token = (id: string) => `header.${btoa(JSON.stringify({ userId: id }))}.signature`;
const mutation = gql`mutation UpdateWorkItems { updateWorkItems { workItems { id } } }`;
function delayedFailure(kind: 'graphql' | 'network') {
  let fail: (() => void) | undefined;
  const terminal = new ApolloLink(() => new Observable(observer => {
    fail = () => {
      if (kind === 'network') observer.error(Object.assign(new Error('Unauthorized'), { statusCode: 401 }));
      else {
        observer.next({ errors: [new GraphQLError('Unauthorized', { extensions: { code: 'UNAUTHENTICATED' } })] });
        observer.complete();
      }
    };
  }));
  const completion = new Promise<void>(resolve => {
    execute(ApolloLink.from([errorLink, authLink, terminal]), { query: mutation, context: { expectedOwnerId: 'owner-a' } }).subscribe({ error: () => resolve(), complete: resolve });
  });
  return { completion, ready: () => !!fail, fail: () => fail!() };
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  setSession(token('owner-a'), { id: 'owner-a' }, true);
});

describe('layout error ownership', () => {
  it.each(['graphql', 'network'] as const)('does not clear a replacement session or preserve another account’s draft after a stale %s error', async kind => {
    const operation = delayedFailure(kind);
    await waitFor(() => expect(operation.ready()).toBe(true));
    setSession(token('owner-b'), { id: 'owner-b' }, true);
    operation.fail();
    await operation.completion;
    expect(getToken()).toBe(token('owner-b'));
    expect(effects.preserveCloudDraft).not.toHaveBeenCalled();
    expect(effects.cloudFailure).not.toHaveBeenCalled();
  });

  it('still handles an authentication failure belonging to the active owner', async () => {
    const operation = delayedFailure('graphql');
    await waitFor(() => expect(operation.ready()).toBe(true));
    operation.fail();
    await operation.completion;
    expect(effects.preserveCloudDraft).toHaveBeenCalledTimes(1);
    expect(getToken()).toBeNull();
  });
});
