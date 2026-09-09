import { test, expect } from '@playwright/test';
import { login, TEST_USERS } from '../../lib/auth';
import { gql } from '../../lib/graphRequest';
import scenarios from '../../fixtures/quality/personas.json';
const cloud=process.env.QC_BACKEND==='cloud';
const base=process.env.TEST_URL||'http://localhost:3127';
const api=process.env.QC_API_URL||'http://localhost:8797/api/graphql';
for(const scenario of scenarios) {
 test(`${scenario.id}: ${scenario.name} create → progress → return @personas`,async({page},info)=>{
  test.setTimeout(90000);
  page.setDefaultTimeout(12000);
  expect(['localhost','127.0.0.1']).toContain(new URL(base).hostname);
  if(cloud) expect(['localhost','127.0.0.1']).toContain(new URL(api).hostname);
  await page.setViewportSize(scenario.viewport);
  let token='';
  if(cloud){
   token=(await (await page.request.post(new URL('/api/guest',api).href)).json()).token;
   await page.goto(base);
   await page.evaluate(token=>localStorage.setItem('authToken',token),token);
  } else await login(page,TEST_USERS.ADMIN);
  const request=async(query:string,variables:unknown={})=>{
   if(!cloud)return gql(page,query,variables);
   const body=await (await page.request.post(api,{headers:{Authorization:`Bearer ${token}`},data:{query,variables}})).json();
   expect(body.errors,JSON.stringify(body.errors)).toBeUndefined();return body.data;
  };
  const me=cloud?null:(await request('{me{id}}')).me.id;
  const graph=(await request('mutation($input:[GraphCreateInput!]!){createGraphs(input:$input){graphs{id}}}',{input:[{name:`${scenario.id} ${Date.now()}`,type:'PROJECT',status:'ACTIVE',...(cloud?{}:{createdBy:me})}]})).createGraphs.graphs[0].id;
  const read=async()=>(await request('query($id:ID!){workItems(where:{graph:{id:$id}}){id title status dueDate metadata}}',{id:graph})).workItems;
  try{
   await page.evaluate(id=>{localStorage.setItem('currentGraphId',id);localStorage.setItem('graphdone:viewMode','graph');},graph);
   await page.goto(base);
   await page.getByRole('button',{name:'New work item',exact:true}).click();
   await page.getByPlaceholder('Enter a descriptive title for your work item').fill(scenario.input.title);
   if(scenario.id==='STUDENT-01') { const details=page.locator('[data-task-create] details');if(!await details.evaluate(el=>el.hasAttribute('open')))await details.locator('summary').click();await page.locator('#dueDate').fill('2026-09-12'); }
   await page.getByRole('button',{name:'Create Work Item',exact:true}).click();
   await expect.poll(async()=>(await read()).length).toBe(1);
   if(scenario.id==='STUDENT-01') expect((await read())[0].dueDate).toContain('2026-09-12T23:59:59');
   const node=page.locator('.graph-container svg .node').first();
   await expect(node).toBeVisible({timeout:15000});
   await node.locator('.node-edit-icon').click();
   const editor=page.getByTestId('quick-edit-surface');
   await expect(editor).toBeVisible();
   await expect(page.getByTestId('quick-title')).toHaveValue(scenario.input.title);
   await page.getByTestId('quick-note-input').fill(scenario.input.note);
   await page.getByTestId('quick-note-add').click();
   await expect.poll(async()=>JSON.stringify((await read())[0].metadata)).toContain(scenario.input.note);
   await page.getByTestId('quick-status').getByRole('button',{name:scenario.input.status,exact:true}).click();
   const status=scenario.input.status.toUpperCase().replaceAll(' ','_');
   await expect.poll(async()=>(await read())[0].status).toBe(status);
   await page.keyboard.press('Escape');
   await page.evaluate(()=>localStorage.setItem('graphdone:viewMode','activity'));
   await page.reload();
   await expect(page.getByText(scenario.input.note,{exact:true})).toBeVisible();
   await info.attach(scenario.id,{body:await page.screenshot({path:`test-artifacts/quality/${cloud?'d1':'core'}-${scenario.id}.png`}),contentType:'image/png'});
   await page.goto(`${base}/analytics`);
   await expect(page.getByTestId('metric-work-items')).toHaveText('1');
   await expect(page.getByTestId('metric-completed')).toHaveText(status==='COMPLETED'?'1':'0');
  } finally {
   for(const item of await read()) await request('mutation($id:ID!){deleteWorkItems(where:{id:$id}){nodesDeleted}}',{id:item.id});
   await request('mutation($id:ID!){deleteGraphs(where:{id:$id}){nodesDeleted}}',{id:graph});
  }
 });
}
