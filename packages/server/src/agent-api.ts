import { agentDiscovery } from '@graphdone/core';
import { Router } from 'express';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { driver } from './db.js';
import { extractUserFromToken } from './middleware/auth.js';
import { sqliteAuthStore } from './auth/sqlite-auth.js';

const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const statuses = ['NOT_STARTED','PROPOSED','PLANNED','IN_PROGRESS','IN_REVIEW','BLOCKED','ON_HOLD','COMPLETED','CANCELLED'];
const ownerMatch = 'MATCH (g:Graph {id:$graphId, createdBy:$ownerId})';
/** Separate from login/GraphQL: agent credentials never grant general account access. */
export const agentApi = Router();
agentApi.use(cors(), express.json({ limit: '16kb' }), rateLimit({ windowMs: 60000, limit: 120 }));
agentApi.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
agentApi.get('/discovery', (_req, res) => res.json(agentDiscovery(false)));
agentApi.all('*', async (req, res) => {
  const session = driver.session();
  try {
    const bearer = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1] || '';
    const isAgent = bearer.startsWith('gd_agent_');
    const graphId = typeof req.query.graphId === 'string' ? req.query.graphId : req.body?.graphId;
    if (typeof graphId !== 'string' || !graphId || graphId.length > 128) return res.status(400).json({ error: 'graphId is required' });
    let ownerId: string, actor: string, actorId: string, scope = 'collaborate';
    if (isAgent) {
      const found = await session.run(`MATCH (t:AgentAccess {digest:$digest, graphId:$graphId}) WHERE t.revokedAt IS NULL AND t.expiresAt > $now RETURN t`, { digest: hash(bearer), graphId, now: new Date().toISOString() });
      const token = found.records[0]?.get('t').properties;
      if (!token) return res.status(401).json({ error: 'Token expired, revoked, or invalid for this project' });
      ownerId = token.ownerId; actor = token.name; actorId = token.id; scope = token.scope;
    } else {
      const user = extractUserFromToken(req.headers.authorization);
      if (!user) return res.status(401).json({ error: 'Authentication required' });
      ownerId = user.userId; actorId = user.userId; actor = user.email;
    }
    const owner = await sqliteAuthStore.findUserById(ownerId);
    if (!owner?.isActive || owner.role === 'VIEWER') return res.status(403).json({ error: 'Active project owner required' });
    if (!isAgent) actor = owner.name;
    const params = { graphId, ownerId };
    const graph = await session.run(`${ownerMatch} RETURN g.name AS name`, params);
    if (!graph.records.length) return res.status(403).json({ error: 'Only projects you own can be connected' });

    if ((req.path === '/limits' || req.path === '/usage') && req.method === 'GET') return res.json({version:1,hosted:false,advisory:true,account:null,agent:null,sharing:null,actions:{canRead:true,canWrite:scope==='collaborate',next:scope==='collaborate'?'WORK':'READ_ONLY'},transport:{requestsPerMinutePerIp:120,remaining:null},constraints:{noteCharacters:4000,connectionsPerProject:25},note:'No managed daily quota. Remaining per-IP capacity is not measured here; your administrator may configure additional limits. Respect HTTP 429 and Retry-After.'});

    if (req.path === '/tokens') {
      if (isAgent) return res.status(403).json({ error: 'Only a human owner can manage connections' });
      if (req.method === 'GET') {
        const result = await session.run('MATCH (t:AgentAccess {ownerId:$ownerId, graphId:$graphId}) WHERE t.revokedAt IS NULL AND t.expiresAt > $now RETURN t { .id, .name, .scope, .createdAt, .expiresAt } AS token ORDER BY t.createdAt DESC LIMIT 25', { ...params, now: new Date().toISOString() });
        return res.json({ tokens: result.records.map(r => r.get('token')) });
      }
      if (req.method === 'POST') {
        const { name, scope: requestedScope } = req.body;
        if (typeof name !== 'string' || !name.trim() || name.length > 60 || !['read','collaborate'].includes(requestedScope)) return res.status(400).json({ error: 'Provide a name (1–60 characters) and read or collaborate scope' });
        const secret = `gd_agent_${randomBytes(32).toString('base64url')}`;
        const token = { id: randomUUID(), name: name.trim(), scope: requestedScope, createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 30 * 86400000).toISOString() };
        const created = await session.executeWrite(async tx => {
          // Serialize issuance for a project before checking the active limit.
          const locked = await tx.run(`${ownerMatch} SET g.agentAccessVersion=coalesce(g.agentAccessVersion,0)+1 RETURN g.id`, params);
          if (!locked.records.length) return false;
          const count = await tx.run('MATCH (t:AgentAccess {graphId:$graphId}) WHERE t.revokedAt IS NULL AND t.expiresAt > $now RETURN count(t) AS total', { ...params, now: token.createdAt });
          if (count.records[0].get('total').toNumber() >= 25) return false;
          await tx.run('CREATE (t:AgentAccess) SET t = $token', { token: { ...token, ...params, digest: hash(secret) } });
          return true;
        });
        if (!created) return res.status(409).json({ error: 'Revoke an existing connection before adding another (limit 25)' });
        return res.status(201).json({ ...token, token: secret });
      }
      if (req.method === 'DELETE' && typeof req.body.id === 'string') {
        await session.run('MATCH (t:AgentAccess {id:$id, ownerId:$ownerId, graphId:$graphId}) SET t.revokedAt=$now', { ...params, id: req.body.id, now: new Date().toISOString() });
        return res.json({ revoked: true });
      }
    }
    if (req.path === '/context' && req.method === 'GET') {
      const result = await session.run(`${ownerMatch} MATCH (w:WorkItem)-[:BELONGS_TO]->(g) RETURN w { .id, .title, .description, .status, .priority, .dueDate, .tags, .updatedAt } AS item ORDER BY w.priority DESC, w.id LIMIT 501`, params);
      const notes = await session.run('MATCH (n:CollaborationNote {graphId:$graphId}) RETURN n { .id, .workItemId, .body, .actor, .actorId, .actorType, .createdAt } AS note ORDER BY n.createdAt DESC LIMIT 100', params);
      return res.json({ project: { id: graphId, name: graph.records[0].get('name') }, scope, items: result.records.slice(0,500).map(r => r.get('item')), truncated: result.records.length > 500, notes: notes.records.map(r => r.get('note')), capabilities: { updateStatusAndPriority: scope === 'collaborate', leaveNotes: scope === 'collaborate', createTasks: scope === 'collaborate', deleteTasks: false }, statuses, priorityRange: [0,1] });
    }
    if (scope !== 'collaborate') return res.status(403).json({ error: 'This token is read-only' });
    if (req.path === '/notes' && req.method === 'POST') {
      const { body, workItemId } = req.body;
      if (typeof body !== 'string' || !body.trim() || body.length > 4000 || (workItemId !== undefined && typeof workItemId !== 'string')) return res.status(400).json({ error: 'A note must contain 1–4000 characters' });
      if (workItemId) {
        const item = await session.run(`${ownerMatch} MATCH (w:WorkItem {id:$workItemId})-[:BELONGS_TO]->(g) RETURN w.id`, { ...params, workItemId });
        if (!item.records.length) return res.status(404).json({ error: 'Work item not found in this project' });
      }
      const note = { id: randomUUID(), graphId, workItemId: workItemId || '', body: body.trim(), actor, actorId, actorType: isAgent ? 'agent' : 'human', createdAt: new Date().toISOString() };
      await session.executeWrite(async tx => { await tx.run('CREATE (n:CollaborationNote) SET n=$note', { note }); await tx.run('MATCH (n:CollaborationNote {graphId:$graphId}) WITH n ORDER BY n.createdAt DESC, n.id DESC SKIP 2000 DELETE n', params); });
      return res.status(201).json(note);
    }
    if (req.path === '/items' && req.method === 'POST') {
      const {id,title,description='',priority=.5,status='NOT_STARTED'}=req.body;
      if(typeof id!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(id)||typeof title!=='string'||!title.trim()||title.length>200||typeof description!=='string'||description.length>2000||typeof priority!=='number'||!Number.isFinite(priority)||priority<0||priority>1||!statuses.includes(status))return res.status(400).json({error:'Provide a lowercase UUID id, title (1–200), optional description (up to 2000), priority (0–1) and valid status'});
      const digest=hash(JSON.stringify([title.trim(),description,priority,status]));
      const outcome=await session.executeWrite(async tx=>{
        await tx.run(`${ownerMatch} SET g.agentAccessVersion=coalesce(g.agentAccessVersion,0)+1`,params);
        const existing=await tx.run('MATCH (w:WorkItem {id:$id}) OPTIONAL MATCH (w)-[:BELONGS_TO]->(g:Graph) RETURN w.agentCreationDigest AS digest,g.id AS graphId',{id});
        if(existing.records.length)return existing.records[0].get('graphId')===graphId&&existing.records[0].get('digest')===digest?'existing':'conflict';
        await tx.run(`${ownerMatch} CREATE (w:WorkItem {id:$id,type:'TASK',title:$title,description:$description,status:$status,priority:$priority,tags:[],metadata:$metadata,positionX:0.0,positionY:0.0,positionZ:0.0,createdAt:datetime(),updatedAt:datetime(),agentCreationDigest:$digest})-[:BELONGS_TO]->(g)`,{...params,id,title:title.trim(),description,status,priority,digest,metadata:JSON.stringify({createdByAgent:actorId})});return 'created';
      });
      if(outcome==='conflict')return res.status(409).json({error:'This task ID is already used. Existing work was not changed.'});
      return res.status(outcome==='created'?201:200).json({id,created:outcome==='created'});
    }
    if (req.path === '/items' && req.method === 'PATCH') {
      const { id, status, priority } = req.body;
      if (typeof id !== 'string' || (status === undefined && priority === undefined) || (status !== undefined && !statuses.includes(status)) || (priority !== undefined && (typeof priority !== 'number' || !Number.isFinite(priority) || priority < 0 || priority > 1))) return res.status(400).json({ error: 'Provide an item id and valid status or priority (0–1)' });
      const changes = { ...(status !== undefined ? { status } : {}), ...(priority !== undefined ? { priority } : {}) };
      const result = await session.executeWrite(async tx => {
        const updated = await tx.run(`${ownerMatch} MATCH (w:WorkItem {id:$id})-[:BELONGS_TO]->(g) SET w += $changes, w.updatedAt=datetime() RETURN w.id`, { ...params, id, changes });
        if (updated.records.length) await tx.run('CREATE (n:CollaborationNote) SET n=$note', { note: { id: randomUUID(), graphId, workItemId: id, body: `Updated ${Object.entries(changes).map(([key,value]) => `${key}: ${value}`).join(', ')}`, actor, actorId, actorType: isAgent ? 'agent' : 'human', createdAt: new Date().toISOString() } });
        await tx.run('MATCH (n:CollaborationNote {graphId:$graphId}) WITH n ORDER BY n.createdAt DESC, n.id DESC SKIP 2000 DELETE n', params);
        return updated.records.length;
      });
      return result ? res.json({ updated: true }) : res.status(404).json({ error: 'Work item not found in this project' });
    }
    return res.status(404).json({ error: 'Unknown agent operation' });
  } catch {
    return res.status(503).json({ error: 'Agent connection service unavailable' });
  } finally { await session.close(); }
});
