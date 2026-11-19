import {test,expect,type Page,type Route} from '@playwright/test';
import {login,TEST_USERS} from '../../lib/auth';
import {gql} from '../../lib/graphRequest';

async function withHeldRead(page: Page, ready: (body: any) => boolean, matches: (body: any) => boolean, run: (held: () => boolean) => Promise<void>) {
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  let continueRead: Promise<void> | undefined;
  let sawWrite = false;
  const route = (request: Route) => {
    const body = request.request().method() === 'POST' ? request.request().postDataJSON() : undefined;
    sawWrite ||= ready(body);
    if (sawWrite && !continueRead && matches(body)) {
      continueRead = pending.then(() => request.continue());
      return continueRead;
    }
    return request.continue();
  };
  await page.route('**/graphql', route);
  try {
    await run(() => Boolean(continueRead));
  } finally {
    release();
    await continueRead;
    await page.unroute('**/graphql', route);
  }
}

test('build, arrange and update a graph entirely through its UI @graphfirst',async({page})=>{
 test.setTimeout(120000);await page.setViewportSize({width:1440,height:900});await login(page,TEST_USERS.ADMIN);
 await page.getByTestId('graph-selector').click();await page.getByRole('button',{name:'Create New Graph',exact:true}).click();
 const create=page.getByRole('dialog',{name:'Create new graph'});await create.getByRole('button',{name:'Continue',exact:true}).click();
 const name=`Graph-first sequence ${Date.now()}`;await create.getByPlaceholder('Enter a descriptive name for your graph').fill(name);
 const created=page.waitForResponse(r=>r.url().includes('graphql')&&r.request().postData()?.includes('mutation CreateGraph(')===true);
 await create.getByRole('button',{name:'Create Graph',exact:true}).click();
 const graph=(await(await created).json()).data.createGraphs.graphs[0].id;
 const read=async()=>gql(page,'query($id:ID!){workItems(where:{graph:{id:$id}}){id title status metadata positionX positionY} edges(where:{source:{graph:{id:$id}}}){id source{id} target{id}}}',{id:graph});
 try{
  await expect(page.getByTestId('graph-selector-name').and(page.locator(':visible'))).toHaveText(name);
  await page.getByRole('button',{name:'New work item',exact:true}).click();await page.getByPlaceholder('Enter a descriptive title for your work item').fill('Prepare the project demo');await page.getByRole('button',{name:'Create Work Item',exact:true}).click();
  await expect(page.locator('.graph-container .node')).toHaveCount(1);await page.getByRole('button',{name:'Zoom to fit — frame all nodes'}).click();await page.waitForTimeout(600);
  const node=page.locator('.graph-container .node').first();const box=await node.boundingBox();const before=(await read()).workItems[0];
  await page.mouse.move(box!.x+box!.width/2,box!.y+box!.height/2);await page.mouse.down();await page.mouse.move(box!.x+box!.width/2+100,box!.y+box!.height/2+70,{steps:24});await page.mouse.up();
  await expect.poll(async()=>{const n=(await read()).workItems[0];return Math.hypot(n.positionX-before.positionX,n.positionY-before.positionY);}).toBeGreaterThan(40);
  await node.locator('.node-relationship-icon').click();await expect(page.getByText('Click empty space to grow',{exact:false})).toBeVisible();
  const spot=await page.evaluate(()=>[[400,350],[600,600],[1000,350]].find(([x,y])=>document.elementFromPoint(x,y)?.classList.contains('background')));
  expect(spot,'a reachable empty canvas point is required').toBeTruthy();
  const rename = page.getByTestId('inline-rename');
  await withHeldRead(page,
    body => body?.operationName === 'CreateWorkItems' && body.variables?.input?.[0]?.graph?.connect?.where?.node?.id === graph,
    body => body?.operationName === 'GetWorkItems' && body.variables?.where?.graph?.id === graph,
    async held => {
      await page.mouse.click(spot![0],spot![1]);
      await expect(rename).toBeVisible();
      await expect.poll(held).toBe(true);
      const committed = await read();
      expect(committed.workItems).toHaveLength(2);
      const created = committed.workItems.find((item: { id: string }) => item.id !== before.id);
      expect(committed.edges).toEqual([{ id: expect.any(String), source: { id: created.id }, target: { id: before.id } }]);
    }
  );
  const original = await rename.inputValue();
  const renamed = 'Review the demo together';
  const grown = await read();
  const child = grown.workItems.find((item: { id: string }) => item.id !== before.id);
  const readChild = async () => {
    const state = await read();
    return { title: state.workItems.find((item: { id: string }) => item.id === child.id)?.title, edges: state.edges };
  };

  await withHeldRead(page,
    body => body?.operationName === 'UpdateWorkItems' && body.variables?.where?.id === child.id && body.variables?.update?.title === renamed,
    body => body?.operationName === 'GetEdges' && body.variables?.where?.OR?.some((end: { source?: { graph?: { id: string } } }) => end.source?.graph?.id === graph),
    async held => {
      await rename.fill(renamed);
      await rename.press('Enter');
      await expect.poll(readChild).toEqual({ title: renamed, edges: grown.edges });
      await expect(page.getByRole('button', { name: `Quick edit ${renamed}`, exact: true })).toBeVisible();
      await expect.poll(held).toBe(true);
      await page.keyboard.press('Control+z');
      await expect.poll(readChild).toEqual({ title: original, edges: grown.edges });
    }
  );

  await page.getByRole('button', { name: `Quick edit ${original}`, exact: true }).click();
  await page.getByTestId('quick-title').fill(renamed);
  await page.getByTestId('quick-title').press('Enter');
  await expect.poll(readChild).toEqual({ title: renamed, edges: grown.edges });
  await page.getByRole('button', { name: 'Close quick edit', exact: true }).click();
  await page.locator('.graph-container .node').filter({hasText:'Prepare'}).locator('.node-edit-icon').click();await page.getByTestId('quick-note-input').fill('Ready for a teammate to review.');await page.getByTestId('quick-note-add').click();await page.getByTestId('quick-status').getByRole('button',{name:'In Review',exact:true}).click();
  await expect.poll(async()=>(await read()).workItems.find((n:any)=>n.id===before.id).status).toBe('IN_REVIEW');await page.keyboard.press('Escape');
  await page.reload();await expect(page.locator('.graph-container .node')).toHaveCount(2);
  const saved=await read();expect(JSON.stringify(saved.workItems.find((n:any)=>n.id===before.id).metadata)).toContain('Ready for a teammate to review.');expect(saved.edges).toHaveLength(1);
  await page.screenshot({path:'test-artifacts/quality/graph-first-sequence.png'});
 }finally{
  await gql(page,'mutation($id:ID!){deleteEdges(where:{source:{graph:{id:$id}}}){nodesDeleted}}',{id:graph});await gql(page,'mutation($id:ID!){deleteWorkItems(where:{graph:{id:$id}}){nodesDeleted}}',{id:graph});await gql(page,'mutation($id:ID!){deleteGraphs(where:{id:$id}){nodesDeleted}}',{id:graph});
 }
});
