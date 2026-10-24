import {test,expect} from '@playwright/test';
import {login,TEST_USERS} from '../../lib/auth';
import {seedLargeGraph,deleteGraphDeep} from '../../lib/seedGraph';
for(const [width,height] of [[844,390],[1440,900],[2560,1440]]) test(`account menu, templates, minimap and hierarchy ${width} @reported-controls`,async({page})=>{
 test.setTimeout(90000);await page.setViewportSize({width,height});await login(page,TEST_USERS.ADMIN);
 await page.getByTestId('user-menu').click();
 const menu=page.getByTestId('user-menu-dropdown');await expect(menu).toBeInViewport();
 await expect(menu.getByRole('link',{name:'Account settings'})).toBeVisible();
 const hit=await menu.evaluate(el=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.right-10,r.top+10));});expect(hit).toBe(true);
 await page.keyboard.press('Escape');await expect(menu).toHaveCount(0);await expect(page.getByTestId('user-menu')).toBeFocused();
 await page.goto('/ontology');await page.getByRole('button',{name:/Templates/}).click();
 await expect(page.getByRole('button',{name:'Create Template',exact:true})).toBeDisabled();await expect(page.getByText(/Coming soon — reusable templates/)).toBeVisible();
 const seeded=await seedLargeGraph(page,{size:6,edgeFactor:1,namePrefix:'Reported controls'});
 try {
  await page.evaluate(id=>{localStorage.setItem('currentGraphId',id);localStorage.setItem('graphdone:viewMode','graph');localStorage.setItem('graphdone:layoutMode','force');},seeded.graphId);await page.goto('/');
  await expect(page.locator('.graph-container .node')).toHaveCount(6);
  await page.getByRole('button',{name:'Toggle hierarchical layout'}).click();
  await expect.poll(()=>page.evaluate(()=>(window as any).__layoutMetrics?.()?.overlappingNodePairs)).toBe(0);
  const points=await page.locator('.graph-container .node').evaluateAll(els=>els.map(el=>{const n=(el as any).__data__;return {x:n.x,y:n.y,fx:n.fx,fy:n.fy};}));
  expect(points.every(p=>Number.isFinite(p.fx)&&Number.isFinite(p.fy))).toBe(true);
  const ys=[...new Set(points.map(p=>p.y))].sort((a,b)=>a-b);for(let i=1;i<ys.length;i++)expect(ys[i]-ys[i-1]).toBeLessThan(260);
  await expect.poll(()=>page.evaluate(()=>(window as any).__layoutMetrics?.()?.atRest),{timeout:20000}).toBe(true);
  if(await page.getByTitle('Show Mini-Map',{exact:true}).count())await page.getByTitle('Show Mini-Map',{exact:true}).click();
  for(let i=0;i<3;i++){
   await expect(page.getByTestId('mini-map-node')).toHaveCount(6);
   await page.getByTitle('Hide Mini-Map',{exact:true}).click();await expect(page.getByTestId('mini-map-node')).toHaveCount(0);
   await page.getByTitle('Show Mini-Map',{exact:true}).click();await expect(page.getByTestId('mini-map-node')).toHaveCount(6);
  }
  await page.screenshot({path:`test-artifacts/quality/reported-controls-${width}.png`});
 }finally{await deleteGraphDeep(page,seeded.graphId);}
});
