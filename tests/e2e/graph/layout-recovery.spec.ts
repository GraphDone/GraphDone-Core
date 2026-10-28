import { test as base, expect, chromium, type Page, type Route, type Browser, type BrowserContext } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import neo4j from 'neo4j-driver';
import { login, logout, TEST_USERS, getBaseURL } from '../../lib/auth';
import { gql } from '../../lib/graphRequest';
import { deleteGraphDeep } from '../../lib/seedGraph';
import { ownedGraphIdsFixture, type OwnedGraphs } from '../../lib/ownedGraphIdsFixture';

const test = base.extend<{ ownedGraphIds: OwnedGraphs }>({ ownedGraphIds: [ownedGraphIdsFixture, { timeout: 60000 }] });
test.use({ viewport: { width: 1440, height: 900 }, actionTimeout: 10000 });
const rounded = (position: { x: number; y: number }) => ({ x: +position.x.toFixed(3), y: +position.y.toFixed(3) });

async function openGraph(page: Page, graphId: string, size = 2) {
  await page.evaluate(id => {
    localStorage.setItem('currentGraphId', id);
    localStorage.setItem('graphdone:viewMode', 'graph');
  }, graphId);
  await page.goto(getBaseURL());
  await expect(page.locator('.graph-container svg .node')).toHaveCount(size);
}

async function readPosition(page: Page, nodeId: string) {
  return page.locator('.graph-container svg .node').evaluateAll((elements, id) => {
    const data = elements.map(element => (element as Element & { __data__?: { id: string; x: number; y: number } }).__data__).find(item => item?.id === id);
    return data ? { x: data.x, y: data.y } : null;
  }, nodeId);
}

async function readSaved(page: Page, graphId: string, nodeId: string) {
  const result = await gql(page, 'query($graph:ID!){workItems(where:{graph:{id:$graph}}){id positionX positionY}}', { graph: graphId });
  const node = result.workItems.find((item: { id: string }) => item.id === nodeId);
  expect(node).toBeDefined();
  return { x: node.positionX as number, y: node.positionY as number };
}

async function readReceipt(page: Page, graphId: string, nodeId: string) {
  const owner = (await gql(page, '{me{id}}')).me.id as string;
  return page.evaluate(async ({ owner, graphId, nodeId }) => {
    const account = await new Promise<any>((resolve, reject) => {
      const open = indexedDB.open('graphdone-offline', 1);
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const database = open.result;
        const request = database.transaction('accounts').objectStore('accounts').get(owner);
        request.onerror = () => { database.close(); reject(request.error); };
        request.onsuccess = () => { database.close(); resolve(request.result); };
      };
    });
    const receipt = account?.layoutOutbox?.graphs?.[JSON.stringify(graphId)]?.[JSON.stringify(nodeId)];
    return { receipt, credentialFound: /authToken|Bearer |sessionToken/.test(JSON.stringify(account?.layoutOutbox || {})) };
  }, { owner, graphId, nodeId });
}

async function drag(page: Page, nodeId: string) {
  const card = page.locator('.graph-container svg .node').filter({ has: page.locator(`[data-node-id="${nodeId}"]`) }).locator('.node-bg');
  await expect(card).toBeInViewport({ ratio: 1 });
  let previous: { x: number; y: number } | null = null;
  let stable = 0;
  await expect.poll(async () => {
    const box = await card.boundingBox();
    if (!box) return 0;
    stable = previous && Math.hypot(box.x - previous.x, box.y - previous.y) < 1 ? stable + 1 : 0;
    previous = box;
    return stable;
  }, { timeout: 10000, intervals: [150] }).toBeGreaterThanOrEqual(3);
  const box = (await card.boundingBox())!;
  const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await page.mouse.move(center.x, center.y);
  await page.mouse.down();
  await page.mouse.move(center.x + 75, center.y + 45, { steps: 12 });
  await page.mouse.up();
  const position = await readPosition(page, nodeId);
  expect(position).not.toBeNull();
  return position!;
}

function failLayout(graphId: string, nodeId: string, attempts: Array<{ x: number; y: number }>) {
  return async (route: Route) => {
    const body = route.request().method() === 'POST' ? route.request().postDataJSON() : null;
    const update = body?.variables?.update;
    if (body?.operationName !== 'UpdateWorkItems' || body?.variables?.where?.id !== nodeId || body?.variables?.where?.graph?.id !== graphId || Object.keys(update || {}).sort().join(',') !== 'positionX,positionY') {
      await route.continue();
      return;
    }
    attempts.push({ x: update.positionX, y: update.positionY });
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ errors: [{ message: 'Owned layout recovery outage' }] }) });
  };
}

async function holdLayoutReads(context: BrowserContext) {
  const gate = await context.newPage();
  await gate.goto(new URL('/health', getBaseURL()).href);
  await gate.evaluate(async () => new Promise<void>((resolve, reject) => {
    const open = indexedDB.open('graphdone-offline', 1);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const database = open.result;
      const transaction = database.transaction('accounts', 'readwrite');
      const store = transaction.objectStore('accounts');
      const deadline = Date.now() + 20000;
      (window as any).__holdLayoutRead = true;
      const next = () => {
        const request = store.get('owned-hydration-gate');
        request.onsuccess = () => {
          resolve();
          if ((window as any).__holdLayoutRead && Date.now() < deadline) next();
        };
      };
      transaction.oncomplete = () => { database.close(); (window as any).__layoutGateDone = true; };
      transaction.onabort = () => { database.close(); reject(transaction.error); };
      next();
    };
  }));
  return async () => {
    await gate.evaluate(() => { (window as any).__holdLayoutRead = false; });
    await expect.poll(() => gate.evaluate(() => !!(window as any).__layoutGateDone)).toBe(true);
    await gate.close();
  };
}

test('latest real drag survives reload before acknowledgement and delayed IndexedDB hydration @layout-recovery', async ({ page, context, ownedGraphIds }, info) => {
  test.setTimeout(90000);
  await login(page, TEST_USERS.ADMIN);
  const graph = await ownedGraphIds.seed({ size: 2, spacing: 600, edgeFactor: 0.5, namePrefix: 'Durable reload' });
  await openGraph(page, graph.graphId);
  const nodeId = graph.nodeIds[0];
  const initial = await readSaved(page, graph.graphId, nodeId);
  const attempts: Array<{ x: number; y: number }> = [];
  const route = failLayout(graph.graphId, nodeId, attempts);
  await page.route('**/api/graphql', route);
  const first = await drag(page, nodeId);
  await expect.poll(() => attempts.length).toBe(1);
  const latest = await drag(page, nodeId);
  expect(Math.hypot(latest.x - first.x, latest.y - first.y)).toBeGreaterThan(10);
  await expect.poll(() => attempts.length).toBe(2);
  await expect(page.getByTestId('layout-save-status')).toContainText('1 saved on this device; 0 pending only in this tab');
  const durable = await readReceipt(page, graph.graphId, nodeId);
  expect(rounded(durable.receipt)).toEqual(rounded(latest));
  expect(durable.credentialFound).toBe(false);
  expect(await readSaved(page, graph.graphId, nodeId)).toEqual(initial);
  const releaseReads = await holdLayoutReads(context);
  try {
    const graphResponse = page.waitForResponse(response => response.url().includes('/graphql') && response.request().postData()?.includes('GetWorkItems') === true);
    await page.reload();
    await graphResponse;
    await expect(page.getByText('Recovering saved layout...', { exact: true })).toBeVisible();
    await expect(page.locator('.graph-container svg .node')).toHaveCount(0);
  } finally {
    await releaseReads();
  }
  await expect(page.locator('.graph-container svg .node')).toHaveCount(2);
  await expect.poll(async () => { const value = await readPosition(page, nodeId); return value && rounded(value); }).toEqual(rounded(latest));
  expect(await readSaved(page, graph.graphId, nodeId)).toEqual(initial);
  await expect(page.getByTestId('layout-save-status')).toContainText('Waiting to send 1 layout change');
  await page.unroute('**/api/graphql', route);
  await page.getByRole('button', { name: 'Retry layout save' }).click();
  await expect.poll(async () => rounded(await readSaved(page, graph.graphId, nodeId))).toEqual(rounded(latest));
  await expect(page.getByTestId('layout-save-status')).toHaveText('Layout saved to the server.');
  expect((await readReceipt(page, graph.graphId, nodeId)).receipt).toBeUndefined();
  await page.reload();
  await expect.poll(async () => { const value = await readPosition(page, nodeId); return value && rounded(value); }).toEqual(rounded(latest));
  await info.attach('layout-reload.json', { contentType: 'application/json', body: JSON.stringify({ graphId: graph.graphId, nodeId, initial, first, latest, attempts, independentReadback: await readSaved(page, graph.graphId, nodeId) }) });
});

async function startOwnedBrowser(profile: string) {
  await rm(join(profile, 'DevToolsActivePort'), { force: true });
  const executable = process.env.QC_BROWSER_PORT ? '/opt/google/chrome/chrome' : chromium.executablePath();
  const child = spawn(executable, ['--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--no-first-run', '--no-default-browser-check', '--remote-debugging-address=127.0.0.1', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore', detached: true });
  let browser: Browser | undefined;
  try {
    let port = '';
    await expect.poll(async () => {
      expect(child.exitCode).toBeNull();
      try { port = (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; return /^\d+$/.test(port); }
      catch { return false; }
    }, { timeout: 10000 }).toBe(true);
    browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
    return { process: child, browser, page: browser.contexts()[0].pages()[0] };
  } catch (error) {
    await stopOwnedBrowser(child, browser);
    throw error;
  }
}

async function killOwnedBrowser(child: ChildProcess) {
  const exited = child.exitCode === null && child.signalCode === null ? once(child, 'exit') : Promise.resolve();
  try { process.kill(-child.pid!, 'SIGKILL'); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error; }
  await exited;
}

async function stopOwnedBrowser(child: ChildProcess, browser?: Browser) {
  await killOwnedBrowser(child);
  await browser?.close().catch(() => undefined);
}

test('a killed owned browser process recovers committed layout receipts from its retained profile @layout-recovery', async ({ page, ownedGraphIds }, info) => {
  test.setTimeout(90000);
  await login(page, TEST_USERS.ADMIN);
  const graph = await ownedGraphIds.seed({ size: 2, spacing: 600, edgeFactor: 0.5, namePrefix: 'Durable process restart' });
  const nodeId = graph.nodeIds[0];
  const initial = await readSaved(page, graph.graphId, nodeId);
  const profile = await mkdtemp(join(tmpdir(), 'graphdone-layout-owned-profile-'));
  let owned: Awaited<ReturnType<typeof startOwnedBrowser>> | undefined;
  let unloads = 0;
  try {
    owned = await startOwnedBrowser(profile);
    await owned.page.setViewportSize({ width: 1440, height: 900 });
    await login(owned.page, TEST_USERS.ADMIN);
    await openGraph(owned.page, graph.graphId);
    const attempts: Array<{ x: number; y: number }> = [];
    await owned.page.route('**/api/graphql', failLayout(graph.graphId, nodeId, attempts));
    const first = await drag(owned.page, nodeId);
    await expect.poll(() => attempts.length).toBe(1);
    const latest = await drag(owned.page, nodeId);
    await expect.poll(() => attempts.length).toBe(2);
    await expect(owned.page.getByTestId('layout-save-status')).toContainText('1 saved on this device; 0 pending only in this tab');
    expect(rounded((await readReceipt(owned.page, graph.graphId, nodeId)).receipt)).toEqual(rounded(latest));
    expect(await readSaved(page, graph.graphId, nodeId)).toEqual(initial);
    await owned.page.exposeFunction('ownedUnloadObserved', () => { unloads++; });
    await owned.page.evaluate(() => addEventListener('beforeunload', () => { void (window as any).ownedUnloadObserved(); }));
    await killOwnedBrowser(owned.process);
    expect(owned.process.signalCode).toBe('SIGKILL');
    expect(unloads).toBe(0);
    owned = await startOwnedBrowser(profile);
    await owned.page.setViewportSize({ width: 1440, height: 900 });
    await owned.page.goto(getBaseURL());
    await expect(owned.page.getByTestId('graph-selector')).toBeVisible();
    await expect.poll(async () => rounded(await readSaved(page, graph.graphId, nodeId))).toEqual(rounded(latest));
    await expect.poll(async () => { const value = await readPosition(owned!.page, nodeId); return value && rounded(value); }).toEqual(rounded(latest));
    expect((await readReceipt(owned.page, graph.graphId, nodeId)).receipt).toBeUndefined();
    await owned.page.reload();
    await expect.poll(async () => { const value = await readPosition(owned!.page, nodeId); return value && rounded(value); }).toEqual(rounded(latest));
    await info.attach('layout-process-restart.json', { contentType: 'application/json', body: JSON.stringify({ graphId: graph.graphId, nodeId, initial, first, latest, attempts, signal: 'SIGKILL', unloads, independentReadback: await readSaved(page, graph.graphId, nodeId) }) });
  } finally {
    if (owned) await stopOwnedBrowser(owned.process, owned.browser);
    await rm(profile, { recursive: true, force: true });
  }
});


test('graph switch stops the previous simulation before delayed layout hydration @layout-recovery', async ({ page, context, ownedGraphIds }) => {
  test.setTimeout(90000);
  await login(page, TEST_USERS.ADMIN);
  const first = await ownedGraphIds.seed({ size: 2, spacing: 600, edgeFactor: 0.5, namePrefix: 'Hydration source' });
  const second = await ownedGraphIds.seed({ size: 2, spacing: 600, edgeFactor: 0.5, namePrefix: 'Hydration destination' });
  const graphs = (await gql(page, '{graphs{id name}}')).graphs as Array<{id: string; name: string}>;
  await openGraph(page, first.graphId);
  await expect.poll(() => page.evaluate(() => (window as any).__layoutMetrics?.()?.atRest)).toBe(true);
  await page.evaluate(() => {
    const node = document.querySelector('.graph-container svg .node') as Element & {__data__: {x: number}};
    node.__data__.x += 30;
  });
  const releaseReads = await holdLayoutReads(context);
  try {
    await page.getByTestId('graph-selector').click();
    await page.getByTestId('graph-selector-dropdown').getByText(graphs.find(graph => graph.id === second.graphId)!.name, {exact: true}).click();
    await page.keyboard.press('Escape');
    await expect(page.getByText('Recovering saved layout...', {exact: true})).toBeVisible();
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide')));
    await expect(page.getByText('Layout needs attention', {exact: true})).toHaveCount(0);
  } finally { await releaseReads(); }
  await expect(page.locator('.graph-container svg .node')).toHaveCount(2);
  expect((await readReceipt(page, second.graphId, first.nodeIds[0])).receipt).toBeUndefined();
  expect((await readReceipt(page, second.graphId, first.nodeIds[1])).receipt).toBeUndefined();
  await expect(page.getByTestId('layout-save-status')).toHaveCount(0);
});

test('quota-failed stale work cannot overwrite a newer real tab save @layout-recovery', async ({ page, context, ownedGraphIds }) => {
  test.setTimeout(90000);
  await login(page, TEST_USERS.ADMIN);
  const graph = await ownedGraphIds.seed({ size: 2, spacing: 600, edgeFactor: 0.5, namePrefix: 'Volatile tab conflict' });
  const nodeId = graph.nodeIds[0];
  await openGraph(page, graph.graphId);
  await page.evaluate(({ graphId, nodeId }) => {
    const original = IDBObjectStore.prototype.put;
    (window as any).__failOwnedLayout = true;
    IDBObjectStore.prototype.put = function(value, ...args) {
      if ((window as any).__failOwnedLayout && this.name === 'accounts' && value?.layoutOutbox?.graphs?.[JSON.stringify(graphId)]?.[JSON.stringify(nodeId)]) throw new DOMException('Owned layout quota failure', 'QuotaExceededError');
      return original.call(this, value, ...args);
    };
  }, { graphId: graph.graphId, nodeId });
  await drag(page, nodeId);
  await expect(page.getByTestId('layout-save-status')).toContainText('0 saved on this device; 1 pending only in this tab');
  await expect(page.getByTestId('layout-save-status')).toContainText('Layout recovery is unavailable');
  const other = await context.newPage();
  try {
    await other.goto(getBaseURL());
    await openGraph(other, graph.graphId);
    const newest = await drag(other, nodeId);
    await expect(other.getByTestId('layout-save-status')).toHaveText('Layout saved to the server.');
    await page.evaluate(() => { (window as any).__failOwnedLayout = false; });
    await page.getByRole('button', { name: 'Retry layout save' }).click();
    await expect(page.getByTestId('layout-save-status')).toContainText('Another tab changed this layout');
    expect(rounded(await readSaved(page, graph.graphId, nodeId))).toEqual(rounded(newest));
    await page.getByRole('button', { name: 'Discard unsent layout' }).click();
    await expect(page.getByTestId('layout-save-status')).toHaveCount(0);
    await page.reload();
    await expect.poll(async () => { const value = await readPosition(page, nodeId); return value && rounded(value); }).toEqual(rounded(newest));
  } finally { await other.close(); }
});

test('logout and another account do not replay or expose the previous owner pending layout @layout-recovery', async ({ page, browser, ownedGraphIds }) => {
  test.setTimeout(120000);
  await login(page, TEST_USERS.ADMIN);
  const graph = await ownedGraphIds.seed({ size: 2, spacing: 600, edgeFactor: 0.5, namePrefix: 'Account isolated recovery' });
  const nodeId = graph.nodeIds[0];
  const initial = await readSaved(page, graph.graphId, nodeId);
  const isolated = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const editor = await isolated.newPage();
  try {
    await login(editor, TEST_USERS.ADMIN);
    await openGraph(editor, graph.graphId);
    const attempts: Array<{ x: number; y: number }> = [];
    const route = failLayout(graph.graphId, nodeId, attempts);
    await editor.route('**/api/graphql', route);
    const latest = await drag(editor, nodeId);
    await expect(editor.getByTestId('layout-save-status')).toContainText('1 saved on this device; 0 pending only in this tab');
    await logout(editor);
    expect(await editor.evaluate(() => localStorage.getItem('authToken'))).toBeNull();
    await editor.unroute('**/api/graphql', route);
    await editor.evaluate(() => window.dispatchEvent(new Event('online')));
    expect(await readSaved(page, graph.graphId, nodeId)).toEqual(initial);
    await login(editor, TEST_USERS.VIEWER, { forceReauth: true, retries: 1 });
    await openGraph(editor, graph.graphId);
    expect(await readSaved(page, graph.graphId, nodeId)).toEqual(initial);
    await editor.goto(new URL('/settings', getBaseURL()).href);
    await expect(editor.getByTestId('layout-recovery-settings')).toContainText('No pending layouts for this account on this device');
    await expect(editor.getByTestId(`layout-recovery-${graph.graphId}`)).toHaveCount(0);
    await logout(editor);
    await login(editor, TEST_USERS.ADMIN, { forceReauth: true, retries: 1 });
    await openGraph(editor, graph.graphId);
    await expect.poll(async () => rounded(await readSaved(page, graph.graphId, nodeId))).toEqual(rounded(latest));
    expect((await readReceipt(editor, graph.graphId, nodeId)).receipt).toBeUndefined();
  } finally { await isolated.close(); }
});

test('revoked graph writes and deleted graphs retain scoped recovery until explicit Settings discard @layout-recovery', async ({ page, ownedGraphIds }) => {
  test.setTimeout(90000);
  if (!process.env.NEO4J_URI || !process.env.NEO4J_USER || !process.env.NEO4J_PASSWORD) throw new Error('Layout access acceptance requires explicit owned Neo4j fixture credentials.');
  await login(page, TEST_USERS.ADMIN);
  const graph = await ownedGraphIds.seed({ size: 2, spacing: 600, edgeFactor: 0.5, namePrefix: 'Revoked layout recovery' });
  const nodeId = graph.nodeIds[0];
  const owner = (await gql(page, '{me{id}}')).me.id as string;
  const initial = await readSaved(page, graph.graphId, nodeId);
  const revoked = `owned-layout-revoked-${graph.graphId}`;
  const driver = neo4j.driver(process.env.NEO4J_URI, neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD));
  const session = driver.session();
  try {
    await openGraph(page, graph.graphId);
    const attempts: Array<{ x: number; y: number }> = [];
    const route = failLayout(graph.graphId, nodeId, attempts);
    await page.route('**/api/graphql', route);
    await drag(page, nodeId);
    await expect(page.getByTestId('layout-save-status')).toContainText('1 saved on this device; 0 pending only in this tab');
    const changed = await session.run('MATCH (g:Graph {id:$id,createdBy:$owner}) SET g.createdBy=$revoked RETURN g.id AS id', { id: graph.graphId, owner, revoked });
    expect(changed.records.map(record => record.get('id'))).toEqual([graph.graphId]);
    await page.unroute('**/api/graphql', route);
    await page.reload();
    await expect(page.getByTestId('layout-save-status')).toContainText('The task position was not saved');
    await expect(page.getByTestId('layout-save-status')).toContainText('Waiting to send 1 layout change');
    expect(await readSaved(page, graph.graphId, nodeId)).toEqual(initial);
    expect((await readReceipt(page, graph.graphId, nodeId)).receipt).toBeDefined();
    const restored = await session.run('MATCH (g:Graph {id:$id,createdBy:$revoked}) SET g.createdBy=$owner RETURN g.id AS id', { id: graph.graphId, owner, revoked });
    expect(restored.records.map(record => record.get('id'))).toEqual([graph.graphId]);
    await gql(page, 'mutation($id:ID!){deleteEdges(where:{OR:[{source:{id:$id}},{target:{id:$id}}]}){nodesDeleted}}', { id: nodeId });
    await gql(page, 'mutation($id:ID!,$graph:ID!){deleteWorkItems(where:{id:$id,graph:{id:$graph}}){nodesDeleted}}', { id: nodeId, graph: graph.graphId });
    await page.getByRole('button', { name: 'Retry layout save' }).click();
    await expect(page.getByTestId('layout-save-status')).toContainText('The task position was not saved');
    expect((await readReceipt(page, graph.graphId, nodeId)).receipt).toBeDefined();
    expect((await gql(page, 'query($id:ID!){workItems(where:{id:$id}){id}}', { id: nodeId })).workItems).toEqual([]);
    await deleteGraphDeep(page, graph.graphId, { strict: true });
    await page.goto(new URL('/settings', getBaseURL()).href);
    await page.reload();
    const recovery = page.getByTestId(`layout-recovery-${graph.graphId}`);
    await expect(recovery).toContainText('Unavailable graph');
    await expect(recovery).toContainText('1 pending position');
    await recovery.getByRole('button', { name: 'Discard pending layout' }).click();
    await recovery.getByRole('button', { name: 'Confirm discard' }).click();
    await expect(recovery).toHaveCount(0);
    expect((await readReceipt(page, graph.graphId, nodeId)).receipt).toBeUndefined();
    expect((await gql(page, 'query($id:ID!){graphs(where:{id:$id}){id}}', { id: graph.graphId })).graphs).toEqual([]);
  } finally {
    await session.run('MATCH (g:Graph {id:$id,createdBy:$revoked}) SET g.createdBy=$owner', { id: graph.graphId, owner, revoked });
    await session.close();
    await driver.close();
  }
});

test('retry after real server acceptance only clears a failed local receipt @layout-recovery', async ({ page, ownedGraphIds }) => {
  test.setTimeout(90000);
  await login(page, TEST_USERS.ADMIN);
  const graph = await ownedGraphIds.seed({ size: 2, spacing: 600, edgeFactor: 0.5, namePrefix: 'Accepted receipt cleanup' });
  const nodeId = graph.nodeIds[0];
  await openGraph(page, graph.graphId);
  await page.evaluate(({ graphId, nodeId }) => {
    const original = IDBObjectStore.prototype.put;
    (window as any).__failOwnedCleanup = false;
    IDBObjectStore.prototype.put = function(value, ...args) {
      if ((window as any).__failOwnedCleanup && this.name === 'accounts' && !value?.layoutOutbox?.graphs?.[JSON.stringify(graphId)]?.[JSON.stringify(nodeId)]) throw new DOMException('Owned receipt cleanup failure', 'QuotaExceededError');
      return original.call(this, value, ...args);
    };
  }, { graphId: graph.graphId, nodeId });
  let sends = 0;
  await page.route('**/api/graphql', async route => {
    const body = route.request().method() === 'POST' ? route.request().postDataJSON() : null;
    if (body?.operationName !== 'UpdateWorkItems' || body?.variables?.where?.id !== nodeId || body?.variables?.where?.graph?.id !== graph.graphId || Object.keys(body?.variables?.update || {}).sort().join(',') !== 'positionX,positionY') { await route.continue(); return; }
    sends++;
    const response = await route.fetch();
    expect((await response.json()).data.updateWorkItems.workItems.map((item: {id: string}) => item.id)).toContain(nodeId);
    await page.evaluate(() => { (window as any).__failOwnedCleanup = true; });
    await route.fulfill({ response });
  });
  const dragged = await drag(page, nodeId);
  await expect(page.getByTestId('layout-save-status')).toContainText('The server accepted 1 layout change');
  await expect(page.getByRole('button', { name: 'Retry receipt cleanup' })).toBeEnabled();
  expect(rounded(await readSaved(page, graph.graphId, nodeId))).toEqual(rounded(dragged));
  const later = { x: dragged.x + 30, y: dragged.y + 30 };
  await gql(page, 'mutation($id:ID!,$graph:ID!,$x:Float!,$y:Float!){updateWorkItems(where:{id:$id,graph:{id:$graph}},update:{positionX:$x,positionY:$y}){workItems{id}}}', { id: nodeId, graph: graph.graphId, ...later });
  await page.evaluate(() => { (window as any).__failOwnedCleanup = false; });
  await page.getByRole('button', { name: 'Retry receipt cleanup' }).click();
  await expect(page.getByTestId('layout-save-status')).toHaveText('Layout saved to the server.');
  expect(sends).toBe(1);
  expect(rounded(await readSaved(page, graph.graphId, nodeId))).toEqual(rounded(later));
  expect((await readReceipt(page, graph.graphId, nodeId)).receipt).toBeUndefined();
});

test('unavailable storage and missing tab coordination remain explicit without false saved status @layout-recovery', async ({ page, ownedGraphIds }) => {
  test.setTimeout(90000);
  await login(page, TEST_USERS.ADMIN);
  const graph = await ownedGraphIds.seed({ size: 2, spacing: 600, edgeFactor: 0.5, namePrefix: 'Unavailable recovery capabilities' });
  const nodeId = graph.nodeIds[0];
  const initial = await readSaved(page, graph.graphId, nodeId);
  await page.addInitScript(() => {
    const original = IDBObjectStore.prototype.get;
    (window as any).__denyOwnedLayoutRead = true;
    IDBObjectStore.prototype.get = function(key) {
      if ((window as any).__denyOwnedLayoutRead && this.name === 'accounts') throw new DOMException('Owned storage read unavailable', 'SecurityError');
      return original.call(this, key);
    };
  });
  await page.evaluate(id => { localStorage.setItem('currentGraphId', id); localStorage.setItem('graphdone:viewMode', 'graph'); }, graph.graphId);
  await page.reload();
  await expect(page.getByTestId('layout-save-status')).toContainText('Layout recovery is unavailable');
  await expect(page.getByTestId('layout-save-status')).not.toContainText('Layout saved to the server');
  await expect(page.locator('.graph-container svg .node')).toHaveCount(0);
  await page.evaluate(() => { (window as any).__denyOwnedLayoutRead = false; });
  await page.getByRole('button', { name: 'Retry layout save' }).click();
  await expect(page.locator('.graph-container svg .node')).toHaveCount(2);
  await page.evaluate(() => Object.defineProperty(navigator, 'locks', { configurable: true, value: undefined }));
  await drag(page, nodeId);
  await expect(page.getByTestId('layout-save-status')).toContainText('cannot coordinate safe layout recovery between tabs');
  await expect(page.getByTestId('layout-save-status')).toContainText('1 saved on this device; 0 pending only in this tab');
  expect(await readSaved(page, graph.graphId, nodeId)).toEqual(initial);
  await page.getByRole('button', { name: 'Discard unsent layout' }).click();
  await expect(page.getByTestId('layout-save-status')).toHaveCount(0);
  expect((await readReceipt(page, graph.graphId, nodeId)).receipt).toBeUndefined();
});


test('pending layout keeps semantic overview labels fixed during pan and zoom @layout-recovery', async ({ page, ownedGraphIds }) => {
  test.setTimeout(120000);
  await login(page, TEST_USERS.ADMIN);
  const graph = await ownedGraphIds.seed({ size: 40, spacing: 600, batchSize: 20, namePrefix: 'Pending layout LOD', metadataForIndex: index => ({ lod: { groupPath: [`Subsystem ${index % 8}`] } }) });
  const nodeId = graph.nodeIds[24];
  await openGraph(page, graph.graphId, 40);
  await page.getByLabel('Graph detail', {exact: true}).selectOption('items');
  const svg = page.locator('.graph-container > svg');
  const initial = await readSaved(page, graph.graphId, nodeId);
  const zoom = async (scale: number) => {
    await page.evaluate(({position, scale}) => {
      (window as any).miniMapZoom(position.x, position.y, scale);
    }, {position: initial, scale});
    await expect.poll(() => svg.evaluate(element => (element as any).__zoom.k)).toBe(scale);
  };
  await zoom(1.2);
  const attempts: Array<{x: number; y: number}> = [];
  await page.route('**/api/graphql', failLayout(graph.graphId, nodeId, attempts));
  const latest = await drag(page, nodeId);
  await expect(page.getByTestId('layout-save-status')).toContainText('1 saved on this device; 0 pending only in this tab');
  await zoom(0.25);
  await page.getByLabel('Graph detail', {exact: true}).selectOption('overview');
  const cards = page.locator('[data-lod-group]');
  await expect.poll(() => cards.count()).toBeGreaterThan(1);
  const geometry = () => cards.evaluateAll(elements => elements.map(element => {
    const rect = element.getBoundingClientRect();
    return {id: element.getAttribute('data-lod-group'), x: rect.x, y: rect.y, w: rect.width, h: rect.height};
  }));
  const before = await geometry();
  const camera = () => svg.evaluate(element => { const transform = (element as any).__zoom; return { x: transform.x, y: transform.y, k: transform.k }; });
  const beforeCamera = await camera();
  const box = (await svg.boundingBox())!;
  const empty = await svg.evaluate(element => {
    const rect = element.getBoundingClientRect();
    for (const x of [0.8, 0.6, 0.4]) for (const y of [0.8, 0.65, 0.5]) {
      const point = { x: rect.x + rect.width * x, y: rect.y + rect.height * y };
      const hit = document.elementFromPoint(point.x, point.y);
      if (hit && element.contains(hit) && !hit.closest('[data-lod-group], [data-lod-controls]')) return point;
    }
    return null;
  });
  expect(empty, 'a visible SVG pan surface is available').not.toBeNull();
  await page.mouse.move(empty!.x, empty!.y);
  await page.mouse.down();
  await page.mouse.move(empty!.x + Math.min(90, box.width / 10), empty!.y - 35, {steps: 12});
  await page.mouse.up();
  await expect.poll(camera).not.toEqual(beforeCamera);
  expect(await geometry()).toEqual(before);
  const beforeWheel = await camera();
  await cards.first().hover();
  await page.mouse.wheel(0, -120);
  await expect.poll(async () => (await camera()).k).toBeGreaterThan(beforeWheel.k);
  expect(await geometry()).toEqual(before);
  expect(attempts).toHaveLength(1);
  expect(rounded((await readReceipt(page, graph.graphId, nodeId)).receipt)).toEqual(rounded(latest));
  expect(await readSaved(page, graph.graphId, nodeId)).toEqual(initial);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await expect.poll(() => page.evaluate(() => (window as any).__layoutMetrics?.()?.cameraReady)).toBe(true);
    const status = page.getByTestId('layout-save-status');
    const connections = page.locator('.semantic-overview').getByRole('button', { name: /relationships, .*not drawn:/ });
    const statusBox = (await status.boundingBox())!;
    const connectionBox = (await connections.boundingBox())!;
    expect(statusBox.y + statusBox.height).toBeLessThanOrEqual(connectionBox.y);
    await page.getByRole('button', { name: 'Retry layout save' }).click();
    await expect.poll(() => attempts.length).toBe(width === 1440 ? 2 : 3);
    expect(await readSaved(page, graph.graphId, nodeId)).toEqual(initial);
    await connections.click();
    await expect(page.getByRole('region', { name: 'Graph relationships' })).toBeVisible();
    await page.getByRole('button', { name: 'Back to groups', exact: true }).click();
    await page.getByRole('button', { name: 'Close group browser', exact: true }).click();
  }
  await page.getByRole('button', { name: 'Discard unsent layout' }).click();
  await expect(page.getByTestId('layout-save-status')).toHaveCount(0);
  expect((await readReceipt(page, graph.graphId, nodeId)).receipt).toBeUndefined();
});
