import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Signin } from './Signin';

type CaptchaProps = { onVerified: (proof: string) => void; onReadyChange?: (ready: boolean) => void; resetKey: number };
const fixture = vi.hoisted(() => ({
  mutate: vi.fn(async () => ({})),
  captcha: null as CaptchaProps | null,
  callbacks: null as { onCompleted: (data: unknown) => void } | null,
}));
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ login: vi.fn() }) }));
vi.mock('../components/AuthCaptcha', () => ({ AuthCaptcha: (props: CaptchaProps) => {
  fixture.captcha = props;
  return <div>Owned verification control</div>;
} }));
vi.mock('@apollo/client', async original => ({
  ...await original<typeof import('@apollo/client')>(),
  useQuery: () => ({ data: undefined }),
  useMutation: (document: { definitions: Array<{ name?: { value: string } }> }, options: typeof fixture.callbacks) => {
    if (document.definitions[0].name?.value === 'Login') fixture.callbacks = options;
    return [fixture.mutate, { loading: false }];
  },
}));

beforeEach(() => {
  localStorage.clear();
  fixture.mutate.mockClear();
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));
});
afterEach(() => { vi.unstubAllGlobals(); });

function form() {
  render(<MemoryRouter><Signin initialMagicLink={false} /></MemoryRouter>);
  fireEvent.change(screen.getByLabelText('Email address or username'), { target: { value: 'owned@example.invalid' } });
  const password = screen.getByLabelText('Password', { exact: true });
  fireEvent.change(password, { target: { value: 'OwnedPassword!94' } });
  return { form: password.closest('form')!, submit: screen.getByRole('button', { name: 'Sign In' }) };
}

it('never sends login while proof is pending/failed/expired, including direct form submission', () => {
  const view = form();
  expect(view.submit).toBeDisabled();
  fireEvent.submit(view.form);
  expect(fixture.mutate).not.toHaveBeenCalled();
  act(() => { fixture.captcha!.onVerified('owned-proof'); fixture.captcha!.onReadyChange!(true); });
  expect(view.submit).toBeEnabled();
  fireEvent.submit(view.form);
  expect(fixture.mutate).toHaveBeenCalledTimes(1);
  act(() => { fixture.captcha!.onVerified(''); fixture.captcha!.onReadyChange!(false); });
  expect(view.submit).toBeDisabled();
  fireEvent.submit(view.form);
  expect(fixture.mutate).toHaveBeenCalledTimes(1);
  // An explicitly optional development/legacy action can proceed without proof.
  act(() => fixture.captcha!.onReadyChange!(true));
  fireEvent.submit(view.form);
  expect(fixture.mutate).toHaveBeenCalledTimes(2);
});

it('clears consumed proof when unverified email keeps the form open', () => {
  const view = form();
  act(() => { fixture.captcha!.onVerified('owned-proof'); fixture.captcha!.onReadyChange!(true); });
  act(() => fixture.callbacks!.onCompleted({ login: { user: { isEmailVerified: false } } }));
  expect(view.submit).toBeDisabled();
  expect(fixture.captcha!.resetKey).toBe(1);
  expect(screen.getByRole('alert')).toHaveTextContent('Please verify your email');
  fireEvent.submit(view.form);
  expect(fixture.mutate).not.toHaveBeenCalled();
});
