import { test, expect } from '@playwright/test';

// Explicit local opt-in. Uses only local guest fixtures, never production.
test('D1 progress persists into the responsive human workspace @cloudlocal', async ({ page }) => {
  test.skip(process.env.GRAPHDONE_LOCAL_CLOUD !== '1', 'Requires local Worker on 8797 and Cloud-configured SPA on 3129');
  test.setTimeout(90000);
  await page.setViewportSize({ width: 390, height: 844 });
  const guest = await page.request.post('http://localhost:8797/api/guest');
  expect(guest.ok()).toBe(true);
  const { token } = await guest.json();
  const request = async (query: string, variables: unknown = {}) => {
    const res = await page.request.post('http://localhost:8797/api/graphql', { headers: { Authorization: `Bearer ${token}` }, data: { query, variables } });
    const body = await res.json();
    expect(body.errors, JSON.stringify(body.errors)).toBeUndefined();
    return body.data;
  };
  const { createGraphs } = await request('mutation { createGraphs(input:[{name:"D1 progress browser fixture"}]) { graphs { id } } }');
  const graphId = createGraphs.graphs[0].id;
  let itemId: string | undefined;
  try {
    const { createWorkItems } = await request('mutation($input:[WorkItemCreateInput!]!) { createWorkItems(input:$input) { workItems { id } } }', { input: [{ title: 'Progress from the internet service', status: 'IN_PROGRESS', type: 'TASK', graph: { connect: { where: { node: { id: graphId } } } } }] });
    itemId = createWorkItems.workItems[0].id;
    await page.goto('http://localhost:3129');
    await page.evaluate(({ token, graphId }) => { localStorage.setItem('authToken', token); localStorage.setItem('currentGraphId', graphId); }, { token, graphId });
    await page.goto('http://localhost:3129/analytics');
    await expect(page.getByTestId('metric-work-items')).toHaveText('1');
    await expect(page.getByTestId('metric-completed')).toHaveText('0');
    await page.evaluate(() => localStorage.setItem('graphdone:viewMode', 'activity'));
    await page.goto('http://localhost:3129/');
    await expect(page.getByText('Progress from the internet service', { exact: true })).toBeVisible();
    const note = 'D1 saved this progress. Ready for human review.';
    await request('mutation($id:ID!,$update:WorkItemUpdateInput!) { updateWorkItems(where:{id:$id},update:$update) { workItems { id } } }', { id: itemId, update: { status: 'COMPLETED', metadata: JSON.stringify({ statusNotes: [{ id: 'local-progress', text: note, at: Date.now() }] }) } });
    await expect(page.getByText(note, { exact: true })).toBeVisible({ timeout: 25000 });
    await page.reload();
    await expect(page.getByText(note, { exact: true })).toBeVisible();
    await page.screenshot({ path: 'test-artifacts/local-d1-progress-phone.png' });
    await page.goto('http://localhost:3129/analytics');
    await expect(page.getByTestId('metric-completed')).toHaveText('1');
  } finally {
    if (itemId) await request('mutation($id:ID!) { deleteWorkItems(where:{id:$id}) { nodesDeleted } }', { id: itemId });
    await request('mutation($id:ID!) { deleteGraphs(where:{id:$id}) { nodesDeleted } }', { id: graphId });
  }
});
