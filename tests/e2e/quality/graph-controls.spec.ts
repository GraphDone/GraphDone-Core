import {test,expect} from '@playwright/test';
import {login,TEST_USERS} from '../../lib/auth';
import {gql} from '../../lib/graphRequest';
import {TYPE_OPTIONS,STATUS_OPTIONS} from '../../../packages/web/src/constants/workItemConstants';
// Enumerate the offered controls, but independently verify each saved value.
for(const [width,height] of [[390,844],[1440,900]])test(`every quick editor type and status saves ${width} @controls`,async({page},info)=>{
 test.setTimeout(120000);await page.setViewportSize({width,height});await login(page,TEST_USERS.ADMIN);
 const me=(await gql(page,'{me{id}}')).me.id;
 const graph=(await gql(page,'mutation($input:[GraphCreateInput!]!){createGraphs(input:$input){graphs{id}}}',{input:[{name:`Controls QC ${Date.now()}`,type:'PROJECT',status:'ACTIVE',createdBy:me}]})).createGraphs.graphs[0].id;
 try{
  const id=(await gql(page,'mutation($input:[WorkItemCreateInput!]!){createWorkItems(input:$input){workItems{id}}}',{input:[{title:'Control coverage',type:'TASK',status:'PLANNED',positionX:400,positionY:300,positionZ:0,graph:{connect:{where:{node:{id:graph}}}}}]})).createWorkItems.workItems[0].id;
  const saved=async()=>(await gql(page,'query($id:ID!){workItems(where:{id:$id}){type status priority description}}',{id})).workItems[0];
  await page.evaluate(id=>{localStorage.setItem('currentGraphId',id);localStorage.setItem('graphdone:viewMode','graph');},graph);await page.goto('/');
  await page.locator('.graph-container .node .node-edit-icon').click();
  const exercised=[];
  for(const [field,options] of [['type',TYPE_OPTIONS],['status',STATUS_OPTIONS]] as const){
   for(const option of options.filter(o=>o.value!=='all')){
    const button=page.getByTestId(`quick-${field}`).getByRole('button',{name:option.label,exact:true});
    await button.click();await expect.poll(async()=>(await saved())[field]).toBe(option.value);
    await expect(button).toHaveAttribute('aria-pressed','true');exercised.push(`${field}:${option.value}`);
   }
  }
  await page.getByTestId('quick-description').fill('Description saved through the graph');await page.getByTestId('quick-description').blur();
  await expect.poll(async()=>(await saved()).description).toBe('Description saved through the graph');
  const priority=page.getByRole('slider',{name:'Priority'});await priority.focus();await priority.press('End');await priority.press('ArrowLeft');
  await expect.poll(async()=>(await saved()).priority).toBe(.95);
  await page.getByRole('button',{name:'Close quick edit',exact:true}).click();await expect(page.getByTestId('quick-edit-surface')).toHaveCount(0);
  await info.attach('controls.json',{body:JSON.stringify({width,exercised}),contentType:'application/json'});
 }finally{await gql(page,'mutation($id:ID!){deleteWorkItems(where:{graph:{id:$id}}){nodesDeleted}}',{id:graph});await gql(page,'mutation($id:ID!){deleteGraphs(where:{id:$id}){nodesDeleted}}',{id:graph});}
});

test('a quick editor switches to inspection when graph editing is revoked @controls', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await login(page, TEST_USERS.ADMIN);
  const owner = (await gql(page, '{me{id}}')).me.id;
  const graph = (await gql(page, 'mutation($input:[GraphCreateInput!]!){createGraphs(input:$input){graphs{id}}}', {
    input: [{ name: `Quick editor ACL ${Date.now()}`, type: 'PROJECT', status: 'ACTIVE', createdBy: owner }],
  })).createGraphs.graphs[0].id;
  try {
    const item = (await gql(page, 'mutation($input:[WorkItemCreateInput!]!){createWorkItems(input:$input){workItems{id}}}', {
      input: [{ title: 'Review the release notes', type: 'TASK', status: 'PLANNED', positionX: 400, positionY: 300, positionZ: 0, graph: { connect: { where: { node: { id: graph } } } } }],
    })).createWorkItems.workItems[0].id;
    const status = async () => (await gql(page, 'query($id:ID!){workItems(where:{id:$id}){status}}', { id: item })).workItems[0].status;
    await page.evaluate(id => {
      localStorage.setItem('currentGraphId', id);
      localStorage.setItem('graphdone:viewMode', 'graph');
    }, graph);
    await page.goto('/');
    const trigger = page.getByRole('button', { name: 'Quick edit Review the release notes', exact: true });
    await trigger.click();
    await expect(page.getByRole('dialog', { name: 'Edit work item', exact: true })).toBeVisible();
    const onHold = page.getByTestId('quick-status').getByRole('button', { name: 'On Hold', exact: true });
    await onHold.click();
    await expect(onHold).toHaveAttribute('aria-pressed', 'true');
    expect(await status()).toBe('ON_HOLD');

    const laterWrites: string[] = [];
    page.on('request', request => {
      if (request.method() !== 'POST' || !request.url().endsWith('/api/graphql')) return;
      const body = request.postDataJSON();
      if (body?.operationName === 'UpdateWorkItems' && body.variables?.where?.id === item) laterWrites.push(body.operationName);
    });
    await gql(page, 'mutation($id:ID!,$acl:String!){updateGraphs(where:{id:$id},update:{permissions:$acl}){graphs{id}}}', {
      id: graph, acl: JSON.stringify({ owner: 'fixture-owner', admins: [], editors: [], viewers: [owner], teamPermission: 'VIEW' }),
    });
    await page.evaluate(() => window.dispatchEvent(new Event('graphdone-sync-refresh')));
    const inspection = page.getByRole('dialog', { name: 'Inspect work item', exact: true });
    await expect(inspection).toBeVisible();
    await expect(inspection.getByText('Review the release notes', { exact: true })).toBeVisible();
    await expect(page.getByTestId('node-quick-edit')).toHaveCount(0);
    await inspection.getByRole('button', { name: 'Close' }).click();
    await page.getByRole('button', { name: 'Inspect Review the release notes', exact: true }).click();
    await expect(inspection).toBeVisible();
    await expect(inspection.getByRole('button', { name: 'On Hold', exact: true })).toHaveCount(0);
    expect(await status()).toBe('ON_HOLD');
    expect(laterWrites).toEqual([]);
  } finally {
    await gql(page, 'mutation($id:ID!){deleteWorkItems(where:{graph:{id:$id}}){nodesDeleted}}', { id: graph });
    await gql(page, 'mutation($id:ID!){deleteGraphs(where:{id:$id}){nodesDeleted}}', { id: graph });
  }
});
