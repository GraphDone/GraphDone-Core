import {getToken} from './authStorage';
export const operationsURL=()=>`${import.meta.env.VITE_API_URL||location.origin}/api/ops`;
export async function operationsRequest(path:string,method='GET',body?:unknown) {
 const token=getToken();
 const r=await fetch(operationsURL()+path,{method,headers:{'Content-Type':'application/json',...(token&&token!=='local-guest'?{Authorization:'Bearer '+token}:{})},cache:'no-store',signal:AbortSignal.timeout(15000),...(body===undefined?{}:{body:JSON.stringify(body)})});
 const data=await r.json().catch(()=>({error:'The service is unavailable. Your draft is retained.'}));
 if(!r.ok)throw Error(data.error||data.message||'Unable to complete this request.');return data;
}
