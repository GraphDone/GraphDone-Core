import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fixture = vi.hoisted(() => ({ user: { id: 'owned-user', role: 'USER' } as { id: string; role: string } | null }));
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ currentUser: fixture.user }) }));

const sessionToken = `x.${btoa(JSON.stringify({ uid: 'owned-user' }))}.y`;
const stored = () => ['authToken', 'currentUser', 'graphdone:keepLoggedIn']
  .map(key => [key, localStorage.getItem(key), sessionStorage.getItem(key)]);

async function load(hosted: boolean) {
  vi.resetModules();
  vi.stubEnv('VITE_HOSTED_USAGE', hosted ? 'true' : 'false');
  const [{ SignOutEverywhere }, storage] = await Promise.all([import('./SignOutEverywhere'), import('../lib/authStorage')]);
  return { SignOutEverywhere, storage };
}

function answer(status: number, body: unknown) {
  return { ok: status < 400, status, headers: new Headers({ 'content-type': 'application/json' }), json: async () => body };
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  fixture.user = { id: 'owned-user', role: 'USER' };
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe('sign out of all devices', () => {
  it.each([
    ['a self-hosted build', false, 'USER', 'session'],
    ['a guest', true, 'GUEST', 'session'],
    ['a local guest', true, 'USER', 'local-guest'],
    ['nobody signed in', true, null, 'session'],
  ])('is not offered to %s', async (_name, hosted, role, kind) => {
    const { SignOutEverywhere, storage } = await load(hosted as boolean);
    fixture.user = role ? { id: 'owned-user', role: role as string } : null;
    storage.setSession(kind === 'local-guest' ? 'local-guest' : sessionToken, { id: 'owned-user' }, true);
    render(<SignOutEverywhere />);
    expect(screen.queryByRole('button', { name: 'Sign out of all devices' })).toBeNull();
  });

  it.each([true, false])('asks first, then stores the returned session keeping the stay-signed-in choice (%s)', async keep => {
    const { SignOutEverywhere, storage } = await load(true);
    storage.setSession(sessionToken, { id: 'owned-user' }, keep);
    const fetchMock = vi.fn(async (_url: string, _init?: unknown) => answer(200, { token: 'owned-renewed-session' }));
    vi.stubGlobal('fetch', fetchMock);
    render(<SignOutEverywhere />);
    fireEvent.click(screen.getByRole('button', { name: 'Sign out of all devices' }));
    expect(screen.getByText('Other browsers and devices will need to sign in again. Agent connections are not affected.')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Confirm' })); });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, { method: string; headers: Record<string, string> }];
    expect(url).toMatch(/\/api\/session\/revoke-all$/);
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe(`Bearer ${sessionToken}`);
    expect(screen.getByRole('status')).toHaveTextContent('Other devices were signed out.');
    const primary = keep ? localStorage : sessionStorage;
    const secondary = keep ? sessionStorage : localStorage;
    expect(primary.getItem('authToken')).toBe('owned-renewed-session');
    expect(primary.getItem('currentUser')).toBe('{"id":"owned-user"}');
    expect(secondary.getItem('authToken')).toBeNull();
    expect(localStorage.getItem('graphdone:keepLoggedIn')).toBe(String(keep));
  });

  it('does nothing on Cancel', async () => {
    const { SignOutEverywhere, storage } = await load(true);
    storage.setSession(sessionToken, { id: 'owned-user' }, true);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    render(<SignOutEverywhere />);
    fireEvent.click(screen.getByRole('button', { name: 'Sign out of all devices' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Sign out of all devices' })).toBeInTheDocument();
  });

  it.each([
    ['refused', () => Promise.resolve(answer(403, { error: 'Not available for guests' }))],
    ['not offered by the server', () => Promise.resolve(answer(404, { error: 'Not found' }))],
    ['unavailable', () => Promise.resolve(answer(503, { error: 'Unavailable' }))],
    ['rate limited', () => Promise.resolve(answer(429, { error: 'Too many requests' }))],
    ['answered without a session', () => Promise.resolve(answer(200, {}))],
    ['unreachable', () => Promise.reject(new TypeError('Failed to fetch'))],
  ])('keeps the current session when the request is %s', async (_name, respond) => {
    const { SignOutEverywhere, storage } = await load(true);
    storage.setSession(sessionToken, { id: 'owned-user' }, true);
    const before = stored();
    vi.stubGlobal('fetch', vi.fn(respond));
    render(<SignOutEverywhere />);
    fireEvent.click(screen.getByRole('button', { name: 'Sign out of all devices' }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Confirm' })); });
    expect(stored()).toEqual(before);
    expect(screen.getByRole('alert')).toHaveTextContent(/still signed in here/);
  });

  it('disables the confirmation while the request is in flight', async () => {
    const { SignOutEverywhere, storage } = await load(true);
    storage.setSession(sessionToken, { id: 'owned-user' }, true);
    let finish: (value: unknown) => void = () => {};
    const fetchMock = vi.fn(() => new Promise(resolve => { finish = resolve; }));
    vi.stubGlobal('fetch', fetchMock);
    render(<SignOutEverywhere />);
    fireEvent.click(screen.getByRole('button', { name: 'Sign out of all devices' }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Confirm' })); });
    expect(screen.getByRole('button', { name: /Confirm|Signing out/ })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /Confirm|Signing out/ }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await act(async () => { finish(answer(200, { token: 'owned-renewed-session' })); });
    expect(localStorage.getItem('authToken')).toBe('owned-renewed-session');
  });
});
