import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type {} from 'altcha';
import { CodeCaptcha } from './CodeCaptcha';

type Action = 'login' | 'signup' | 'magic-link' | 'forgot-password' | 'reset-password';

/** Core advertises server verification in /config. Older/Cloud backends retain
 * their existing contract; a failed policy request never becomes a success. */
export function AuthCaptcha({ action, onVerified, onReadyChange, resetKey = 0, autoFocus = false, compact = false, className = '' }: {
  action: Action;
  onVerified: (payload: string) => void;
  onReadyChange?: (ready: boolean) => void;
  resetKey?: number;
  autoFocus?: boolean;
  compact?: boolean;
  className?: string;
}) {
  const [policy, setPolicy] = useState<'loading' | 'altcha' | 'legacy' | 'error'>('loading');
  const [ready, setReady] = useState(false);
  const [requiredActions, setRequiredActions] = useState<string[] | null>(null);
  const [reload, setReload] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState('Complete verification before continuing.');
  const widget = useRef<HTMLElement>(null);
  const focusOnMount = useRef(autoFocus);
  const callback = useRef(onVerified);
  callback.current = onVerified;
  const readiness = useRef(onReadyChange);
  readiness.current = onReadyChange;
  const optional = policy === 'legacy' && (action === 'login' || action === 'signup')
    || policy === 'altcha' && requiredActions !== null && !requiredActions.includes(action);
  const apiUrl = (import.meta.env.VITE_API_URL || window.location.origin).replace(/\/$/, '');

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    let active = true;
    callback.current('');
    readiness.current?.(false);
    setPolicy('loading');
    void (async () => {
      try {
        const response = await fetch(`${apiUrl}/config`, { signal: controller.signal });
        if (!response.ok) throw new Error('Verification policy unavailable');
        const config = await response.json();
        if (config.captcha?.provider === 'altcha') {
          await import('altcha');
          if (active) {
            setRequiredActions(Array.isArray(config.captcha.requiredActions) ? config.captcha.requiredActions : null);
            setReady(true); setPolicy('altcha');
          }
        } else if (active) setPolicy('legacy');
      } catch {
        if (active) setPolicy('error');
      } finally { window.clearTimeout(timeout); }
    })();
    return () => { active = false; controller.abort(); window.clearTimeout(timeout); };
  }, [apiUrl, reload]);

  useLayoutEffect(() => {
    callback.current('');
    readiness.current?.(optional);
    setStatus('Complete verification before continuing.');
    const element = widget.current;
    if (!element) return;
    const changed = (event: Event) => {
      const { state, payload } = (event as CustomEvent<{ state: string; payload?: string }>).detail;
      callback.current(state === 'verified' && payload ? payload : '');
      readiness.current?.(optional || state === 'verified' && Boolean(payload));
      setStatus(state === 'verified' ? 'Verification complete.'
        : state === 'verifying' ? 'Verifying…'
        : state === 'expired' ? 'Verification expired. Please verify again.'
        : state === 'error' ? 'Verification failed. Please retry.'
        : 'Complete verification before continuing.');
    };
    element.addEventListener('statechange', changed);
    return () => element.removeEventListener('statechange', changed);
  }, [policy, ready, action, resetKey, attempt, optional]);

  useEffect(() => {
    const element = widget.current;
    const wideScreen = typeof window.matchMedia !== 'function' || window.matchMedia('(min-width: 1024px)').matches;
    if (!element || !(focusOnMount.current && wideScreen || attempt > 0 || reload > 0)) return;
    // The widget's autofocus option concerns verification completion. Focus its
    // initial control once on mode entry/retry, never when the user starts typing.
    const root = element.shadowRoot || element;
    const focus = () => {
      const input = root.querySelector<HTMLInputElement>('input[type="checkbox"]');
      input?.focus();
      return Boolean(input);
    };
    if (focus()) return;
    const observer = new MutationObserver(() => { if (focus()) observer.disconnect(); });
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [policy, ready, action, resetKey, attempt, reload]);

  if (policy === 'loading') return <p role="status" className="text-sm text-gray-300">Loading verification…</p>;
  if (policy === 'error') return <div role="alert" className={className}>
    <p>Verification is unavailable. Please try again.</p>
    <button type="button" onClick={() => setReload(value => value + 1)}>Retry verification</button>
  </div>;
  if (optional) return null;
  if (policy === 'legacy') return action === 'login' || action === 'signup' ? null
    : <CodeCaptcha key={`${action}:${resetKey}`} onVerified={onVerified} autoFocus={autoFocus} compact={compact} className={className} />;
  return <div className={className} role="group" aria-label="Verification" data-testid="server-captcha">
    {ready && <div key={`${action}:${resetKey}:${attempt}`}><altcha-widget ref={widget}
      challengeurl={`${apiUrl}/api/captcha/challenge?action=${action}`} expire={300000}
      disableautofocus={!autoFocus} hidefooter hidelogo
      style={{ '--altcha-max-width': '100%', '--altcha-color-base': '#1f2937', '--altcha-color-text': '#f3f4f6' }} /></div>}
    <p role="status" className="mt-1 text-sm text-gray-300">{status}</p>
    <button type="button" className="mt-1 text-sm text-teal-300 underline" onClick={() => {
      callback.current(''); readiness.current?.(false); setAttempt(value => value + 1);
    }}>Retry verification</button>
  </div>;
}
