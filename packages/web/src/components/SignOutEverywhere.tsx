import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getToken, isKept, setToken } from '../lib/authStorage';
import { hostedUsageEnabled } from '../lib/hostedUsage';
import { handleSessionRevoked, isSessionRevoked } from '../lib/sessionRevoked';

export function SignOutEverywhere() {
  const { currentUser } = useAuth();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const token = getToken();
  if (!hostedUsageEnabled || !currentUser || currentUser.role === 'GUEST' || !token || token === 'local-guest') return null;

  const signOutOthers = async () => {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    let failure = 'Other devices could not be signed out. You are still signed in here.';
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || window.location.origin}/api/session/revoke-all`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        cache: 'no-store',
        signal: AbortSignal.timeout(15000),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok && typeof data.token === 'string' && data.token && getToken() === token) {
        setToken(data.token, isKept());
        setConfirming(false);
        setNotice({ ok: true, text: 'Other devices were signed out.' });
        return;
      }
      if (isSessionRevoked(data.code)) { handleSessionRevoked(token); return; }
      if (response.status === 429) failure = 'Too many attempts. Try again in a few minutes. You are still signed in here.';
    } catch {
      failure = 'The server could not be reached. You are still signed in here.';
    } finally {
      setBusy(false);
    }
    setNotice({ ok: false, text: failure });
  };

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 space-y-3">
      <h2 className="text-lg font-semibold text-gray-100">Signed-in devices</h2>
      {confirming ? (
        <div className="space-y-3">
          <p className="text-sm text-gray-300">Other browsers and devices will need to sign in again. Agent connections are not affected.</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={signOutOthers} disabled={busy} className="min-h-[44px] px-4 rounded-lg bg-red-700 text-white font-medium hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed">{busy ? 'Signing out…' : 'Confirm'}</button>
            <button type="button" onClick={() => setConfirming(false)} disabled={busy} className="min-h-[44px] px-4 rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-700 disabled:opacity-50">Cancel</button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => { setNotice(null); setConfirming(true); }} className="min-h-[44px] px-4 rounded-lg border border-red-500/50 text-red-200 hover:bg-red-950">Sign out of all devices</button>
      )}
      {notice && <p role={notice.ok ? 'status' : 'alert'} className={`text-sm ${notice.ok ? 'text-teal-300' : 'text-amber-200'}`}>{notice.text}</p>}
    </div>
  );
}
