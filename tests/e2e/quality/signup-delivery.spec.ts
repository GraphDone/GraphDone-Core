import { test, expect } from '@playwright/test';
import { completeAuthCaptcha } from '../../lib/completeAuthCaptcha';
for (const [width,height] of [[390,844],[844,390],[1440,900]]) {
 for (const outcome of ['sent','delivery-failed','security-page']) test(`signup ${outcome} ${width} @signup`, async ({page}) => {
  await page.setViewportSize({width,height});
  const policyErrors: string[] = [];
  page.on('console', message => { if (/violates.*Content Security Policy/i.test(message.text())) policyErrors.push(message.text()); });
  let requests=0;
  await page.route('**/auth/magic-link/request', async route => {
   requests++;
   await route.fulfill(outcome==='security-page' ? {status:403,contentType:'text/html',body:'Security policy blocked request'} : {status:outcome==='sent'?200:503,contentType:'application/json',body:JSON.stringify({userExists:true,sent:outcome==='sent',message:'We could not send your sign-in email. Please try again shortly.'})});
  });
  await page.goto('/signup');
  await page.locator('#magicLinkEmail').fill('fixture@example.invalid');
  await completeAuthCaptcha(page);
  await expect(page.getByRole('button',{name:'Send Link',exact:true})).toBeEnabled();
  await page.getByRole('button',{name:'Send Link',exact:true}).click();
  if(outcome==='sent') await expect(page.getByLabel('Sign-in code from email')).toBeVisible();
  else {
   await expect(page.getByText(outcome==='security-page'?'We could not reach the sign-in service. Please try again shortly.':'We could not send your sign-in email. Please try again shortly.',{exact:true})).toBeVisible();
   await expect(page.getByLabel('Sign-in code from email')).toHaveCount(0);
   await completeAuthCaptcha(page);
   await expect(page.getByRole('button',{name:'Send Link',exact:true})).toBeEnabled();
  }
  expect(requests).toBe(1);
  expect(policyErrors).toEqual([]);
  await page.screenshot({path:`test-artifacts/quality/signup-${outcome}-${width}.png`});
 });
}

test('returning visitor can enter an existing code without sending another email @signup', async ({page}) => {
 let sends=0, verifies=0;
 await page.route('**/auth/magic-link/request', route => { sends++; return route.abort(); });
 await page.route('**/auth/code/verify', route => { verifies++; return route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({error:'Invalid or expired code'})}); });
 await page.goto('/signup');
 await page.locator('#magicLinkEmail').fill('fixture@example.invalid');
 await page.getByRole('button',{name:'Already have a code?'}).click();
 await page.getByLabel('Sign-in code from email').fill('AAAA-BBBB-CCCC');
 await page.getByLabel('Sign-in code from email').press('Enter');
 await expect(page.getByRole('alert')).toBeVisible();
 expect(sends).toBe(0);expect(verifies).toBe(1);
});
