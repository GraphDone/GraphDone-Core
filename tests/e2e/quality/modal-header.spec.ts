import {test,expect} from '@playwright/test';
import {login,TEST_USERS} from '../../lib/auth';
import {gql} from '../../lib/graphRequest';
for(const [width,height] of [[390,844],[844,390],[1440,900]])test(`modal panels respect workspace header ${width} @responsive`,async({page})=>{
 test.setTimeout(90000);await page.setViewportSize({width,height});await login(page,TEST_USERS.ADMIN);
 const me=(await gql(page,'{me{id}}')).me.id;
 const graph=(await gql(page,'mutation($input:[GraphCreateInput!]!){createGraphs(input:$input){graphs{id}}}',{input:[{name:`Modal placement ${Date.now()}`,type:'PROJECT',status:'ACTIVE',createdBy:me}]})).createGraphs.graphs[0].id;
 try{
  await gql(page,'mutation($input:[WorkItemCreateInput!]!){createWorkItems(input:$input){workItems{id}}}',{input:[{title:'Review modal placement',type:'TASK',positionX:400,positionY:300,positionZ:0,graph:{connect:{where:{node:{id:graph}}}}}]} );
  await page.evaluate(id=>{localStorage.setItem('currentGraphId',id);localStorage.setItem('graphdone:viewMode','graph');},graph);await page.goto('/');await expect(page.locator('.graph-container .node')).toHaveCount(1);
  const check=async()=>{
   await expect(async()=>{
    const panel=page.locator('[data-modal-panel]').and(page.locator(':visible'));const box=(await panel.boundingBox())!;
    const bottom=await page.locator('[data-workspace-header]').evaluateAll(headers=>Math.max(0,...headers.filter(h=>h.getClientRects().length>0).map(h=>h.getBoundingClientRect().bottom)));
    expect(box.y).toBeGreaterThanOrEqual(height-bottom>=420?bottom+10:0);expect(box.y+box.height).toBeLessThanOrEqual(height);expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(width);
   }).toPass({timeout:3000});
  };
  await page.getByRole('button',{name:'New work item',exact:true}).click();await expect(page.getByRole('dialog',{name:'Create new work item',exact:true})).toBeVisible();await check();await page.screenshot({path:`test-artifacts/quality/modal-create-${width}.png`});await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);
  if(width>=768){await page.getByTestId('graph-selector').click();await page.getByRole('button',{name:'Create New Graph',exact:true}).click();await expect(page.getByRole('dialog',{name:'Create new graph'})).toBeVisible();await check();await page.keyboard.press('Escape');}
  await page.locator('.graph-container .node .node-edit-icon').click();await page.getByRole('button',{name:'Details & connections',exact:true}).click();await expect(page.getByRole('dialog',{name:'Work item details',exact:true})).toBeVisible();await check();await page.screenshot({path:`test-artifacts/quality/modal-details-${width}.png`});await page.keyboard.press('Escape');
 }finally{await gql(page,'mutation($id:ID!){deleteWorkItems(where:{graph:{id:$id}}){nodesDeleted}}',{id:graph});await gql(page,'mutation($id:ID!){deleteGraphs(where:{id:$id}){nodesDeleted}}',{id:graph});}
});
