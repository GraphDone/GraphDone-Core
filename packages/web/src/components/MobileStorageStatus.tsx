import {Link} from 'react-router-dom';
import {Cloud,CloudOff,AlertCircle} from 'lucide-react';
import {useOffline,offlineEnabled,localGuest} from '../lib/offline/engine';
import {useHostedUsage,hostedUsageEnabled} from '../lib/hostedUsage';
export function MobileStorageStatus({expanded=false}:{expanded?:boolean}){
 const state=useOffline(),{usage,error}=useHostedUsage();
 if(!offlineEnabled&&!hostedUsageEnabled)return null;
 const paused=!!usage&&usage.status!=='AVAILABLE';
 const problem=!!state.conflicts.length||!!state.error||!state.ready;
 const label=problem?'Storage needs attention':paused?'Saved locally · sync paused':!state.online?'Offline · saved locally':state.pending?'Saved locally · waiting to sync':localGuest()?'Saved on this device':'Storage & sync';
 const Icon=problem?AlertCircle:paused||!state.online?CloudOff:Cloud;
 return <Link to="/settings" aria-label={label+' — storage and allowance details'} data-testid="mobile-storage-status" className={expanded?'flex items-center gap-2 min-h-[44px] my-2 text-sm text-amber-100':'flex-1 flex flex-col items-center justify-center min-h-[44px] gap-0.5 text-gray-300'}>
  <Icon aria-hidden className={`h-5 w-5 ${problem||paused?'text-amber-300':''}`}/><span className={expanded?'':'text-[11px]'}>{expanded?label:problem?'Attention':paused?'Local only':state.pending?'Pending':'Storage'}</span>{expanded&&error&&<span className="sr-only">{error}</span>}
 </Link>;
}
