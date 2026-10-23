import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
test('family feedback → admin review → scoped agent → public notice @operations',async({page,context,browser})=>{
 test.setTimeout(90000);page.setDefaultTimeout(15000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 const fixture=JSON.parse(await readFile('/tmp/graphdone-operations-fixture.json','utf8'));
 await page.goto('/');await page.getByRole('button',{name:'Feedback and bug reports',exact:true}).click();
 let dialog=page.getByRole('dialog',{name:'Feedback and bug reports'});
 const title='Family portrait report '+Date.now();await dialog.getByLabel('Short summary').fill(title);await dialog.getByLabel('What happened, or what would help?').fill('The project selector is hard to read on a phone. Expected a readable label.');
 await context.setOffline(true);await dialog.getByRole('button',{name:'Send feedback',exact:true}).click();await expect(dialog.getByRole('alert')).toContainText('offline');
 await dialog.getByRole('button',{name:'Close feedback'}).click();await context.setOffline(false);await page.reload();await page.getByRole('button',{name:'Feedback and bug reports',exact:true}).click();dialog=page.getByRole('dialog',{name:'Feedback and bug reports'});await expect(dialog.getByLabel('Short summary')).toHaveValue(title);
 for(const [width,height] of [[320,568],[390,844],[844,390],[1024,768],[1440,900],[2560,1440]]){
  await page.setViewportSize({width,height});const send=dialog.getByRole('button',{name:'Send feedback',exact:true});await send.scrollIntoViewIfNeeded();const b=await send.boundingBox();expect(b!.x+b!.width).toBeLessThanOrEqual(width);expect(b!.y+b!.height).toBeLessThanOrEqual(height);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }
 await page.setViewportSize({width:1440,height:900});await dialog.getByRole('button',{name:'Send feedback',exact:true}).click();await expect(dialog.getByRole('status')).toContainText('Received.');await dialog.getByRole('button',{name:'Close feedback'}).click();
 await page.evaluate(f=>{localStorage.setItem('authToken',f.admin);localStorage.setItem('currentUser',JSON.stringify(f.adminUser));localStorage.setItem('currentGraphId','owner-home');},fixture);await page.goto('/admin');
 const panel=page.locator('[aria-label="Feedback and operations"]');await expect(panel.getByText('Report inbox',{exact:true})).toBeVisible();
 await panel.getByRole('button').filter({hasText:title}).click();await panel.getByLabel('Report status',{exact:true}).selectOption('reviewing');await panel.getByLabel('Finding / resolution').fill('Reproduced at 390×844. Preparing a local regression.');await panel.getByRole('button',{name:'Save review'}).click();await expect(panel.getByRole('status')).toContainText('Report updated');await panel.getByRole('button',{name:'Review history'}).click();await expect(panel.getByText(/Revision 1: reviewing/)).toBeVisible();
 await panel.getByLabel('Connection name').fill('Headed QC reader');await panel.getByRole('button',{name:'Create operator token'}).click();const token=await panel.getByLabel('New operator token').inputValue();expect(token).toMatch(/^gd_ops_/);
 const api='http://localhost:8799/api/ops';const read=await page.request.get(api+'/reports',{headers:{Authorization:'Bearer '+token}});expect(read.status()).toBe(200);const report=(await read.json()).reports.find((r:any)=>r.title===title);expect(report.status).toBe('reviewing');
 expect((await page.request.patch(api+'/reports',{headers:{Authorization:'Bearer '+token},data:{id:report.id,revision:1,status:'resolved',resolution:'Unauthorized change'}})).status()).toBe(403);
 await panel.getByRole('button',{name:'Revoke Headed QC reader'}).click();await expect(panel.getByLabel('New operator token')).toHaveCount(0);expect((await page.request.get(api+'/reports',{headers:{Authorization:'Bearer '+token}})).status()).toBe(401);
 await panel.getByLabel('Announcement text').fill('Local QC notice: service available');await panel.getByLabel('Show announcement').check();await panel.getByRole('button',{name:'Save announcement'}).click();await expect(panel.getByRole('status')).toContainText('Public announcement saved');
 const visitor=await browser.newPage();await visitor.goto(process.env.TEST_URL!);await expect(visitor.getByLabel('Service announcement')).toContainText('Local QC notice');await visitor.close();
 await panel.getByLabel('Show announcement').uncheck();await panel.getByRole('button',{name:'Save announcement'}).click();await expect(panel.getByRole('status')).toContainText('Public announcement saved');
 for(const [width,height] of [[320,568],[844,390],[1440,900]]){await page.setViewportSize({width,height});await panel.getByRole('button',{name:'Refresh operations'}).scrollIntoViewIfNeeded();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
 await page.screenshot({path:'test-artifacts/quality/operations-admin.png'});expect(errors).toEqual([]);
});
