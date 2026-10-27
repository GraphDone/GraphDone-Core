import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthCaptcha } from './AuthCaptcha';

vi.mock('altcha', () => ({}));
afterEach(() => { vi.unstubAllGlobals(); });

describe('authentication verification UI', () => {
  it('clears proof on expiry and retry, and requests the intended server action', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ captcha: { provider: 'altcha' } }) }));
    const verified = vi.fn();
    const { container, rerender } = render(<AuthCaptcha action="login" onVerified={verified} />);
    await screen.findByTestId('server-captcha');
    const widget = container.querySelector('altcha-widget')!;
    expect(widget.getAttribute('challengeurl')).toContain('/api/captcha/challenge?action=login');
    act(() => widget.dispatchEvent(new CustomEvent('statechange', { detail: { state: 'verified', payload: 'issued-proof' } })));
    expect(verified).toHaveBeenLastCalledWith('issued-proof');
    expect(screen.getByRole('status')).toHaveTextContent('Verification complete');
    act(() => widget.dispatchEvent(new CustomEvent('statechange', { detail: { state: 'expired' } })));
    expect(verified).toHaveBeenLastCalledWith('');
    expect(screen.getByRole('status')).toHaveTextContent('expired');
    fireEvent.click(screen.getByRole('button', { name: 'Retry verification' }));
    expect(container.querySelector('altcha-widget')).not.toBe(widget);
    expect(verified).toHaveBeenLastCalledWith('');
    rerender(<AuthCaptcha action="reset-password" onVerified={verified} resetKey={1} />);
    expect(container.querySelector('altcha-widget')!.getAttribute('challengeurl')).toContain('action=reset-password');
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
});
