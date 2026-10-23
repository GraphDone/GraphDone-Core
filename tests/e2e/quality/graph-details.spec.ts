import {test,expect} from '@playwright/test';
import {login,TEST_USERS} from '../../lib/auth';
import {gql} from '../../lib/graphRequest';
const cloud=process.env.QC_BACKEND==='cloud';
const base=process.env.TEST_URL||'http://localhost:3127';
const api=process.env.QC_API_URL||'http://localhost:8797/api/graphql';
for(const [width,height] of [[390,844],[844,390],[1440,900]]){
 test(`Graph view keeps drafts and saves all details ${width} @graphfirst`,async({page})=>{
  test.setTimeout(90000);page.setDefaultTimeout(10000);
  expect(['localhost','127.0.0.1']).toContain(new URL(base).hostname);
  if(cloud)expect(['localhost','127.0.0.1']).toContain(new URL(api).hostname);
  await page.setViewportSize({width,height});let token='';
  if(cloud){token=(await (await page.request.post(new URL('/api/guest',api).href)).json()).token;await page.goto(base);await page.evaluate(token=>localStorage.setItem('authToken',token),token);}
  else await login(page,TEST_USERS.ADMIN);
  const request=async(query:string,variables:unknown={})=>{
   if(!cloud)return gql(page,query,variables);
   const body=await(await page.request.post(api,{headers:{Authorization:`Bearer ${token}`},data:{query,variables}})).json();
   expect(body.errors,JSON.stringify(body.errors)).toBeUndefined();return body.data;
  };
  const me=cloud?null:(await request('{me{id}}')).me.id;
  const graph=(await request('mutation($input:[GraphCreateInput!]!){createGraphs(input:$input){graphs{id}}}',{input:[{name:`Graph details ${width} ${Date.now()}`,type:'PROJECT',status:'ACTIVE',...(cloud?{}:{createdBy:me})}]})).createGraphs.graphs[0].id;
  let id='';
  try{
   id=(await request('mutation($input:[WorkItemCreateInput!]!){createWorkItems(input:$input){workItems{id}}}',{input:[{title:'Graph details task',type:'TASK',status:'PLANNED',positionX:400,positionY:300,positionZ:0,graph:{connect:{where:{node:{id:graph}}}}}]})).createWorkItems.workItems[0].id;
   // D1 selected non-default graph must also be supplied when reading lists.
   const saved=async()=>(await request('query($id:ID!,$g:ID!){workItems(where:{id:$id,graph:{id:$g}}){id title tags dueDate status}}',{id,g:graph})).workItems[0];
   await page.evaluate(id=>{localStorage.setItem('currentGraphId',id);localStorage.setItem('graphdone:viewMode','graph');},graph);
   await page.goto(base);
   const node=page.locator('.graph-container .node').first();
   await expect(node).toBeVisible();
   await node.locator('.node-edit-icon').click();
   await page.getByTestId('quick-status').getByRole('button',{name:'In Review',exact:true}).click();
   await expect(node.locator('.status-percentage-text')).toHaveText('In Review');
   await page.getByRole('button',{name:'Details & connections',exact:true}).click();
   const dialog=page.getByRole('dialog',{name:'Work item details',exact:true});
   await expect(dialog).toBeVisible();
   await dialog.locator('input[type="date"]').fill('2026-09-14');
   await dialog.getByPlaceholder('Add Tag').fill('graph-first');await page.keyboard.press('Enter');
   // Keep a human draft open for 16 seconds; controlled refetch coverage is in WorkItemDetailsModal.test.tsx.
   await page.waitForTimeout(16000);
   await expect(dialog.locator('input[type="date"]')).toHaveValue('2026-09-14');
   await expect(dialog.getByText('graph-first',{exact:true})).toBeVisible();
   await dialog.getByRole('button',{name:'Save changes to work item',exact:true}).click();
   await expect.poll(async()=>(await saved()).tags).toEqual(['graph-first']);
   expect((await saved()).dueDate).toContain('2026-09-14T23:59:59');
   await dialog.locator('input[type="date"]').fill('');
   await dialog.getByRole('button',{name:'Save changes to work item',exact:true}).click();
   await expect.poll(async()=>(await saved()).dueDate).toBeNull();
   await page.screenshot({path:`test-artifacts/quality/${cloud?'d1':'core'}-graph-details-${width}.png`});
   await dialog.getByRole('button',{name:'Close modal (ESC)',exact:true}).click();
   await expect(dialog).toHaveCount(0);
   expect(await page.evaluate(()=>localStorage.getItem('graphdone:viewMode'))).toBe('graph');
  }finally{
   if(id)await request('mutation($id:ID!){deleteWorkItems(where:{id:$id}){nodesDeleted}}',{id});
   await request('mutation($id:ID!){deleteGraphs(where:{id:$id}){nodesDeleted}}',{id:graph});
  }
 });
}
