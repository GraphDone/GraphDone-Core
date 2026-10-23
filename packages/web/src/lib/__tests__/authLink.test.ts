import { ApolloLink, Observable, execute, gql } from '@apollo/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authLink } from '../authLink';
import * as authStorage from '../authStorage';
import { clearSession, setSession, setToken } from '../authStorage';

const token = (id: string, refresh = '') => `header.${btoa(JSON.stringify({ userId: id }))}.signature${refresh}`;
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
  setSession(token('owner-a'), { id: 'owner-a' }, true);
});

describe('layout mutation owner guard', () => {
  it('validates the exact bearer snapshot even when shared storage changes between reads', async () => {
    setSession(token('owner-b'), { id: 'owner-b' }, true);
    const read = vi.spyOn(authStorage, 'getToken').mockReturnValueOnce(token('owner-a'));
    try {
      const operation = request('owner-b');
      await expect(operation.completion).rejects.toThrow('signed-in owner changed');
      expect(operation.sent).not.toHaveBeenCalled();
    } finally { read.mockRestore(); }
  });

  it('rejects a replacement token before the cached user has been refreshed', async () => {
    const operation = request('owner-a');
    setToken(token('owner-b'), true);
    await expect(operation.completion).rejects.toThrow('signed-in owner changed');
    expect(operation.sent).not.toHaveBeenCalled();
  });

  it('rejects a queued mutation if the account changes before the auth context resolves', async () => {
    const operation = request('owner-a');
    setSession(token('owner-b'), { id: 'owner-b' }, true);
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
    setSession(token('owner-a', '-refreshed'), { id: 'owner-a' }, false);
    await operation.completion;
    expect(operation.sent).toHaveBeenCalledWith({ 'x-client': 'web', authorization: `Bearer ${token('owner-a', '-refreshed')}` });
  });

  it('preserves authentication for operations without an owner constraint', async () => {
    const operation = request();
    await operation.completion;
    expect(operation.sent).toHaveBeenCalledWith({ 'x-client': 'web', authorization: `Bearer ${token('owner-a')}` });
  });
});
