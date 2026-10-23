export type Row = {id:string; [key:string]:any};
export type Snapshot = {project:Row; nodes:Row[]; edges:Row[]; notes:Row[]};
export type Change = {table:'nodes'|'edges'|'notes'; id:string; action:'put'|'delete'; value?:Row};
export type PendingRequest = {requestId:string;projectId:string;version:number;attempts?:number;name?:string;deleteProject?:boolean;changes:Change[];sent:Snapshot|null};
export type Project = {base:Snapshot|null;local:Snapshot|null;request?:PendingRequest;conflicts?:string[];remote?:Snapshot|null;checkedAt:number};
export type Account = {user?:Record<string,any>;projects:Record<string,Project>;list:Row[];listedAt:number;retryAt:number;error:string;blocked?:'auth'|'validation'};
export const emptyAccount = ():Account=>({projects:{},list:[],listedAt:0,retryAt:0,error:''});
export const same=(a:any,b:any):boolean=>JSON.stringify(a)===JSON.stringify(b);
const editable:Record<string,string[]>={nodes:['type','title','description','status','priority','position_x','position_y','due_date','tags','metadata'],edges:['source_id','target_id','type','weight'],notes:['work_item_id','body']};
export function changes(base:Snapshot|null,local:Snapshot|null):Change[] {
 const result:Change[]=[];
 for(const table of ['nodes','edges','notes'] as const) {
  const before=new Map((base?.[table]||[]).map(r=>[r.id,r])),after=new Map((local?.[table]||[]).map(r=>[r.id,r]));
  for(const [id,row] of after) if(!before.has(id)||editable[table].some(k=>!same(row[k],before.get(id)?.[k])))result.push({table,id,action:'put',value:row});
  for(const id of before.keys())if(!after.has(id))result.push({table,id,action:'delete'});
 }
 return result;
}
export function dirty(p:Project) {return !!p.request || (!!p.base!==!!p.local) || p.base?.project.name!==p.local?.project.name || changes(p.base,p.local).length>0;}
/** Three-way merge preserves disjoint human/agent edits; never resolves competing
 * edits or delete-vs-edit silently. Metadata is an atomic field. */
const equivalent=(a:Snapshot|null,b:Snapshot|null)=>!a&&!b || !!a&&!!b&&a.project.name===b.project.name&&changes(a,b).length===0;
export function merge(base:Snapshot|null,local:Snapshot|null,remote:Snapshot|null):{local:Snapshot|null;conflicts:string[]} {
 if(equivalent(base,local))return {local:structuredClone(remote),conflicts:[]};
 if(!remote || !local || !base) {
  if(equivalent(base,remote))return {local:structuredClone(local),conflicts:[]};
  if(equivalent(local,remote))return {local:structuredClone(remote),conflicts:[]};
  return {local:structuredClone(local),conflicts:['Project was created or deleted elsewhere']};
 }
 const conflicts:string[]=[],out=structuredClone(remote);
 function field(label:string,key:string,b:any,l:any,r:any) {
  if(same(l,b))return r;
  if(!same(r,b)&&!same(r,l))conflicts.push(`${label}: ${key}`);
  return l;
 }
 out.project.name=field('Project','name',base.project.name,local.project.name,remote.project.name);
 for(const table of ['nodes','edges','notes'] as const) {
  const b=new Map(base[table].map(r=>[r.id,r])),l=new Map(local[table].map(r=>[r.id,r])),r=new Map(remote[table].map(r=>[r.id,r]));
  const rows:Row[]=[];
  for(const id of new Set([...b.keys(),...l.keys(),...r.keys()])) {
   const before=b.get(id),mine=l.get(id),theirs=r.get(id),label=mine?.title||theirs?.title||id;
   if(!before||!mine||!theirs) {
    // Ignore server timestamps when deciding if a row was edited.
    const equals=(x:any,y:any)=>!!x===!!y && (!x||editable[table].every(k=>same(x[k],y[k])));
    if(equals(mine,before)){if(theirs)rows.push(theirs);}
    else if(equals(theirs,before)||equals(mine,theirs)){if(mine)rows.push(mine);}
    else {conflicts.push(`${label}: deleted or changed elsewhere`);if(mine)rows.push(mine);}
   }else{
    const row={...theirs};for(const key of editable[table])row[key]=field(label,key,before[key],mine[key],theirs[key]);rows.push(row);
   }
  }
  out[table]=rows;
 }
 // A remote deletion can leave a locally added connection dangling. Stop for review.
 const ids=new Set(out.nodes.map(n=>n.id));
 if(out.edges.some(e=>!ids.has(e.source_id)||!ids.has(e.target_id)))conflicts.push('A connection points to a deleted task');
 return {local:out,conflicts};
}
export function makeRequest(id:string,p:Project):PendingRequest {
 // Preserve dependencies in batches; delete edges before deleting their tasks.
 const delta=changes(p.base,p.local).sort((a,b)=>{
  const rank=(c:Change)=>c.action==='delete'?(c.table==='edges'?0:c.table==='notes'?1:2):(c.table==='nodes'?3:c.table==='edges'?4:5);
  return rank(a)-rank(b);
 });
 const selected:Change[]=[];let size=0;
 for(const ch of delta) {const n=new TextEncoder().encode(JSON.stringify(ch)).length;if(selected.length>=25||size+n>26000)break;selected.push(ch);size+=n;}
 if(delta.length&&!selected.length)throw Error('A change is too large to upload. Shorten its description or metadata.');
 const sent=p.local?structuredClone(p.base||{project:p.local.project,nodes:[],edges:[],notes:[]}):null;
 if(sent && p.local) {sent.project.name=p.local.project.name;for(const c of selected){sent[c.table]=sent[c.table].filter(r=>r.id!==c.id);if(c.action==='put')sent[c.table].push(c.value!);}}
 return {requestId:crypto.randomUUID(),attempts:0,projectId:id,version:p.base?.project.sync_version??-1,name:p.local?.project.name,deleteProject:!p.local,changes:p.local?selected:[],sent};
}

/** Backups are untrusted files. Reject malformed renderable values before they
 * can poison the persistent workspace; identity and upload requests are never imported. */
export function validateBackupSnapshot(s:any):asserts s is Snapshot {
 const fail=():never=>{throw Error('The backup contains an invalid project or item. Nothing was imported.');};
 const text=(v:any,max:number,optional=false)=>{if(optional&&v==null)return;if(typeof v!=='string'||v.length>max)fail();};
 const num=(v:any)=>{if(typeof v!=='number'||!Number.isFinite(v))fail();};
 if(!s?.project||!Array.isArray(s.nodes)||!Array.isArray(s.edges)||!Array.isArray(s.notes))fail();
 text(s.project.name,120);if(!s.project.name.trim()||s.nodes.length>300||s.edges.length>600||s.notes.length>2000)fail();
 const ids=new Set<string>();
 for(const n of s.nodes){text(n.id,128);if(ids.has(n.id))fail();ids.add(n.id);text(n.title,200);if(!n.title.trim())fail();text(n.description,4000,true);text(n.type,60);text(n.status,60);num(n.priority);if(n.priority<0||n.priority>1)fail();num(n.position_x);num(n.position_y);text(n.metadata,10000);text(n.tags,6000);
  try{const tags=JSON.parse(n.tags);if(!Array.isArray(tags)||tags.length>50||tags.some((t:any)=>typeof t!=='string'||t.length>100))fail();}catch{fail();}
  for(const key of ['created_at','updated_at'])if(n[key]!=null)num(n[key]);
  if(n.due_date!=null&&(typeof n.due_date!=='string'||!Number.isFinite(Date.parse(n.due_date))))fail();
 }
 const edgeIds=new Set<string>();for(const e of s.edges){text(e.id,128);if(edgeIds.has(e.id))fail();edgeIds.add(e.id);text(e.type,60);num(e.weight);if(!ids.has(e.source_id)||!ids.has(e.target_id)||e.source_id===e.target_id)fail();if(e.created_at!=null)num(e.created_at);}
 const noteIds=new Set<string>();for(const n of s.notes){text(n.id,128);if(noteIds.has(n.id))fail();noteIds.add(n.id);text(n.body,4000);text(n.actor,254);text(n.actor_type,60);if(typeof n.created_at!=='string'||!Number.isFinite(Date.parse(n.created_at)))fail();text(n.work_item_id,128,true);}
}

/** If an old receipt has expired, a retried create followed by a remote delete
 * is indistinguishable from an upload that never arrived. Require review rather
 * than silently resurrecting a task, connection, note, or project. */
export function ambiguousRetriedCreation(request:PendingRequest,base:Snapshot|null,local:Snapshot|null,remote:Snapshot|null):boolean {
 if((request.attempts??2)<=1||!local||request.deleteProject)return false;
 if(!base&&!remote)return true;
 return request.changes.some(c=>c.action==='put' && local[c.table].some(r=>r.id===c.id) && !base?.[c.table].some(r=>r.id===c.id) && !remote?.[c.table].some(r=>r.id===c.id));
}
