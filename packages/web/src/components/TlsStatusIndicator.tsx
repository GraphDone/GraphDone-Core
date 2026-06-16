import React from 'react';
import { createPortal } from 'react-dom';
import { ShieldOff, AlertTriangle, X } from 'lucide-react';

const DISMISS_KEY = 'tlsBannerDismissed';

function readConnection() {
  const isSecure = window.location.protocol === 'https:';
  const isLocalhost =
    window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  return { isSecure, isLocalhost };
}

interface InsecureConnectionBannerProps {
  /** Render as a fixed full-width strip pinned to the very top (for pages that
   *  have no app chrome to sit under, e.g. the auth screens). Default is an
   *  in-flow strip that pushes the content below it down. */
  fixed?: boolean;
  /** Called when the user dismisses the strip, so a parent can drop any layout
   *  offset it added to make room for the (fixed) banner. */
  onDismiss?: () => void;
  className?: string;
}

/** Whether the current connection should trigger an insecure-connection warning
 *  (i.e. not HTTPS). Lets a layout reserve space for the fixed banner. */
export function isInsecureConnection(): boolean {
  return typeof window !== 'undefined' && window.location.protocol !== 'https:';
}

/**
 * A slim, dismissible warning strip shown ONLY when the connection is not
 * encrypted (HTTP). It lives in the document flow (or pinned to the top edge
 * for chrome-less pages) instead of floating in a corner, so it never overlaps
 * the rest of the UI. Dismissal is remembered for the browser session.
 */
export function InsecureConnectionBanner({ fixed = false, onDismiss, className = '' }: InsecureConnectionBannerProps) {
  const { isSecure, isLocalhost } = readConnection();
  const [dismissed, setDismissed] = React.useState(
    () => typeof sessionStorage !== 'undefined' && sessionStorage.getItem(DISMISS_KEY) === '1'
  );

  // Nothing to warn about on HTTPS, or once the user has dismissed it.
  if (isSecure || dismissed) return null;

  const dismiss = () => {
    try {
      sessionStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* storage may be unavailable; dismissing for this mount is enough */
    }
    setDismissed(true);
    onDismiss?.();
  };

  const tone = isLocalhost
    ? 'bg-yellow-500/15 border-yellow-600/40 text-yellow-200'
    : 'bg-red-500/15 border-red-600/40 text-red-200';
  const position = fixed ? 'fixed top-0 inset-x-0 z-[60]' : 'w-full';

  const strip = (
    <div
      role="status"
      data-testid="insecure-connection-banner"
      className={`${position} flex items-center justify-center gap-2 border-b px-4 py-1.5 text-xs sm:text-sm backdrop-blur-sm ${tone} ${className}`}
    >
      {isLocalhost ? <AlertTriangle size={14} className="flex-shrink-0" /> : <ShieldOff size={14} className="flex-shrink-0" />}
      <span className="text-center">
        {isLocalhost
          ? 'Development mode — this connection is not encrypted (HTTP).'
          : 'Insecure connection — this site is served over HTTP, not HTTPS.'}
      </span>
      <button
        onClick={dismiss}
        title="Dismiss"
        aria-label="Dismiss insecure-connection warning"
        className="ml-1 flex-shrink-0 rounded p-0.5 opacity-70 transition-opacity hover:opacity-100 hover:bg-white/10"
      >
        <X size={14} />
      </button>
    </div>
  );

  // When pinned, portal to <body> so a transformed/blur ancestor (route
  // transitions, backdrop-filter) can't turn `fixed` into a clipped/offset box.
  return fixed && typeof document !== 'undefined' ? createPortal(strip, document.body) : strip;
}
