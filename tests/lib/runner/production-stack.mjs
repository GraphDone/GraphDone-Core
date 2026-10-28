import { request as httpsRequest } from 'node:https';
import { productionLoginProof } from '../production/auth-captcha.mjs';

export function assertHealthy(response) {
  if (response.status !== 200 || response.body?.status !== 'healthy'
    || response.body?.services?.graphql?.status !== 'healthy'
    || response.body?.services?.neo4j?.status !== 'healthy') {
    throw new Error(`Production API and Neo4j are not healthy (HTTP ${response.status}).`);
  }
  return { status: response.body.status, graphql: response.body.services.graphql.status,
    neo4j: response.body.services.neo4j.status, mcp: response.body.services.mcp?.status };
}

export function privateRequest(url, { method = 'GET', body, headers = {}, timeoutMs = 10_000 } = {}) {
  const target = new URL(url);
  if (target.protocol !== 'https:' || target.hostname !== '127.0.0.1' || !target.port
    || target.username || target.password) throw new Error('Production fixture requests require a loopback HTTPS target.');
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? undefined : JSON.stringify(body);
    const request = httpsRequest(target, { method, rejectUnauthorized: false,
      headers: { ...(payload && { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }), ...headers } }, response => {
      let text = '';
      response.setEncoding('utf8');
      response.on('data', chunk => {
        text += chunk;
        if (text.length > 1024 * 1024) request.destroy(new Error('Fixture response exceeded 1 MiB.'));
      });
      response.on('error', reject);
      response.on('end', () => {
        try { resolve({ status: response.statusCode, body: JSON.parse(text) }); }
        catch { reject(new Error(`Expected JSON from fixture endpoint (HTTP ${response.statusCode}).`)); }
      });
    });
    const timer = setTimeout(() => request.destroy(new Error('Fixture request timed out.')), timeoutMs);
    request.on('close', () => clearTimeout(timer));
    request.on('error', reject);
    request.end(payload);
  });
}

export function isolateCompose(input, { project, root, certDir }) {
  if (!/^graphdone-prod-test-[a-z0-9-]{8,80}$/.test(project)) throw new Error('Expected a unique production-test project name.');
  const config = structuredClone(input);
  const services = ['graphdone-api', 'graphdone-neo4j', 'graphdone-redis', 'graphdone-web'];
  if (JSON.stringify(Object.keys(config.services || {}).sort()) !== JSON.stringify(services)) throw new Error('Unexpected production Compose services.');
  config.name = project;
  for (const [key, volume] of Object.entries(config.volumes || {})) {
    if (volume?.external || volume?.driver_opts) throw new Error('Production tests refuse external or host-backed volumes.');
    config.volumes[key] = { ...volume, name: `${project}_${key}` };
  }
  for (const [key, network] of Object.entries(config.networks || {})) {
    if (network?.external) throw new Error('Production tests refuse external networks.');
    config.networks[key] = { ...network, name: `${project}_${key}` };
  }
  for (const [name, service] of Object.entries(config.services)) {
    delete service.container_name;
    delete service.ports;
    if (service.network_mode || service.privileged || service.devices || service.volumes_from || service.external_links) {
      throw new Error('Production tests refuse host/shared service resources.');
    }
    if (service.build) {
      service.build.context = root;
      service.image = `${project}-${name === 'graphdone-api' ? 'api' : 'web'}:test`;
    }
    service.volumes = (service.volumes || []).filter(volume => volume.target !== '/app/.env').map(volume => {
      if (volume.type === 'volume' && Object.hasOwn(config.volumes || {}, volume.source)) return volume;
      if (volume.type === 'bind') {
        const certs = { '/app/certs': certDir, '/etc/ssl/certs/server-cert.pem': `${certDir}/server-cert.pem`, '/etc/ssl/private/server-key.pem': `${certDir}/server-key.pem` };
        if (certs[volume.target]) return { ...volume, source: certs[volume.target], read_only: true };
      }
      throw new Error(`Unowned production test mount on ${name}.`);
    });
  }
  const api = config.services['graphdone-api'];
  if (!api.environment?.ADMIN_PASSWORD || !api.environment?.ADMIN_EMAIL) throw new Error('Compose must forward generated ADMIN_PASSWORD and ADMIN_EMAIL.');
  if (api.environment.NEO4J_URI !== 'bolt://graphdone-neo4j:7687') throw new Error('Production tests require their project-owned Neo4j.');
  const web = config.services['graphdone-web'];
  web.ports = [{ target: 3128, published: '0', host_ip: '127.0.0.1', protocol: 'tcp' }];
  web.build.args = { ...web.build.args, VITE_GRAPHQL_URL: '', VITE_GRAPHQL_WS_URL: '' };
  web.environment = { ...web.environment, VITE_GRAPHQL_URL: '', VITE_GRAPHQL_WS_URL: '' };
  return config;
}

export async function waitForProduction({ target, request, timeoutMs = 120_000, intervalMs = 2000, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)), now = Date.now }) {
  const started = now();
  let attempts = 0;
  let last;
  do {
    attempts++;
    try { return { ...assertHealthy(await request(`${target}/health`)), attempts }; }
    catch (error) { last = error; }
    if (now() - started >= timeoutMs) break;
    await sleep(intervalMs);
  } while (now() - started < timeoutMs);
  throw new Error(`Production readiness failed after ${attempts} attempts: ${last?.message}`);
}

export async function verifyOwnedFixture({ target, env, request }) {
  let token;
  let graphId;
  let nodeIds = [];
  const gql = async (query, variables = {}) => {
    const response = await request(`${target}/api/graphql`, { method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {}, body: { query, variables } });
    if (response.status !== 200 || response.body?.errors?.length || !response.body?.data) {
      throw new Error(`Owned GraphQL fixture operation failed (HTTP ${response.status}).`);
    }
    return response.body.data;
  };
  const login = await gql('mutation($input:LoginInput!){login(input:$input){token user{id username}}}',
    { input: { emailOrUsername: env.TEST_ADMIN_USERNAME, password: env.TEST_ADMIN_PASSWORD, captchaPayload: await productionLoginProof({ target, request }) } });
  token = login.login?.token;
  const owner = login.login?.user?.id;
  if (!token || !owner || login.login.user.username !== env.TEST_ADMIN_USERNAME) throw new Error('Generated production admin login failed.');
  const me = await gql('{me{id username}}');
  if (me.me?.id !== owner || me.me?.username !== env.TEST_ADMIN_USERNAME) throw new Error('Production login and me identities disagree.');
  const evidence = { owner, nodeIds: [], graphId: null, edgeCount: 0, cleanup: [] };
  try {
    const graphs = await gql('mutation($input:[GraphCreateInput!]!){createGraphs(input:$input){graphs{id}}}', {
      input: [{ name: '[E2E] Production readiness', type: 'PROJECT', status: 'ACTIVE', createdBy: owner, isShared: true }],
    });
    graphId = graphs.createGraphs?.graphs?.[0]?.id;
    if (!graphId || graphs.createGraphs.graphs.length !== 1) throw new Error('Production fixture graph was not created exactly once.');
    evidence.graphId = graphId;
    const items = await gql('mutation($input:[WorkItemCreateInput!]!){createWorkItems(input:$input){workItems{id}}}', {
      input: [0, 1].map(i => ({ type: 'TASK', title: `Production readiness ${i}`, status: 'NOT_STARTED', priority: 0.5,
        positionX: i * 240, positionY: 0, positionZ: 0,
        owner: { connect: { where: { node: { id: owner } } } }, graph: { connect: { where: { node: { id: graphId } } } } })),
    });
    nodeIds = items.createWorkItems?.workItems?.map(item => item.id) || [];
    if (nodeIds.length !== 2 || new Set(nodeIds).size !== 2 || nodeIds.some(id => !id)) throw new Error('Production fixture requires two saved tasks.');
    const edges = await gql('mutation($input:[EdgeCreateInput!]!){createEdges(input:$input){edges{id}}}', {
      input: [{ type: 'DEPENDS_ON', weight: 1, source: { connect: { where: { node: { id: nodeIds[0] } } } }, target: { connect: { where: { node: { id: nodeIds[1] } } } } }],
    });
    const edgeId = edges.createEdges?.edges?.[0]?.id;
    if (!edgeId || edges.createEdges.edges.length !== 1) throw new Error('Production fixture requires one saved edge.');
    const saved = await gql('query($id:ID!){workItems(where:{graph:{id:$id}}){id} edges(where:{source:{graph:{id:$id}}}){id source{id} target{id}}}', { id: graphId });
    if (JSON.stringify(saved.workItems?.map(item => item.id).sort()) !== JSON.stringify([...nodeIds].sort())
      || saved.edges?.length !== 1 || saved.edges[0].id !== edgeId
      || saved.edges[0].source?.id !== nodeIds[0] || saved.edges[0].target?.id !== nodeIds[1]) throw new Error('Saved production graph does not match its owned fixture.');
    evidence.nodeIds = nodeIds;
    evidence.edgeCount = 1;
    return evidence;
  } finally {
    if (graphId) {
      for (const [field, query, readback, key, expected] of [
        ['deleteEdges', 'mutation($id:ID!){deleteEdges(where:{source:{graph:{id:$id}}}){nodesDeleted}}', 'query($id:ID!){edges(where:{source:{graph:{id:$id}}}){id}}', 'edges', null],
        ['deleteWorkItems', 'mutation($id:ID!){deleteWorkItems(where:{graph:{id:$id}}){nodesDeleted}}', 'query($id:ID!){workItems(where:{graph:{id:$id}}){id}}', 'workItems', null],
        ['deleteGraphs', 'mutation($id:ID!){deleteGraphs(where:{id:$id}){nodesDeleted}}', 'query($id:ID!){graphs(where:{id:$id}){id}}', 'graphs', 1],
      ]) {
        const result = await gql(query, { id: graphId });
        const count = result[field]?.nodesDeleted;
        if (!Number.isSafeInteger(count) || count < 0 || (expected !== null && count !== expected)) throw new Error('Owned fixture cleanup was not confirmed.');
        const remaining = (await gql(readback, { id: graphId }))[key];
        if (!Array.isArray(remaining) || remaining.length) throw new Error(`Owned fixture ${key} remain after cleanup.`);
        evidence.cleanup.push({ field, nodesDeleted: count });
      }
    }
  }
}

export async function runProductionStages({ command, composeArgs, env, getTarget, readiness, fixture, recreate, smoke, persistence }) {
  await command('build', 'docker', [...composeArgs, 'build'], { env, timeoutMs: 60 * 60_000 });
  await command('start', 'docker', [...composeArgs, 'up', '--detach', '--wait', '--wait-timeout', '600', '--no-build'], { env, timeoutMs: 11 * 60_000 });
  const target = await getTarget();
  const health = await readiness(target);
  const ownedFixture = await fixture(target);
  const recreation = await recreate(target);
  await smoke(target);
  await persistence();
  return { target, health, ownedFixture, recreation };
}
