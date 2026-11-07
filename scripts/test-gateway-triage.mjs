/** Explicit opt-in only. One small inference call against synthetic, loopback-only reports. */
import {readFile} from 'node:fs/promises';import {triage} from './graphdone-triage.mjs';
if(process.env.GRAPHDONE_GATEWAY_SMOKE!=='1')throw Error('Set GRAPHDONE_GATEWAY_SMOKE=1 to authorize one real gateway inference request.');
const {LLM_BASE_URL,LLM_API_KEY,LLM_MODEL}=process.env;if(!LLM_BASE_URL||!LLM_API_KEY||!LLM_MODEL)throw Error('Set LLM_BASE_URL, LLM_API_KEY and LLM_MODEL for your OpenAI-compatible gateway.');
const gateway=new URL(LLM_BASE_URL);if(gateway.protocol!=='https:')throw Error('The gateway must use HTTPS.');
const fixture=JSON.parse(await readFile('/tmp/graphdone-operations-fixture.json','utf8')),api='http://localhost:8799/api/ops';
const created=await fetch(api+'/tokens',{method:'POST',headers:{Authorization:'Bearer '+fixture.admin,'Content-Type':'application/json'},body:JSON.stringify({name:'Bounded gateway smoke',scope:'triage'})});if(!created.ok)throw Error('Start the isolated operations fixture first.');const token=await created.json();
try{const result=await triage({api,token:token.token,gateway:gateway.origin,key:LLM_API_KEY,model:LLM_MODEL,apply:true,output:'/tmp/graphdone-gateway-triage-result-final.json'});console.log(JSON.stringify({status:result.status,model:result.model,elapsedMs:result.elapsedMs,usage:result.usage,resolution:result.action?.resolution}));}
finally{await fetch(api+'/tokens',{method:'DELETE',headers:{Authorization:'Bearer '+fixture.admin,'Content-Type':'application/json'},body:JSON.stringify({id:token.id})});}
