import {test,expect,type Route} from '@playwright/test';
import {login,TEST_USERS} from '../../lib/auth';
import {gql} from '../../lib/graphRequest';

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
  expect(spot,'a reachable empty canvas point is required').toBeTruthy();await page.mouse.click(spot![0],spot![1]);
  const rename = page.getByTestId('inline-rename');
  const original = await rename.inputValue();
  const renamed = 'Review the demo together';
  const grown = await read();
  expect(grown.workItems).toHaveLength(2);
  const child = grown.workItems.find((item: { id: string }) => item.id !== before.id);
  expect(grown.edges).toEqual([{ id: expect.any(String), source: { id: child.id }, target: { id: before.id } }]);
  const readChild = async () => {
    const state = await read();
    return { title: state.workItems.find((item: { id: string }) => item.id === child.id)?.title, edges: state.edges };
  };

  let releaseRefetch!: () => void;
  const pending = new Promise<void>(resolve => { releaseRefetch = resolve; });
  let sawRename = false;
  let continueRefetch: Promise<void> | undefined;
  const holdRenameRefetch = async (route: Route) => {
    const body = route.request().method() === 'POST' ? route.request().postDataJSON() : undefined;
    if (body?.operationName === 'UpdateWorkItems' && body.variables?.where?.id === child.id && body.variables?.update?.title === renamed) sawRename = true;
    const scope = body?.variables?.where?.OR;
    if (sawRename && !continueRefetch && body?.operationName === 'GetEdges' && scope?.some((end: { source?: { graph?: { id: string } } }) => end.source?.graph?.id === graph)) {
      continueRefetch = pending.then(() => route.continue());
      return continueRefetch;
    }
    return route.continue();
  };
  await page.route('**/api/graphql', holdRenameRefetch);
  try {
    await rename.fill(renamed);
    await rename.press('Enter');
    await expect.poll(readChild).toEqual({ title: renamed, edges: grown.edges });
    await expect(page.getByRole('button', { name: `Quick edit ${renamed}`, exact: true })).toBeVisible();
    await expect.poll(() => Boolean(continueRefetch)).toBe(true);
    await page.keyboard.press('Control+z');
    await expect.poll(readChild).toEqual({ title: original, edges: grown.edges });
  } finally {
    releaseRefetch();
    await continueRefetch;
    await page.unroute('**/api/graphql', holdRenameRefetch);
  }

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
