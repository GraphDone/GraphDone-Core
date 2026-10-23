import { ApolloLink, Observable, execute, gql } from '@apollo/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authLink } from '../authLink';
import { clearSession, setSession } from '../authStorage';

const mutation = gql`mutation UpdateWorkItems { updateWorkItems { workItems { id } } }`;
function request(expectedOwnerId?: string) {
  const sent = vi.fn();
  const terminal = new ApolloLink(operation => {
    sent(operation.getContext().headers);
    return Observable.of({ data: { updateWorkItems: { workItems: [{ id: 'task' }] } } });
  });
  const completion = new Promise((resolve, reject) => {
    execute(authLink.concat(terminal), { query: mutation, context: { expectedOwnerId, headers: { 'x-client': 'web' } } }).subscribe({ next: resolve, error: reject });
  });
  return { sent, completion };
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  setSession('token-a', { id: 'owner-a' }, true);
});

describe('layout mutation owner guard', () => {
  it('rejects a queued mutation if the account changes before the auth context resolves', async () => {
    const operation = request('owner-a');
    setSession('token-b', { id: 'owner-b' }, true);
    await expect(operation.completion).rejects.toThrow('signed-in owner changed');
    expect(operation.sent).not.toHaveBeenCalled();
  });

  it('does not send a retained layout after sign-out', async () => {
    const operation = request('owner-a');
    clearSession();
    await expect(operation.completion).rejects.toThrow('signed-in owner changed');
    expect(operation.sent).not.toHaveBeenCalled();
  });

  it('uses fresh credentials for the same owner while preserving request headers', async () => {
    const operation = request('owner-a');
    setSession('token-a-refreshed', { id: 'owner-a' }, false);
    await operation.completion;
    expect(operation.sent).toHaveBeenCalledWith({ 'x-client': 'web', authorization: 'Bearer token-a-refreshed' });
  });

  it('preserves authentication for operations without an owner constraint', async () => {
    const operation = request();
    await operation.completion;
    expect(operation.sent).toHaveBeenCalledWith({ 'x-client': 'web', authorization: 'Bearer token-a' });
  });
});
