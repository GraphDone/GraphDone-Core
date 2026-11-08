import {test,expect} from '@playwright/test';
import {login,TEST_USERS} from '../../lib/auth';
import {gql} from '../../lib/graphRequest';
import {TYPE_OPTIONS,STATUS_OPTIONS} from '../../../packages/web/src/constants/workItemConstants';
// Enumerate the offered controls, but independently verify each saved value.
for(const [width,height] of [[390,844],[1440,900]])test(`every quick editor type and status saves ${width} @controls`,async({page},info)=>{
 test.setTimeout(120000);await page.setViewportSize({width,height});await login(page,TEST_USERS.ADMIN);
 const me=(await gql(page,'{me{id}}')).me.id;
 const graph=(await gql(page,'mutation($input:[GraphCreateInput!]!){createGraphs(input:$input){graphs{id}}}',{input:[{name:`Controls QC ${Date.now()}`,type:'PROJECT',status:'ACTIVE',createdBy:me}]})).createGraphs.graphs[0].id;
 try{
  const id=(await gql(page,'mutation($input:[WorkItemCreateInput!]!){createWorkItems(input:$input){workItems{id}}}',{input:[{title:'Control coverage',type:'TASK',status:'PLANNED',positionX:400,positionY:300,positionZ:0,graph:{connect:{where:{node:{id:graph}}}}}]})).createWorkItems.workItems[0].id;
  const saved=async()=>(await gql(page,'query($id:ID!){workItems(where:{id:$id}){type status priority description}}',{id})).workItems[0];
  await page.evaluate(id=>{localStorage.setItem('currentGraphId',id);localStorage.setItem('graphdone:viewMode','graph');},graph);await page.goto('/');
  await page.locator('.graph-container .node .node-edit-icon').click();
  const exercised=[];
  for(const [field,options] of [['type',TYPE_OPTIONS],['status',STATUS_OPTIONS]] as const){
   for(const option of options.filter(o=>o.value!=='all')){
    const button=page.getByTestId(`quick-${field}`).getByRole('button',{name:option.label,exact:true});
    await button.click();await expect.poll(async()=>(await saved())[field]).toBe(option.value);
    await expect(button).toHaveAttribute('aria-pressed','true');exercised.push(`${field}:${option.value}`);
   }
  }
  await page.getByTestId('quick-description').fill('Description saved through the graph');await page.getByTestId('quick-description').blur();
  await expect.poll(async()=>(await saved()).description).toBe('Description saved through the graph');
  const priority=page.getByRole('slider',{name:'Priority'});await priority.focus();await priority.press('End');await priority.press('ArrowLeft');
  await expect.poll(async()=>(await saved()).priority).toBe(.95);
  await page.getByRole('button',{name:'Close quick edit',exact:true}).click();await expect(page.getByTestId('quick-edit-surface')).toHaveCount(0);
  await info.attach('controls.json',{body:JSON.stringify({width,exercised}),contentType:'application/json'});
 }finally{await gql(page,'mutation($id:ID!){deleteWorkItems(where:{graph:{id:$id}}){nodesDeleted}}',{id:graph});await gql(page,'mutation($id:ID!){deleteGraphs(where:{id:$id}){nodesDeleted}}',{id:graph});}
});
