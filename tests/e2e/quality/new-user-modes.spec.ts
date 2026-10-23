import { test, expect } from '@playwright/test';
import { login, TEST_USERS } from '../../lib/auth';
import { gql } from '../../lib/graphRequest';
const cloud = process.env.QC_BACKEND === 'cloud';
const base = process.env.TEST_URL || 'http://localhost:3127';
const api = process.env.QC_API_URL || 'http://localhost:8797/api/graphql';
const modes = [
  ['cards','List','Card View'], ['dashboard','Dashboard','Dashboard View'],
  ['table','Table','Table View'], ['kanban','Board','Kanban View'],
  ['gantt','Gantt','Gantt Chart'], ['calendar','Calendar','Calendar View'],
  ['activity','Activity','Activity Feed'], ['graph','Graph','Graph View'],
];
for (const [width,height] of [[360,640],[844,390],[1440,900]]) {
  test(`same saved work in all modes ${width}×${height} @newuser`, async ({page},info) => {
    test.setTimeout(120000);
    page.setDefaultTimeout(10000);
    expect(['localhost','127.0.0.1']).toContain(new URL(base).hostname);
    if(cloud) expect(['localhost','127.0.0.1']).toContain(new URL(api).hostname);
    await page.setViewportSize({width,height});
    let token='';
    if(cloud) {
      const guest=await page.request.post(new URL('/api/guest',api).href);
      expect(guest.ok()).toBe(true);
      token=(await guest.json()).token;
      await page.goto(base);
      await page.evaluate(token=>localStorage.setItem('authToken',token),token);
    } else await login(page,TEST_USERS.ADMIN);
    const request=async(query:string,variables:unknown={})=> {
      if(!cloud) return gql(page,query,variables);
      const res=await page.request.post(api,{headers:{Authorization:`Bearer ${token}`},data:{query,variables}});
      const body=await res.json();
      expect(body.errors,JSON.stringify(body.errors)).toBeUndefined();
      return body.data;
    };
    const me=cloud?null:(await request('{me{id}}')).me.id;
    const graph=(await request('mutation($input:[GraphCreateInput!]!){createGraphs(input:$input){graphs{id}}}',{input:[{name:`QC ${width} ${Date.now()}`,type:'PROJECT',status:'ACTIVE',...(cloud?{}:{createdBy:me})}]})).createGraphs.graphs[0].id;
    const ids:string[]=[];
    const errors:string[]=[];
    page.on('pageerror',error=>errors.push(error.message));
    try {
      const dueDate=new Date(); dueDate.setHours(12,0,0,0);
      const items=(await request('mutation($input:[WorkItemCreateInput!]!){createWorkItems(input:$input){workItems{id}}}',{input:[
        {title:'QC scheduled work',status:'IN_PROGRESS',dueDate:dueDate.toISOString(),tags:['qc']},
        {title:'QC finished work',status:'COMPLETED'},
      ].map(item=>({...item,type:'TASK',positionX:0,positionY:0,positionZ:0,graph:{connect:{where:{node:{id:graph}}}}}))})).createWorkItems.workItems;
      ids.push(...items.map((i:{id:string})=>i.id));
      const saved=(await request('query($id:ID!){workItems(where:{graph:{id:$id}}){title dueDate tags}}',{id:graph})).workItems.find((i:{title:string})=>i.title==='QC scheduled work');
      expect(Date.parse(saved.dueDate)).toBe(dueDate.getTime());
      expect(saved.tags).toEqual(['qc']);
      await page.evaluate(id=>{localStorage.setItem('currentGraphId',id);localStorage.setItem('graphdone:viewMode','cards');},graph);
      await page.goto(base);
      const navigation = page.getByTestId('mobile-bottom-nav')
        .or(page.getByRole('combobox',{name:'Workspace view'}))
        .or(page.getByTitle('Card View',{exact:true}));
      await expect(navigation.and(page.locator(':visible')).first()).toBeVisible();
      for(const [mode,label,title] of modes) {
        if(await page.getByTestId('mobile-bottom-nav').isVisible()) {
          const nav=page.getByTestId('mobile-bottom-nav');
          if(mode==='cards'||mode==='graph') await nav.getByRole('button',{name:label,exact:true}).click();
          else {
            await nav.getByRole('button',{name:'More',exact:true}).click();
            await page.getByRole('dialog',{name:'More navigation'}).getByRole('button',{name:label,exact:true}).click();
          }
        } else if(await page.getByRole('combobox',{name:'Workspace view'}).isVisible()) await page.getByRole('combobox',{name:'Workspace view'}).selectOption(mode);
        else await page.getByTitle(title,{exact:true}).click();
        await expect.poll(()=>page.evaluate(()=>localStorage.getItem('graphdone:viewMode'))).toBe(mode);
        const scope=mode==='graph'?page.locator('.graph-container'):page.getByTestId('view-content');
        await expect(scope.getByText('QC scheduled work',{exact:true}).and(page.locator(':visible')).first()).toBeVisible({timeout:15000});
        if(mode==='gantt') await expect(scope.getByText('Unscheduled',{exact:true}).and(page.locator(':visible')).first()).toBeVisible();
        expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth),mode).toBeLessThanOrEqual(2);
        await info.attach(`${cloud?'d1':'core'}-${width}-${mode}`,{body:await page.screenshot({path:`test-artifacts/quality/${cloud?'d1':'core'}-${width}-${mode}.png`}),contentType:'image/png'});
      }
      await page.goto(`${base}/analytics`);
      await expect(page.getByTestId('metric-work-items')).toHaveText('2');
      await expect(page.getByTestId('metric-completed')).toHaveText('1');
      await page.reload();
      await expect(page.getByTestId('metric-work-items')).toHaveText('2');
      expect(errors).toEqual([]);
    } finally {
      for(const id of ids) await request('mutation($id:ID!){deleteWorkItems(where:{id:$id}){nodesDeleted}}',{id});
      await request('mutation($id:ID!){deleteGraphs(where:{id:$id}){nodesDeleted}}',{id:graph});
    }
  });
}
