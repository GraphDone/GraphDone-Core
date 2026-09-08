import {useEffect,useRef,useState} from 'react';
type Turnstile={render:(el:HTMLElement,options:Record<string,unknown>)=>string;remove:(id:string)=>void};
let scriptPromise:Promise<void>|undefined;
const api=()=> (window as unknown as {turnstile?:Turnstile}).turnstile;
function load(){
 if(api())return Promise.resolve();
 if(!scriptPromise)scriptPromise=new Promise<void>((resolve,reject)=>{
  const script=document.createElement('script');script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';script.async=true;
  script.onload=()=>resolve();script.onerror=()=>{script.remove();scriptPromise=undefined;reject(new Error('Verification unavailable'));};document.head.append(script);
 });
 return scriptPromise;
}
export function TurnstileChallenge({siteKey,onToken}:{siteKey:string;onToken:(token:string|null)=>void}){
 const container=useRef<HTMLDivElement>(null);const callback=useRef(onToken);callback.current=onToken;
 const [error,setError]=useState(false);const [attempt,setAttempt]=useState(0);
 useEffect(()=>{
  let cancelled=false;let id:string|undefined;setError(false);callback.current(null);
  load().then(()=>{
   if(cancelled||!container.current)return;
   id=api()?.render(container.current,{sitekey:siteKey,action:'guest',theme:'dark',size:'flexible',
    callback:(token:string)=>{setError(false);callback.current(token);},
    'expired-callback':()=>callback.current(null),
    'error-callback':()=>{callback.current(null);setError(true);},
   });
  }).catch(()=>{if(!cancelled)setError(true);});
  return()=>{cancelled=true;if(id)api()?.remove(id);};
 },[siteKey,attempt]);
 return <div><div ref={container}/>{error&&<div role="alert" className="text-sm text-amber-200">Verification could not load. <button className="min-h-[44px] underline" onClick={()=>setAttempt(n=>n+1)}>Try again</button></div>}</div>;
}
