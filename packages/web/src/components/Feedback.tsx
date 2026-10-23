import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {MessageSquare} from 'lucide-react';
import {useAuth} from '../contexts/AuthContext';
import {useModalA11y} from '../hooks/useModalA11y';
import {operationsRequest,operationsURL} from '../lib/operations';
import {APP_VERSION} from '../utils/version';
export function FeedbackButton({compact=false,onOpen}:{compact?:boolean;onOpen?:()=>void}) {
 return <button type="button" title="Feedback and bug reports" aria-label="Feedback and bug reports" className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white" onClick={()=>{onOpen?.();window.dispatchEvent(new Event('graphdone-feedback'));}}><MessageSquare className="h-5 w-5 shrink-0"/>{!compact&&'Feedback & bugs'}</button>;
}
export function FeedbackHost() {
 const {currentUser}=useAuth();const [open,setOpen]=useState(false);
 useEffect(()=>{const show=()=>setOpen(true);window.addEventListener('graphdone-feedback',show);return()=>window.removeEventListener('graphdone-feedback',show);},[]);
 return open?<FeedbackForm key={currentUser?.id||'public'} owner={currentUser?.id||'public'} onClose={()=>setOpen(false)}/>:null;
}
function FeedbackForm({owner,onClose}:{owner:string;onClose:()=>void}) {
 const key='graphdone-feedback-draft:'+owner,panel=useRef<HTMLDivElement>(null);
 const blank=()=>({id:crypto.randomUUID(),kind:'bug',title:'',body:'',diagnostics:true});
 const [draft,setDraft]=useState(()=>{try{const d=JSON.parse(localStorage.getItem(key)||'null');return d&&typeof d.title==='string'&&typeof d.body==='string'?d:blank();}catch{return blank();}});
 const [error,setError]=useState(''),[receipt,setReceipt]=useState(''),[busy,setBusy]=useState(false),[saved,setSaved]=useState(true);
 useModalA11y(panel,{isOpen:true,label:'Feedback and bug reports'});
 useEffect(()=>{try{localStorage.setItem(key,JSON.stringify(draft));setSaved(true);}catch{setSaved(false);}},[draft,key]);
 useEffect(()=>{const keydown=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose();};window.addEventListener('keydown',keydown);return()=>window.removeEventListener('keydown',keydown);},[onClose]);
 const submit=async()=>{
  setError('');if(!navigator.onLine){setError('You are offline. Keep this draft and send it when you reconnect.');return;}setBusy(true);
  const context=draft.context??(draft.diagnostics?JSON.stringify({page:location.pathname,viewport:`${innerWidth}×${innerHeight}`,version:APP_VERSION,browser:navigator.userAgent.slice(0,300)}):'');
  setDraft({...draft,context});
  try{const r=await operationsRequest('/feedback','POST',{id:draft.id,kind:draft.kind,title:draft.title,body:draft.body,context});setReceipt(r.id);try{localStorage.removeItem(key);}catch{/* Keep receipt visible even if storage is unavailable. */}}catch(e){setError(e instanceof Error?e.message:'Unable to send; your draft is retained.');}finally{setBusy(false);}
 };
 const field='w-full min-w-0 rounded-lg border border-gray-600 bg-gray-950 p-2 text-gray-100';
 return createPortal(<div data-modal-backdrop className="fixed inset-0 z-[999999999] bg-black/70 flex items-center justify-center p-3" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}>
  <div ref={panel} data-modal-panel className="w-full max-w-lg rounded-xl border border-gray-600 bg-gray-900 text-gray-100 shadow-xl flex flex-col max-h-[calc(100dvh-24px)]">
   <div className="flex shrink-0 items-center justify-between gap-2 border-b border-gray-700 px-4 py-2"><h2 className="text-lg font-semibold">Help improve GraphDone</h2><button className="min-h-[44px] px-3" aria-label="Close feedback" onClick={onClose}>Close</button></div>
   <div className="overflow-y-auto min-h-0 p-4">
    {receipt?<div role="status"><p className="text-emerald-200">Received. Thank you—our team can now review your report.</p><p className="mt-2 break-all text-xs text-gray-400">Reference: {receipt}</p><button className="mt-4 min-h-[44px] rounded-lg border border-gray-600 px-3" onClick={()=>{setReceipt('');setDraft(blank());}}>New report</button></div>:<form className="space-y-3" onSubmit={e=>{e.preventDefault();void submit();}}>
     <label className="block text-sm">Type<select aria-label="Report type" className={field} value={draft.kind} onChange={e=>setDraft({...draft,kind:e.target.value})}><option value="bug">Something is broken</option><option value="idea">An idea or suggestion</option><option value="question">A question</option></select></label>
     <label className="block text-sm">Short summary<input required maxLength={160} className={field} value={draft.title} onChange={e=>setDraft({...draft,title:e.target.value})}/></label>
     <label className="block text-sm">What happened, or what would help?<textarea required maxLength={4000} rows={4} className={field} value={draft.body} onChange={e=>setDraft({...draft,body:e.target.value})} placeholder="What were you trying to do? What did you expect?"/></label>
     <label className="flex items-start gap-2 text-xs text-gray-300"><input type="checkbox" className="mt-1" checked={draft.diagnostics} onChange={e=>setDraft({...draft,diagnostics:e.target.checked})}/>Include this page’s path, screen size, browser and app version. No project contents or login tokens.</label>
     <p className="text-xs text-gray-400">Visible to this installation’s administrators and their authorized improvement agents. Don’t include passwords or private project data. Up to five reports per UTC day.</p>
     <p className="text-xs text-gray-400">{saved?'Draft saved on this device until you send it.':'Device storage is full. Keep this form open or copy your draft before leaving.'}</p>
     {error&&<><p role="alert" className="text-sm text-amber-200">{error}</p><button type="button" className="min-h-[44px] text-sm underline" onClick={()=>{setDraft({...draft,id:crypto.randomUUID(),context:undefined});setError('');}}>Use this text in a new report</button></>}
     <button disabled={busy} className="min-h-[44px] rounded-lg bg-emerald-700 px-4 py-2 text-white disabled:opacity-50">{busy?'Sending…':'Send feedback'}</button>
    </form>}
   </div>
  </div>
 </div>,document.body);
}
export function PublicAnnouncement() {
 const [message,setMessage]=useState('');
 useEffect(()=>{let active=true;void fetch(operationsURL()+'/announcement',{signal:AbortSignal.timeout(5000)}).then(r=>r.ok?r.json():null).then(d=>{if(active&&d?.enabled&&typeof d.message==='string')setMessage(d.message);}).catch(()=>{});return()=>{active=false;};},[]);
 return message?<aside aria-label="Service announcement" className="shrink-0 border-b border-amber-500/30 bg-amber-950 px-4 py-2 text-sm text-amber-100 break-words">{message}</aside>:null;
}
