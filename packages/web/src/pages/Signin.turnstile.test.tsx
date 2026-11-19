import { act, fireEvent, render, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Signin } from './Signin';

type ChallengeProps = { siteKey: string; action?: string; onToken: (token: string | null) => void };
const fixture = vi.hoisted(() => ({
  config: {} as Record<string, unknown>,
  request: { status: 200, body: { success: true, userExists: true } as Record<string, unknown> },
  captcha: null as { onVerified: (proof: string) => void } | null,
  challenge: null as ChallengeProps | null,
  mounts: 0,
}));
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ login: vi.fn() }) }));
vi.mock('../components/AuthCaptcha', () => ({ AuthCaptcha: (props: { onVerified: (proof: string) => void }) => {
  fixture.captcha = props;
  return <div>Owned verification control</div>;
} }));
vi.mock('../components/TurnstileChallenge', () => ({ TurnstileChallenge: (props: ChallengeProps) => {
  fixture.challenge = props;
  useEffect(() => { fixture.mounts += 1; props.onToken(null); }, []);
  return <div>Owned human check</div>;
} }));
vi.mock('@apollo/client', async original => ({
  ...await original<typeof import('@apollo/client')>(),
  useQuery: () => ({ data: undefined }),
  useMutation: () => [vi.fn(), { loading: false }],
}));

const fetchMock = vi.fn(async (url: string, _init?: unknown) => url.endsWith('/config')
  ? { ok: true, status: 200, json: async () => fixture.config }
  : { ok: fixture.request.status < 400, status: fixture.request.status, json: async () => fixture.request.body });

beforeEach(() => {
  localStorage.clear();
  fixture.config = {};
  fixture.request = { status: 200, body: { success: true, userExists: true } };
  fixture.captcha = null;
  fixture.challenge = null;
  fixture.mounts = 0;
  fetchMock.mockClear();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

async function form() {
  render(<MemoryRouter initialEntries={['/login']}><Signin /></MemoryRouter>);
  await act(async () => {});
  fireEvent.change(screen.getByLabelText('Email Address'), { target: { value: 'owned@example.invalid' } });
  return { send: screen.getByRole('button', { name: 'Send Link' }) };
}

const requests = () => fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/auth/magic-link/request'))
  .map(([, init]) => init as unknown as { headers: Record<string, string>; body: string });

it('keeps the existing verification and sends no human-check header when the server asks for none', async () => {
  fixture.config = { signIn: { turnstileSiteKey: null, action: 'signin' } };
  const view = await form();
  expect(screen.queryByText('Owned human check')).toBeNull();
  expect(screen.getByText('Owned verification control')).toBeInTheDocument();
  expect(view.send).toBeDisabled();
  act(() => fixture.captcha!.onVerified('owned-proof'));
  await act(async () => { fireEvent.click(view.send); });
  expect(requests()).toEqual([{ method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'owned@example.invalid', captchaPayload: 'owned-proof' }) }]);
});

it('waits for the human check and sends its token as a header, then asks for a fresh one', async () => {
  fixture.config = { signIn: { turnstileSiteKey: 'owned-site-key', action: 'signin' } };
  const view = await form();
  expect(fixture.challenge).toMatchObject({ siteKey: 'owned-site-key', action: 'signin' });
  expect(fixture.mounts).toBe(1);
  expect(view.send).toBeDisabled();
  fireEvent.click(view.send);
  expect(requests()).toEqual([]);
  act(() => fixture.challenge!.onToken('owned-turnstile-token'));
  expect(view.send).toBeEnabled();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  await act(async () => { fireEvent.click(view.send); });
  expect(requests()).toHaveLength(1);
  expect(requests()[0].headers).toEqual({ 'Content-Type': 'application/json', 'X-Turnstile-Token': 'owned-turnstile-token' });
  expect(screen.queryByText('Owned human check')).toBeNull();
  for (let second = 0; second < 60; second += 1) act(() => { vi.advanceTimersByTime(1000); });
  vi.useRealTimers();
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Resend Magic Link' })); });
  expect(requests()).toHaveLength(1);
  expect(fixture.mounts).toBe(2);
  const resend = screen.getByRole('button', { name: 'Send Link' });
  expect(resend).toBeDisabled();
  act(() => fixture.challenge!.onToken('owned-second-token'));
  await act(async () => { fireEvent.click(resend); });
  expect(requests()[1].headers['X-Turnstile-Token']).toBe('owned-second-token');
});

it('defaults the human-check action to signin', async () => {
  fixture.config = { signIn: { turnstileSiteKey: 'owned-site-key' } };
  await form();
  expect(fixture.challenge).toMatchObject({ siteKey: 'owned-site-key', action: 'signin' });
});

it('shows a plain message and a fresh human check when the server asks for verification again', async () => {
  fixture.config = { signIn: { turnstileSiteKey: 'owned-site-key', action: 'signin' } };
  fixture.request = { status: 403, body: { error: 'verification_required' } };
  const view = await form();
  act(() => fixture.challenge!.onToken('owned-turnstile-token'));
  await act(async () => { fireEvent.click(view.send); });
  expect(requests()).toHaveLength(1);
  expect(screen.getByRole('alert')).toHaveTextContent('Please complete the verification and try again.');
  expect(fixture.mounts).toBe(2);
  expect(screen.getByRole('button', { name: 'Send Link' })).toBeDisabled();
});
