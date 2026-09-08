import { test, expect } from '@playwright/test';
for (const [width,height] of [[390,844],[844,390],[1440,900]]) {
 for (const outcome of ['sent','delivery-failed','security-page']) test(`signup ${outcome} ${width} @signup`, async ({page}) => {
  await page.setViewportSize({width,height});
  let requests=0;
  await page.route('**/auth/magic-link/request', async route => {
   requests++;
   await route.fulfill(outcome==='security-page' ? {status:403,contentType:'text/html',body:'Security policy blocked request'} : {status:outcome==='sent'?200:503,contentType:'application/json',body:JSON.stringify({userExists:true,sent:outcome==='sent',message:'We could not send your sign-in email. Please try again shortly.'})});
  });
  await page.goto('/signup');
  await page.locator('#magicLinkEmail').fill('fixture@example.invalid');
  const text=await page.locator('body').innerText();
  const match=text.match(/(\d+)\s*([+−-])\s*(\d+)\s*=/)!;
  expect(match).toBeTruthy();
  await page.getByLabel('Verification answer').fill(String(match[2]==='+'?+match[1]+ +match[3]:+match[1]- +match[3]));
  await page.getByTestId('captcha-verify-btn').click();
  await expect(page.getByRole('button',{name:'Send Link',exact:true})).toBeEnabled();
  await page.getByRole('button',{name:'Send Link',exact:true}).click();
  if(outcome==='sent') await expect(page.getByLabel('Sign-in code from email')).toBeVisible();
  else {
   await expect(page.getByText(outcome==='security-page'?'We could not reach the sign-in service. Please try again shortly.':'We could not send your sign-in email. Please try again shortly.',{exact:true})).toBeVisible();
   await expect(page.getByLabel('Sign-in code from email')).toHaveCount(0);
   await expect(page.getByRole('button',{name:'Send Link',exact:true})).toBeEnabled();
  }
  expect(requests).toBe(1);
  await page.screenshot({path:`test-artifacts/quality/signup-${outcome}-${width}.png`});
 });
}
