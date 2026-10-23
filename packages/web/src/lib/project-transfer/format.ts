import { Snapshot, Row, validateBackupSnapshot } from '../offline/model';

export const PROJECT_FORMAT = 'graphdone-project';
const pick = (row:Row, keys:string[]) => Object.fromEntries(keys.filter(k=>row[k]!==undefined).map(k=>[k,row[k]]));
const fields = {
 nodes: ['id','title','type','description','status','priority','position_x','position_y','due_date','tags','metadata','created_at','updated_at'],
 edges: ['id','source_id','target_id','type','weight','created_at'],
 notes: ['id','work_item_id','body','actor','actor_type','created_at'],
};
/** Explicit allowlist keeps credentials, account identifiers and sync internals out. */
export function projectDocument(snapshot:Snapshot) {
 validateBackupSnapshot(snapshot);
 return {format:PROJECT_FORMAT,version:1,exportedAt:new Date().toISOString(),
  project:pick(snapshot.project,['id','name','created_at']),
  nodes:snapshot.nodes.map(n=>({...pick(n,fields.nodes),tags:JSON.parse(n.tags)})),
  edges:snapshot.edges.map(e=>pick(e,fields.edges)),notes:snapshot.notes.map(n=>({...pick(n,fields.notes),work_item_id:snapshot.nodes.some(task=>task.id===n.work_item_id)?n.work_item_id:null}))};
}
export function parseProjectDocument(data:unknown):Snapshot {
 const d=data as any;
 if(d?.format!==PROJECT_FORMAT||d.version!==1)throw Error('Choose a GraphDone project JSON file (version 1) or an offline backup.');
 if(!Array.isArray(d.nodes)||!Array.isArray(d.edges)||!Array.isArray(d.notes))throw Error('Project must contain nodes, edges and notes arrays.');
 const snapshot:Snapshot={project:d.project,nodes:d.nodes.map((n:any)=>{
  if(!n||!Array.isArray(n.tags))throw Error('Task tags must be an array of strings.');
  return {...n,tags:JSON.stringify(n.tags)};
 }),edges:d.edges,notes:d.notes};
 validateBackupSnapshot(snapshot);
 const ids=new Set(snapshot.nodes.map(n=>n.id));
 if(snapshot.notes.some(n=>n.work_item_id!=null&&!ids.has(n.work_item_id)))throw Error('A note refers to a task missing from this project. Nothing was imported.');
 // Normalize through the export allowlist, including untrusted project properties.
 return {project:pick(snapshot.project,['id','name','created_at']),nodes:snapshot.nodes.map(n=>pick(n,fields.nodes) as Row),edges:snapshot.edges.map(n=>pick(n,fields.edges) as Row),notes:snapshot.notes.map(n=>pick(n,fields.notes) as Row)} as Snapshot;
}
/** Mermaid decimal entities keep user text inside quoted labels, never syntax/HTML. */
const label=(s:string)=>Array.from(s.replace(/[\r\n\t]+/g,' ')).map(c=>/^[a-zA-Z0-9 ,._-]$/.test(c)?c:`#${c.codePointAt(0)};`).join('');
export function projectMermaid(snapshot:Snapshot):string {
 validateBackupSnapshot(snapshot);
 const ids=new Map(snapshot.nodes.map((n,i)=>[n.id,`task${i}`]));
 const lines=['flowchart TD','  %% GraphDone diagram. Use JSON export for a restorable project.'];
 for(const n of snapshot.nodes)lines.push(`  ${ids.get(n.id)}["${label(n.title)} (${label(n.status)})"]`);
 for(const e of snapshot.edges)lines.push(`  ${ids.get(e.source_id)} -->|"${label(e.type)}"| ${ids.get(e.target_id)}`);
 return lines.join('\n')+'\n';
}
export function projectFilename(name:string,extension:'json'|'mmd') {
 const base=name.normalize('NFKC').replace(/[^\p{L}\p{N} _-]/gu,'').trim().slice(0,80)||'graphdone-project';
 return `${base}.${extension}`;
}
export function downloadText(contents:string,name:string,type:string) {
 const url=URL.createObjectURL(new Blob([contents],{type})),a=document.createElement('a');
 a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
}
