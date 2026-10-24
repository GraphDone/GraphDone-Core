/** Explicit opt-in only. One small inference call against synthetic, loopback-only reports. */
import {readFile} from 'node:fs/promises';import {homedir} from 'node:os';import {join} from 'node:path';import {triage} from './graphdone-triage.mjs';
if(process.env.GRAPHDONE_GATEWAY_SMOKE!=='1')throw Error('Set GRAPHDONE_GATEWAY_SMOKE=1 to authorize one real gateway inference request.');
const env=Object.fromEntries((await readFile(join(homedir(),'.config/graphlings/gateway.env'),'utf8')).split('\n').filter(l=>l.includes('=')&&!l.trim().startsWith('#')).map(l=>{const [k,...v]=l.replace(/^export /,'').split('=');return [k.trim(),v.join('=').trim().replace(/^['"]|['"]$/g,'')];}));
const gateway=new URL(env.GRAPHLING_GATEWAY_URL);if(gateway.hostname!=='gateway.graphlings.net')throw Error('Unexpected gateway host');
const fixture=JSON.parse(await readFile('/tmp/graphdone-operations-fixture.json','utf8')),api='http://localhost:8799/api/ops';
const created=await fetch(api+'/tokens',{method:'POST',headers:{Authorization:'Bearer '+fixture.admin,'Content-Type':'application/json'},body:JSON.stringify({name:'Bounded gateway smoke',scope:'triage'})});if(!created.ok)throw Error('Start the isolated operations fixture first.');const token=await created.json();
try{const result=await triage({api,token:token.token,gateway:gateway.origin,key:env.GRAPHLING_GATEWAY_KEY,model:'graphling-small',apply:true,output:'/tmp/graphdone-gateway-triage-result-final.json'});console.log(JSON.stringify({status:result.status,model:result.model,elapsedMs:result.elapsedMs,usage:result.usage,resolution:result.action?.resolution}));}
finally{await fetch(api+'/tokens',{method:'DELETE',headers:{Authorization:'Bearer '+fixture.admin,'Content-Type':'application/json'},body:JSON.stringify({id:token.id})});}
