import { useSyncExternalStore } from 'react';
import { getToken,getUserRaw } from '../authStorage';
import { cloudFailure, skipBackgroundPoll } from '../hostedUsage';
import { changes,dirty,makeRequest,merge,Snapshot,Row,validateBackupSnapshot,ambiguousRetriedCreation } from './model';
import { readAccount,editAccount,channel } from './store';
import { PROJECT_FORMAT,parseProjectDocument,projectDocument,projectMermaid,projectFilename,downloadText } from '../project-transfer/format';
export const offlineEnabled=import.meta.env.VITE_OFFLINE_SYNC==='true';
export function sessionAccountId():string|null {try{const t=getToken();return t&&t!=='local-guest'?JSON.parse(atob(t.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).uid||null:null;}catch{return null;}}
export function ownerId():string|null {
 try {const token=getToken(),user=JSON.parse(getUserRaw()||'null');if(!token||!user?.id)return null;
  if(token==='local-guest')return user.id;
  const payload=JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));
  return payload.uid===user.id?user.id:null;
 }catch{return null;}
}
export function primaryProjectId():string|null {try{const token=getToken();return token&&token!=='local-guest'?JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).pid||null:null;}catch{return null;}}
export function localGuest() {return getToken()==='local-guest';}
let view={ready:false,pending:0,conflicts:[] as {id:string;name:string;fields:string[]}[],available:0,total:0,error:'',retryAt:0,online:navigator.onLine,syncing:false,blocked:undefined as 'auth'|'validation'|undefined};
const listeners=new Set<()=>void>();
export function useOffline(){return useSyncExternalStore(fn=>{listeners.add(fn);return()=>{listeners.delete(fn);};},()=>view);}
async function publish() {
 const owner=ownerId(),a=owner?await readAccount(owner):null;if(owner!==ownerId())return;
 view={...view,ready:true,pending:a?Object.values(a.projects).filter(dirty).length:0,conflicts:a?Object.entries(a.projects).filter(([,p])=>p.conflicts?.length).map(([id,p])=>({id,name:p.local?.project.name||p.base?.project.name||'Deleted project',fields:p.conflicts!})):[],available:a?Object.values(a.projects).filter(p=>p.local).length:0,total:a?a.list.length:0,error:a?.error||'',retryAt:a?.retryAt||0,blocked:a?.blocked,online:navigator.onLine};listeners.forEach(f=>f());
}
const baseURL=()=>`${import.meta.env.VITE_API_URL||location.origin}/api/sync`;
async function request(owner:string,path:string,body?:any) {
 if(owner!==ownerId())throw Error('Account changed; sync stopped.');
 const token=getToken(),response=await fetch(`${baseURL()}${path}`,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},cache:'no-store',signal:AbortSignal.timeout(15000),...(body?{body:JSON.stringify(body)}:{})});
 if(owner!==ownerId()||token!==getToken())throw Error('Account changed; sync stopped.');
 const data=await response.json().catch(()=>({message:'Sync service unavailable'}));
 if(!response.ok&&response.status!==409) {
  const validation=[400,413,422].includes(response.status);
  let retry=validation||response.status===401||response.status===403?Number.MAX_SAFE_INTEGER:response.status===429?Date.parse(data.resetAt)||Date.now()+Math.max(60,Number(response.headers.get('Retry-After'))||60)*1000:Date.now()+(response.status>=500?60000:300000);
  // Personal shares can recover when other accounts go idle. Recheck hourly;
  // shared exhaustion still waits for the service reset. Denied work never reaches D1.
  if(response.status===429&&data.code==='PERSONAL_LIMIT')retry=Math.min(retry,Date.now()+3600000);
  await editAccount(owner,a=>{a.retryAt=retry;a.blocked=validation?'validation':response.status===401||response.status===403?'auth':undefined;if(validation&&body?.projectId&&a.projects[body.projectId])delete a.projects[body.projectId].request;a.error=response.status===401?'Sign in again to upload. Your local work is retained.':data.message||data.error||'Sync paused. Your local work is retained.';});
  cloudFailure(data.code);throw Error(data.message||data.error||'Sync paused');
 }
 return {data,status:response.status};
}
async function canConnect(owner:string) {return navigator.onLine&&!localGuest()&&(await readAccount(owner)).retryAt<=Date.now();}
const loading=new Map<string,Promise<any>>();
function once<T>(key:string,fn:()=>Promise<T>):Promise<T> {const running=loading.get(key);if(running)return running;const p=fn().finally(()=>loading.delete(key));loading.set(key,p);return p;}
export async function listProjects(force=false):Promise<Row[]> {
 const owner=ownerId();if(!owner)throw Error('Sign in or continue as guest.');
 return once(`list:${owner}`,async()=>{
  let a=await readAccount(owner);
  if((force||Date.now()-a.listedAt>60000)&&await canConnect(owner))try {
   const {data}=await request(owner,'/projects');
   await editAccount(owner,state=>{state.list=data.projects;state.listedAt=Date.now();});
  }catch(error){if(!a.listedAt&&!Object.keys(a.projects).length)throw error;}
  a=await readAccount(owner);const list=new Map(a.list.map(p=>[p.id,p]));
  for(const [id,p] of Object.entries(a.projects)){if(p.local)list.set(id,p.local.project);else list.delete(id);}
  return [...list.values()];
 });
}
export async function getProject(id:string,force=false):Promise<Snapshot> {
 const owner=ownerId();if(!owner)throw Error('Sign in first.');
 return once(`project:${owner}:${id}`,async()=>{
  let p=(await readAccount(owner)).projects[id];
  if((!p||force)&&await canConnect(owner)) {
   try {const {data}=await request(owner,`/project?id=${encodeURIComponent(id)}`);await acceptRemote(owner,id,data.snapshot);p=(await readAccount(owner)).projects[id];}
   catch(e){if(!p?.local)throw e;}
  }
  if(!p?.local)throw Error('This project is not available on this device yet. Reconnect and open it to download an offline copy.');
  return p.local;
 });
}
async function acceptRemote(owner:string,id:string,remote:Snapshot|null,ack?:string) {
 await editAccount(owner,a=>{
  const p=a.projects[id];
  if(!p){a.projects[id]={base:remote,local:structuredClone(remote),checkedAt:Date.now()};return;}
  // Never replace an unresolved conflict through background refresh.
  if(p.conflicts?.length)return;
  if(p.request&&!ack)return; // resolve uncertain acknowledgement before pulling
  const base=ack&&p.request?.requestId===ack?p.request.sent:p.base;
  const result=merge(base,p.local,remote);
  a.projects[id]={base:remote,local:result.local,conflicts:result.conflicts,remote:result.conflicts.length?remote:undefined,checkedAt:Date.now()};
 });
}
export async function syncNow(manual=false,scheduled=false) {
 const owner=ownerId();if(!offlineEnabled||!owner||localGuest()||(!navigator.onLine&&!scheduled))return;
 if(!navigator.locks) {await editAccount(owner,a=>{a.error='This browser cannot coordinate safe sync between tabs. Export a backup and use a current browser.';});return;}
 await navigator.locks.request(`graphdone-sync:${owner}`,{ifAvailable:true},async lock=>{
  if(!lock)return;
  const a=await readAccount(owner);
  // Manual retry can retry expired authentication after a fresh sign-in, but
  // cannot bypass a quota recheck deadline by repeatedly pressing a button.
  if(a.retryAt>Date.now())return;
  const hasDirty=Object.values(a.projects).some(dirty);
  // A scheduled dirty upload is also the bounded connectivity probe. Browser
  // online hints can be stale; the request result is authoritative. Never use
  // this exception for clean background reads.
  if(!navigator.onLine&&!hasDirty)return;
  if(!hasDirty && !manual && (skipBackgroundPoll() || !Object.entries(a.projects).some(([id,p])=>localStorage.getItem('currentGraphId')===id && Date.now()-p.checkedAt>60000)))return;
  view={...view,syncing:true};listeners.forEach(f=>f());
  try {
   for(const [id] of Object.entries(a.projects).sort(([,a],[,b])=>Number(!!a.local)-Number(!!b.local))) {
    if(owner!==ownerId()||(!navigator.onLine&&!scheduled))break;
    const p=(await readAccount(owner)).projects[id];if(p.conflicts?.length)continue;
    if(!dirty(p)) {
     if(manual||(!skipBackgroundPoll() && (localStorage.getItem('currentGraphId')===id)&&Date.now()-p.checkedAt>60000))await getProject(id,true);
     continue;
    }
    const pending=await editAccount(owner,state=>{const current=state.projects[id];const request=current.request ||= makeRequest(id,current);request.attempts=request.attempts===undefined?2:request.attempts+1;return request;});
    const {sent,attempts,...payload}=pending;
    const {data,status}=await request(owner,'/project',payload);
    if(status===409) {
     const remote=data.snapshot===undefined?(await request(owner,`/project?id=${encodeURIComponent(id)}`)).data.snapshot:data.snapshot;
     await editAccount(owner,state=>{delete state.projects[id].request;});
     await acceptRemote(owner,id,remote);
     await editAccount(owner,state=>{const current=state.projects[id];if(ambiguousRetriedCreation(pending,p.base,current.local,remote)){current.remote=remote;current.conflicts=[...(current.conflicts||[]),'An earlier creation could not be confirmed; review it before adding it again'];}});
    }else await acceptRemote(owner,id,data.snapshot,pending.requestId);
   }
   await editAccount(owner,state=>{state.error='';state.retryAt=0;delete state.blocked;});
  } catch(e) {
   // A timeout may have committed. The exact request stays on disk for replay.
   await editAccount(owner,state=>{if(!state.error)state.error=e instanceof Error?e.message:'Sync unavailable';state.retryAt=Math.max(state.retryAt,Date.now()+60000);});
  } finally {view={...view,syncing:false};await publish();window.dispatchEvent(new Event('graphdone-sync-refresh'));}
 });
}
export async function resolveConflict(id:string,choice:'local'|'cloud') {
 const owner=ownerId();if(!owner)return;
 await editAccount(owner,a=>{const p=a.projects[id];if(!p?.conflicts?.length)return;
  if(choice==='cloud')p.local=structuredClone(p.remote??null);
  else if(p.local) {const ids=new Set(p.local.nodes.map(n=>n.id));p.local.edges=p.local.edges.filter(e=>ids.has(e.source_id)&&ids.has(e.target_id));}
  p.base=p.remote??null;delete p.remote;delete p.conflicts;delete p.request;a.error='';
 });
 window.dispatchEvent(new Event('graphdone-sync-refresh'));void syncNow();
}
export async function prepareOffline() {const list=await listProjects(true);for(const p of list){const owner=ownerId();if(!owner||!await canConnect(owner))break;await getProject(p.id);}}
export async function exportOffline() {
 const owner=ownerId();if(!owner)return;
 const account=await readAccount(owner);delete account.user;delete account.layoutOutbox;delete account.layoutFences;
 const blob=new Blob([JSON.stringify({format:'graphdone-offline-v1',exportedAt:new Date().toISOString(),account},null,2)],{type:'application/json'});
 const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='graphdone-offline-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
}
export async function exportProject(id:string,format:'json'|'mermaid') {
 const snapshot=await getProject(id);
 downloadText(format==='json'?JSON.stringify(projectDocument(snapshot),null,2):projectMermaid(snapshot),projectFilename(snapshot.project.name,format==='json'?'json':'mmd'),format==='json'?'application/json':'text/plain');
}
export async function importOffline(file:File) {
 if(file.size>50*1024*1024)throw Error('Backup is too large (50 MB maximum).');
 let data:any;try{data=JSON.parse(await file.text());}catch{throw Error('This file is not valid JSON. Mermaid files are diagrams; import a GraphDone JSON export to restore work.');}
 const owner=ownerId();
 if(data?.format===PROJECT_FORMAT){const snapshot=parseProjectDocument(data);data={format:'graphdone-offline-v1',account:{projects:{project:{local:snapshot}}}};}
 if(data?.format!=='graphdone-offline-v1'||!data.account?.projects||Array.isArray(data.account.projects)||typeof data.account.projects!=='object'||!owner)throw Error('Choose a GraphDone offline backup while signed in.');
 // Import as NEW local projects. Never replay another account's requests/ids.
 if(Object.keys(data.account.projects).length>100)throw Error('Import at most 100 projects at a time.');
 const copies:Snapshot[]=[];
 for(const p of Object.values(data.account.projects) as any[]) {
  if(!p||typeof p!=='object')throw Error('Invalid project in backup');
  if(!p.local)continue;const s=p.local as Snapshot;validateBackupSnapshot(s);
  if(!s.project||typeof s.project.name!=='string'||!Array.isArray(s.nodes)||!Array.isArray(s.edges)||!Array.isArray(s.notes))throw Error('Invalid project in backup');
  if(s.nodes.length>300||s.edges.length>600||s.notes.length>2000)throw Error('A project exceeds the supported import size.');
  const ids=new Map(s.nodes.map(n=>[n.id,crypto.randomUUID()]));
  copies.push({project:{...s.project,id:crypto.randomUUID(),owner_id:owner,sync_version:0,name:`${s.project.name.slice(0,105)} (imported)`},nodes:s.nodes.map(n=>({...n,id:ids.get(n.id)!})),edges:s.edges.map(e=>({...e,id:crypto.randomUUID(),source_id:ids.get(e.source_id),target_id:ids.get(e.target_id)})),notes:s.notes.map(n=>({...n,id:crypto.randomUUID(),work_item_id:ids.get(n.work_item_id)||null}))});
 }
 if(!copies.length)throw Error('This file contains no projects to import.');
 if(owner!==ownerId())throw Error('Account changed. Please import again.');
 await editAccount(owner,a=>{const ids=new Set(a.list.map(p=>p.id));for(const [id,p] of Object.entries(a.projects)){if(p.local)ids.add(id);else ids.delete(id);}
 if(ids.size+copies.length>100)throw Error('Import would exceed 100 projects. Remove unused projects or import fewer projects.');
 for(const s of copies)a.projects[s.project.id]={base:null,local:s,checkedAt:Date.now()};});
 window.dispatchEvent(new Event('graphdone-sync-refresh'));void syncNow();
 return copies.map(s=>({id:s.project.id,name:s.project.name}));
}
function storageError(e:unknown){view={...view,ready:false,error:e instanceof Error?e.message:'Device storage unavailable'};listeners.forEach(f=>f());}
let observedToken=getToken();
if(offlineEnabled) {
 void publish().catch(storageError);
 const changed=()=>{void publish().catch(storageError);};channel?.addEventListener('message',event=>{changed();if(event.data===ownerId())window.dispatchEvent(new Event('graphdone-sync-refresh'));});window.addEventListener('graphdone-local-change',changed);
 window.addEventListener('online',()=>{changed();void syncNow();});window.addEventListener('offline',changed);
 window.addEventListener('graphdone-session',()=>{
  changed();const owner=ownerId(),token=getToken();
  if(owner){const user=JSON.parse(getUserRaw()||'null');void readAccount(owner).then(async a=>{if(JSON.stringify(a.user)!==JSON.stringify(user))await editAccount(owner,state=>{state.user=user;});}).catch(storageError);}
  if(owner && token!==observedToken){observedToken=token;void editAccount(owner,a=>{if(a.blocked==='auth'){a.retryAt=0;a.error='';delete a.blocked;}}).then(()=>syncNow());}
 });
 setInterval(()=>{if(!document.hidden)void syncNow(false,true);},60000);
}
