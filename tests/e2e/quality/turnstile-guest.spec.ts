import {test,expect} from '@playwright/test';
// Official public testing key; no production challenge is bypassed.
for(const [width,height] of [[390,844],[844,390]])test(`Turnstile guest entry fits ${width} @verification`,async({page})=>{
 test.setTimeout(90000);await page.setViewportSize({width,height});
 await page.route('**/config',route=>route.fulfill({json:{allowAnonymousGuest:true,guest:{turnstileSiteKey:'1x00000000000000000000AA'}}}));
 await page.goto('/login-form');
 await page.getByRole('button',{name:'Continue as Guest',exact:true}).click();
 const dialog=page.getByTestId('guest-dialog');await expect(dialog).toBeVisible();
 await expect(dialog.locator('input:not([type=hidden])')).toHaveCount(0);
 const submit=dialog.getByRole('button',{name:'Continue as Guest',exact:true});
 await expect(submit).toBeEnabled({timeout:60000});
 const box=await dialog.boundingBox();expect(box!.width).toBeLessThanOrEqual(width);expect(box!.height).toBeLessThanOrEqual(height);
 const request=page.waitForRequest(r=>r.url().includes('graphql')&&r.postData()?.includes('GuestLogin')===true);
 await submit.click();expect((await request).headers()['x-turnstile-token']).toBeTruthy();
 await expect(page.getByTestId(width<768?'graph-selector-mobile':'graph-selector')).toBeVisible({timeout:15000});
 await page.screenshot({path:`test-artifacts/quality/turnstile-${width}.png`});
});
