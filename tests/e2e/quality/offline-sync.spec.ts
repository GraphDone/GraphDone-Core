import { test,expect } from '@playwright/test';
import { readFile,mkdtemp,rm } from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
const fixturePath='/tmp/graphdone-offline-fixture.json';
test('student team: offline reload, drag, quota pause, reconnect, no duplicates @offline-sync',async({page,context})=>{
 test.setTimeout(180000);
 const fixture=JSON.parse(await readFile(fixturePath,'utf8'));
 fixture.projectId=randomUUID();
 const seeded=await page.request.post('http://localhost:8798/api/sync/project',{headers:{Authorization:'Bearer '+fixture.token},data:{requestId:randomUUID(),projectId:fixture.projectId,version:-1,name:'Offline student QC '+fixture.projectId,changes:[{table:'nodes',id:randomUUID(),action:'put',value:{title:'Plan the student project',type:'TASK',description:null,status:'PROPOSED',priority:.5,position_x:0,position_y:0,due_date:null,tags:'[]',metadata:'{}'}}]}});
 expect(seeded.ok()).toBe(true);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');
 await page.evaluate(f=>{localStorage.setItem('authToken',f.token);localStorage.setItem('currentUser',JSON.stringify(f.user));localStorage.setItem('currentGraphId',f.projectId);localStorage.setItem('graphdone:viewMode','graph');},fixture);
 await page.reload();
 await expect(page.locator('.graph-container .node')).toHaveCount(1);
 await page.evaluate(async()=>{await navigator.serviceWorker.ready;});
 await page.reload();
 await expect(page.locator('.graph-container .node')).toHaveCount(1);
 for(const [width,height] of [[320,568],[390,844],[844,390],[1024,768],[1440,900],[2560,1440]]) {
  await page.setViewportSize({width,height});await expect(page.getByTestId(width<768||(height<=500&&width<=1023)?'mobile-storage-status':'offline-status')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }
 await page.setViewportSize({width:1440,height:900});
 await page.route('**/health',route=>route.abort());
 await context.setOffline(true);
 await page.getByRole('button',{name:'New work item',exact:true}).click();
 const title='Offline student research '+Date.now();
 await page.getByPlaceholder('Enter a descriptive title for your work item').fill(title);
 await page.getByRole('button',{name:'Create Work Item',exact:true}).click();
 await expect(page.locator('.graph-container .node')).toHaveCount(2);
 await expect(page.getByTestId('offline-status')).toContainText('waiting to sync');
 const nodes=page.locator('.graph-container .node');
 const index=await nodes.evaluateAll((els,title)=>els.findIndex(el=>(el as any).__data__.title===title),title);expect(index).toBeGreaterThanOrEqual(0);
 const node=nodes.nth(index),box=await node.boundingBox();expect(box).toBeTruthy();
 await page.mouse.move(box!.x+box!.width/2,box!.y+box!.height/2);await page.mouse.down();await page.mouse.move(box!.x+box!.width/2+100,box!.y+box!.height/2+50,{steps:20});await page.mouse.up();
 await page.waitForTimeout(1500);
 const position=await node.evaluate(el=>({id:(el as any).__data__.id,x:(el as any).__data__.positionX,y:(el as any).__data__.positionY}));
 for(const mode of ['Table','Card','Kanban','Gantt','Calendar','Activity','Graph']) {
  await page.getByRole('group',{name:'Workspace views'}).getByRole('button',{name:mode,exact:true}).click();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }
 await page.reload();await expect(page.locator('.graph-container .node')).toHaveCount(2);
 const restored=await page.locator('.graph-container .node').evaluateAll((els,id)=>{const d=(els.find(e=>(e as any).__data__.id===id) as any).__data__;return {x:d.positionX,y:d.positionY};},position.id);
 expect(restored.x).toBeCloseTo(position.x,0);expect(restored.y).toBeCloseTo(position.y,0);
 // Quota denial must retain the durable exact request, and stop retries.
 let denied=0;
 await page.route('**/api/sync/project',route=>{denied++;return route.fulfill({status:429,json:{code:'PERSONAL_LIMIT',message:'Local quota fixture',resetAt:new Date(Date.now()+60000).toISOString()}});});
 await context.setOffline(false);await expect.poll(()=>denied).toBe(1);
 await page.waitForTimeout(12000);expect(denied).toBe(1);
 let profileReads=0;page.on('request',request=>{if(request.url().includes('/api/graphql')&&request.postData()?.includes('\"operationName\":\"Me\"'))profileReads++;});
 // A renewed sign-in has a token but may need its cached profile while D1 is paused.
 await page.evaluate(()=>{localStorage.removeItem('currentUser');sessionStorage.removeItem('currentUser');});
 await page.reload();await expect(page.locator('.graph-container .node')).toHaveCount(2);
 expect(denied).toBe(1);expect(profileReads).toBe(0);
 await page.screenshot({path:'test-artifacts/quality/offline-quota-retained.png'});
 await expect(page.getByTestId('offline-status')).toContainText('waiting to sync');
 await page.unroute('**/api/sync/project');
 // Move only the LOCAL retry clock, equivalent to reaching the published reset.
 await page.evaluate(async()=>{
  const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('graphdone-offline',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
  await new Promise<void>((resolve,reject)=>{const tx=db.transaction('accounts','readwrite'),store=tx.objectStore('accounts'),r=store.get('browser');r.onsuccess=()=>{const a=r.result;a.retryAt=0;a.error='';store.put(a,'browser');};tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});db.close();
 });
 await expect.poll(async()=>{const r=await page.request.get('http://localhost:8798/api/sync/project?id='+fixture.projectId,{headers:{Authorization:'Bearer '+fixture.token}});return (await r.json()).snapshot.nodes.some((n:any)=>n.title===title);},{timeout:30000,intervals:[1000,3000,5000]}).toBe(true);
 await expect(page.getByTestId('offline-status')).not.toContainText('waiting to sync',{timeout:30000});
 const response=await page.request.get('http://localhost:8798/api/sync/project?id='+fixture.projectId,{headers:{Authorization:'Bearer '+fixture.token}});expect(response.ok()).toBe(true);
 const remote=(await response.json()).snapshot;expect(remote.nodes.filter((n:any)=>n.title===title)).toHaveLength(1);
 expect(remote.nodes.find((n:any)=>n.title===title).position_x).toBeCloseTo(position.x,0);
 // A second tab uses the same durable store without a stale cached read.
 const second=await context.newPage();await second.goto('/');await expect(second.locator('.graph-container .node')).toHaveCount(2);await second.close();
 // Connect a real local agent, then disconnect the human and make competing edits.
 await page.getByRole('button',{name:'Your agent',exact:true}).click();
 await page.getByRole('button',{name:'Create agent token',exact:true}).click();
 const instructions=await page.getByLabel('Agent connection instructions').inputValue();
 const agentToken=instructions.match(/Bearer (gd_agent_[a-f0-9]+)/)![1];
 await page.getByRole('button',{name:'Hide token',exact:true}).click();
 await context.setOffline(true);
 await expect(page.getByRole('button',{name:'Create agent token',exact:true})).toBeDisabled();
 await page.getByLabel('Note for your agent').fill('Offline human handoff: check the experiment');
 await page.getByRole('button',{name:'Leave note',exact:true}).click();
 await expect(page.getByLabel('Shared notes')).toContainText('Offline human handoff');
 await page.getByRole('button',{name:'Close agent connection',exact:true}).click();
 const editedIndex=await page.locator('.graph-container .node').evaluateAll((els,id)=>els.findIndex(el=>(el as any).__data__.id===id),position.id);
 await page.locator('.graph-container .node').nth(editedIndex).click();
 await expect(page.getByText('Connection Lost',{exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Edit',exact:true}).click();
 await page.getByTestId('quick-priority').focus();await page.getByTestId('quick-priority').press('End');
 await page.getByRole('button',{name:'Close quick edit',exact:true}).click();
 // APIRequestContext is independent of the disconnected browser. No remote inference.
 const agentEdit=await page.request.patch('http://localhost:8798/api/agent/items?graphId='+fixture.projectId,{headers:{Authorization:'Bearer '+agentToken},data:{id:position.id,priority:.2}});expect(agentEdit.ok()).toBe(true);
 await context.setOffline(false);
 await expect(page.getByTestId('offline-status')).toContainText('Changes need your review',{timeout:30000});
 await page.getByRole('button',{name:'Keep my version',exact:true}).click();
 await expect.poll(async()=>{const r=await page.request.get('http://localhost:8798/api/sync/project?id='+fixture.projectId,{headers:{Authorization:'Bearer '+fixture.token}});const s=(await r.json()).snapshot;return s.nodes.find((n:any)=>n.id===position.id).priority===1&&s.notes.some((n:any)=>n.body==='Offline human handoff: check the experiment');},{timeout:30000,intervals:[1000,3000,5000]}).toBe(true);
 await page.goto('/settings');
 const panel=page.getByTestId('offline-status').last();
 const [download]=await Promise.all([page.waitForEvent('download'),panel.getByRole('button',{name:'Export backup',exact:true}).click()]);
 const stream=await download.createReadStream();let backup='';for await(const chunk of stream!)backup+=chunk;
 expect(backup).toContain(title);expect(backup).not.toContain(fixture.token);expect(backup).not.toContain(agentToken);
 await panel.locator('input[type=file]').setInputFiles({name:'offline-backup.json',mimeType:'application/json',buffer:Buffer.from(backup)});
 let importedId='';
 await expect.poll(async()=>{const response=await page.request.get('http://localhost:8798/api/sync/projects',{headers:{Authorization:'Bearer '+fixture.token}});const projects=(await response.json()).projects;importedId=projects.find((p:any)=>p.name==='Offline student QC '+fixture.projectId+' (imported)')?.id||'';return !!importedId;},{timeout:30000,intervals:[1000,3000,5000]}).toBe(true);
 const imported=(await (await page.request.get('http://localhost:8798/api/sync/project?id='+importedId,{headers:{Authorization:'Bearer '+fixture.token}})).json()).snapshot;
 expect(imported.nodes).toHaveLength(2);expect(imported.nodes.some((n:any)=>n.id===position.id)).toBe(false);expect(imported.notes.some((n:any)=>n.body==='Offline human handoff: check the experiment')).toBe(true);
 expect(errors).toEqual([]);
 const removeImport=await page.request.post('http://localhost:8798/api/sync/project',{headers:{Authorization:'Bearer '+fixture.token},data:{requestId:randomUUID(),projectId:importedId,version:imported.project.sync_version,deleteProject:true,changes:[]}});expect(removeImport.ok()).toBe(true);
 // Remove this run's isolated project, including agent tokens and notes.
 const last=(await (await page.request.get('http://localhost:8798/api/sync/project?id='+fixture.projectId,{headers:{Authorization:'Bearer '+fixture.token}})).json()).snapshot;
 const removed=await page.request.post('http://localhost:8798/api/sync/project',{headers:{Authorization:'Bearer '+fixture.token},data:{requestId:randomUUID(),projectId:fixture.projectId,version:last.project.sync_version,deleteProject:true,changes:[]}});expect(removed.ok()).toBe(true);
});

test('local-only guest: project, tasks and reload without any D1 writes @offline-sync',async({page,context})=>{
 test.setTimeout(90000);let cloudWrites=0;
 page.on('request',r=>{if(r.method()==='POST'&&(/\/api\/sync/.test(r.url()) || (/\/api\/graphql/.test(r.url())&&/mutation/.test(r.postData()||''))))cloudWrites++;});
 await page.goto('/');
 // Use the real guest mutation; seed no server credentials.
 await page.getByRole('button',{name:/continue as guest/i}).first().click();
 // Some landing variants show a confirmation dialog.
 const proceed=page.getByRole('button',{name:/continue as guest|start exploring|enter workspace/i});
 if(await proceed.count())await proceed.last().click();
 await expect(page.getByTestId('offline-status')).toContainText('Guest workspace',{timeout:20000});
 await page.evaluate(async()=>{await navigator.serviceWorker.ready;});
 await context.setOffline(true);await page.reload();
 await expect(page.getByTestId('offline-status')).toContainText('Guest workspace');
 expect(cloudWrites).toBe(0);
});


test('parent: local guest survives closing the browser and reopening offline @offline-sync',async({playwright})=>{
 test.setTimeout(90000);const profile=await mkdtemp(join(tmpdir(),'graphdone-offline-browser-'));let context;
 try {
  context=await playwright.chromium.launchPersistentContext(profile,{headless:false});let page=await context.newPage();await page.goto(process.env.TEST_URL!);
  await page.getByRole('button',{name:'Continue as Guest',exact:true}).click();
  await page.getByTestId('guest-dialog').getByRole('button',{name:'Continue as Guest',exact:true}).click();
  await expect(page.getByTestId('offline-status')).toContainText('Guest workspace');
  await page.getByRole('button',{name:'New work item',exact:true}).click();
  await page.getByPlaceholder('Enter a descriptive title for your work item').fill('Remember the school pickup');
  await page.getByRole('button',{name:'Create Work Item',exact:true}).click();
  await expect.poll(()=>page.locator('.graph-container .node').evaluateAll(els=>els.some(e=>(e as any).__data__.title==='Remember the school pickup'))).toBe(true);
  await page.evaluate(async()=>{await navigator.serviceWorker.ready;});
  await context.close();context=await playwright.chromium.launchPersistentContext(profile,{headless:false,offline:true});page=await context.newPage();await page.goto(process.env.TEST_URL!);
  await expect(page.getByTestId('offline-status')).toContainText('Guest workspace');
  await expect.poll(()=>page.locator('.graph-container .node').evaluateAll(els=>els.some(e=>(e as any).__data__.title==='Remember the school pickup'))).toBe(true);
 }finally{await context?.close();await rm(profile,{recursive:true,force:true});}
});
