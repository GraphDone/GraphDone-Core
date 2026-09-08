import { useEffect,useState } from 'react';
import { offlineEnabled,useOffline,syncNow,exportOffline,importOffline,prepareOffline,resolveConflict,localGuest } from '../lib/offline/engine';
import { useAuth } from '../contexts/AuthContext';
export function OfflineStatus({compact=false}:{compact?:boolean}) {
 const {currentUser,logout}=useAuth(),state=useOffline();const [error,setError]=useState(''),[busy,setBusy]=useState(false),[persistent,setPersistent]=useState(false);
 useEffect(()=>{if(offlineEnabled)void navigator.storage?.persisted().then(setPersistent);},[]);
 if(!offlineEnabled||!currentUser)return null;
 const act=async(fn:()=>Promise<unknown>)=>{setBusy(true);setError('');try{await fn();}catch(e){setError(e instanceof Error?e.message:'Unable to complete');}finally{setBusy(false);}};
 const title=!state.ready ? state.error ? 'Device storage unavailable' : 'Checking device storage…' : state.conflicts.length?'Changes need your review':localGuest()?'Guest workspace · saved on this device':state.pending?`${state.pending} project${state.pending===1?'':'s'} saved on this device · waiting to sync`:!state.online?'Offline · saved on this device':state.syncing?'Syncing your work…':'Saved on this device';
 const button='min-h-[40px] px-3 py-2 rounded-lg border border-gray-600 disabled:opacity-50 text-sm';
 return <section aria-label="Offline storage and sync" data-testid="offline-status" className={`${compact?'shrink-0 px-3 py-1 text-xs':'rounded-xl border border-gray-600 p-4 text-sm'} bg-gray-900 text-gray-100`}>
  <div className="flex flex-wrap items-center justify-between gap-2"><span role="status">{title}</span>{compact?<a href="/settings" className="min-h-[32px] inline-flex items-center underline">Storage & sync</a>:<button className={button} disabled={busy||!state.online||state.retryAt>Date.now()||localGuest()} onClick={()=>void act(()=>syncNow(true))}>Sync now</button>}</div>
  {!compact&&<><p className="mt-2 text-gray-300">{state.available} projects available offline on this device. Changes upload automatically while GraphDone is open and cloud allowance is available. Agent activity appears after sync.</p>
   {localGuest()&&<p className="mt-2 text-amber-200">Guest projects stay on this device. Export a backup, then import it after signing in to put a copy in your account.</p>}
   {state.blocked==='auth'&&<button className={button} onClick={logout}>Sign in again to resume sync</button>}
   {state.blocked==='validation'&&<p className="mt-2 text-amber-200">Correct the pending work to resume uploads. Your changes remain on this device and in exported backups.</p>}
   {!!state.error&&<p role="status" className="mt-2 text-amber-200">{state.error}{state.retryAt>Date.now()&&state.retryAt<Number.MAX_SAFE_INTEGER?` Retry after ${new Date(state.retryAt).toLocaleString()}.`:''}</p>}
   <div className="mt-3 flex flex-wrap gap-2"><button className={button} disabled={busy||!state.online||localGuest()} onClick={()=>void act(prepareOffline)}>Download all projects for offline use</button><button className={button} disabled={busy} onClick={()=>void act(exportOffline)}>Export backup</button><label className={`${button} cursor-pointer`}>Import backup<input type="file" accept="application/json,.json" className="sr-only" disabled={busy} onChange={e=>{const f=e.target.files?.[0];if(f)void act(()=>importOffline(f));e.target.value='';}}/></label><button className={button} disabled={persistent||busy} onClick={()=>void act(async()=>{setPersistent(await navigator.storage.persist());})}>{persistent?'Device storage protected':'Protect device storage'}</button></div>
   <p className="mt-2 text-xs text-gray-400">Browser storage can be removed by clearing site data or by the browser. Keep an exported backup of important work. Token management, registration, and account administration require a connection. This device’s copy remains after signing out; use a private browser session on shared computers.</p>
  </>}
  {state.conflicts.map(c=><div key={c.id} className="mt-2 rounded-lg border border-amber-400/40 p-3"><strong>{c.name}</strong><p className="mt-1">Check these changes: {c.fields.slice(0,3).join('; ')}. Both versions are retained. Export a backup before choosing.</p><div className="mt-2 flex flex-wrap gap-2"><button disabled={busy} className={button} onClick={()=>void act(()=>resolveConflict(c.id,'local'))}>Keep my version</button><button disabled={busy} className={button} onClick={()=>void act(()=>resolveConflict(c.id,'cloud'))}>Use cloud version</button></div></div>)}
  {error&&<p role="alert" className="mt-2 text-red-200">{error}</p>}
 </section>;
}
