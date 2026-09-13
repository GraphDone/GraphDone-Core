import { test, expect } from '@playwright/test';
import { login, TEST_USERS } from '../../lib/auth';
import { gql } from '../../lib/graphRequest';
import { randomUUID } from 'node:crypto';
for (const [width,height] of [[390,844],[844,390],[1440,900]]) test(`human and agent collaborate ${width} @agents`, async ({page,request}) => {
 test.setTimeout(120000); page.setDefaultTimeout(10000); await page.setViewportSize({width,height}); await login(page,TEST_USERS.ADMIN);
 const me=(await gql(page,'{me{id}}')).me.id;
 const graph=(await gql(page,'mutation($input:[GraphCreateInput!]!){createGraphs(input:$input){graphs{id}}}',{input:[{name:`Agent collaboration ${Date.now()}`,type:'PROJECT',status:'ACTIVE',createdBy:me}]})).createGraphs.graphs[0].id;
 let token='';
 try {
  const item=(await gql(page,'mutation($input:[WorkItemCreateInput!]!){createWorkItems(input:$input){workItems{id}}}',{input:[{title:'Prepare the launch',type:'TASK',graph:{connect:{where:{node:{id:graph}}}}}]})).createWorkItems.workItems[0].id;
  await page.evaluate(id=>{localStorage.setItem('currentGraphId',id);localStorage.setItem('graphdone:viewMode','graph');},graph);await page.goto('/');
  await page.getByRole('button',{name:width<768?'Work with your agent':'Your agent',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Work with your agent'});await expect(dialog.getByRole('button',{name:'Create agent token'})).toBeVisible();
  await dialog.getByLabel('Agent name').fill('Launch helper');await dialog.getByRole('button',{name:'Create agent token'}).click();
  const instructions=await dialog.getByLabel('Agent connection instructions').inputValue();token=instructions.match(/Bearer (gd_agent_\S+)/)![1];
  const base=instructions.match(/Base URL: (\S+)/)![1];
  const call=(path:string,method='GET',data?:object,credential=token,gid=graph)=>request.fetch(`${base}${path}?graphId=${gid}`,{method,headers:{Authorization:`Bearer ${credential}`},...(data?{data}:{})});
  await dialog.getByLabel('Note for your agent').fill('Please review launch priorities.');await dialog.getByRole('button',{name:'Leave note',exact:true}).click();
  await expect(dialog.getByLabel('Shared notes', {exact:true})).toContainText('Please review launch priorities.');
  const context=await (await call('/context')).json();expect(context.items[0].id).toBe(item);expect(context.notes.some((n:any)=>n.actorType==='human')).toBe(true);
  expect((await call('/items','PATCH',{id:item,status:'IN_REVIEW',priority:0.8})).status()).toBe(200);
  expect((await call('/notes','POST',{id:randomUUID(),body:'Ready for your review.',workItemId:item,actor:'Spoofed human'})).status()).toBe(201);
  await expect(dialog.getByLabel('Shared notes',{exact:true})).toContainText('Ready for your review.',{timeout:20000});
  expect((await call('/tokens','POST',{name:'Escalation',scope:'collaborate'})).status()).toBe(403);
  expect((await call('/context','GET',undefined,token,'different-project')).status()).toBe(401);
  expect((await call('/items','PATCH',{id:item,priority:2})).status()).toBe(400);
  expect((await call('/notes','POST',{id:randomUUID(),body:'Wrong task',workItemId:'other-project-item'})).status()).toBe(404);
  const updated=(await gql(page,'query($id:ID!){workItems(where:{id:$id}){status priority}}',{id:item})).workItems[0];expect(updated).toMatchObject({status:'IN_REVIEW',priority:0.8});
  await dialog.getByRole('button',{name:'Revoke Launch helper'}).click();await expect(dialog.getByLabel('Agent connections')).not.toContainText('Launch helper');expect((await call('/context')).status()).toBe(401);
  await dialog.getByLabel('Access',{exact:true}).selectOption('read');await dialog.getByRole('button',{name:'Create agent token'}).click();token=(await dialog.getByLabel('Agent connection instructions').inputValue()).match(/Bearer (gd_agent_\S+)/)![1];
  expect((await call('/context')).status()).toBe(200);expect((await call('/notes','POST',{body:'Unauthorized edit'})).status()).toBe(403);
  await dialog.getByRole('button',{name:'Hide token'}).click();await expect(dialog.getByRole('button',{name:'Close agent connection'})).toBeInViewport();await page.screenshot({path:`test-artifacts/quality/agent-collaboration-${width}.png`});
  await dialog.getByRole('button',{name:'Revoke Launch helper'}).click();await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);
 } finally { if (!page.isClosed()) await gql(page,'mutation($id:ID!){deleteWorkItems(where:{graph:{id:$id}}){nodesDeleted}}',{id:graph});await gql(page,'mutation($id:ID!){deleteGraphs(where:{id:$id}){nodesDeleted}}',{id:graph}); }
});
