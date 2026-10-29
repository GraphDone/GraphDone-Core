import { test, expect } from '@playwright/test';
import { login, TEST_USERS } from '../../lib/auth';
import { gql } from '../../lib/graphRequest';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
for (const [width,height] of [[390,844],[844,390],[1440,900]]) test(`human and agent collaborate ${width} @agents`, async ({page,request}, info) => {
 test.setTimeout(120000); page.setDefaultTimeout(10000); await page.setViewportSize({width,height}); await login(page,TEST_USERS.ADMIN);
 const me=(await gql(page,'{me{id}}')).me.id;
 const graph=(await gql(page,'mutation($input:[GraphCreateInput!]!){createGraphs(input:$input){graphs{id}}}',{input:[{name:`Agent collaboration ${Date.now()} — Coordinate the launch across design, engineering, quality, support and release management`,type:'PROJECT',status:'ACTIVE',createdBy:me}]})).createGraphs.graphs[0].id;
 let token=''; let base='';
 const audit = async (label: string) => {
  const panel=page.locator('[data-agent-connection]');
  const geometry=await panel.evaluate(el=>{
   const box=(target:Element)=>{const r=target.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
   const sections=[...el.querySelectorAll('section')].map(section=>({heading:section.querySelector('h3')?.textContent,box:box(section),overflow:section.scrollWidth-section.clientWidth}));
   const controls=[...el.querySelectorAll('input,select,textarea,button')].filter(x=>x.getClientRects().length).map(x=>({box:box(x),font:Number.parseFloat(getComputedStyle(x).fontSize),weight:Number.parseInt(getComputedStyle(x).fontWeight)}));
   return {panel:box(el),overflow:el.scrollWidth-el.clientWidth,sections,controls};
  });
  expect(geometry.overflow).toBeLessThanOrEqual(1);
  for(const section of geometry.sections)expect(section.overflow).toBeLessThanOrEqual(1);
  for(const control of geometry.controls){expect(control.box.height).toBeGreaterThanOrEqual(44);expect(control.box.x).toBeGreaterThanOrEqual(geometry.panel.x);expect(control.box.right).toBeLessThanOrEqual(geometry.panel.right);expect(control.font).toBeGreaterThanOrEqual(14);expect(control.weight).toBeGreaterThanOrEqual(500);}
  if(label==='initial'){
   const [setup,access,notes]=geometry.sections;
   if(width>=1024){expect(notes.box.x-setup.box.right).toBeGreaterThanOrEqual(16);expect(Math.abs(notes.box.y-setup.box.y)).toBeLessThanOrEqual(1);}
   else expect(notes.box.y-access.box.bottom).toBeGreaterThanOrEqual(16);
   expect(await panel.locator('details').first().getAttribute('open')).toBeNull();
  }
  const receipt=info.outputPath(`agent-${label}.json`);await writeFile(receipt,JSON.stringify(geometry,null,2));await info.attach(`agent-${label}-geometry`,{path:receipt,contentType:'application/json'});
  if(label==='handoff')await panel.getByRole('list',{name:'Shared notes',exact:true}).scrollIntoViewIfNeeded();
  else await panel.evaluate(el=>{el.scrollTop=0;});
  const screenshot=info.outputPath(`agent-${label}.png`);await page.screenshot({path:screenshot,mask:[page.getByLabel('Agent connection instructions')]});await info.attach(`agent-${label}`,{path:screenshot,contentType:'image/png'});
 };
 try {
  const item=(await gql(page,'mutation($input:[WorkItemCreateInput!]!){createWorkItems(input:$input){workItems{id}}}',{input:[{title:'Prepare the launch checklist with engineering, design, quality, support and release management',type:'TASK',graph:{connect:{where:{node:{id:graph}}}}}]})).createWorkItems.workItems[0].id;
  await page.evaluate(id=>{localStorage.setItem('currentGraphId',id);localStorage.setItem('graphdone:viewMode','graph');},graph);await page.goto('/');
  if(width<768 || (height<=500 && width<=1023)){await page.getByRole('button',{name:'More',exact:true}).click();await page.getByRole('button',{name:'Connect an agent to this project',exact:true}).click();}
  else await page.getByRole('button',{name:'Your agent',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Work with your agent'});await expect(dialog.getByRole('button',{name:'Create agent token'})).toBeVisible();
  await expect(dialog.getByRole('heading',{name:'Shared notes',exact:true})).toHaveCount(1);
  await audit('initial');
  await dialog.getByLabel('Agent name').fill('Launch helper');await dialog.getByRole('button',{name:'Create agent token'}).click();
  const instructions=await dialog.getByLabel('Agent connection instructions').inputValue();token=instructions.match(/Bearer (gd_agent_\S+)/)![1];
  base=instructions.match(/Base URL: (\S+)/)![1];
  const call=(path:string,method='GET',data?:object,credential=token,gid=graph)=>request.fetch(`${base}${path}?graphId=${gid}`,{method,headers:{Authorization:`Bearer ${credential}`},...(data?{data}:{})});
  await dialog.getByLabel('Note for your agent').fill('Please review launch priorities.');await dialog.getByRole('button',{name:'Leave note',exact:true}).click();
  await expect(dialog.getByLabel('Shared notes', {exact:true})).toContainText('Please review launch priorities.');
  const context=await (await call('/context')).json();expect(context.items[0].id).toBe(item);expect(context.notes.some((n:any)=>n.actorType==='human')).toBe(true);
  expect((await call('/items','PATCH',{id:item,status:'IN_REVIEW',priority:0.8})).status()).toBe(200);
  expect((await call('/notes','POST',{id:randomUUID(),body:'Ready for your review.',workItemId:item,actor:'Spoofed human'})).status()).toBe(201);
  await dialog.getByRole('button',{name:'Refresh shared notes',exact:true}).click();
  await expect(dialog.getByLabel('Shared notes',{exact:true})).toContainText('Ready for your review.');
  expect((await call('/tokens','POST',{name:'Escalation',scope:'collaborate'})).status()).toBe(403);
  expect((await call('/context','GET',undefined,token,'different-project')).status()).toBe(401);
  expect((await call('/items','PATCH',{id:item,priority:2})).status()).toBe(400);
  expect((await call('/notes','POST',{id:randomUUID(),body:'Wrong task',workItemId:'other-project-item'})).status()).toBe(404);
  const updated=(await gql(page,'query($id:ID!){workItems(where:{id:$id}){status priority}}',{id:item})).workItems[0];expect(updated).toMatchObject({status:'IN_REVIEW',priority:0.8});
  await dialog.getByRole('button',{name:'Revoke Launch helper'}).click();await expect(dialog.getByLabel('Agent connections')).not.toContainText('Launch helper');expect((await call('/context')).status()).toBe(401);
  await dialog.getByLabel('Access',{exact:true}).selectOption('read');await dialog.getByRole('button',{name:'Create agent token'}).click();token=(await dialog.getByLabel('Agent connection instructions').inputValue()).match(/Bearer (gd_agent_\S+)/)![1];
  expect((await call('/context')).status()).toBe(200);expect((await call('/notes','POST',{body:'Unauthorized edit'})).status()).toBe(403);
  await dialog.getByRole('button',{name:'Hide token'}).click();await expect(dialog.getByRole('button',{name:'Close agent connection'})).toBeInViewport();await audit('handoff');
  await dialog.getByRole('button',{name:'Revoke Launch helper'}).click();await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);
  await page.goto('/agents');await expect(page.getByRole('heading',{name:'Working with AI'})).toBeVisible();await expect(page.locator('[data-agent-connection]').getByRole('heading',{name:'Shared notes',exact:true})).toBeVisible();await audit('embedded');
 } finally { if(base&&!page.isClosed()){await page.evaluate(async ({base,graph})=>{const headers={Authorization:`Bearer ${localStorage.getItem('authToken')}`,'Content-Type':'application/json'};const response=await fetch(`${base}/tokens?graphId=${graph}`,{headers});if(!response.ok)throw Error('Owned agent credential cleanup could not list tokens');const data=await response.json();for(const token of data.tokens){const deleted=await fetch(`${base}/tokens?graphId=${graph}`,{method:'DELETE',headers,body:JSON.stringify({id:token.id})});if(!deleted.ok)throw Error('Owned agent credential cleanup failed');}},{base,graph});} if (!page.isClosed()) await gql(page,'mutation($id:ID!){deleteWorkItems(where:{graph:{id:$id}}){nodesDeleted}}',{id:graph});await gql(page,'mutation($id:ID!){deleteGraphs(where:{id:$id}){nodesDeleted}}',{id:graph}); }
});
