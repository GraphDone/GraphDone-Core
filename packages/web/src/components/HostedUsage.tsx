import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { downloadCloudDrafts, hostedUsageEnabled, refreshHostedUsage, usageFraction, useHostedUsage } from '../lib/hostedUsage';

export function HostedUsage({ compact = false }: { compact?: boolean }) {
  const { currentUser } = useAuth();
  const { usage, error, drafts } = useHostedUsage();
  useEffect(() => {
    if (!hostedUsageEnabled || !currentUser) return;
    void refreshHostedUsage();
    const refresh = () => { if (!document.hidden) void refreshHostedUsage(); };
    const timer = setInterval(refresh,60000);
    document.addEventListener('visibilitychange',refresh);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange',refresh); };
  }, [currentUser?.id]);
  if (!hostedUsageEnabled || !currentUser) return null;
  const ratio = usageFraction(usage), paused = usage && usage.status !== 'AVAILABLE';
  const reset = usage ? new Date(usage.resetAt).toLocaleString([], {month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'}) : '';
  if (compact && !paused && ratio < .8 && !error && !drafts) return null;
  return <section data-testid={compact ? 'cloud-usage-banner' : 'cloud-usage'} aria-label="Cloud allowance" className={`${compact ? 'relative z-40 shrink-0 px-3 py-2 text-xs' : 'rounded-xl border p-4 text-sm'} border-amber-400/30 bg-gray-900 text-gray-100`}>
    <div className="flex flex-wrap items-center justify-between gap-2"><strong>{paused ? usage?.status==='PERSONAL_LIMIT' ? 'Your daily cloud allowance is used up' : 'Cloud sync is paused' : ratio>=.95 ? 'Almost at today’s cloud limit' : ratio>=.8 ? 'Approaching today’s cloud limit' : 'Free hosted allowance'}</strong>
      {compact ? <Link to="/settings" className="underline min-h-[32px] inline-flex items-center">View allowance</Link> : <button onClick={()=>void refreshHostedUsage(true)} className="min-h-[44px] px-3 rounded-lg border border-gray-600">Refresh usage</button>}
    </div>
    {error && <p role="status" className="mt-2 text-amber-200">{error}</p>}
    {usage && <>
      {!compact && <><p className="mt-2 text-gray-300">One allowance for all your projects, devices, and agents. Opening or saving work may use several database operations.</p>
        <dl className="mt-3 grid gap-2 sm:grid-cols-3">{(['operations','reads','writes'] as const).map(key=><div key={key}><dt className="text-gray-300">{key==='operations'?'Database operations':key==='reads'?'Rows read':'Rows written'}</dt><dd className="font-semibold tabular-nums">{usage.used[key].toLocaleString()} / {usage.limit[key].toLocaleString()}</dd><progress aria-label={key} className="mt-1 w-full accent-emerald-400" max={usage.limit[key]} value={Math.min(usage.used[key],usage.limit[key])}/></div>)}</dl>
        <p className="mt-3 text-gray-300">{usage.limits.projectsPerAccount || 100} projects per account; {usage.limits.tasksPerProject} tasks and {usage.limits.linksPerProject} links per project. {usage.kind==='guest'?'Guest work is temporary; access expires after 24 hours.':`Today’s account allocation uses ${usage.allocationShares} shares, based on recently active accounts with a minimum of 20. Tomorrow’s allowance may change.`}</p>
        {!!usage.rolloutOperations && <p className="mt-2 text-emerald-200">Includes {usage.rolloutOperations} one-time rollout operations today to cover older tabs refreshing before this update. This credit expires at the reset below.</p>}
        <p className="mt-2 text-gray-400">Row counters are measured after each database batch. A batch may cross a row limit; further cloud work then pauses. Shared service limits can pause work earlier. These hosting limits do not apply to self-hosted GraphDone Core.</p></>}
      <p className="mt-2 text-gray-300">Resets {reset}.{ratio>=.8?' Automatic refresh is paused to preserve your remaining allowance.':''}</p>
      {paused && <p className="mt-2 text-amber-200">{compact ? 'Keep unsaved text; check your project before retrying. No automatic sync.' : 'Keep this page open and copy any unsaved text. Check the project before retrying an unconfirmed save. Changes are not queued for automatic sync.'}</p>}
    </>}
    {!!drafts && <div className="mt-2 flex flex-wrap items-center gap-2"><p>{drafts} unconfirmed change{drafts===1?'':'s'} kept in this tab until it closes.</p><button onClick={downloadCloudDrafts} className="min-h-[44px] px-3 rounded-lg border border-amber-400/50">Download recovery copy</button></div>}
  </section>;
}
