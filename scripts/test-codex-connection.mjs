// Protocol-only probe: no thread, model turn, gateway request, or project access.
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
const child=spawn('codex',['app-server'],{stdio:['pipe','pipe','pipe']});
let buffer='';
try {
 await new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(Error('Codex initialization timed out')),15000);
  child.once('error',error=>{clearTimeout(timer);reject(error);});
  child.once('exit',code=>{clearTimeout(timer);reject(Error('Codex exited before initialization: '+code));});
  child.stdout.on('data',chunk=>{
   buffer+=chunk;let end;
   while((end=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,end);buffer=buffer.slice(end+1);let message;try{message=JSON.parse(line);}catch{continue;}
    if(message.id===1){clearTimeout(timer);if(message.error)reject(Error('Codex rejected initialization'));else{assert.ok(message.result);resolve(message.result);}}
   }
  });
  child.stdin.write(JSON.stringify({jsonrpc:'2.0',id:1,method:'initialize',params:{clientInfo:{name:'graphdone_protocol_qc',version:'1.0.0'},capabilities:{}}})+'\n');
 });
 child.stdin.write(JSON.stringify({jsonrpc:'2.0',method:'initialized'})+'\n');
 console.log('PASS Codex app-server initialization; no inference or agent session started');
}finally{child.kill('SIGTERM');}
