import {test,expect} from '@playwright/test';
import {login,TEST_USERS} from '../../lib/auth';
import {gql} from '../../lib/graphRequest';
import {seedLargeGraph,deleteGraphDeep} from '../../lib/seedGraph';

for(const size of [12,50,200])test(`cards do not stack at ${size} nodes @layout @stress`,async({page},info)=>{
 test.setTimeout(120000);
 await page.setViewportSize({width:1440,height:900});await login(page,TEST_USERS.ADMIN);
 const seeded=await seedLargeGraph(page,{size,spacing:size===12?0:130,namePrefix:'Layout QC'});
 try{
  // Reproduce imported/saved collisions, including a completely stacked graph.
  if(size===12)for(const id of seeded.nodeIds)await gql(page,'mutation($id:ID!){updateWorkItems(where:{id:$id},update:{positionX:400,positionY:300}){workItems{id}}}',{id});
  await page.evaluate(id=>{localStorage.setItem('currentGraphId',id);localStorage.setItem('graphdone:viewMode','graph');},seeded.graphId);
  const start=Date.now();await page.goto('/');
  await expect(page.locator('.graph-container .node')).toHaveCount(size,{timeout:30000});
  await expect.poll(()=>page.evaluate(()=>(window as any).__layoutMetrics?.()?.overlappingNodePairs),{timeout:15000}).toBe(0);
  const metrics=await page.evaluate(()=>(window as any).__layoutMetrics?.());
  await info.attach('layout.json',{body:JSON.stringify({size,loadAndLayoutMs:Date.now()-start,metrics}),contentType:'application/json'});
  await page.screenshot({path:`test-artifacts/quality/layout-${size}.png`});
  await page.reload();
  await expect(page.locator('.graph-container .node')).toHaveCount(size);
  await expect.poll(()=>page.evaluate(()=>(window as any).__layoutMetrics?.()?.overlappingNodePairs),{timeout:10000}).toBe(0);
 }finally{await deleteGraphDeep(page,seeded.graphId);}
});
