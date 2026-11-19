import { ArrowRight } from 'lucide-react';

export function SessionHandover({ account, replacing, busy, onContinue, onCancel }: {
  account: string | null;
  replacing: boolean;
  busy: boolean;
  onContinue: () => void;
  onCancel: () => void;
}) {
  return (
    <section aria-labelledby="session-handover-title" className="signin-card border border-stone-500/20 rounded-xl p-5 sm:p-8 lg:py-6 space-y-4">
      {account === null ? (
        <p id="session-handover-title" role="status" className="text-sm text-gray-300">Checking your sign-in link…</p>
      ) : (
        <>
          <h2 id="session-handover-title" className="text-lg font-semibold text-gray-100 break-words">Finish signing in as {account}?</h2>
          {replacing && <p className="text-sm text-amber-200">Continuing will replace the account signed in on this browser.</p>}
          <button
            type="button"
            onClick={onContinue}
            disabled={busy}
            className="w-full min-h-[44px] bg-gradient-to-r from-teal-600 to-blue-600 hover:from-teal-500 hover:to-blue-500 border border-teal-400/50 text-white font-semibold py-3 px-6 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
          >
            {busy ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" /> : <ArrowRight className="h-5 w-5" />}
            <span>Continue</span>
          </button>
          <button type="button" onClick={onCancel} disabled={busy} className="w-full min-h-[44px] text-teal-200 hover:text-teal-100 underline underline-offset-4 disabled:opacity-50">Cancel</button>
        </>
      )}
    </section>
  );
}
