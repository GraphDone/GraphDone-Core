import {taskAssignee} from '@graphdone/core';
import { ApolloLink,Observable } from '@apollo/client';
import { getMainDefinition } from '@apollo/client/utilities';
import { valueFromASTUntyped } from 'graphql';
import { getUserRaw } from '../authStorage';
import { offlineEnabled,ownerId,localGuest,primaryProjectId,sessionAccountId,listProjects,getProject } from './engine';
import { readAccount,editAccount } from './store';
import { Row,Snapshot } from './model';
const iso=(n:number)=>new Date(n*1000).toISOString();
const now=()=>Math.floor(Date.now()/1000);
function graph(row:Row,s?:Snapshot|null):any {
 return {__typename:'Graph',id:row.id,name:row.name,description:'',type:'PROJECT',status:'ACTIVE',parentGraphId:null,teamId:null,createdBy:row.owner_id,tags:[],defaultRole:'USER',depth:0,path:[],isShared:false,nodeCount:s?.nodes.length??row.node_count??0,edgeCount:s?.edges.length??row.edge_count??0,contributorCount:1,lastActivity:iso(row.created_at||now()),settings:JSON.stringify({theme:'dark',layout:'force',showPriorities:true,showDependencies:true,autoLayout:true,zoomLevel:1}),permissions:JSON.stringify({owner:row.owner_id,admins:[row.owner_id],editors:[],viewers:[],teamPermission:'VIEW'}),shareSettings:JSON.stringify({isPublic:false,allowTeamAccess:false,allowCopying:false,allowForking:false}),team:null,createdAt:iso(row.created_at||now()),updatedAt:iso(row.created_at||now()),workItems:[],subgraphs:[],parentGraph:null};
}
export function workItem(row:Row,s:Snapshot):any {
 const lite=(id:string)=>{const n=s.nodes.find(n=>n.id===id);return n?{__typename:'WorkItem',id:n.id,title:n.title,type:n.type,status:n.status}:null;};
 return {__typename:'WorkItem',id:row.id,title:row.title,type:row.type,description:row.description,status:row.status,priority:row.priority,positionX:row.position_x,positionY:row.position_y,positionZ:0,radius:0,theta:0,phi:0,dueDate:row.due_date,tags:JSON.parse(row.tags||'[]'),metadata:row.metadata||'{}',subgraphId:null,subgraph:null,owner:null,assignedTo:taskAssignee(row.metadata),graph:graph(s.project),contributors:[],dependencies:s.edges.filter(e=>e.source_id===row.id).map(e=>lite(e.target_id)).filter(Boolean),dependents:s.edges.filter(e=>e.target_id===row.id).map(e=>lite(e.source_id)).filter(Boolean),createdAt:iso(row.created_at||now()),updatedAt:iso(row.updated_at||now())};
}
function edge(row:Row,s:Snapshot):any {return {__typename:'Edge',id:row.id,type:row.type,weight:row.weight,createdBy:null,source:s.nodes.find(n=>n.id===row.source_id)?workItem(s.nodes.find(n=>n.id===row.source_id)!,s):null,target:s.nodes.find(n=>n.id===row.target_id)?workItem(s.nodes.find(n=>n.id===row.target_id)!,s):null,createdAt:iso(row.created_at||now())};}
function matches(row:any,where:any):boolean {
 if(!where)return true;
 return Object.entries(where).every(([key,value])=>key==='OR'?(value as any[]).some(w=>matches(row,w)):key==='AND'?(value as any[]).every(w=>matches(row,w)):typeof value==='object'&&value!==null?matches(row?.[key],value):row?.[key]===value);
}
function projectResult(value:any,selection:any,variables:any,fragments:Map<string,any>):any {
 if(value==null)return null;if(Array.isArray(value))return value.map(v=>projectResult(v,selection,variables,fragments));if(!selection)return value;
 const out:Record<string,any>={};
 for(const f of selection.selections) {
  if(f.kind==='FragmentSpread'){Object.assign(out,projectResult(value,fragments.get(f.name.value)?.selectionSet,variables,fragments));continue;}
  if(f.kind==='InlineFragment'){Object.assign(out,projectResult(value,f.selectionSet,variables,fragments));continue;}
  if(f.directives?.some((d:any)=>{const condition=valueFromASTUntyped(d.arguments[0].value,variables);return d.name.value==='skip'?condition:d.name.value==='include'?!condition:false;}))continue;
  out[f.alias?.value||f.name.value]=projectResult(value[f.name.value],f.selectionSet,variables,fragments);
 }
 return out;
}
const ref=(value:any)=>value?.connect?.where?.node?.id||value?.id;
const nodeFields:Record<string,string>={title:'title',description:'description',type:'type',status:'status',priority:'priority',positionX:'position_x',positionY:'position_y',dueDate:'due_date',tags:'tags',metadata:'metadata'};
function nodeUpdate(input:any) {
 const out:Record<string,any>={};
 for(const [key,col] of Object.entries(nodeFields))if(input[key]!==undefined) {
  const v=input[key];
  if(key==='title'&&(typeof v!=='string'||!v.trim()||v.length>200))throw Error('Use a task title of 1–200 characters.');
  if(key==='description'&&v!=null&&(typeof v!=='string'||v.length>4000))throw Error('Descriptions can contain up to 4000 characters.');
  if(['priority','positionX','positionY'].includes(key)&&(typeof v!=='number'||!Number.isFinite(v)))throw Error('Use a finite number.');
  if(key==='priority'&&(v<0||v>1))throw Error('Priority must be between 0 and 1.');
  if(key==='tags'&&(!Array.isArray(v)||v.length>50||v.some((t:any)=>typeof t!=='string'||t.length>100)))throw Error('Use up to 50 tags, each up to 100 characters.');
  if(key==='dueDate'&&v!=null&&(typeof v!=='string'||!Number.isFinite(Date.parse(v))))throw Error('Use a valid date.');
  out[col]=key==='tags'?JSON.stringify(v):key==='metadata'&&typeof v!=='string'?JSON.stringify(v):v;
  if(key==='metadata'&&out[col].length>10000)throw Error('Task notes and metadata can contain up to 10000 characters.');
 }
 return out;
}
async function findProject(args:any,table='nodes'):Promise<string> {
 const direct=args.where?.graph?.id||args.where?.source?.graph?.id||ref((Array.isArray(args.input)?args.input[0]:args.input)?.graph);
 if(direct)return direct;
 const id=args.where?.id||args.id||ref((Array.isArray(args.input)?args.input[0]:args.input)?.source)||args.where?.source?.id||args.where?.target?.id;
 const account=await readAccount(ownerId()!);
 if(id){for(const [pid,p] of Object.entries(account.projects))if((p.local?.[table as 'nodes']||[]).some(r=>r.id===id)||p.local?.nodes.some(r=>r.id===id))return pid;}
 return localStorage.getItem('currentGraphId')||Object.keys(account.projects)[0]||account.list[0]?.id;
}
const supported=new Set(['graphs','workItems','workItem','edges','createGraphs','updateGraphs','deleteGraphs','createWorkItems','updateWorkItems','deleteWorkItems','createEdges','updateEdges','deleteEdges','restoreWorkItem']);
export const offlineLink=new ApolloLink((operation,forward)=>{
 const def=getMainDefinition(operation.query) as any;
 if(!offlineEnabled||def.kind!=='OperationDefinition')return forward(operation);
 const fields=def.selectionSet.selections;
 const me=fields.length===1&&fields[0].name?.value==='me'&&!!(ownerId()||sessionAccountId());
 const guest=fields.length===1&&fields[0].name?.value==='guestLogin';
 if(!me&&!guest&&(!ownerId()||!fields.every((f:any)=>supported.has(f.name?.value))))return forward(operation);
 return new Observable(observer=>{
  let cancelled=false,fallback:any;
  (async()=>{
   const result:Record<string,any>={},fragments=new Map(operation.query.definitions.filter(d=>d.kind==='FragmentDefinition').map((d:any)=>[d.name.value,d]));
   for(const field of fields) {
    const name=field.name.value,args=Object.fromEntries((field.arguments||[]).map((a:any)=>[a.name.value,valueFromASTUntyped(a.value,operation.variables)]));
    let value:any;
    if(me){
     value=ownerId()?JSON.parse(getUserRaw()||'null'):(await readAccount(sessionAccountId()!)).user;
     if(!value){fallback=forward(operation).subscribe(observer);return;}
    }
    else if(guest) {
     const id=crypto.randomUUID();value={__typename:'AuthPayload',token:'local-guest',user:{__typename:'User',id,name:'Guest',username:'Guest',email:'',role:'GUEST',isActive:true,isEmailVerified:false,avatar:null,team:null}};
     await editAccount(id,a=>{a.listedAt=Date.now();});
    }else if(name==='graphs') {
     const list=await listProjects();const a=await readAccount(ownerId()!);
     value=list.map(p=>graph(p,a.projects[p.id]?.local)).filter(g=>matches(g,args.where));
     if(args.where?.id)for(const g of value){const s=await getProject(g.id);g.workItems=s.nodes.map(n=>workItem(n,s));}
    }else if(['workItems','workItem','edges'].includes(name)) {
     const id=await findProject(args,name==='edges'?'edges':'nodes'),s=await getProject(id);
     if(name==='workItem')value=s.nodes.find(n=>n.id===args.id)?workItem(s.nodes.find(n=>n.id===args.id)!,s):null;
     else {const all=name==='edges'?s.edges.map(e=>edge(e,s)):s.nodes.map(n=>workItem(n,s));value=all.filter(r=>matches(r,args.where)).slice(args.options?.offset||0,(args.options?.offset||0)+(args.options?.limit||10000));}
    }else {
     const owner=ownerId()!,user=JSON.parse(getUserRaw()||'{}');if(user.role==='VIEWER')throw Error('This account is read-only.');
     const graphOp=name.endsWith('Graphs'),table=name.endsWith('Edges')?'edges':'nodes';
     let pid=name==='restoreWorkItem'?args.input?.graphId:graphOp?args.where?.id:await findProject(args,table);
     if(name==='deleteGraphs'&&pid===primaryProjectId())throw Error('Your initial account project cannot be deleted.');
     if(name!=='createGraphs')await getProject(pid);
     value=await editAccount(owner,a=>{
      if(a.blocked==='validation'){a.retryAt=0;a.error='';delete a.blocked;}
      if(name==='createGraphs') {
       const occupied=new Set(a.list.filter(r=>!a.projects[r.id]||a.projects[r.id].base||a.projects[r.id].local).map(r=>r.id));for(const [id,p] of Object.entries(a.projects))if(p.base||p.local)occupied.add(id);
       const input=Array.isArray(args.input)?args.input:[args.input];if(occupied.size+input.length>100)throw Error('This account can hold 100 projects. Sync a project deletion before adding another.');
       const created=input.map((i:any)=>{
        if(!i.name?.trim())throw Error('A project name is required.');
        const id=crypto.randomUUID(),s:Snapshot={project:{id,name:i.name.slice(0,120),owner_id:owner,created_at:now(),sync_version:0},nodes:[],edges:[],notes:[]};a.projects[id]={base:null,local:s,checkedAt:Date.now()};return graph(s.project,s);
       });return {__typename:'GraphsMutationResponse',graphs:created};
      }
      const p=a.projects[pid],s=p?.local;if(!s)throw Error('Download this project before editing offline.');
      if(name==='restoreWorkItem') {
       const i=args.input;
       if(typeof i?.id!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(i.id))throw Error('The task recovery identity is invalid.');
       const parsedCreated=typeof i.createdAt==='string'?Math.floor(Date.parse(i.createdAt)/1000):now();
       const row:Row={id:i.id,title:'',type:'TASK',description:null,status:'PROPOSED',priority:0,position_x:0,position_y:0,due_date:null,tags:'[]',metadata:'{}',created_at:Number.isFinite(parsedCreated)?parsedCreated:now(),updated_at:now(),...nodeUpdate(i)};
       const located=Object.entries(a.projects).flatMap(([projectId,project])=>(project.local?.nodes||[]).filter(node=>node.id===i.id).map(node=>({projectId,node})));
       if(located.length) {
        const prior=located[0],keys:(keyof Row)[]=['id','title','type','description','status','priority','position_x','position_y','due_date','tags','metadata'];
        if(located.length===1&&prior.projectId===pid&&keys.every(key=>prior.node[key]===row[key]))return workItem(prior.node,s);
        throw Error('The task identity is already in use. No existing work was changed.');
       }
       if(s.nodes.length>=300)throw Error('This project can hold 300 tasks. Start another project to continue.');
       s.nodes.push(row);return workItem(row,s);
      }
      if(name==='updateGraphs'){if(args.update.name!==undefined)s.project.name=String(args.update.name).trim().slice(0,120);if(!s.project.name)throw Error('A project name is required.');return {__typename:'GraphsMutationResponse',graphs:[graph(s.project,s)]};}
      if(name==='deleteGraphs'){const count=s.nodes.length;p.local=null;return {__typename:'DeleteResponse',nodesDeleted:count,relationshipsDeleted:s.edges.length};}
      const deleted=name.startsWith('delete'),created=name.startsWith('create');
      if(deleted) {
       const ids=new Set(s[table].filter(row=>matches(table==='nodes'?workItem(row,s):edge(row,s),args.where)).map(r=>r.id));
       const before=s.edges.length;s[table]=s[table].filter(r=>!ids.has(r.id));
       if(table==='nodes')s.edges=s.edges.filter(e=>!ids.has(e.source_id)&&!ids.has(e.target_id));
       return {__typename:'DeleteResponse',nodesDeleted:table==='nodes'?ids.size:0,relationshipsDeleted:table==='nodes'?before-s.edges.length:ids.size};
      }
      let rows:Row[]=[];
      if(created)for(const i of args.input) {
       if(s[table].length>=(table==='nodes'?300:600))throw Error(table==='nodes'?'This project can hold 300 tasks. Start another project to continue.':'This project can hold 600 connections. Remove a connection before adding another.');
       const row:Row=table==='nodes'?{id:crypto.randomUUID(),title:'',type:'TASK',description:null,status:'PROPOSED',priority:0,position_x:0,position_y:0,due_date:null,tags:'[]',metadata:'{}',created_at:now(),updated_at:now(),...nodeUpdate(i)}:{id:crypto.randomUUID(),source_id:ref(i.source),target_id:ref(i.target),type:i.type||'DEPENDS_ON',weight:i.weight??1,created_at:now()};
       if(table==='nodes'&&(!row.title?.trim()||row.title.length>200))throw Error('Use a task title of 1–200 characters.');
       if(table==='edges'&&(row.source_id===row.target_id||!s.nodes.some(n=>n.id===row.source_id)||!s.nodes.some(n=>n.id===row.target_id)))throw Error('Choose two different tasks from this project.');
       s[table].push(row);rows.push(row);
      }else {
       rows=s[table].filter(row=>matches(table==='nodes'?workItem(row,s):edge(row,s),args.where));
       for(const row of rows)Object.assign(row,table==='nodes'?{...nodeUpdate(args.update),updated_at:now()}:args.update);
      }
      return table==='nodes'?{__typename:created?'CreateWorkItemsResponse':'UpdateWorkItemsResponse',workItems:rows.map(n=>workItem(n,s))}:{__typename:created?'CreateEdgesResponse':'UpdateEdgesResponse',edges:rows.map(e=>edge(e,s))};
     });
     // IndexedDB is already committed. The periodic uploader coalesces edits.
    }
    result[field.alias?.value||name]=projectResult(value,field.selectionSet,operation.variables,fragments);
   }
   if(!cancelled){observer.next({data:result});observer.complete();}
  })().catch(error=>{if(!cancelled)observer.error(error);});
  return()=>{cancelled=true;fallback?.unsubscribe();};
 });
});
