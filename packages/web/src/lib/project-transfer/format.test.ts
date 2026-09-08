import {describe,it,expect} from 'vitest';
import {projectDocument,parseProjectDocument,projectMermaid,projectFilename} from './format';
import type {Snapshot} from '../offline/model';
export const example=():Snapshot=>({project:{id:'p',name:'Rocket science 🚀',owner_id:'private',sync_version:12},nodes:[{id:'a',title:'Plan "launch" <script> & end\n%%{init: evil}%%',type:'TASK',description:'Detailed notes',status:'IN_PROGRESS',priority:.8,position_x:-120.5,position_y:90,due_date:'2026-10-01',tags:'["science","家庭"]',metadata:'{"custom":true}',created_at:1,updated_at:2},{id:'b',title:'学生 🚀',type:'TASK',description:null,status:'PROPOSED',priority:0,position_x:200,position_y:50,due_date:null,tags:'[]',metadata:'{}'}],edges:[{id:'e',source_id:'a',target_id:'b',type:'DEPENDS_ON',weight:1}],notes:[{id:'n',work_item_id:'a',body:'Check the fuel',actor:'Engineer',actor_id:'private-agent',actor_type:'AGENT',created_at:'2026-09-08T00:00:00Z'}]});
describe('portable project format',()=>{
 it('round trips all supported content without sync state or credentials',()=>{
  const s=example(),doc=projectDocument(s),again=parseProjectDocument(JSON.parse(JSON.stringify(doc)));
  expect(again.nodes).toEqual(s.nodes);expect(again.edges).toEqual(s.edges);
  expect(again.notes[0].body).toBe(s.notes[0].body);expect(again.notes[0].work_item_id).toBe('a');
  expect(doc.nodes[0].tags).toEqual(['science','家庭']);expect(JSON.stringify(doc)).not.toMatch(/private|sync_version|actor_id|owner_id/);
  expect(projectDocument(again)).toEqual({...doc,exportedAt:expect.any(String)});
 });
 it.each(['version','duplicate','edge','note','tags','title','priority','limit'])('rejects malformed %s',kind=>{
  const d:any=projectDocument(example());
  if(kind==='version')d.version=99;if(kind==='duplicate')d.nodes.push(d.nodes[0]);
  if(kind==='edge')d.edges[0].target_id='missing';if(kind==='note')d.notes[0].work_item_id='missing';
  if(kind==='tags')d.nodes[0].tags=['a'.repeat(101)];if(kind==='title')d.nodes[0].title='';
  if(kind==='priority')d.nodes[0].priority=2;if(kind==='limit')d.nodes=Array.from({length:301},(_,i)=>({...d.nodes[0],id:String(i)}));
  expect(()=>parseProjectDocument(d)).toThrow();
 });
 it('accepts empty projects and preserves cycles and disconnected tasks',()=>{
  const s=example();s.edges.push({id:'e2',source_id:'b',target_id:'a',type:'RELATES_TO',weight:.5});
  expect(parseProjectDocument(projectDocument(s)).edges).toHaveLength(2);
  s.nodes=[];s.edges=[];s.notes=[];expect(parseProjectDocument(projectDocument(s)).nodes).toEqual([]);expect(projectMermaid(s)).toContain('flowchart TD');
 });
 it('quotes adversarial labels and assigns syntax-safe independent IDs',()=>{
  const s=example();s.edges[0].type='x"|\nclick task0 evil';const out=projectMermaid(s);
  expect(out).toContain('task0 -->|"');expect(out).toContain('#34;');expect(out).toContain('#60;script#62;');
  expect(out).not.toContain('<script>');expect(out).not.toContain('\nclick');expect(out).not.toContain('%%{init');
  expect(out.split('\n')).toHaveLength(6);
 });
 it('uses safe filenames',()=>{expect(projectFilename('../../evil<script>', 'json')).toBe('evilscript.json');expect(projectFilename('🚀','mmd')).toBe('graphdone-project.mmd');});
});

it('round trips the full supported project size',()=>{
 const s=example();s.nodes=Array.from({length:300},(_,i)=>({...s.nodes[0],id:'n'+i,title:'Task '+i}));
 s.edges=Array.from({length:600},(_,i)=>({id:'e'+i,source_id:'n'+(i%300),target_id:'n'+((i+1)%300),type:'DEPENDS_ON',weight:1}));
 s.notes=Array.from({length:2000},(_,i)=>({...s.notes[0],id:'note'+i,work_item_id:'n'+(i%300),body:'x'.repeat(4000)}));
 const restored=parseProjectDocument(JSON.parse(JSON.stringify(projectDocument(s))));
 expect(restored.nodes).toEqual(s.nodes);expect(restored.edges).toEqual(s.edges);expect(restored.notes).toHaveLength(2000);
 expect(projectMermaid(restored).split('\n')).toHaveLength(903);
 s.notes.push({...s.notes[0],id:'over'});expect(()=>projectDocument(s)).toThrow();
});
it('retains historical notes after their task was deleted, as project notes',()=>{
 const s=example();s.notes[0].work_item_id='deleted-task';
 const restored=parseProjectDocument(projectDocument(s));
 expect(restored.notes[0].work_item_id).toBeNull();expect(restored.notes[0].body).toBe('Check the fuel');
});
