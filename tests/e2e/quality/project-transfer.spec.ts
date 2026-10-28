import {test,expect} from '@playwright/test';
import {readFile,writeFile,unlink} from 'node:fs/promises';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createRequire} from 'node:module';
const webRequire=createRequire(resolve('packages/web/package.json'));
const example=JSON.parse(readFileSync('docs/formats/project-v1.example.json','utf8'));
async function account(page:any){return page.evaluate(async()=>{
 const owner=JSON.parse(localStorage.getItem('currentUser')||sessionStorage.getItem('currentUser')||'null').id;
 const db=await new Promise<IDBDatabase>((ok,no)=>{const r=indexedDB.open('graphdone-offline',1);r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error);});
 const a=await new Promise<any>((ok,no)=>{const r=db.transaction('accounts').objectStore('accounts').get(owner);r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error);});db.close();return a;
});}
async function openMenu(page:any){if(!await page.getByTestId('graph-selector-dropdown').isVisible())await page.locator('[data-testid="graph-selector"]:visible,[data-testid="graph-selector-mobile"]:visible,[data-testid="graph-selector-sidebar"]:visible').first().click();return page.getByRole('region',{name:'Project import and export'});}
async function upload(region:any,data:any){await region.getByLabel('Import project JSON').setInputFiles({name:'project.json',mimeType:'application/json',buffer:Buffer.from(typeof data==='string'?data:JSON.stringify(data))});}
test('student / engineer: portable project round trip, offline, safe Mermaid and responsive controls @project-transfer',async({page,context,browser})=>{
 test.setTimeout(120000);let writes=0;const errors:string[]=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.method()==='POST'&&(/\/api\/sync/.test(r.url())||(/\/api\/graphql/.test(r.url())&&/mutation/.test(r.postData()||''))))writes++;});
 await page.goto('/');await page.getByRole('button',{name:/continue as guest/i}).first().click();
 const proceed=page.getByRole('button',{name:/continue as guest|start exploring|enter workspace/i});if(await proceed.count())await proceed.last().click();
 await expect(page.getByTestId('offline-status')).toContainText('Guest workspace');
 await page.evaluate(async()=>{await navigator.serviceWorker.ready;});await context.setOffline(true);await page.reload();
 let region=await openMenu(page);const chooserWait=page.waitForEvent('filechooser');await region.getByRole('button',{name:'Import project',exact:true}).click();await (await chooserWait).setFiles({name:'project.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(example))});await expect(region).toContainText('Imported 1 project');
 await page.getByTestId('graph-selector-dropdown').getByRole('button').filter({hasText:'Student launch project (imported)'}).click();
 // Selection preserves the open menu and changes the export target immediately.
 await expect(region).toContainText('Transfer Student launch project (imported)');
 const jsonWait=page.waitForEvent('download');await region.getByRole('button',{name:'Export JSON',exact:true}).click();const jsonDownload=await jsonWait;
 const doc=JSON.parse(await readFile((await jsonDownload.path())!,'utf8'));
 expect(jsonDownload.suggestedFilename()).toMatch(/\.json$/);expect(doc.format).toBe('graphdone-project');expect(doc.nodes).toHaveLength(2);expect(doc.notes).toHaveLength(1);
 expect(JSON.stringify(doc)).not.toMatch(/owner_id|actor_id|sync_version|authToken/);
 const baseline=await account(page);const original=Object.values(baseline.projects).find((p:any)=>p.local?.project.id===doc.project.id) as any;
 await upload(region,doc);await expect(region).toContainText('Imported 1 project');
 const after=await account(page);expect(Object.keys(after.projects)).toHaveLength(Object.keys(baseline.projects).length+1);
 const copy=Object.values(after.projects).find((p:any)=>p.local?.project.name==='Student launch project (imported) (imported)') as any;
 expect(copy.local.project.id).not.toBe(doc.project.id);expect(copy.local.nodes.map((n:any)=>n.id)).not.toEqual(doc.nodes.map((n:any)=>n.id));
 const byTitle=new Map(copy.local.nodes.map((n:any)=>[n.title,n]));
 for(const n of original.local.nodes){const c:any=byTitle.get(n.title);expect({...c,id:n.id}).toEqual(n);}
 expect(copy.local.edges[0].source_id).toBe((byTitle.get(example.nodes[0].title) as any).id);
 expect(copy.local.notes[0].work_item_id).toBe(copy.local.edges[0].source_id);expect(copy.local.notes[0].body).toBe(example.notes[0].body);
 // Invalid files cannot create partial projects, including a mixed valid/invalid backup.
 for(const data of ['not json',{...doc,version:999},{...doc,edges:[{...doc.edges[0],target_id:'missing'}]},{format:'graphdone-offline-v1',account:{projects:{good:{local:original.local},bad:{local:{...original.local,nodes:[{...original.local.nodes[0],title:''}]}}}}}]){
  await upload(region,data);await expect(region.getByRole('alert')).toBeVisible();expect(Object.keys((await account(page)).projects)).toHaveLength(Object.keys(after.projects).length);
 }
 // Oversized files and a failed device write leave the account unchanged.
 const oversized='/tmp/graphdone-transfer-oversized-'+Date.now()+'.json';await writeFile(oversized,Buffer.alloc(50*1024*1024+1));
 try{await region.getByLabel('Import project JSON').setInputFiles(oversized);}finally{await unlink(oversized);}
 await expect(region.getByRole('alert')).toContainText('50 MB');
 await page.evaluate(()=>{const original=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(...args:any[]){IDBObjectStore.prototype.put=original;throw new DOMException('Test device full','QuotaExceededError');};});
 await upload(region,doc);await expect(region.getByRole('alert')).toBeVisible();expect(Object.keys((await account(page)).projects)).toHaveLength(Object.keys(after.projects).length);
 // Cloud-only project summaries count toward the account cap too.
 const savedAccount=await account(page);
 await page.evaluate(async()=>{
  const owner=JSON.parse(localStorage.getItem('currentUser')||sessionStorage.getItem('currentUser')!).id;
  const db=await new Promise<IDBDatabase>(ok=>{const r=indexedDB.open('graphdone-offline',1);r.onsuccess=()=>ok(r.result);});
  await new Promise<void>((ok,no)=>{const tx=db.transaction('accounts','readwrite'),store=tx.objectStore('accounts'),r=store.get(owner);r.onsuccess=()=>{const a=r.result;a.list=Array.from({length:100},(_,i)=>({id:'cloud-'+i,name:'Cloud project '+i}));store.put(a,owner);};tx.oncomplete=()=>ok();tx.onabort=()=>no(tx.error);});db.close();
 });
 await upload(region,doc);await expect(region.getByRole('alert')).toContainText('100 projects');
 expect(Object.keys((await account(page)).projects)).toHaveLength(Object.keys(after.projects).length);
 await page.evaluate(async(a)=>{
  const owner=JSON.parse(localStorage.getItem('currentUser')||sessionStorage.getItem('currentUser')!).id;
  const db=await new Promise<IDBDatabase>(ok=>{const r=indexedDB.open('graphdone-offline',1);r.onsuccess=()=>ok(r.result);});
  await new Promise<void>((ok,no)=>{const tx=db.transaction('accounts','readwrite');tx.objectStore('accounts').put(a,owner);tx.oncomplete=()=>ok();tx.onabort=()=>no(tx.error);});db.close();
 },savedAccount);
 // Export a real task containing Mermaid syntax / HTML attack text.
 await page.keyboard.press('Escape');await page.getByRole('button',{name:'New work item',exact:true}).click();
 await page.getByPlaceholder('Enter a descriptive title for your work item').fill('end " ] <script> & 🚀 %%{init: evil}%%');
 await page.getByRole('button',{name:'Create Work Item',exact:true}).click();await expect(page.locator('.graph-container .node')).toHaveCount(3);
 region=await openMenu(page);const mmdWait=page.waitForEvent('download');await region.getByRole('button',{name:'Export Mermaid'}).click();const mmdDownload=await mmdWait;const mmd=await readFile((await mmdDownload.path())!,'utf8');
 expect(mmdDownload.suggestedFilename()).toMatch(/\.mmd$/);expect(mmd).not.toContain('<script>');expect(mmd).not.toContain('%%{init');
 // Local blank tab, never send project content to an external Mermaid service.
 const render=await browser.newPage();await render.setContent('<div id="diagram"></div>');
 await render.addScriptTag({path:webRequire.resolve('mermaid/dist/mermaid.min.js')});
 const result=await render.evaluate(async(source)=>{const m=(window as any).mermaid;m.initialize({startOnLoad:false,securityLevel:'strict',layout:'dagre',theme:'default',look:'classic'});await m.parse(source);const {svg}=await m.render('project-diagram',source);document.querySelector('#diagram')!.innerHTML=svg;return {nodes:document.querySelectorAll('.node').length,edges:document.querySelectorAll('.flowchart-link').length,text:document.body.textContent};},mmd);
 expect(result.nodes).toBe(3);expect(result.edges).toBe(1);expect(result.text).toContain('Plan the launch 🚀');await render.screenshot({path:'test-artifacts/quality/project-mermaid.png'});await render.close();
 for(const [width,height] of [[320,568],[390,844],[844,390],[1024,768],[1440,900],[2560,1440]]){
  await page.keyboard.press('Escape');await page.setViewportSize({width,height});region=await openMenu(page);
  for(const name of ['Export JSON','Export Mermaid','Import project']){
   const button=region.getByRole('button',{name,exact:true});await button.scrollIntoViewIfNeeded();const b=await button.boundingBox();expect(b).toBeTruthy();expect(b!.x).toBeGreaterThanOrEqual(0);expect(b!.x+b!.width).toBeLessThanOrEqual(width);expect(b!.y+b!.height).toBeLessThanOrEqual(height);expect(await button.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
   if(name.startsWith('Export')){const downloaded=page.waitForEvent('download');await button.click();const d=await downloaded;expect((await readFile((await d.path())!)).length).toBeGreaterThan(0);}
   else {const chooser=page.waitForEvent('filechooser');await button.click();await (await chooser).setFiles(width===320?{name:'phone-project.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(doc))}:[]);if(width===320)await expect(region).toContainText('Imported 1 project');}

  }
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  const menu=page.getByTestId('graph-selector-dropdown');expect(await menu.evaluate(el=>el.scrollHeight<=el.clientHeight+1)).toBe(true);
  if(width===320)await page.screenshot({path:'test-artifacts/quality/project-transfer-phone.png'});
 }
 await page.screenshot({path:'test-artifacts/quality/project-transfer-menu.png'});await page.keyboard.press('Escape');await page.reload();await expect(page.locator('.graph-container .node')).toHaveCount(3);
 expect(writes).toBe(0);expect(errors).toEqual([]);
});
