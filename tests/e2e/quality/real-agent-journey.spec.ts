import { test, expect } from '@playwright/test';
import { login, TEST_USERS } from '../../lib/auth';
import { gql } from '../../lib/graphRequest';
import { runAgent } from '../../agents/run-cli';
import { writeFile } from 'node:fs/promises';

// Explicit opt-in: normal QC never spends inference credits.
test.skip(process.env.QC_REAL_AGENTS !== '1', 'Set QC_REAL_AGENTS=1 for bounded real inference');
for (const provider of ['claude', 'codex'] as const) test(`${provider} understands the actual connection prompt @real-agents`, async ({ page, request }) => {
  test.setTimeout(240000);
  const url = new URL(process.env.TEST_URL || 'http://localhost:3127');
  expect(['localhost', '127.0.0.1']).toContain(url.hostname);
  expect(url.port).toBe('3127'); // Core local Neo4j only; never hosted D1 or Cloud preview.
  await page.setViewportSize({ width: 1440, height: 900 });
  await login(page, TEST_USERS.ADMIN);
  const owner = (await gql(page, '{me{id}}')).me.id;
  const graph = (await gql(page, 'mutation($input:[GraphCreateInput!]!){createGraphs(input:$input){graphs{id}}}', { input: [{ name: `Real ${provider} acceptance ${Date.now()}`, type: 'PROJECT', status: 'ACTIVE', createdBy: owner }] })).createGraphs.graphs[0].id;
  let tokenId = ''; let base = ''; let human = '';
  try {
    const items = (await gql(page, 'mutation($input:[WorkItemCreateInput!]!){createWorkItems(input:$input){workItems{id title}}}', { input: [
      { title: 'Draft the student project checklist', description: 'Write a short three-step checklist in a shared note for human review.', priority: 0.9, status: 'NOT_STARTED' },
      { title: 'Choose a cover color', description: 'Wait for the human to choose.', priority: 0.1, status: 'NOT_STARTED' },
    ].map(item => ({ ...item, type: 'TASK', graph: { connect: { where: { node: { id: graph } } } } })) })).createWorkItems.workItems;
    await page.evaluate(id => { localStorage.setItem('currentGraphId', id); localStorage.setItem('graphdone:viewMode', 'graph'); }, graph);
    await page.goto('/');
    await page.getByRole('button', { name: 'Your agent', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Work with your agent' });
    await dialog.getByLabel('Agent name').fill(`${provider} student helper`);
    await dialog.getByRole('button', { name: 'Create agent token' }).click();
    const instructions = await dialog.getByLabel('Agent connection instructions').inputValue();
    base = instructions.match(/Base URL: (\S+)/)![1];
    expect(new URL(base).hostname).toBe('localhost');
    expect(new URL(base).port).toBe('3127');
    const token = instructions.match(/Bearer (gd_agent_\S+)/)![1];
    human = await page.evaluate(() => localStorage.getItem('authToken')!);
    const call = (path: string, credential = token) => request.get(`${base}${path}?graphId=${graph}`, { headers: { Authorization: `Bearer ${credential}` } });
    tokenId = (await (await call('/tokens', human)).json()).tokens.find((t: any) => t.name === `${provider} student helper`).id;
    await dialog.getByLabel('Note for your agent').fill('Please help with the highest-priority unfinished task. Draft its requested checklist as a task note, mark it IN_REVIEW, and leave other tasks unchanged. I will review your work.');
    await dialog.getByRole('button', { name: 'Leave note', exact: true }).click();
    await expect(dialog.getByLabel('Shared notes', { exact: true })).toContainText('Please help with the highest-priority unfinished task.');
    await dialog.getByRole('button', { name: 'Hide token' }).click();
    const run = await runAgent(provider, `${instructions}\n\nYou are helping a student team. Read the human's shared note and carry out their request. Use your available tools to call only the local API above. Do not inspect files, use other services, or change application code. Report truthfully what you accomplished. Stop after completing this one handoff.`);
    await writeFile(`test-artifacts/quality/real-agent-${provider}.json`, JSON.stringify(run, null, 2), { mode: 0o600 });
    await test.info().attach('agent-run', { body: JSON.stringify(run, null, 2), contentType: 'application/json' });
    expect(run.exitCode, run.output.slice(-1500)).toBe(0);
    const context = await (await call('/context')).json();
    const target = items.find((i: any) => i.title.startsWith('Draft'));
    const other = items.find((i: any) => i.id !== target.id);
    expect(context.items.find((i: any) => i.id === target.id).status).toBe('IN_REVIEW');
    expect(context.items.find((i: any) => i.id === other.id).status).toBe('NOT_STARTED');
    const note = context.notes.find((n: any) => n.actorType === 'agent' && n.workItemId === target.id && !n.body.startsWith('Updated '));
    expect(note?.body.length).toBeGreaterThan(40);
    expect(JSON.stringify(context.notes)).not.toContain(token);
    await expect(dialog.getByLabel('Shared notes', { exact: true })).toContainText(note.body, { timeout: 20000 });
    await page.screenshot({ path: `test-artifacts/quality/real-agent-${provider}.png` });
    await dialog.getByRole('button', { name: `Revoke ${provider} student helper` }).click();
    await expect(dialog.getByLabel('Agent connections')).not.toContainText(`${provider} student helper`);
    expect((await call('/context')).status()).toBe(401);
  } finally {
    if (tokenId) await request.delete(`${base}/tokens?graphId=${graph}`, { headers: { Authorization: `Bearer ${human}` }, data: { id: tokenId } });
    await gql(page, 'mutation($id:ID!){deleteWorkItems(where:{graph:{id:$id}}){nodesDeleted}}', { id: graph });
    await gql(page, 'mutation($id:ID!){deleteGraphs(where:{id:$id}){nodesDeleted}}', { id: graph });
  }
});
