import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { setTimeout as delay } from 'node:timers/promises';

const root = process.env.GRAPHDONE_IMAGE_ROOT || '/app';
const uri = process.env.NEO4J_URI;
assert.equal(process.env.GRAPHDONE_DISPOSABLE_NEO4J, '1');
assert.ok(uri && ['127.0.0.1', 'localhost', '[::1]'].includes(new URL(uri).hostname));
assert.ok(process.env.NEO4J_USER && process.env.NEO4J_PASSWORD && process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD);
const cwd = `${root}/packages/server`;
const require = createRequire(`${cwd}/package.json`);
const neo4j = require('neo4j-driver');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');
const driver = neo4j.driver(uri, neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD), { connectionTimeout: 5000, maxTransactionRetryTime: 1000 });
const childEnv = { ...process.env, NODE_ENV: 'production', PORT: process.env.GRAPHDONE_IMAGE_TEST_PORT || '28767', MCP_HEALTH_PORT: '0', CI: 'true' };
for (const invalid of [{ JWT_SECRET: '', SESSION_SECRET: '' }, { JWT_SECRET: 'your-dev-secret-key' }]) {
  const result = spawnSync(process.execPath, ['dist/index.js'], { cwd, env: { ...childEnv, ...invalid }, encoding: 'utf8', timeout: 10000, maxBuffer: 1024 * 1024 });
  assert.ifError(result.error);
  assert.notEqual(result.status, 0);
  assert.match(result.stdout + result.stderr, /Invalid production secrets: JWT_SECRET/);
}
const server = spawn(process.execPath, ['dist/index.js'], { cwd, env: childEnv, stdio: ['ignore', 'pipe', 'pipe'] });
let diagnostics = '';
for (const stream of [server.stdout, server.stderr]) stream.on('data', chunk => { diagnostics += chunk.toString().slice(0, Math.max(0, 32000 - diagnostics.length)); });
const endpoint = `http://127.0.0.1:${childEnv.PORT}`;
let token = '';
let graphId;
let transport;
let client;
const protocolErrors = [];
async function request(query, variables) {
  const response = await fetch(`${endpoint}/graphql`, { method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ query, variables }), signal: AbortSignal.timeout(20000) });
  assert.equal(response.status, 200);
  return response.json();
}
async function gql(query, variables) {
  const body = await request(query, variables);
  assert.equal(body.errors, undefined, 'GraphQL operation failed');
  return body.data;
}
try {
  await driver.verifyConnectivity();
  let health;
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    assert.equal(server.exitCode, null, 'Compiled API exited during startup');
    try {
      const response = await fetch(`${endpoint}/health`, { signal: AbortSignal.timeout(2000) });
      if (response.ok) { health = await response.json(); break; }
    } catch {}
    await delay(200);
  }
  assert.ok(health, 'Compiled API did not become ready');
  assert.equal(health.services.graphql.status, 'healthy');
  assert.equal(health.services.neo4j.status, 'healthy');
  assert.equal(diagnostics.includes('Default admin setup completed'), false, 'Startup hid a missing shell dependency');
  const loginQuery = 'mutation($input:LoginInput!){login(input:$input){token user{id role}}}';
  const input = { emailOrUsername: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD };
  const denied = await request(loginQuery, { input });
  assert.equal(denied.errors?.[0]?.extensions.code, 'CAPTCHA_FAILED');
  const challengeResponse = await fetch(`${endpoint}/api/captcha/challenge?action=login`, { signal: AbortSignal.timeout(5000) });
  assert.equal(challengeResponse.status, 200);
  const challenge = await challengeResponse.json();
  assert.equal(challenge.algorithm, 'SHA-256');
  assert.equal(challenge.maxnumber, 100000);
  let captchaPayload;
  for (let number = 0; number <= challenge.maxnumber; number++) {
    if (createHash('sha256').update(challenge.salt + number).digest('hex') === challenge.challenge) {
      captchaPayload = Buffer.from(JSON.stringify({ ...challenge, number })).toString('base64');
      break;
    }
  }
  assert.ok(captchaPayload, 'Owned challenge was not solved');
  const loggedIn = await gql(loginQuery, { input: { ...input, captchaPayload } });
  token = loggedIn.login.token;
  assert.equal(loggedIn.login.user.role, 'ADMIN');
  const statePath = `${cwd}/data/image-contract-state.json`;
  if (process.env.GRAPHDONE_REQUIRE_RECOVERY === '1') assert.ok(existsSync(statePath), 'Owned volume recovery marker is missing');
  if (existsSync(statePath)) assert.equal(JSON.parse(readFileSync(statePath, 'utf8')).userId, loggedIn.login.user.id, 'SQLite account did not survive container replacement');
  else writeFileSync(statePath, JSON.stringify({ userId: loggedIn.login.user.id }), { mode: 0o600, flag: 'wx' });
  const replay = await request(loginQuery, { input: { ...input, captchaPayload } });
  assert.equal(replay.errors?.[0]?.extensions.code, 'CAPTCHA_FAILED');
  const me = await gql('{me{id}}');
  assert.equal(me.me.id, loggedIn.login.user.id);
  const graph = await gql('mutation($input:[GraphCreateInput!]!){createGraphs(input:$input){graphs{id}}}', { input: [{ name: `Owned image contract ${randomUUID()}`, type: 'PROJECT', status: 'ACTIVE', createdBy: me.me.id, isShared: true }] });
  graphId = graph.createGraphs.graphs[0].id;
  transport = new StdioClientTransport({ command: process.execPath, args: [`${root}/packages/mcp-server/dist/index.js`], cwd: `${root}/packages/mcp-server`, env: childEnv, stderr: 'pipe' });
  transport.stderr?.on('data', () => {});
  client = new Client({ name: 'graphdone-image-contract', version: '1.0.0' }, { capabilities: {} });
  client.onerror = error => protocolErrors.push(error.message);
  const options = { timeout: 10000, maxTotalTimeout: 10000 };
  await client.connect(transport, options);
  const listed = await client.listTools(undefined, options);
  assert.ok(listed.tools.some(tool => tool.name === 'create_node'));
  const created = await client.callTool({ name: 'create_node', arguments: { title: 'Owned compiled image item', type: 'TASK', graph_id: graphId } }, undefined, options);
  assert.notEqual(created.isError, true);
  const nodeId = JSON.parse(created.content[0].text).node.id;
  assert.ok(nodeId);
  const visible = await gql('query($id:ID!){workItems(where:{id:$id}){id title}}', { id: nodeId });
  assert.deepEqual(visible.workItems, [{ id: nodeId, title: 'Owned compiled image item' }]);
  await gql('mutation($id:ID!){updateWorkItems(where:{id:$id},update:{title:"Updated by compiled API"}){workItems{id}}}', { id: nodeId });
  const read = await client.callTool({ name: 'get_node_details', arguments: { node_id: nodeId } }, undefined, options);
  assert.equal(JSON.parse(read.content[0].text).node.title, 'Updated by compiled API');
  const unknown = await client.callTool({ name: 'owned_unknown_tool', arguments: {} }, undefined, options);
  assert.equal(unknown.isError, true);
  const recovered = await client.callTool({ name: 'get_graph_details', arguments: { graphId } }, undefined, options);
  assert.equal(JSON.parse(recovered.content[0].text).graph.nodeCount, 1);
  const session = driver.session();
  try {
    const persisted = await session.run('MATCH (w:WorkItem {id:$id})-[:BELONGS_TO]->(g:Graph {id:$graphId}) RETURN w.title AS title', { id: nodeId, graphId });
    assert.deepEqual(persisted.records.map(record => record.get('title')), ['Updated by compiled API']);
  } finally { await session.close(); }
  assert.deepEqual(protocolErrors, []);
  console.log(JSON.stringify({ secretRejection: 'passed', api: 'passed', captcha: 'passed', compiledMcpStdio: 'passed', independentNeo4jReadback: 'passed' }));
} finally {
  try {
    try { await client?.close(); } finally { await transport?.close(); }
    if (server.exitCode === null) {
      const exited = new Promise(resolve => server.once('exit', resolve));
      server.kill('SIGTERM');
      const stopped = await Promise.race([exited.then(() => true), delay(5000).then(() => false)]);
      if (!stopped) server.kill('SIGKILL');
      assert.equal(stopped, true, 'Owned compiled API did not stop');
    }
  } finally {
    try {
      if (graphId) {
        const session = driver.session();
        try {
          await session.run('MATCH (g:Graph {id:$graphId})<-[:BELONGS_TO]-(w:WorkItem) OPTIONAL MATCH (w)<-[:EDGE_SOURCE|EDGE_TARGET]-(e:Edge) DETACH DELETE e', { graphId });
          await session.run('MATCH (g:Graph {id:$graphId}) OPTIONAL MATCH (g)<-[:BELONGS_TO]-(w:WorkItem) DETACH DELETE w,g', { graphId });
          const remaining = await session.run('MATCH (g:Graph {id:$graphId}) RETURN count(g) AS count', { graphId });
          assert.equal(remaining.records[0].get('count').toNumber(), 0);
        } finally { await session.close(); }
      }
    } finally { await driver.close(); }
  }
}
