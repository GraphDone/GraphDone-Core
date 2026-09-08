import { test, expect, vi } from 'vitest';
test('background refresh spends nothing when hidden, idle or near the quota, and resumes after reset',async()=>{
 vi.stubEnv('VITE_HOSTED_USAGE','true');vi.useFakeTimers();vi.setSystemTime(new Date('2026-09-08T12:00:00Z'));
 const visibility=Object.getOwnPropertyDescriptor(document,'hidden');
 Object.defineProperty(document,'hidden',{configurable:true,value:false});
 try {
  const {skipBackgroundPoll,refreshHostedUsage}=await import('./hostedUsage');
  expect(skipBackgroundPoll()).toBe(false);
  Object.defineProperty(document,'hidden',{configurable:true,value:true});expect(skipBackgroundPoll()).toBe(true);
  Object.defineProperty(document,'hidden',{configurable:true,value:false});
  vi.setSystemTime(Date.now()+61000);expect(skipBackgroundPoll()).toBe(true);
  window.dispatchEvent(new Event('pointerdown'));expect(skipBackgroundPoll()).toBe(false);
  localStorage.setItem('authToken','local-fixture');
  const state={hosted:true,used:{operations:320,reads:0,writes:0},limit:{operations:400,reads:180000,writes:3000},status:'AVAILABLE'};
  vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,json:async()=>state})));
  await refreshHostedUsage(true);expect(skipBackgroundPoll()).toBe(true);
  state.used.operations=0;await refreshHostedUsage(true);expect(skipBackgroundPoll()).toBe(false);
 } finally {
  localStorage.removeItem('authToken');vi.unstubAllGlobals();vi.unstubAllEnvs();vi.useRealTimers();
  if(visibility)Object.defineProperty(document,'hidden',visibility);else delete (document as any).hidden;
 }
});
