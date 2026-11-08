import { useRef,useState } from 'react';
import { useGraph } from '../contexts/GraphContext';
import { exportProject,importOffline,offlineEnabled } from '../lib/offline/engine';

/** Lives inside the project selector so transferring work never requires leaving the graph. */
export function ProjectTransfer() {
 const {currentGraph}=useGraph();
 const input=useRef<HTMLInputElement>(null);
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
 if(!offlineEnabled)return null;
 const act=async(fn:()=>Promise<string>)=>{setBusy(true);setError('');setMessage('');try{setMessage(await fn());}catch(e){setError(e instanceof Error?e.message:'Unable to transfer project');}finally{setBusy(false);}};
 const button='min-h-[44px] rounded-lg border border-gray-600 px-3 py-2 text-sm text-gray-100 hover:bg-gray-700 disabled:opacity-50';
 return <section aria-label="Project import and export" className="border-b border-gray-600 p-3 space-y-2">
  <p className="text-sm text-gray-200 break-words">Transfer {currentGraph?.name||'a project'}</p>
  <div className="flex flex-wrap gap-2">
   <button className={button} disabled={busy||!currentGraph} onClick={()=>void act(async()=>{await exportProject(currentGraph!.id,'json');return 'Project JSON downloaded.';})}>Export JSON</button>
   <button className={button} disabled={busy||!currentGraph} onClick={()=>void act(async()=>{await exportProject(currentGraph!.id,'mermaid');return 'Mermaid diagram downloaded.';})}>Export Mermaid</button>
   <button className={button} disabled={busy} onClick={()=>input.current?.click()}>Import project</button>
   <input ref={input} aria-label="Import project JSON" className="sr-only" type="file" accept=".json,application/json" disabled={busy} onChange={e=>{const file=e.target.files?.[0];e.target.value='';if(file)void act(async()=>{const copies=await importOffline(file);return `Imported ${copies.length} project${copies.length===1?'':'s'} as new copies. Choose them in Projects below.`;});}}/>
  </div>
  <p className="text-xs text-gray-400">JSON restores tasks, connections and notes. Mermaid shares a diagram. Imports create new copies.</p>
  {message&&<p role="status" className="text-sm text-emerald-200">{message}</p>}
  {error&&<p role="alert" className="text-sm text-red-200">{error}</p>}
 </section>;
}
