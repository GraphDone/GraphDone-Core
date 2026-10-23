import {test, expect} from '@playwright/test';
import {login, TEST_USERS} from '../../lib/auth';
import {gql} from '../../lib/graphRequest';

 test('graph stays visible and clear of controls through gradual growth, shrink and rotation @motion', async ({page}) => {
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
   const accessible=async()=>{
    const bounds=await page.locator('.graph-container').evaluate(el=>{
     const viewport=el.getBoundingClientRect();
     const cards=Array.from(el.querySelectorAll('.node-bg')).map(n=>n.getBoundingClientRect());
     const obstacles=Array.from(document.querySelectorAll<HTMLElement>('[data-graph-fit-obstacle="true"]')).map(n=>({name:n.getAttribute('aria-label')||n.title||n.textContent,box:n.getBoundingClientRect()})).filter(o=>o.box.width>0&&o.box.height>0);
     const overlaps=cards.flatMap((card,index)=>obstacles.filter(({box})=>card.left<box.right-1&&card.right>box.left+1&&card.top<box.bottom-1&&card.bottom>box.top+1).map(o=>({card:index,control:o.name})));
     return {count:cards.length,inside:cards.every(card=>card.left>=viewport.left-1&&card.right<=viewport.right+1&&card.top>=viewport.top-1&&card.bottom<=viewport.bottom+1),overlaps};
    });
    expect(bounds.count).toBe(2);expect(bounds.inside).toBe(true);expect(bounds.overlaps).toEqual([]);
   };
   await expect(accessible).toPass({timeout:5000});
   const before=await positions();
   const translation=()=>page.locator('.graph-container .node').first().evaluate(element=>{
    const matrix=(element as SVGGraphicsElement).getScreenCTM()!;
    return {x:matrix.e,y:matrix.f};
   });
   // Include small desktop steps below the old 20% threshold. Each must reframe.
   for(const [width,height] of [[1100,750],[1200,800],[1320,850],[1440,900],[1920,1080],[1440,900],[1320,850],[1200,800],[390,844],[844,390],[390,844],[1440,900]]) {
    const previous=await translation();
    await page.setViewportSize({width,height});
    await expect.poll(async()=>{
     const current=await translation();
     return Math.hypot(current.x-previous.x,current.y-previous.y);
    },{timeout:3000}).toBeGreaterThan(1);
    await expect(accessible).toPass({timeout:3000});
    await page.screenshot({path:`test-artifacts/quality/resize-${width}-${height}.png`});
   }
   expect(await positions()).toEqual(before);
  } finally {
   await gql(page,'mutation($id:ID!){deleteWorkItems(where:{graph:{id:$id}}){nodesDeleted}}',{id:graph});
   await gql(page,'mutation($id:ID!){deleteGraphs(where:{id:$id}){nodesDeleted}}',{id:graph});
  }
 });
