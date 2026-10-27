import { Profiler } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthCaptcha } from './AuthCaptcha';

vi.mock('altcha', () => ({}));
afterEach(() => { vi.unstubAllGlobals(); });

describe('authentication verification UI', () => {
  it('captures proof emitted at the first widget commit before passive effects', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ captcha: { provider: 'altcha' } }) }));
    const verified = vi.fn();
    const readiness = vi.fn();
    const seen = new WeakSet<Element>();
    const captured: unknown[] = [];
    render(<Profiler id="captcha-commit" onRender={() => {
      const widget = document.querySelector('altcha-widget');
      if (widget && !seen.has(widget)) {
        seen.add(widget);
        widget.dispatchEvent(new CustomEvent('statechange', { detail: { state: 'verified', payload: 'early-issued-proof' } }));
        captured.push(verified.mock.calls.at(-1)?.[0]);
      }
    }}><AuthCaptcha action="login" onVerified={verified} onReadyChange={readiness} /></Profiler>);
    await screen.findByTestId('server-captcha');
    expect(captured).toEqual(['early-issued-proof']);
    expect(verified).toHaveBeenLastCalledWith('early-issued-proof');
    expect(readiness).toHaveBeenLastCalledWith(true);
    expect(screen.getByRole('status')).toHaveTextContent('Verification complete');
  });

  it('clears proof on expiry and retry, and requests the intended server action', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ captcha: { provider: 'altcha' } }) }));
    const verified = vi.fn();
    const readiness = vi.fn();
    const { container, rerender, unmount } = render(<AuthCaptcha action="login" onVerified={verified} onReadyChange={readiness} />);
    expect(readiness).toHaveBeenLastCalledWith(false);
    await screen.findByTestId('server-captcha');
    const widget = container.querySelector('altcha-widget')!;
    expect(widget.getAttribute('challengeurl')).toContain('/api/captcha/challenge?action=login');
    act(() => widget.dispatchEvent(new CustomEvent('statechange', { detail: { state: 'verified', payload: 'issued-proof' } })));
    expect(verified).toHaveBeenLastCalledWith('issued-proof');
    expect(readiness).toHaveBeenLastCalledWith(true);
    expect(screen.getByRole('status')).toHaveTextContent('Verification complete');
    act(() => widget.dispatchEvent(new CustomEvent('statechange', { detail: { state: 'expired' } })));
    expect(verified).toHaveBeenLastCalledWith('');
    expect(readiness).toHaveBeenLastCalledWith(false);
    expect(screen.getByRole('status')).toHaveTextContent('expired');
    fireEvent.click(screen.getByRole('button', { name: 'Retry verification' }));
    expect(container.querySelector('altcha-widget')).not.toBe(widget);
    expect(verified).toHaveBeenLastCalledWith('');
    const replacement = container.querySelector('altcha-widget')!;
    const beforeRemovedEvent = verified.mock.calls.length;
    act(() => widget.dispatchEvent(new CustomEvent('statechange', { detail: { state: 'verified', payload: 'stale-proof' } })));
    expect(verified).toHaveBeenCalledTimes(beforeRemovedEvent);
    act(() => replacement.dispatchEvent(new CustomEvent('statechange', { detail: { state: 'verified', payload: 'replacement-proof' } })));
    expect(verified).toHaveBeenLastCalledWith('replacement-proof');
    act(() => replacement.dispatchEvent(new CustomEvent('statechange', { detail: { state: 'error' } })));
    expect(verified).toHaveBeenLastCalledWith('');
    expect(readiness).toHaveBeenLastCalledWith(false);
    expect(screen.getByRole('status')).toHaveTextContent('failed');
    rerender(<AuthCaptcha action="reset-password" onVerified={verified} resetKey={1} />);
    expect(container.querySelector('altcha-widget')!.getAttribute('challengeurl')).toContain('action=reset-password');
    const current = container.querySelector('altcha-widget')!;
    const afterReset = verified.mock.calls.length;
    act(() => replacement.dispatchEvent(new CustomEvent('statechange', { detail: { state: 'verified', payload: 'old-action-proof' } })));
    expect(verified).toHaveBeenCalledTimes(afterReset);
    unmount();
    act(() => current.dispatchEvent(new CustomEvent('statechange', { detail: { state: 'verified', payload: 'unmounted-proof' } })));
    expect(verified).toHaveBeenCalledTimes(afterReset);
  });

  it('shows an accessible failure and retry when policy loading fails', async () => {
    const fetch = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ ok: true, json: async () => ({ captcha: { provider: 'altcha' } }) });
    vi.stubGlobal('fetch', fetch);
    const verified = vi.fn();
    render(<AuthCaptcha action="magic-link" onVerified={verified} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Verification is unavailable');
    expect(screen.queryByLabelText('Verification answer')).toBeNull();
    expect(verified.mock.calls.every(([value]) => value === '')).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Retry verification' }));
    await screen.findByTestId('server-captcha');
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('retains an explicitly advertised backend without Core CAPTCHA support', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ oauth: { providers: {} } }) }));
    const { container } = render(<AuthCaptcha action="login" onVerified={() => {}} />);
    await waitFor(() => expect(screen.queryByRole('status')).toBeNull());
    expect(container.querySelector('altcha-widget')).toBeNull();
  });

  it('allows an explicitly optional Core action without asking for proof', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ captcha: { provider: 'altcha', requiredActions: ['magic-link'] } }) }));
    const readiness = vi.fn();
    render(<AuthCaptcha action="login" onVerified={() => {}} onReadyChange={readiness} />);
    await waitFor(() => expect(readiness).toHaveBeenLastCalledWith(true));
    expect(screen.queryByTestId('server-captcha')).toBeNull();
  });
});
