import { act, render } from '@testing-library/react';
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
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

async function open(url: string) {
  const replaceState = vi.spyOn(window.history, 'replaceState');
  const session = vi.fn();
  window.addEventListener('graphdone-session', session);
  render(<MemoryRouter initialEntries={[url]}><Signin /></MemoryRouter>);
  await act(async () => {});
  window.removeEventListener('graphdone-session', session);
  return { replaceState, session };
}

it('stores no session from a token in the sign-in address and does not reload', async () => {
  const view = await open('/login?token=owned-url-token');
  expect(stored()).toEqual([['authToken', null, null], ['currentUser', null, null], ['graphdone:keepLoggedIn', null, null]]);
  expect(view.session).not.toHaveBeenCalled();
  expect(view.replaceState).not.toHaveBeenCalled();
});

it('leaves an existing session untouched when the sign-in address carries a token', async () => {
  localStorage.setItem('authToken', 'owned-existing-session');
  localStorage.setItem('currentUser', '{"id":"owned-user"}');
  localStorage.setItem('graphdone:keepLoggedIn', 'true');
  const before = stored();
  const view = await open('/login?token=owned-url-token');
  expect(stored()).toEqual(before);
  expect(view.session).not.toHaveBeenCalled();
  expect(view.replaceState).not.toHaveBeenCalled();
});
