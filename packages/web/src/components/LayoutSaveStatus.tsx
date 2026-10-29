import { useEffect, useState } from 'react';
import type { usePositionSaveQueue } from '../hooks/usePositionSaveQueue';

export function LayoutSaveStatus({ queue }: { queue: ReturnType<typeof usePositionSaveQueue> }) {
  const { state, error } = queue;
  const acknowledgedOnly = !!state?.acknowledged && !state.pending && !error && !state.storageError && !state.cleanupError && !state.sendError;
  const [ackExpired, setAckExpired] = useState(false);
  useEffect(() => {
    if (!acknowledgedOnly) { setAckExpired(false); return; }
    setAckExpired(false);
    const timer = setTimeout(() => setAckExpired(true), 3500);
    return () => clearTimeout(timer);
  }, [acknowledgedOnly]);
  if (acknowledgedOnly && ackExpired) return null;
  if (!error && (!state || !(state.pending || state.acknowledged || state.storageError || state.cleanupError || state.sendError))) return null;
  return (
    <div data-graph-fit-obstacle="true" data-testid="layout-save-status" data-layout-save-progress={!!state?.pending && !error && !state.storageError && !state.cleanupError && !state.sendError} role="status" className="max-w-full rounded-lg bg-gray-950/90 px-3 py-2 text-xs text-gray-100 shadow">
      {error && <p>{error}</p>}
      {state && <>
        {state.pending > 0 && <p>{state.local} saved on this device; {state.pending - state.local} pending only in this tab.</p>}
        {state.unsent > 0 && <p>Waiting to {state.networkBacked ? 'send' : 'save'} {state.unsent} layout change{state.unsent === 1 ? '' : 's'}.</p>}
        {state.cleanupPending > 0 && <p>The server accepted {state.cleanupPending} layout change{state.cleanupPending === 1 ? '' : 's'}. Device receipt cleanup is pending.</p>}
        {state.pending === 0 && state.acknowledged && <p>{state.networkBacked ? 'Layout saved to the server.' : 'Layout saved on this device. Check sync status for upload progress.'}</p>}
        {state.storageError && <p className="mt-1 text-amber-200">Layout recovery is unavailable: {state.storageError}{state.pending > state.local ? ' Keep this tab open.' : ''}</p>}
        {state.cleanupError && <p className="mt-1 text-amber-200">{state.cleanupError}</p>}
        {state.sendError && <p className="mt-1 text-amber-200">{state.sendError}</p>}
        {(state.pending > 0 || state.storageError) && <div className="mt-2 flex flex-wrap gap-3">
          <button type="button" disabled={queue.saving} onClick={() => void queue.flush()} className="min-h-11 rounded bg-blue-700 px-2 disabled:opacity-50">{state.cleanupPending && !state.unsent ? 'Retry receipt cleanup' : 'Retry layout save'}</button>
          {state.unsent > 0 && <button type="button" disabled={queue.saving} onClick={() => void queue.discard()} className="min-h-11 rounded bg-gray-700 px-2 disabled:opacity-50">Discard unsent layout</button>}
        </div>}
      </>}
    </div>
  );
}
