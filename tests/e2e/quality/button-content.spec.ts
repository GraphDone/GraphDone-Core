import {test,expect} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
import {login,TEST_USERS} from '../../lib/auth';
import {captureBrowserDiagnostics} from '../../lib/runner/browser-diagnostics.mjs';

 test('visible buttons contain their labels across routes and viewport sizes @responsive @controls',async({page},info)=>{
 test.setTimeout(180000);
 const diagnostics=captureBrowserDiagnostics(page);
 let navigation:{route:string;width?:number;height?:number}={route:'login'};
 try {
 await login(page,TEST_USERS.ADMIN);
 const failures:Array<{width:number;route:string;button:string;reason:string}>=[];let checked=0;
 const inspect=async(width:number,route:string)=>{
  const result=await page.evaluate(()=>{
   const failures:Array<{button:string;reason:string}>=[];let checked=0;
   for(const button of document.querySelectorAll<HTMLButtonElement>('button')){
    const box=button.getBoundingClientRect();const css=getComputedStyle(button);
    if(!box.width||!box.height||css.visibility==='hidden'||css.display==='none'||box.bottom<0||box.top>innerHeight)continue;
    checked++;
    const name=(button.getAttribute('aria-label')||button.textContent||button.title||'unnamed').trim().replace(/\s+/g,' ').slice(0,100);
    if(button.scrollWidth>button.clientWidth+2)failures.push({button:name,reason:`content ${button.scrollWidth}px exceeds ${button.clientWidth}px width`});
    const walker=document.createTreeWalker(button,NodeFilter.SHOW_TEXT);
    while(walker.nextNode()){
     const node=walker.currentNode;if(!node.textContent?.trim())continue;
     const parent=node.parentElement;if(!parent||parent.closest('svg,.sr-only,[hidden]'))continue;
     // Explicit ellipsis keeps the full accessible name; it is not accidental clipping.
     if(parent.closest('.truncate,[class*="line-clamp"]'))continue;
     if(getComputedStyle(parent).visibility==='hidden')continue;
     const range=document.createRange();range.selectNodeContents(node);
     for(const r of Array.from(range.getClientRects()))if(r.width&&r.height&&(r.left<box.left-2||r.right>box.right+2||r.top<box.top-2||r.bottom>box.bottom+2))failures.push({button:name,reason:'label extends outside button'});
    }
   }return {failures,checked};
  });checked+=result.checked;failures.push(...result.failures.map(f=>({...f,width,route})));
 };
 for(const [width,height] of [[320,568],[390,844],[844,390],[768,1024],[1024,768],[1440,900],[1920,1080]]){
  await page.setViewportSize({width,height});
  for(const route of ['/','/analytics','/agents','/settings','/backend','/ontology','/admin']){
   navigation={route,width,height};
   await test.step(`Inspect buttons: ${route} at ${width}x${height}`,async()=>{
   await page.goto(route);await expect(page.locator('main'),`main mounts on ${route} at ${width}x${height}`).toBeVisible();await page.waitForTimeout(400);await inspect(width,route);
   if(route==='/'){
    const selector=page.getByTestId(width<768?'graph-selector-mobile':'graph-selector').and(page.locator(':visible'));await expect(selector).toBeVisible();
    const name=selector.getByTestId('graph-selector-name');expect((await name.boundingBox())!.width,'project name has usable space').toBeGreaterThanOrEqual(100);
    await selector.click();await expect(page.getByTestId('graph-selector-dropdown')).toBeVisible();await inspect(width,'graph selector menu');await page.keyboard.press('Escape');
   }
   });
  }
 }
 console.log(`Inspected ${checked} buttons; ${failures.length} content failures`);
 await info.attach('button-content.json',{body:JSON.stringify({checked,failures},null,2),contentType:'application/json'});
 expect(failures,JSON.stringify(failures,null,2)).toEqual([]);expect(checked).toBeGreaterThan(100);
 } catch(error) {
  try {
   const path=info.outputPath('button-navigation-diagnostics.json');
   await writeFile(path,JSON.stringify({navigation,...diagnostics.snapshot()},null,2));
   await info.attach('button-navigation-diagnostics.json',{path,contentType:'application/json'});
  } catch {console.error('Button navigation diagnostics could not be attached.');}
  throw error;
 } finally {diagnostics.stop();}
 });
