import { act, fireEvent, render, screen } from '@testing-library/react';
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

const fixture = vi.hoisted(() => ({
  preview: { status: 200, body: { account: 'owned@example.invalid' } as Record<string, unknown> },
  complete: { status: 200, body: { token: 'owned-session-jwt' } as Record<string, unknown> },
}));
const fetchMock = vi.fn(async (url: string, _init?: unknown) => {
  const answer = url.endsWith('/auth/session/handover/preview') ? fixture.preview
    : url.endsWith('/auth/session/handover/complete') ? fixture.complete : { status: 200, body: {} };
  return { ok: answer.status < 400, status: answer.status, json: async () => answer.body };
});
const calls = (step: string) => fetchMock.mock.calls.filter(([url]) => String(url).endsWith(`/auth/session/handover/${step}`))
  .map(([, init]) => JSON.parse((init as { body: string }).body));
const stored = () => ['authToken', 'currentUser', 'graphdone:keepLoggedIn']
  .map(key => [key, localStorage.getItem(key), sessionStorage.getItem(key)]);

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  fixture.preview = { status: 200, body: { account: 'owned@example.invalid' } };
  fixture.complete = { status: 200, body: { token: 'owned-session-jwt' } };
  fetchMock.mockClear();
  vi.stubGlobal('fetch', fetchMock);
  window.history.replaceState(null, '', '/login#handover=owned-handover-code');
});
afterEach(() => {
  vi.unstubAllGlobals();
  window.history.replaceState(null, '', '/');
});

async function open() {
  render(<MemoryRouter initialEntries={['/login']}><Signin /></MemoryRouter>);
  await act(async () => {});
}

function existingSession() {
  localStorage.setItem('authToken', 'owned-existing-session');
  localStorage.setItem('currentUser', '{"id":"owned-user"}');
  localStorage.setItem('graphdone:keepLoggedIn', 'true');
  return stored();
}

it('removes the handover code from the address at once and asks before signing in', async () => {
  await open();
  expect(window.location.hash).toBe('');
  expect(window.location.pathname).toBe('/login');
  expect(calls('preview')).toEqual([{ code: 'owned-handover-code' }]);
  expect(calls('complete')).toEqual([]);
  expect(screen.getByRole('heading', { name: 'Finish signing in as owned@example.invalid?' })).toBeInTheDocument();
  expect(screen.queryByText(/replace/)).toBeNull();
  expect(stored()).toEqual([['authToken', null, null], ['currentUser', null, null], ['graphdone:keepLoggedIn', null, null]]);
});

it('stores the session only when the person presses Continue', async () => {
  await open();
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Continue' })); });
  expect(calls('complete')).toEqual([{ code: 'owned-handover-code' }]);
  expect(localStorage.getItem('authToken')).toBe('owned-session-jwt');
  expect(localStorage.getItem('graphdone:keepLoggedIn')).toBe('true');
});

it('says an existing session will be replaced and leaves it untouched on Cancel', async () => {
  const before = existingSession();
  await open();
  expect(screen.getByText('Continuing will replace the account signed in on this browser.')).toBeInTheDocument();
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Cancel' })); });
  expect(calls('complete')).toEqual([]);
  expect(stored()).toEqual(before);
  expect(screen.queryByRole('heading', { name: /Finish signing in/ })).toBeNull();
  expect(screen.getByRole('button', { name: 'Send Link' })).toBeInTheDocument();
});

it('shows the invalid link message and keeps an existing session when the code is refused', async () => {
  const before = existingSession();
  fixture.preview = { status: 400, body: { error: 'invalid_handover' } };
  await open();
  expect(screen.getByRole('alert')).toHaveTextContent('This magic link is not valid or has already been used.');
  expect(screen.queryByRole('button', { name: 'Continue' })).toBeNull();
  expect(calls('complete')).toEqual([]);
  expect(stored()).toEqual(before);
});

it('stores nothing when the code is refused at Continue', async () => {
  fixture.complete = { status: 400, body: { error: 'invalid_handover' } };
  await open();
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Continue' })); });
  expect(screen.getByRole('alert')).toHaveTextContent('This magic link is not valid or has already been used.');
  expect(stored()).toEqual([['authToken', null, null], ['currentUser', null, null], ['graphdone:keepLoggedIn', null, null]]);
});

it('does nothing without a handover fragment', async () => {
  window.history.replaceState(null, '', '/login#elsewhere');
  await open();
  expect(window.location.hash).toBe('#elsewhere');
  expect(calls('preview')).toEqual([]);
  expect(screen.queryByRole('heading', { name: /Finish signing in/ })).toBeNull();
});
