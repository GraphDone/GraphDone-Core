import { createPortal } from 'react-dom';
import { X, Users } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { TurnstileChallenge } from './TurnstileChallenge';
import { CodeCaptcha } from './CodeCaptcha';
import { useModalA11y } from '../hooks/useModalA11y';

interface GuestModeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (token?: string) => void;
  turnstileSiteKey?: string;
  guestDescription?: string;
}

export function GuestModeDialog({ isOpen, onClose, onConfirm, guestDescription, turnstileSiteKey }: GuestModeDialogProps) {
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [guestCaptchaVerified, setGuestCaptchaVerified] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  useModalA11y(dialogRef, { isOpen, label: 'Continue as Guest?' });

  useEffect(() => {
    if (!isOpen) { setGuestCaptchaVerified(false); setTurnstileToken(null); return; }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', close);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', close);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[999999999] flex items-center justify-center p-3 bg-black/75 backdrop-blur-sm" onClick={onClose}>
      <div ref={dialogRef} data-testid="guest-dialog" className="flex flex-col w-full max-w-lg max-h-[calc(100dvh-1.5rem)] min-h-0 rounded-2xl border border-gray-700 bg-gray-800 shadow-2xl overflow-hidden" onClick={event => event.stopPropagation()}>
        <header className="flex shrink-0 items-center gap-3 px-4 py-2 border-b border-gray-700">
          <Users className="h-5 w-5 shrink-0 text-purple-300" />
          <h2 className="flex-1 text-lg font-semibold text-gray-100">Continue as Guest?</h2>
          <button aria-label="Close guest dialog" onClick={onClose} className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-700 hover:text-white"><X className="h-5 w-5" /></button>
        </header>
        <div data-testid="guest-dialog-content" className="min-h-0 overflow-y-auto overscroll-contain p-4 space-y-3">
          <p className="text-sm text-gray-300">{guestDescription || 'Explore public graphs and views without an account. Guest access is read-only; create an account to save and edit your work.'}</p>
          {turnstileSiteKey ? <TurnstileChallenge siteKey={turnstileSiteKey} onToken={setTurnstileToken} /> : <CodeCaptcha compact autoFocus={false} onVerified={() => setGuestCaptchaVerified(true)} />}
        </div>
        <footer className="flex shrink-0 gap-2 px-4 py-3 border-t border-gray-700">
          <button onClick={onClose} className="min-h-[44px] px-4 rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-700">Cancel</button>
          <button onClick={() => { onConfirm(turnstileToken || undefined); onClose(); }} disabled={turnstileSiteKey ? !turnstileToken : !guestCaptchaVerified} className="min-h-[44px] flex-1 px-3 rounded-lg bg-purple-600 text-white font-medium hover:bg-purple-500 disabled:bg-gray-700 disabled:text-gray-400 disabled:cursor-not-allowed">Continue as Guest</button>
        </footer>
      </div>
    </div>, document.body
  );
}
