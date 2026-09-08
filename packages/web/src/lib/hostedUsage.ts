import { useSyncExternalStore } from 'react';
import { getToken, getUserRaw } from './authStorage';
export const hostedUsageEnabled = import.meta.env.VITE_HOSTED_USAGE === 'true';
type Meter = { operations: number; reads: number; writes: number };
export type HostedUsage = { used: Meter; limit: Meter; status: string; resetAt: string; rolloutOperations?: number; allocationShares: number; kind: string; limits: {projectsPerAccount?: number; tasksPerProject: number; linksPerProject: number} };
let snapshot: { usage: HostedUsage | null; error: string; drafts: number } = { usage: null, error: '', drafts: 0 };
const listeners = new Set<() => void>();
let pending = false;
let lastFetch = 0;
let lastToken: string | null = null;
function publish(next: typeof snapshot) { snapshot = next; listeners.forEach(fn => fn()); }
export function useHostedUsage() { return useSyncExternalStore(fn => { listeners.add(fn); return () => { listeners.delete(fn); }; }, () => snapshot); }
export function usageFraction(usage: HostedUsage | null) { return usage ? Math.max(...(['operations','reads','writes'] as const).map(key => usage.used[key] / Math.max(1,usage.limit[key]))) : 0; }
export async function refreshHostedUsage(force = false) {
  if (!hostedUsageEnabled) return;
  const token = getToken();
  if (token !== lastToken) { lastToken = token; lastFetch = 0; publish({ usage: null, error: '', drafts: readDrafts().length }); }
  if (token === 'local-guest') return;
  if (!token || pending || (!force && Date.now() - lastFetch < 15000)) return;
  pending = true; lastFetch = Date.now();
  try {
    const response = await fetch(`${import.meta.env.VITE_API_URL || window.location.origin}/api/usage`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw Error('Usage is temporarily unavailable. Cloud saves may be paused.');
    const usage = await response.json();
    if (!usage.hosted || !usage.limit || !usage.used) throw Error('Usage is temporarily unavailable.');
    if (getToken() === token) publish({ usage, error: '', drafts: readDrafts().length });
  } catch (error) { if (getToken() === token) publish({ ...snapshot, error: error instanceof Error ? error.message : 'Usage unavailable' }); }
  finally { pending = false; }
}
export function cloudFailure(code?: string) {
  if (!hostedUsageEnabled || !['PERSONAL_LIMIT','SHARED_LIMIT','USAGE_UNAVAILABLE'].includes(code || '')) return;
  if (snapshot.usage) publish({ ...snapshot, usage: { ...snapshot.usage, status: code! } });
  void refreshHostedUsage(true);
}
function draftKey() {
  let id = 'anonymous';
  try { id = JSON.parse(getUserRaw() || '{}').id || id; } catch { /* no cached user */ }
  return `graphdone:unsent:${id}`;
}
function readDrafts(): any[] { try { return JSON.parse(sessionStorage.getItem(draftKey()) || '[]'); } catch { return []; } }
export function preserveCloudDraft(operation: string, variables: unknown) {
  if (!hostedUsageEnabled) return;
  const drafts = readDrafts();
  const value = JSON.stringify({operation, variables});
  if (!drafts.some(d => JSON.stringify({operation:d.operation,variables:d.variables}) === value)) drafts.push({operation,variables,recordedAt:new Date().toISOString()});
  try { sessionStorage.setItem(draftKey(),JSON.stringify(drafts.slice(-20))); publish({...snapshot,drafts:Math.min(20,drafts.length)}); }
  catch { publish({...snapshot,error:'This browser could not keep a recovery copy. Copy your text before closing.'}); }
}
export function downloadCloudDrafts() {
  const blob = new Blob([JSON.stringify({notice:'Unconfirmed changes. Check the project before reapplying; a request may have partially succeeded.',drafts:readDrafts()},null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob), link=document.createElement('a'); link.href=url;link.download='graphdone-unconfirmed-changes.json';document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);
}
// Queries only refresh while someone is using the app. Mutations still refetch
// immediately. Stop background spending at the first allowance warning.
let lastActivity = Date.now();
for (const event of ['pointerdown','keydown','pointermove']) window.addEventListener(event,()=>{lastActivity=Date.now();},{passive:true});
export function skipBackgroundPoll() { return document.hidden || Date.now()-lastActivity>60000 || (hostedUsageEnabled && (usageFraction(snapshot.usage)>=.8 || (!!snapshot.usage && snapshot.usage.status!=='AVAILABLE'))); }

window.addEventListener('online',()=>{void refreshHostedUsage(true);});
