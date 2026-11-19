import { beforeEach, expect, it, vi } from 'vitest';
import { emptyAccount, type Account } from './model';

const signedIn = `x.${btoa(JSON.stringify({ uid: 'owner' }))}.y`;
const fixture = vi.hoisted(() => ({ account: null as Account | null, signedOut: vi.fn() }));
vi.mock('./store', () => ({
  channel: null,
  readAccount: async () => structuredClone(fixture.account),
  editAccount: async (_owner: string, edit: (account: Account) => unknown) => {
    const account = structuredClone(fixture.account!);
    const result = edit(account);
    fixture.account = account;
    return result;
  },
}));
vi.mock('../authStorage', () => ({
  getToken: () => `x.${btoa(JSON.stringify({ uid: 'owner' }))}.y`,
  getUserRaw: () => JSON.stringify({ id: 'owner', role: 'USER' }),
}));
vi.mock('../sessionRevoked', () => ({
  isSessionRevoked: (code: unknown) => code === 'SESSION_REVOKED',
  handleSessionRevoked: fixture.signedOut,
}));

import { listProjects } from './engine';

beforeEach(() => {
  fixture.account = emptyAccount();
  fixture.signedOut.mockClear();
});

it('hands a signed-out sync answer to the shared sign-out and keeps local work', async () => {
  const local = { project: { id: 'owned-local', name: 'Owned local work' }, nodes: [], edges: [], notes: [] };
  fixture.account!.projects['owned-local'] = { base: null, local } as unknown as Account['projects'][string];
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 401, headers: new Headers(), json: async () => ({ code: 'SESSION_REVOKED', message: 'Signed out' }) })));
  try {
    await listProjects(true);
  } finally {
    vi.unstubAllGlobals();
  }
  expect(fixture.signedOut).toHaveBeenCalledTimes(1);
  expect(fixture.signedOut).toHaveBeenCalledWith(signedIn);
  expect(fixture.account!.projects['owned-local'].local).toEqual(local);
});

it('does not sign out on other sync refusals', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 401, headers: new Headers(), json: async () => ({ code: 'UNAUTHENTICATED' }) })));
  try {
    await listProjects(true).catch(() => {});
  } finally {
    vi.unstubAllGlobals();
  }
  expect(fixture.signedOut).not.toHaveBeenCalled();
});
