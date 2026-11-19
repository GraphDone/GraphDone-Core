import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Signin } from './Signin';

vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ login: vi.fn() }) }));
vi.mock('../components/AuthCaptcha', () => ({ AuthCaptcha: () => <div>Owned verification control</div> }));
vi.mock('@apollo/client', async original => ({
  ...await original<typeof import('@apollo/client')>(),
  useQuery: () => ({ data: undefined }),
  useMutation: () => [vi.fn(), { loading: false }],
}));

const stored = () => ['authToken', 'currentUser', 'graphdone:keepLoggedIn']
  .map(key => [key, localStorage.getItem(key), sessionStorage.getItem(key)]);

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); window.history.replaceState(null, '', '/'); });

async function open(url: string) {
  window.history.replaceState(null, '', url);
  const session = vi.fn();
  window.addEventListener('graphdone-session', session);
  render(<MemoryRouter initialEntries={[url]}><Signin /></MemoryRouter>);
  await act(async () => {});
  window.removeEventListener('graphdone-session', session);
  return { session };
}

it('stores no session from a token in the sign-in address and removes it from the address', async () => {
  const view = await open('/login?token=owned-url-token');
  expect(stored()).toEqual([['authToken', null, null], ['currentUser', null, null], ['graphdone:keepLoggedIn', null, null]]);
  expect(view.session).not.toHaveBeenCalled();
  expect(window.location.pathname).toBe('/login');
  expect(window.location.search).toBe('');
});

it('removes only the token from an address that carries other parameters', async () => {
  await open('/login?error=github&token=owned-url-token');
  expect(window.location.search).toBe('?error=github');
  expect(stored()).toEqual([['authToken', null, null], ['currentUser', null, null], ['graphdone:keepLoggedIn', null, null]]);
});

it('leaves an existing session untouched when the sign-in address carries a token', async () => {
  localStorage.setItem('authToken', 'owned-existing-session');
  localStorage.setItem('currentUser', '{"id":"owned-user"}');
  localStorage.setItem('graphdone:keepLoggedIn', 'true');
  const before = stored();
  const view = await open('/login?token=owned-url-token');
  expect(stored()).toEqual(before);
  expect(view.session).not.toHaveBeenCalled();
  expect(window.location.search).toBe('');
});

it('tells a person who was signed out on this device to sign in again', async () => {
  await open('/login?error=signed_out');
  expect(screen.getByRole('alert')).toHaveTextContent('You were signed out on this device. Sign in again.');
  expect(stored()).toEqual([['authToken', null, null], ['currentUser', null, null], ['graphdone:keepLoggedIn', null, null]]);
});
