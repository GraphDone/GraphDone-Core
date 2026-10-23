import {buildAgentPrompt} from '@graphdone/core';
import { offlineEnabled, ownerId, getProject, localGuest, useOffline } from '../lib/offline/engine';
import { editAccount } from '../lib/offline/store';
import { cloudFailure, preserveCloudDraft, skipBackgroundPoll, hostedUsageEnabled, useHostedUsage, refreshHostedUsage } from '../lib/hostedUsage';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { getToken } from '../lib/authStorage';
import { useDialog } from '../hooks/useDialogManager';
import { useModalA11y } from '../hooks/useModalA11y';

export const agentBase = `${import.meta.env.VITE_API_URL || window.location.origin}/api/agent`;
export async function agentRequest(graphId: string, path: string, method = 'GET', body?: object) {
  if (offlineEnabled && ownerId() && (path === '/context' || path === '/notes')) {
    const s=await getProject(graphId);
    if(path==='/context')return {project:{id:graphId,name:s.project.name},items:s.nodes,notes:[...s.notes].sort((a,b)=>b.created_at.localeCompare(a.created_at)).map(n=>({id:n.id,body:n.body,actor:n.actor,actorType:n.actor_type,createdAt:n.created_at,workItemId:n.work_item_id}))};
    if(method==='POST') {
      const input=body as {body:string;workItemId?:string};
      if(!input.body?.trim()||input.body.length>4000)throw Error('Use a note of 1–4000 characters.');
      await editAccount(ownerId()!,a=>{if(a.projects[graphId].local!.notes.length>=2000)throw Error('This project has 2000 shared notes. Export a backup and start another project to continue.');a.projects[graphId].local!.notes.push({id:crypto.randomUUID(),body:input.body.trim(),work_item_id:input.workItemId||null,actor:'You',actor_id:ownerId(),actor_type:'human',created_at:new Date().toISOString()});});
      return {created:true};
    }
  }
  if(offlineEnabled && path==='/tokens' && (localGuest() || !navigator.onLine))throw Error('Sign in and connect to the internet to manage agent tokens. Notes are saved on this device.');
  try {
  const response = await fetch(`${agentBase}${path}?graphId=${encodeURIComponent(graphId)}`, {
    signal: AbortSignal.timeout(10000), method, headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('Agent connections are not available on this server yet.');
  const data = await response.json();
  if (!response.ok) { cloudFailure(data.code); throw new Error(data.error || 'Unable to connect'); }
  if(method!=='GET')void refreshHostedUsage(true);
  return data;
  } catch(error) { if (method !== 'GET' && (path === '/notes' || path === '/items')) preserveCloudDraft(`agent${path}`, {graphId,...body}); throw error; }
}
type Token = { id: string; name: string; scope: string; expiresAt: string; canShare?:boolean };
type Note = { id: string; actor: string; actorType: string; body: string; createdAt: string; workItemId: string };
export function AgentConnection({ graphId, graphName, onClose, embedded=false }: { graphId: string; graphName: string; onClose: () => void; embedded?:boolean }) {
  const {usage}=useHostedUsage();
  const {online}=useOffline();
  const tokenUnavailable=offlineEnabled && (localGuest() || !online);
  const ref = useRef<HTMLDivElement>(null);
  useDialog(!embedded, onClose);
  useModalA11y(ref, { isOpen: !embedded, label: 'Work with your agent' });
  const [tokens, setTokens] = useState<Token[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [items, setItems] = useState<{id: string; title: string}[]>([]);
  const [name, setName] = useState('My agent');
  const [scope, setScope] = useState('collaborate');
  const [allowSharing,setAllowSharing]=useState(false);
  const [secretAccess,setSecretAccess]=useState({scope:'collaborate',canShare:false});
  const [shares,setShares]=useState<{id:string;expires:number;redeemed:number;revoked:number}[]>([]);
  const [shareSecret,setShareSecret]=useState('');
  const [secret, setSecret] = useState('');
  const [note, setNote] = useState('');
  const [itemId, setItemId] = useState('');
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const refresh = async () => {
    if(offlineEnabled){const context=await agentRequest(graphId,'/context');setNotes(context.notes);setItems(context.items);setReady(true);}
    const [access, context] = await Promise.all([agentRequest(graphId, '/tokens').catch(e=>{if(!offlineEnabled)throw e;setError('Agent token management requires cloud access. You can still leave notes locally.');return {tokens:[]};}), agentRequest(graphId, '/context')]);
    setTokens(access.tokens); if(hostedUsageEnabled&&!tokenUnavailable){const sharing=await agentRequest(graphId,'/shares').catch(()=>{setError('Sharing links could not be loaded. Reconnect to review or revoke access.');return {shares:[]};});setShares(sharing.shares||[]);} setNotes(context.notes); setItems(context.items); setReady(true);
  };
  useEffect(() => { let alive = true; refresh().catch(e => { if (alive) setError(e.message); }); const timer = window.setInterval(() => { if (!skipBackgroundPoll()) void refresh().catch(() => {}); }, 60000); return () => { alive = false; clearInterval(timer); }; }, [graphId]);
  const act = async (work: () => Promise<void>) => { setBusy(true); setError(''); try { await work(); } catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong'); } finally { setBusy(false); } };
  const instructions = buildAgentPrompt({api:agentBase,projectId:graphId,token:secret,scope:secretAccess.scope,canShare:secretAccess.canShare});
  const field = 'w-full min-h-[44px] rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-gray-100';
  const panel=<div ref={ref} data-modal-panel={embedded?undefined:true} className={`w-full rounded-2xl border border-gray-600 bg-gray-800 p-5 text-gray-100 ${embedded?'':'max-w-xl shadow-2xl'}`}>
      <div className={`${embedded?'':'sticky -top-5 z-10 -mx-5 -mt-5 px-5 py-3 border-b border-gray-600'} mb-3 flex items-start justify-between gap-3 bg-gray-800`}><div><h2 className="text-xl font-semibold">Work with your agent</h2><p className="text-sm text-gray-300 break-words">{graphName}</p></div>{!embedded&&<button aria-label="Close agent connection" onClick={onClose} className="min-h-[44px] min-w-[44px] flex items-center justify-center"><X /></button>}</div>
      <p className="text-sm text-gray-300 my-3">Share priorities, progress, and notes. Your agent uses its own connection; you stay in control.</p>
      <details className="my-3 rounded-lg border border-gray-600 p-3 text-sm">
        <summary className="min-h-[44px] cursor-pointer font-medium">API access and agent limits</summary>
        <p className="mt-2 break-all">API: <code>{agentBase}</code></p>
        <p className="mt-2">Create a project access token below. It expires after 30 days and can be revoked here. These tokens connect your existing agent; GraphDone does not start an AI session or store a model-provider API key.</p>
        {hostedUsageEnabled?<><p className="mt-2">Up to 25 connections per project. Agent requests are limited to 60 per minute per IP. The hosted API entry limit is also 300 requests per minute per IP, shared with other API traffic. Agents share your account’s daily cloud allowance. Token lookups also share a 100-operation daily IP allowance with public access; several agents behind one IP share that limit. Avoid polling; read context when starting work and send meaningful progress updates. On HTTP 429, respect Retry-After.</p>{usage?.agents&&<p className="mt-2" data-testid="agent-activity-allowance">Autonomous activity: {usage.agents.used.requests} / {usage.agents.limit.requests} requests and {usage.agents.used.updates} / {usage.agents.limit.updates} updates today; {usage.agents.limit.perMinute} requests per minute. Shared across your projects and tokens. Agents can work while you are away. Reaching this limit pauses agents, not your own access.</p>}{usage&&<p className="mt-2" data-testid="agent-owner-allowance">Account database operations: {usage.used.operations.toLocaleString()} / {usage.limit.operations.toLocaleString()} today. One API call can use several operations. Resets {new Date(usage.resetAt).toLocaleString()}.</p>}</>:<p className="mt-2">Self-hosted Core has no managed daily cloud quota. Its agent API allows 120 requests per minute per IP; your server administrator may configure additional limits.</p>}
      </details>
      {error && <p role="alert" className="my-3 text-red-200">{error}</p>}
      {ready && <>
        <form className="space-y-3" onSubmit={e => { e.preventDefault(); void act(async () => { const created = await agentRequest(graphId, '/tokens', 'POST', { name, scope, allowSharing:allowSharing&&scope==='collaborate' }); setSecret(created.token);setSecretAccess({scope:created.scope,canShare:!!created.canShare}); setCopied(false); await refresh(); }); }}>
          <label className="block text-sm">Agent name<input className={field} value={name} maxLength={60} required onChange={e => setName(e.target.value)} /></label>
          <label className="block text-sm">Access<select aria-label="Access" className={field} value={scope} onChange={e => setScope(e.target.value)}><option value="collaborate">Collaborate — edit tasks and notes</option><option value="read">Read only — view tasks and notes</option></select></label>
          {hostedUsageEnabled&&<label className="flex min-h-[44px] items-center gap-2 text-sm"><input type="checkbox" checked={allowSharing&&scope==='collaborate'} disabled={scope!=='collaborate'} onChange={e=>setAllowSharing(e.target.checked)}/>Allow this agent to create read-only sharing links</label>}
          <button disabled={busy || !name.trim() || tokenUnavailable} className="min-h-[44px] rounded-lg bg-violet-600 px-4 py-2 disabled:opacity-50">Create agent token</button><p className="text-xs text-gray-300">{tokenUnavailable ? 'Sign in and reconnect to manage agent tokens. You can leave notes locally.' : 'This project only · expires in 30 days · revoke anytime'}</p>
        </form>
        {secret && <div className="mt-4 rounded-lg border border-emerald-400/50 p-3 space-y-2"><p className="font-medium">Connection ready. Copy it now.</p><p className="text-sm text-gray-300">The token is shown only here. Give these instructions privately to your agent.</p><textarea aria-label="Agent connection instructions" readOnly className={`${field} h-40 text-xs font-mono`} value={instructions}/><div className="flex flex-wrap gap-2"><button className="min-h-[44px] px-3 bg-emerald-900 rounded-lg" onClick={() => void act(async () => { await navigator.clipboard.writeText(instructions); setCopied(true); })}>{copied ? 'Copied' : 'Copy connection instructions'}</button><button className="min-h-[44px] px-3" onClick={() => setSecret('')}>Hide token</button></div></div>}
        <ul className="my-4 space-y-2" aria-label="Agent connections">{tokens.map(token => <li key={token.id} className="flex items-center justify-between gap-2 border-b border-gray-600 py-2"><div className="min-w-0 break-words"><strong>{token.name}</strong><p className="text-xs text-gray-300">{token.scope === 'read' ? 'Read only' : 'Collaboration'}{token.canShare?' · Can create sharing links':''} · expires {new Date(token.expiresAt).toLocaleDateString()}</p></div><button disabled={busy || tokenUnavailable} className="min-h-[44px] px-3 text-red-200 disabled:opacity-50" onClick={() => void act(async () => { await agentRequest(graphId, '/tokens', 'DELETE', { id: token.id }); setSecret(''); await refresh(); })}>Revoke<span className="sr-only"> {token.name}</span></button></li>)}</ul>
        {hostedUsageEnabled&&<details className="my-4 rounded-lg border border-gray-600 p-3 text-sm">
         <summary className="min-h-[44px] cursor-pointer font-medium">Read-only magic links</summary>
         <p className="my-2">Share current task summaries, priorities and shared notes. Each link opens once and grants read-only access for up to one hour. It can be revoked here.</p>
         <p className="my-2 text-xs text-gray-300">{usage?.sharing?`${usage.sharing.used.links} / ${usage.sharing.limit.links} links and ${usage.sharing.used.reads} / ${usage.sharing.limit.reads} shared reads used today.`:'10 links per account per day.'} Shared views have a separate 2,000-read daily owner allowance and 60 reads per minute; cached views use no D1 queries. Changes refresh the cache. Other cloud and shared-service limits still apply.</p>
         <button disabled={busy||tokenUnavailable} className="min-h-[44px] px-3 rounded-lg bg-violet-700 disabled:opacity-50" onClick={()=>void act(async()=>{const link=await agentRequest(graphId,'/shares','POST',{});setShareSecret(location.origin+'/share#'+link.token);await refresh();})}>Create read-only link</button>
         {shareSecret&&<div className="mt-2"><input aria-label="New read-only share link" readOnly value={shareSecret} className={field}/><button className="min-h-[44px] px-3" onClick={()=>void act(()=>navigator.clipboard.writeText(shareSecret))}>Copy share link</button><button className="min-h-[44px] px-3" onClick={()=>setShareSecret('')}>Hide share link</button></div>}
         <ul aria-label="Read-only shares" className="mt-3 space-y-2">{shares.filter(link=>!link.revoked).map(link=><li key={link.id} className="flex flex-wrap items-center justify-between gap-2"><span>{link.redeemed?'Opened':'Not yet opened'} · expires {new Date(link.expires).toLocaleTimeString()}</span><button className="min-h-[44px] px-3 text-red-200" disabled={busy} onClick={()=>void act(async()=>{await agentRequest(graphId,'/shares','DELETE',{id:link.id});setShareSecret('');await refresh();})}>Revoke link<span className="sr-only"> {link.id}</span></button></li>)}</ul>
        </details>}
        <h3 className="font-semibold">Shared notes</h3>
        <form className="space-y-2 mt-2" onSubmit={e => { e.preventDefault(); void act(async () => { await agentRequest(graphId, '/notes', 'POST', { body: note, ...(itemId ? {workItemId: itemId} : {}) }); setNote(''); await refresh(); }); }}>
          <label className="block text-sm">About<select aria-label="About" className={field} value={itemId} onChange={e => setItemId(e.target.value)}><option value="">Whole project</option>{items.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
          <textarea aria-label="Note for your agent" placeholder="A priority, question, or handoff for your agent…" className={field} maxLength={4000} required value={note} onChange={e => setNote(e.target.value)}/><button disabled={busy || !note.trim()} className="min-h-[44px] px-4 rounded-lg bg-violet-600 disabled:opacity-50">Leave note</button>
        </form>
        <ol className="mt-4 space-y-3" aria-label="Shared notes">{notes.map(n => <li key={n.id} className="rounded-lg bg-gray-900 p-3 break-words"><p className="text-xs text-emerald-200">{n.actor} · {n.actorType} · {new Date(n.createdAt).toLocaleString()}</p>{n.workItemId && <p className="text-xs text-gray-300">{items.find(i => i.id === n.workItemId)?.title || 'Work item'}</p>}<p className="whitespace-pre-wrap text-sm mt-1">{n.body}</p></li>)}</ol>{!notes.length && <p className="text-sm text-gray-300 mt-3">Leave the first note to give your agent context.</p>}
      </>}
    </div>;
  return embedded?panel:createPortal(<div data-modal-backdrop className="fixed inset-0 z-[1200] bg-black/60"><div className="modal-stage">{panel}</div></div>,document.body);
}
