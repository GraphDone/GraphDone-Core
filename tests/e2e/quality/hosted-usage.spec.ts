import { test, expect } from '@playwright/test';
import { login, TEST_USERS } from '../../lib/auth';
import { seedLargeGraph, deleteGraphDeep } from '../../lib/seedGraph';

for (const [width,height] of [[320,568],[390,844],[844,390],[1024,768],[1440,900],[2560,1440]]) {
 test(`cloud warnings, reset and unsaved recovery ${width} @hosted-usage`,async({page})=>{
  test.setTimeout(90000);
  await page.setViewportSize({width,height});
  let usage={hosted:true,used:{operations:316,reads:1200,writes:100},limit:{operations:400,reads:180000,writes:3000},resetAt:new Date(Date.now()+3600000).toISOString(),allocationShares:20,kind:'account',status:'AVAILABLE',limits:{tasksPerProject:300,linksPerProject:600}};
  let usageCalls=0, deniedSaves=0;
  await page.route('**/api/usage',route=>{usageCalls++;return route.fulfill({json:usage});});
  const errors:string[]=[];page.on('pageerror',e=>{errors.push(e.message);console.log('PAGE ERROR',e.message);});
  await login(page,TEST_USERS.ADMIN);
  const seeded=await seedLargeGraph(page,{size:2,edgeFactor:0,namePrefix:'Cloud allowance QC'});
  try {
   await page.evaluate(id=>{localStorage.setItem('currentGraphId',id);localStorage.setItem('graphdone:viewMode','graph');},seeded.graphId);
   await page.goto('/settings');
   const panel=page.getByTestId('cloud-usage');await expect(panel).toBeVisible();
   await expect(panel.getByText('316 / 400',{exact:true})).toBeVisible();
   await expect(page.getByTestId('cloud-usage-banner')).toHaveCount(0);
   for(const [operations,heading,status] of [[320,'Approaching today’s cloud limit','AVAILABLE'],[380,'Almost at today’s cloud limit','AVAILABLE'],[400,'Your daily cloud allowance is used up','PERSONAL_LIMIT'],[200,'Cloud sync is paused','SHARED_LIMIT']] as const){
    usage={...usage,used:{...usage.used,operations},status};
    await panel.getByRole('button',{name:'Refresh usage'}).click();
    await expect(page.getByTestId('cloud-usage-banner').getByText(heading,{exact:true})).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
   }
   await page.screenshot({path:`test-artifacts/quality/cloud-limit-${width}.png`});
   usage={...usage,used:{operations:0,reads:0,writes:0},status:'AVAILABLE'};
   await panel.getByRole('button',{name:'Refresh usage'}).click();
   await expect(page.getByTestId('cloud-usage-banner')).toHaveCount(0);
   await page.goto('/');
   await expect(page.locator('.graph-container .node')).toHaveCount(2);
   await page.route('**/api/graphql',async route=>{
    const body=route.request().postDataJSON();
    if(/mutation[\s\S]*createWorkItems/.test(body?.query||'')){
     deniedSaves++;usage={...usage,status:'PERSONAL_LIMIT',used:{...usage.used,operations:400}};
     return route.fulfill({json:{errors:[{message:'Your daily cloud allowance is used up. Keep your draft.',extensions:{code:'PERSONAL_LIMIT',resetAt:usage.resetAt}}]}});
    }
    return route.continue();
   });
   await page.getByRole('button',{name:'New work item',exact:true}).click();
   await page.getByPlaceholder('Enter a descriptive title for your work item').fill('Do not lose the student project plan');
   await page.getByRole('button',{name:'Create Work Item',exact:true}).click();
   await expect(page.getByPlaceholder('Enter a descriptive title for your work item')).toHaveValue('Do not lose the student project plan');
   expect(deniedSaves).toBe(1);
   await page.keyboard.press('Escape');
   await page.route('**/api/graphql',route=>route.fulfill({json:{data:{me:null},errors:[{message:'Daily cloud limit reached',extensions:{code:'PERSONAL_LIMIT'}}]}}));
   await page.reload();
   await expect(page.getByTestId('cloud-usage-banner').getByText('Your daily cloud allowance is used up',{exact:true})).toBeVisible();
   await expect(page.getByTestId('cloud-usage-banner').getByText(/Resets/)).toBeVisible();
   const download=page.getByRole('button',{name:'Download recovery copy'});await expect(download).toBeVisible();
   expect(await download.evaluate(el=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));})).toBe(true);
   const [file]=await Promise.all([page.waitForEvent('download',{timeout:15000}),download.click({timeout:10000})]);
   const stream=await file.createReadStream();let text='';for await(const chunk of stream!)text+=chunk;
   expect(text).toContain('Do not lose the student project plan');expect(text).not.toContain('authToken');
   expect(await page.evaluate(()=>!!(localStorage.getItem('authToken')||sessionStorage.getItem('authToken')))).toBe(true);
   expect(deniedSaves).toBe(1);
   expect(usageCalls).toBeGreaterThan(4);expect(errors).toEqual([]);
   await page.screenshot({path:`test-artifacts/quality/cloud-recovery-${width}.png`});
  } finally {await deleteGraphDeep(page,seeded.graphId);}
 });
}
