import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
// Explicit opt-in: creates one QA report, resolves it, and revokes its temporary token.
// No passwords, storage state or bearer tokens are recorded in traces/videos.
test.use({trace:'off',video:'off',screenshot:'off'});
test('real operator password → feedback → review → restricted token @operator-login',async({page})=>{
 test.skip(!process.env.OPERATOR_CREDENTIAL_FILE,'Private operator credential file required');test.setTimeout(90000);page.setDefaultTimeout(15000);
 const raw=await readFile(process.env.OPERATOR_CREDENTIAL_FILE!,'utf8');
 const credentials=raw.trim().startsWith('{')?JSON.parse(raw):Object.fromEntries(raw.split('\n').filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return[l.slice(0,i),l.slice(i+1)];}));
 await page.goto('/login');await page.getByRole('tab',{name:'Password',exact:true}).click();
 await page.getByLabel('Email address or username',{exact:true}).fill(credentials.email||credentials.ADMIN_EMAIL||'admin');await page.getByLabel('Password',{exact:true}).fill(credentials.password||credentials.ADMIN_PASSWORD);
 await page.getByRole('button',{name:'Sign In',exact:true}).click();await expect.poll(()=>page.evaluate(()=>Boolean(localStorage.getItem('authToken')||sessionStorage.getItem('authToken')))).toBe(true);
 await page.goto('/admin');const panel=page.locator('[aria-label="Feedback and operations"]');await expect(panel.getByText('Report inbox',{exact:true})).toBeVisible();
 const title='Operator release check '+Date.now();await page.getByRole('button',{name:'Feedback and bug reports',exact:true}).first().click();const dialog=page.getByRole('dialog',{name:'Feedback and bug reports'});
 await dialog.getByLabel('Short summary').fill(title);await dialog.getByLabel('What happened, or what would help?').fill('Release acceptance check: verify feedback reaches the operator inbox and can be reviewed. No user project data.');await dialog.getByRole('button',{name:'Send feedback',exact:true}).click();await expect(dialog.getByRole('status')).toContainText('Received.');await dialog.getByRole('button',{name:'Close feedback'}).click();
 await panel.getByRole('button',{name:'Refresh operations'}).click();await panel.getByRole('button').filter({hasText:title}).click();await panel.getByLabel('Report status',{exact:true}).selectOption('resolved');await panel.getByLabel('Finding / resolution').fill('Verified real password login, UI submission, persisted receipt and admin review. Automated release acceptance report.');await panel.getByRole('button',{name:'Save review'}).click();await expect(panel.getByRole('status')).toContainText('Report updated');await panel.getByRole('button',{name:'Review history'}).click();await expect(panel.getByText(/Revision 1: resolved/)).toBeVisible();
 await panel.getByLabel('Connection name').fill('Release acceptance reader');await panel.getByRole('button',{name:'Create operator token'}).click();const token=await panel.getByLabel('New operator token').inputValue();const api=(process.env.TEST_URL||'').replace(/\/$/,'')+'/api/ops';const headers={Authorization:'Bearer '+token};
 expect((await page.request.get(api+'/stats',{headers})).status()).toBe(200);expect((await page.request.patch(api+'/announcement',{headers,data:{message:'Must not publish',enabled:true,revision:0}})).status()).toBe(403);
 await panel.getByRole('button',{name:'Revoke Release acceptance reader'}).click();await expect(panel.getByLabel('New operator token')).toHaveCount(0);expect((await page.request.get(api+'/stats',{headers})).status()).toBe(401);
 for(const [width,height] of [[320,568],[390,844],[844,390],[1440,900]]){await page.setViewportSize({width,height});await panel.getByRole('button',{name:'Refresh operations'}).scrollIntoViewIfNeeded();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
 await page.setViewportSize({width:1440,height:900});await page.screenshot({path:'test-artifacts/quality/operator-'+new URL(process.env.TEST_URL!).hostname+'.png'});
});
