import {test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {login,TEST_USERS} from '../../lib/auth';
import {gql} from '../../lib/graphRequest';

// Translation stability is separate from intentional color/scale animation.
// Measure every animation frame, so a screenshot between shakes cannot pass.
for(const [width,height] of [[390,844],[844,390],[1440,900]]) {
 test(`graph settles after real drags, edits and rotation ${width} @motion`,async({page},info)=>{
  test.setTimeout(100000);
  await page.setViewportSize({width,height});
  await login(page,TEST_USERS.ADMIN);
  const me=(await gql(page,'{me{id}}')).me.id;
  const graph=(await gql(page,'mutation($input:[GraphCreateInput!]!){createGraphs(input:$input){graphs{id}}}',{input:[{name:`Motion QC ${width} ${Date.now()}`,type:'PROJECT',status:'ACTIVE',createdBy:me}]})).createGraphs.graphs[0].id;
  try{
   await gql(page,'mutation($input:[WorkItemCreateInput!]!){createWorkItems(input:$input){workItems{id}}}',{input:[
    {title:'Drag this task',positionX:400,positionY:300},
    {title:'Keep this task still',positionX:750,positionY:550},
   ].map(n=>({...n,type:'TASK',status:'IN_PROGRESS',positionZ:0,graph:{connect:{where:{node:{id:graph}}}}}))});
   await page.evaluate(id=>{localStorage.setItem('currentGraphId',id);localStorage.setItem('graphdone:viewMode','graph');},graph);
   await page.goto('/');
   const node=page.locator('.graph-container .node').filter({hasText:'Drag this task'});
   await expect(node).toBeVisible();
   const lock = page.getByTestId('graph-lock-toggle');
   if (await lock.isVisible()) {
     if ((await lock.textContent())?.trim() === 'Locked') await lock.click();
     await expect(lock).toHaveText('Editing');
   }
   await page.getByRole('button',{name:'Zoom to fit — frame all nodes'}).click();
   await expect.poll(()=>page.evaluate(()=>(window as any).__layoutMetrics?.()?.atRest)).toBe(true);
   const translation = () => node.evaluate(element => { const matrix = (element as SVGGraphicsElement).getScreenCTM(); return { x: matrix!.e, y: matrix!.f }; });
   await expect(async()=>{const a=await translation();await page.waitForTimeout(120);const b=await translation();expect(Math.abs(a.x-b.x)+Math.abs(a.y-b.y)).toBeLessThan(0.1);}).toPass({timeout:3000});
   const before=(await gql(page,'query($id:ID!){workItems(where:{graph:{id:$id}}){title positionX positionY}}',{id:graph})).workItems.find((n:any)=>n.title==='Drag this task');
   const box=await node.boundingBox();
   await page.mouse.move(box!.x+box!.width/2,box!.y+box!.height/2);
   await page.mouse.down();
   await page.mouse.move(box!.x+box!.width/2+45,box!.y+box!.height/2+35,{steps:24});
   await page.mouse.up();
   await expect.poll(async()=>{const after=(await gql(page,'query($id:ID!){workItems(where:{graph:{id:$id}}){title positionX positionY}}',{id:graph})).workItems.find((n:any)=>n.title==='Drag this task');return Math.hypot(after.positionX-before.positionX,after.positionY-before.positionY);},{timeout:5000}).toBeGreaterThan(20);
   // A fully pinned graph has nothing to solve after release. It must not
   // keep reheating for seconds or fight the user's chosen placement.
   await expect.poll(()=>page.evaluate(()=>(window as any).__layoutMetrics?.()?.atRest),{timeout:2000}).toBe(true);
   await node.locator('.node-edit-icon').click();
   await expect(page.getByTestId('quick-edit-surface')).toBeVisible();
   await page.getByTestId('quick-type').getByRole('button',{name:'Idea',exact:true}).click();
   await page.keyboard.press('Escape');
   await expect.poll(()=>page.evaluate(()=>(window as any).__layoutMetrics?.()?.atRest),{timeout:2000}).toBe(true);
   if(width===390){await page.setViewportSize({width:844,height:390});await page.setViewportSize({width,height});}
   await expect.poll(()=>page.evaluate(()=>(window as any).__layoutMetrics?.()?.atRest),{timeout:2000}).toBe(true);
   const sample=await page.evaluate(async()=>{
    const samples:Record<string,Array<{x:number;y:number}>>={};
    const start=performance.now();let frames=0,maxGap=0,last=start;
    await new Promise<void>(resolve=>{
     const frame=()=>{
      const now=performance.now();maxGap=Math.max(maxGap,now-last);last=now;frames++;
      document.querySelectorAll<SVGGElement>('.graph-container .node').forEach(el=>{
       const d=(el as any).__data__;const point=el.getScreenCTM();
       if(d?.id&&point)(samples[d.id]??=[]).push({x:point.e,y:point.f});
      });
      if(now-start<17000)requestAnimationFrame(frame);else resolve();
     };requestAnimationFrame(frame);
    });
    return {frames,maxGap,series:samples,nodes:Object.entries(samples).map(([id,points])=>({id,samples:points.length,xSpan:Math.max(...points.map(p=>p.x))-Math.min(...points.map(p=>p.x)),ySpan:Math.max(...points.map(p=>p.y))-Math.min(...points.map(p=>p.y))}))};
   });
   await mkdir('test-artifacts/quality',{recursive:true});
   await writeFile(`test-artifacts/quality/motion-${width}.json`,JSON.stringify(sample,null,2));
   await page.screenshot({path:`test-artifacts/quality/motion-${width}.png`});
   await info.attach('motion-samples.json',{body:JSON.stringify(sample,null,2),contentType:'application/json'});
   expect(sample.frames).toBeGreaterThan(100);
   expect(sample.nodes).toHaveLength(2);
   for(const sampleNode of sample.nodes){expect(sampleNode.xSpan,'idle horizontal shaking during the 17-second sample').toBeLessThanOrEqual(1);expect(sampleNode.ySpan,'idle vertical shaking during the 17-second sample').toBeLessThanOrEqual(1);}
   await page.screenshot({path:`test-artifacts/quality/motion-${width}.png`});
  }finally{
   await gql(page,'mutation($id:ID!){deleteWorkItems(where:{graph:{id:$id}}){nodesDeleted}}',{id:graph});
   await gql(page,'mutation($id:ID!){deleteGraphs(where:{id:$id}){nodesDeleted}}',{id:graph});
  }
 });
}
