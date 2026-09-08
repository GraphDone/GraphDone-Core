import {test, expect} from '@playwright/test';
import {login, TEST_USERS} from '../../lib/auth';
import {gql} from '../../lib/graphRequest';

 test('graph stays centered through gradual growth, shrink and rotation @motion', async ({page}) => {
  test.setTimeout(90000);
  await page.setViewportSize({width:1000,height:700});
  await login(page,TEST_USERS.ADMIN);
  const me=(await gql(page,'{me{id}}')).me.id;
  const graph=(await gql(page,'mutation($input:[GraphCreateInput!]!){createGraphs(input:$input){graphs{id}}}',{input:[{name:`Resize QC ${Date.now()}`,type:'PROJECT',status:'ACTIVE',createdBy:me}]})).createGraphs.graphs[0].id;
  const positions=async()=>(await gql(page,'query($id:ID!){workItems(where:{graph:{id:$id}}){id positionX positionY}}',{id:graph})).workItems.sort((a:any,b:any)=>a.id.localeCompare(b.id));
  try {
   await gql(page,'mutation($input:[WorkItemCreateInput!]!){createWorkItems(input:$input){workItems{id}}}',{input:[{title:'First task',positionX:400,positionY:300},{title:'Second task',positionX:750,positionY:550}].map(n=>({...n,type:'TASK',status:'PLANNED',positionZ:0,graph:{connect:{where:{node:{id:graph}}}}}))});
   await page.evaluate(id=>{localStorage.setItem('currentGraphId',id);localStorage.setItem('graphdone:viewMode','graph');},graph);
   await page.goto('/');
   await expect(page.locator('.graph-container .node')).toHaveCount(2);
   const centered=async()=>{
    const bounds=await page.locator('.graph-container').evaluate(el=>{
     const viewport=el.getBoundingClientRect();
     const cards=Array.from(el.querySelectorAll('.node-bg')).map(n=>n.getBoundingClientRect());
     const left=Math.min(...cards.map(r=>r.left)),right=Math.max(...cards.map(r=>r.right));
     const top=Math.min(...cards.map(r=>r.top)),bottom=Math.max(...cards.map(r=>r.bottom));
     return {dx:Math.abs((left+right)/2-(viewport.left+viewport.width/2)),dy:Math.abs((top+bottom)/2-(viewport.top+viewport.height/2)),inside:left>=viewport.left&&right<=viewport.right&&top>=viewport.top&&bottom<=viewport.bottom};
    });
    expect(bounds.dx).toBeLessThan(3);expect(bounds.dy).toBeLessThan(3);expect(bounds.inside).toBe(true);
   };
   await expect(centered).toPass({timeout:5000});
   const before=await positions();
   // Every desktop step is below the old 20% threshold. Each must reframe.
   for(const [width,height] of [[1100,750],[1200,800],[1320,850],[1440,900],[1920,1080],[1440,900],[1320,850],[1200,800],[390,844],[844,390],[390,844],[1440,900]]) {
    await page.setViewportSize({width,height});
    await expect(centered).toPass({timeout:3000});
    await page.screenshot({path:`test-artifacts/quality/resize-${width}-${height}.png`});
   }
   expect(await positions()).toEqual(before);
  } finally {
   await gql(page,'mutation($id:ID!){deleteWorkItems(where:{graph:{id:$id}}){nodesDeleted}}',{id:graph});
   await gql(page,'mutation($id:ID!){deleteGraphs(where:{id:$id}){nodesDeleted}}',{id:graph});
  }
 });
