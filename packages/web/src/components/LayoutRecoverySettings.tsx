import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useGraph } from '../contexts/GraphContext';
import { useLayoutRecovery } from '../hooks/usePositionSaveQueue';

export function LayoutRecoverySettings() {
  const { currentUser } = useAuth();
  const { availableGraphs } = useGraph();
  const recovery = useLayoutRecovery(currentUser?.id);
  const [confirm, setConfirm] = useState<string>();
  if (import.meta.env.VITE_OFFLINE_SYNC === 'true') return null;
  return (
    <section data-testid="layout-recovery-settings" className="bg-gray-800 border border-gray-700 rounded-lg p-6" aria-labelledby="layout-recovery-title">
      <h2 id="layout-recovery-title" className="text-lg font-semibold text-gray-100 mb-4">Pending layouts</h2>
      <p className="text-sm text-gray-300 mb-4">Return to an accessible graph to retry its pending layout. You can discard local changes here if a graph was deleted or you no longer have access. Discarding does not undo positions already saved to the server.</p>
      {recovery.error && <p role="alert" className="text-sm text-amber-200 mb-3">{recovery.error}</p>}
      {recovery.loading && <p className="text-sm text-gray-400">Checking this device for pending layouts…</p>}
      {!recovery.loading && !recovery.scopes.length && !recovery.error && <p className="text-sm text-gray-400">No pending layouts for this account on this device.</p>}
      <ul className="space-y-3">
        {recovery.scopes.map(scope => <li key={scope.graphId} data-testid={`layout-recovery-${scope.graphId}`} className="rounded border border-gray-600 p-3">
          <p className="font-medium text-gray-100 break-words">{availableGraphs.find(graph => graph.id === scope.graphId)?.name || 'Unavailable graph'}</p>
          <p className="text-sm text-gray-300 break-all">{scope.graphId}</p>
          <p className="text-sm text-gray-300 mb-2">{scope.count} pending position{scope.count === 1 ? '' : 's'}</p>
          {confirm === scope.graphId ? <div className="flex flex-wrap gap-3">
            <button type="button" disabled={recovery.busy} className="min-h-10 rounded bg-red-900 px-3 text-sm text-white disabled:opacity-50" onClick={() => { void recovery.discard(scope.graphId).then(() => setConfirm(undefined)); }}>Confirm discard</button>
            <button type="button" disabled={recovery.busy} className="min-h-10 rounded bg-gray-700 px-3 text-sm text-white disabled:opacity-50" onClick={() => setConfirm(undefined)}>Cancel</button>
          </div> : <button type="button" disabled={recovery.busy} className="min-h-10 rounded bg-gray-700 px-3 text-sm text-white disabled:opacity-50" onClick={() => setConfirm(scope.graphId)}>Discard pending layout</button>}
        </li>)}
      </ul>
    </section>
  );
}
