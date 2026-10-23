import {test,expect} from '@playwright/test';
import {login,TEST_USERS} from '../../lib/auth';
import {gql} from '../../lib/graphRequest';

for(const [width,height] of [[390,844],[844,390],[1440,900]])test(`studio visual review ${width}x${height} @visualstyle`,async({page})=>{
 test.setTimeout(90000);await page.setViewportSize({width,height});
 await page.goto('/login-form');await expect(page.getByRole('heading',{name:'You and your agent. Moving work forward.'})).toBeVisible();
 if(width>=1024){
  const ratios=await page.locator('.work-illustration g').evaluateAll(groups=>{
   const luminance=(rgb:string)=>{const c=(rgb.match(/[\d.]+/g)||[]).slice(0,3).map(Number).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;});return .2126*c[0]+.7152*c[1]+.0722*c[2];};
   return groups.map(group=>{const text=group.querySelector('text')!,rect=group.querySelector('rect')!;const a=luminance(getComputedStyle(text).fill),b=luminance(getComputedStyle(rect).fill);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);});
  });
  expect(ratios).toHaveLength(3);for(const ratio of ratios)expect(ratio,'illustration panel text contrast').toBeGreaterThanOrEqual(4.5);
 }
 await page.screenshot({path:`test-artifacts/quality/design-signin-${width}.png`});
 await login(page,TEST_USERS.ADMIN);
 const me=(await gql(page,'{me{id}}')).me.id;
 const graph=(await gql(page,'mutation($input:[GraphCreateInput!]!){createGraphs(input:$input){graphs{id}}}',{input:[{name:'The community garden',type:'PROJECT',status:'ACTIVE',createdBy:me}]})).createGraphs.graphs[0].id;
 try{
  const titles=['Choose a sunny spot','Plan the planting beds','Gather tools and seeds','Invite the neighbours','Plant the first seedlings','Share the harvest'];
  const items=(await gql(page,'mutation($input:[WorkItemCreateInput!]!){createWorkItems(input:$input){workItems{id}}}',{input:titles.map((title,i)=>({title,type:i===5?'OUTCOME':'TASK',status:['COMPLETED','IN_PROGRESS','PLANNED','IN_REVIEW','PLANNED','PROPOSED'][i],positionX:(i%3)*330-330,positionY:Math.floor(i/3)*250-125,positionZ:0,graph:{connect:{where:{node:{id:graph}}}}}))})).createWorkItems.workItems;
  const link=(id:string)=>({connect:{where:{node:{id}}}});
  await gql(page,'mutation($input:[EdgeCreateInput!]!){createEdges(input:$input){edges{id}}}',{input:[[0,1],[1,2],[2,4],[3,4],[4,5]].map(([a,b])=>({source:link(items[a].id),target:link(items[b].id),type:'DEPENDS_ON'}))});
  await page.evaluate(id=>{localStorage.setItem('currentGraphId',id);localStorage.setItem('graphdone:viewMode','graph');},graph);
  await page.goto('/');await expect(page.locator('.graph-container .node')).toHaveCount(6);
  await page.getByRole('button',{name:'Zoom to fit — frame all nodes'}).click();await page.waitForTimeout(650);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  const escapedTitles=await page.locator('.graph-container .node').evaluateAll(nodes=>nodes.filter(node=>{
   const card=node.querySelector('.node-bg')!.getBoundingClientRect();const title=node.querySelector('.node-title-group')!.getBoundingClientRect();
   return title.left<card.left-1||title.right>card.right+1||title.top<card.top-1||title.bottom>card.bottom+1;
  }).length);expect(escapedTitles,'title text stays within its card at overview zoom').toBe(0);
  await page.screenshot({path:`test-artifacts/quality/design-graph-${width}.png`});
  const selector=page.getByTestId(width<768?'graph-selector-mobile':'graph-selector');await selector.click();await expect(page.getByTestId('graph-selector-dropdown')).toBeVisible();
  await page.screenshot({path:`test-artifacts/quality/design-project-menu-${width}.png`});await page.keyboard.press('Escape');await expect(page.getByTestId('graph-selector-dropdown')).toHaveCount(0);
  await page.locator('.graph-container .node').filter({has:page.locator('.node-title-group').filter({hasText:'beds'})}).locator('.node-edit-icon').click();await expect(page.getByTestId('quick-edit-surface')).toBeVisible();
  await page.screenshot({path:`test-artifacts/quality/design-editor-${width}.png`});await page.keyboard.press('Escape');
 }finally{
  await gql(page,'mutation($id:ID!){deleteEdges(where:{source:{graph:{id:$id}}}){nodesDeleted}}',{id:graph});
  await gql(page,'mutation($id:ID!){deleteWorkItems(where:{graph:{id:$id}}){nodesDeleted}}',{id:graph});
  await gql(page,'mutation($id:ID!){deleteGraphs(where:{id:$id}){nodesDeleted}}',{id:graph});
 }
});
